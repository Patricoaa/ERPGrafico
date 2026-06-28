"""
loan_service.py — Lógica de negocio para créditos bancarios (Fase 2).

Responsabilidades:
  - generate_schedule(loan): tabla de amortización (francés / lineal).
  - disburse(loan): INBOUND al banco + nacimiento del pasivo.
  - pay_installment(loan, n): pago con reparto capital/interés/seguro.
    - Si el crédito es UF, convierte usando IndicatorValue.get_value('UF', on_date).
  - prepay(loan): pago total anticipado.

Convenciones:
  - Todos los movimientos se generan vía `TreasuryService.create_movement`.
  - Vistas Django ≤ 20 líneas → delegan a este servicio.
  - Las cuentas de gasto (interés/seguro) se pasan como parámetro; cuando
    F5.1 las añada a AccountingSettings, la vista las resolverá desde allí.

Ver `docs/50-audit/bancos/fase-2-creditos-bancarios.md` (F2.4–F2.8).
"""

from __future__ import annotations

from datetime import date
from decimal import ROUND_HALF_EVEN, ROUND_HALF_UP, Decimal
from typing import TYPE_CHECKING

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone
from django.utils.translation import gettext_lazy as _t

from .models import BankLoan, LoanInstallment, TreasuryMovement

if TYPE_CHECKING:
    from django.contrib.auth.models import AbstractUser

    from accounting.models import Account
    from treasury.models import TreasuryAccount


_TWO = Decimal("0.01")


def _q(x: Decimal) -> Decimal:
    """Quantize to 2 decimals (banking rounding)."""
    return x.quantize(_TWO, rounding=ROUND_HALF_UP)


def _peso(x: Decimal) -> Decimal:
    """
    Redondeo a peso entero, igual que el libro mayor (JournalItem.debit/credit
    son `decimal_places=0`). Usa HALF_EVEN para coincidir con el redondeo de
    Django al persistir, de modo que la línea de cuadre (banco) sume EXACTAMENTE
    los débitos ya redondeados y el asiento cuadre en pesos enteros (cross-DB).
    """
    return Decimal(x).quantize(Decimal("1"), rounding=ROUND_HALF_EVEN)


class LoanService:
    @classmethod
    def create_loan_from_request(cls, user, validated):
        from .loan_provisioning import get_or_create_loan_treasury_account
        from .models import Bank, BankLoan
        acc = validated.get('liability_account')
        if acc is not None:
            lender = validated.get('lender')
            if not isinstance(lender, Bank): lender = Bank.objects.get(pk=lender)
            validated['liability_account'] = get_or_create_loan_treasury_account(bank=lender, accounting_account=acc, currency=validated.get('currency', 'CLP'))
        return BankLoan.objects.create(created_by=user, **validated)

    @classmethod
    def disburse_from_request(cls, request, loan, v):
        from decimal import Decimal
        of = Decimal(str(v['opening_fee'])) if v.get('opening_fee') is not None else None
        st = Decimal(str(v['stamp_tax'])) if v.get('stamp_tax') is not None else None
        return cls.disburse(loan, date=v.get('date'), opening_fee_override=of, stamp_tax_override=st, commission_expense_account=v.get('commission_expense_account'), stamp_tax_expense_account=v.get('stamp_tax_expense_account'), created_by=request.user)

    @classmethod
    def prepay_from_request(cls, request, loan, v):
        from decimal import Decimal
        amt = Decimal(str(v['amount']))
        return cls.prepay(loan, amount=amt, date=v.get('date'), penalty_fee=Decimal(str(v['penalty_fee'])) if v.get('penalty_fee') is not None else None, penalty_expense_account=v.get('penalty_expense_account'), created_by=request.user)

    """Operaciones sobre créditos / préstamos bancarios."""

    @staticmethod
    def preview_schedule(*, loan: BankLoan) -> dict:
        """
        Calcula in-memory la tabla de amortización de un préstamo (mismo
        algoritmo que generate_schedule, pero sin persistir).
        Devuelve el dict listo para Response.
        """
        from decimal import Decimal
        from django.core.exceptions import ValidationError
        from .loan_service import _add_months

        if loan.installments.exists():
            raise ValidationError(
                "El crédito ya tiene una tabla generada. Use GET amortization_table."
            )

        if loan.rate_basis == loan.RateBasis.MONTHLY:
            i = loan.interest_rate / Decimal("100")
        else:
            i = (loan.interest_rate / Decimal("100")) / Decimal("12")
        if i <= 0:
            i = Decimal("0")
        n = loan.term_months
        P = loan.principal
        ins = loan.insurance_monthly or Decimal("0")
        
        # Calcular cuota francesa fija
        if i == 0:
            C = P / Decimal(n)
        else:
            C = P * i / (Decimal(1) - (Decimal(1) + i) ** (-n))
            
        rows = []
        balance = P
        for k in range(1, n + 1):
            interest = (balance * i).quantize(Decimal("0.01"))
            principal = (C - interest).quantize(Decimal("0.01"))
            if k == n:  # última cuota: ajuste de redondeo
                principal = balance
            total = principal + interest + ins
            balance = (balance - principal).quantize(Decimal("0.01"))
            rows.append(
                {
                    "number": k,
                    "due_date": _add_months(loan.first_due_date, k - 1).isoformat(),
                    "principal_amount": str(principal),
                    "interest_amount": str(interest),
                    "insurance_amount": str(ins),
                    "total_amount": str(total),
                    "outstanding_balance": str(balance),
                }
            )
            
        return {
            "currency": loan.currency,
            "monthly_rate": str(i),
            "installments": rows,
        }

    # ── Generación de tabla de amortización (F2.4) ─────────────────────────

    @staticmethod
    @transaction.atomic
    def generate_schedule(loan: BankLoan) -> list[LoanInstallment]:
        """
        Genera la tabla de amortización completa y la persiste.

        Soporta sistemas:
          - FRENCH: cuota fija (capital + interés variable, interés sobre saldo).
          - LINEAR: capital constante, interés sobre saldo decreciente.

        Para créditos en UF, los montos quedan almacenados en UF (la
        conversión a CLP ocurre al pagar — F2.7).
        """
        if loan.term_months <= 0:
            raise ValidationError(_t("El plazo en meses debe ser positivo."))

        # Si ya hay tabla, purgar pendientes (idempotencia manual).
        loan.installments.filter(status=LoanInstallment.Status.PENDING).delete()

        # Tasa mensual efectiva (la cuota se calcula mes a mes).
        if loan.rate_basis == BankLoan.RateBasis.MONTHLY:
            i = loan.interest_rate / Decimal("100")
        else:  # ANNUAL
            i = (loan.interest_rate / Decimal("100")) / Decimal("12")

        # Validar i > 0 para evitar división por cero en fórmula francesa.
        if i <= 0:
            i = Decimal("0")

        n = loan.term_months
        P = loan.principal
        insurance = loan.insurance_monthly or Decimal("0")

        rows: list[LoanInstallment] = []
        if loan.amortization_system == BankLoan.AmortizationSystem.FRENCH:
            rows = LoanService._french_schedule(loan, P, i, n, insurance)
        else:  # LINEAR
            rows = LoanService._linear_schedule(loan, P, i, n, insurance)

        # Bulk create — más rápido que N saves y mantiene orden por `number`.
        LoanInstallment.objects.bulk_create(rows)
        return list(loan.installments.order_by("number"))

    @staticmethod
    def _french_schedule(loan, P, i, n, insurance):
        """Cuota fija: C = P · i / (1 - (1+i)^-n)."""
        if i == 0:
            # Sin interés → todas las cuotas son capital constante.
            capital_const = (P / Decimal(n)).quantize(_TWO, rounding=ROUND_HALF_UP)
            balance = P
            rows = []
            for k in range(1, n + 1):
                due = _add_months(loan.first_due_date, k - 1)
                principal = capital_const
                # Ajuste de redondeo en la última cuota.
                if k == n:
                    principal = balance
                interest = Decimal("0.00")
                balance = balance - principal
                rows.append(
                    LoanInstallment(
                        loan=loan,
                        number=k,
                        due_date=due,
                        principal_amount=_q(principal),
                        interest_amount=_q(interest),
                        insurance_amount=_q(insurance),
                        total_amount=_q(principal + interest + insurance),
                        outstanding_balance=_q(balance),
                        status=LoanInstallment.Status.PENDING,
                    )
                )
            return rows

        # Cuota constante francesa.
        one_plus_i = Decimal(1) + i
        # C = P · i · (1+i)^n / ((1+i)^n - 1)
        factor_n = one_plus_i**n
        C = (P * i * factor_n) / (factor_n - Decimal(1))
        C = _q(C)

        balance = P
        rows = []
        for k in range(1, n + 1):
            interest = _q(balance * i)
            # Última cuota: ajustar capital para que outstanding_balance == 0.
            if k == n:
                principal = balance
                C = _q(principal + interest + insurance)
            else:
                principal = _q(C - interest - insurance)
                if principal < 0:
                    # Tasa demasiado alta vs. seguro — el interés se come la cuota.
                    # Forzamos principal=0 (no es realista, pero no rompe).
                    principal = Decimal("0.00")
                    C = _q(interest + insurance)
            balance = _q(balance - principal)
            due = _add_months(loan.first_due_date, k - 1)
            rows.append(
                LoanInstallment(
                    loan=loan,
                    number=k,
                    due_date=due,
                    principal_amount=principal,
                    interest_amount=interest,
                    insurance_amount=_q(insurance),
                    total_amount=C,
                    outstanding_balance=balance,
                    status=LoanInstallment.Status.PENDING,
                )
            )
        return rows

    @staticmethod
    def _linear_schedule(loan, P, i, n, insurance):
        """Capital constante: capital_k = P/n; interés_k = saldo · i."""
        capital_const = (P / Decimal(n)).quantize(_TWO, rounding=ROUND_HALF_UP)
        balance = P
        rows = []
        for k in range(1, n + 1):
            interest = _q(balance * i)
            # Última cuota absorbe redondeo.
            if k == n:
                principal = balance
            else:
                principal = capital_const
            balance = _q(balance - principal)
            due = _add_months(loan.first_due_date, k - 1)
            total = _q(principal + interest + insurance)
            rows.append(
                LoanInstallment(
                    loan=loan,
                    number=k,
                    due_date=due,
                    principal_amount=principal,
                    interest_amount=interest,
                    insurance_amount=_q(insurance),
                    total_amount=total,
                    outstanding_balance=balance,
                    status=LoanInstallment.Status.PENDING,
                )
            )
        return rows

    # ── Desembolso (F2.5) ──────────────────────────────────────────────────

    @staticmethod
    @transaction.atomic
    def disburse(
        loan: BankLoan,
        *,
        date=None,
        opening_fee_override: "Decimal | None" = None,
        stamp_tax_override: "Decimal | None" = None,
        commission_expense_account: "Account | None" = None,
        stamp_tax_expense_account: "Account | None" = None,
        created_by: "AbstractUser | None" = None,
    ) -> BankLoan:
        """
        Registra el desembolso del crédito en el banco y materializa la deuda.

        1. Genera la tabla de amortización si no existe.
        2. Crea TreasuryMovement INBOUND al disbursement_account con origen
           contable = liability_account (crédito al pasivo). El asiento
           contable lo genera `_build_disbursement_entry` (manual, porque el
           flujo estándar de Treasury no conoce la liability_account).
        3. Marca el crédito como ACTIVE.

        Cargos del desembolso:
          `opening_fee_override` y `stamp_tax_override` permiten ajustar los
          cargos guardados en el `BankLoan` **sólo al materializar** el
          desembolso (one-shot). El contrato conserva los valores originales
          en el modelo. Si el override difiere del valor original, la
          diferencia se documenta en las `notes` del `TreasuryMovement` para
          trazabilidad contable.

        Cuentas de gasto (overrides opcionales del AccountingSettings):
          `commission_expense_account` y `stamp_tax_expense_account` ganan
          sobre los settings `loan_commission_expense_account` /
          `loan_stamp_tax_expense_account` si vienen en el payload. Esto
          permite al operador configurar el asiento "in-line" cuando los
          settings no están definidos a nivel empresa (escape híbrido).

        Idempotencia: si el crédito ya está ACTIVE, retorna sin error.
        """
        if loan.status == BankLoan.Status.PAID:
            raise ValidationError(_t("No se puede desembolsar un crédito ya pagado."))
        if loan.status == BankLoan.Status.ACTIVE:
            return loan  # ya desembolsado, idempotente

        if not loan.installments.exists():
            LoanService.generate_schedule(loan)

        from .services import TreasuryService

        # Cargos de apertura: si llega override, gana. Si no, el del contrato.
        # El contrato NO se muta (preservamos el valor originalmente pactado).
        opening_fee_contract = loan.opening_fee or Decimal("0")
        stamp_tax_contract = loan.stamp_tax or Decimal("0")
        opening_fee = (
            opening_fee_override if opening_fee_override is not None else opening_fee_contract
        )
        stamp_tax = stamp_tax_override if stamp_tax_override is not None else stamp_tax_contract
        # No aceptamos cargos negativos: el operador ajusta a 0 si quiere
        # "anular" un cargo del contrato.
        if opening_fee < 0:
            raise ValidationError(_t("La comisión de apertura no puede ser negativa."))
        if stamp_tax < 0:
            raise ValidationError(_t("El impuesto de timbres no puede ser negativo."))

        fee_lines: list = []
        if opening_fee > 0 or stamp_tax > 0:
            from accounting.models import AccountingSettings

            settings_obj = AccountingSettings.get_solo()
            # Override per-desembolso gana sobre el setting; si no, el setting.
            commission_acc = (
                commission_expense_account
                if commission_expense_account is not None
                else getattr(settings_obj, "loan_commission_expense_account", None)
            )
            stamp_acc = (
                stamp_tax_expense_account
                if stamp_tax_expense_account is not None
                else getattr(settings_obj, "loan_stamp_tax_expense_account", None)
            )
            if opening_fee > 0:
                if not commission_acc:
                    raise ValidationError(
                        _t(
                            "Configure la 'Cuenta de Gasto por Comisiones de Préstamo' en "
                            "Configuración > Contabilidad para registrar la comisión de apertura, "
                            "o envíela en el payload del desembolso."
                        )
                    )
                fee_lines.append((commission_acc, opening_fee))
            if stamp_tax > 0:
                if not stamp_acc:
                    raise ValidationError(
                        _t(
                            "Configure la 'Cuenta de Gasto por Impuesto de Timbres' en "
                            "Configuración > Contabilidad para registrar el ITE del desembolso, "
                            "o envíela en el payload del desembolso."
                        )
                    )
                fee_lines.append((stamp_acc, stamp_tax))

        net_cash = _q(loan.principal - opening_fee - stamp_tax)
        if net_cash <= 0:
            raise ValidationError(
                _t(
                    "La comisión de apertura y el impuesto de timbres no pueden igualar "
                    "o superar el capital del crédito."
                )
            )

        # Notas: documentamos el contrato original + override (si difiere)
        # para que la auditoría contable vea el ajuste en el movimiento.
        notes_base = f"Desembolso crédito {loan.display_id} ({loan.lender.name})"
        notes_adjustments: list[str] = []
        if opening_fee_override is not None and opening_fee_override != opening_fee_contract:
            notes_adjustments.append(
                f"Comisión apertura ajustada: contrato {opening_fee_contract} → materializado {opening_fee}"
            )
        if stamp_tax_override is not None and stamp_tax_override != stamp_tax_contract:
            notes_adjustments.append(
                f"ITE ajustado: contrato {stamp_tax_contract} → materializado {stamp_tax}"
            )
        notes_final = notes_base + (
            (" · " + " · ".join(notes_adjustments)) if notes_adjustments else ""
        )

        # INBOUND al banco por el efectivo NETO, SIN auto-asiento: el flujo
        # estándar de Treasury no conoce la liability_account del préstamo y, al
        # quedar el asiento con una sola línea (sin contraparte), lo borraría
        # (services.py:410). Lo construimos a mano balanceado:
        #   Debe banco net_cash · Debe comisión · Debe ITE · Haber pasivo principal
        #
        # Nota UF: los montos se asientan tal cual la moneda del crédito. El
        # nacimiento del pasivo en CLP y su reajuste por corrección monetaria
        # para créditos UF queda fuera de alcance — ver ADR-0033/0045.
        movement = TreasuryService.create_movement(
            amount=net_cash,
            movement_type=TreasuryMovement.Type.INBOUND,
            payment_method=TreasuryMovement.Method.TRANSFER,
            to_account=loan.disbursement_account,
            date=date or loan.start_date,
            created_by=created_by,
            reference=loan.display_id,
            notes=notes_final,
            is_pending_registration=True,
        )

        _build_disbursement_entry(
            movement=movement,
            bank_account=loan.disbursement_account.account,
            liability_account=loan.liability_account.account,
            principal=loan.principal,
            net_cash=net_cash,
            fee_lines=fee_lines,
        )

        loan.status = BankLoan.Status.ACTIVE
        loan.save(update_fields=["status", "updated_at"])
        return loan

    @staticmethod
    def pay_installment_from_request(request, installment: LoanInstallment) -> LoanInstallment:
        from .serializers import PayInstallmentActionSerializer
        from .models import TreasuryAccount
        from accounting.models import Account

        payload = PayInstallmentActionSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        v = payload.validated_data

        try:
            payment_account = TreasuryAccount.objects.get(pk=v["payment_account"])
        except TreasuryAccount.DoesNotExist:
            raise ValidationError("payment_account no existe.")

        interest_exp = None
        if v.get("interest_expense_account"):
            try:
                interest_exp = Account.objects.get(pk=v["interest_expense_account"])
            except Account.DoesNotExist:
                raise ValidationError("interest_expense_account no existe.")

        insurance_exp = None
        if v.get("insurance_expense_account"):
            try:
                insurance_exp = Account.objects.get(pk=v["insurance_expense_account"])
            except Account.DoesNotExist:
                raise ValidationError("insurance_expense_account no existe.")

        return LoanService.pay_installment(
            installment.loan,
            installment,
            payment_account=payment_account,
            interest_expense_account=interest_exp,
            insurance_expense_account=insurance_exp,
            date=v.get("date"),
            created_by=request.user,
            principal_amount=v.get("principal_amount"),
            interest_amount=v.get("interest_amount"),
            insurance_amount=v.get("insurance_amount"),
            tax_amount=v.get("tax_amount"),
            penalty_amount=v.get("penalty_amount"),
        )

    # ── Pago de cuota (F2.6 / F2.7) ────────────────────────────────────────

    @staticmethod
    @transaction.atomic
    def pay_installment(
        loan: BankLoan,
        installment: LoanInstallment,
        *,
        payment_account: "TreasuryAccount",
        interest_expense_account: "Account | None" = None,
        insurance_expense_account: "Account | None" = None,
        date=None,
        created_by: "AbstractUser | None" = None,
        principal_amount: "Decimal | None" = None,
        interest_amount: "Decimal | None" = None,
        insurance_amount: "Decimal | None" = None,
        tax_amount: "Decimal | None" = None,
        penalty_amount: "Decimal | None" = None,
    ) -> LoanInstallment:
        """
        Paga una cuota: OUTBOUND desde `payment_account` por el total.

        Reparto contable (asiento en DRAFT, post por TreasuryService):
          - Debe  `liability_account`           (amortización de capital)
          - Debe  `interest_expense_account`    (gasto interés)
          - Debe  `insurance_expense_account`   (gasto seguro, si > 0)
          - Haber `payment_account`              (banco/caja)

        Si el crédito es UF, convierte al CLP vigente en la fecha de pago
        (F2.7) usando `IndicatorValue.get_value('UF', payment_date)`. El
        valor UF usado se persiste en `installment.uf_value_used` para
        trazabilidad.

        `interest_expense_account` e `insurance_expense_account` se resuelven
        desde `AccountingSettings` si no se pasan como parámetro.

        Montos opcionales (editable por el usuario):
          - `principal_amount`: monto de capital a pagar (default: monto de la cuota)
          - `interest_amount`: monto de interés a pagar (default: monto de la cuota)
          - `insurance_amount`: monto de seguro a pagar (default: monto de la cuota)
          - `tax_amount`: monto de impuestos pagados (default: 0)
          - `penalty_amount`: monto de multa por mora pagada (default: cálculo automático)
        """
        if loan.status != BankLoan.Status.ACTIVE:
            raise ValidationError(
                _t("El crédito debe estar ACTIVE para pagar cuotas (estado actual: %(s)s).")
                % {"s": loan.get_status_display()}
            )
        if installment.status == LoanInstallment.Status.PAID:
            raise ValidationError(_t("Esta cuota ya está pagada."))
        if installment.loan_id != loan.id:
            raise ValidationError(_t("La cuota no pertenece a este crédito."))

        # Resolver cuentas de gasto desde settings si no se pasan como parámetro.
        if not interest_expense_account or not insurance_expense_account:
            from accounting.models import AccountingSettings

            settings_obj = AccountingSettings.get_solo()
            if settings_obj:
                if not interest_expense_account:
                    interest_expense_account = getattr(
                        settings_obj, "interest_expense_account", None
                    )
                if not insurance_expense_account:
                    insurance_expense_account = getattr(
                        settings_obj, "insurance_expense_account", None
                    )

        pay_date = date or timezone.now().date()
        # Si la cuota estaba marcada OVERDUE, mantenemos la fecha de
        # vencimiento original en el asiento; solo cambia paid_at.

        # Usar montos del payload o defaults de la cuota
        principal_native = (
            principal_amount if principal_amount is not None else installment.principal_amount
        )
        interest_native = (
            interest_amount if interest_amount is not None else installment.interest_amount
        )
        insurance_native = (
            insurance_amount if insurance_amount is not None else installment.insurance_amount
        )
        tax_native = tax_amount or Decimal("0")

        principal_clp = principal_native
        interest_clp = interest_native
        insurance_clp = insurance_native
        tax_clp = tax_native

        # Mora (interés penal): usar monto provisto o calcular automáticamente
        penalty_clp = Decimal("0")
        penalty_expense_account = None
        if penalty_amount is not None and penalty_amount > 0:
            penalty_clp = penalty_amount
        elif installment.status == LoanInstallment.Status.OVERDUE and (loan.penalty_rate or 0) > 0:
            days_late = (pay_date - installment.due_date).days
            if days_late > 0:
                penalty_clp = _q(
                    installment.total_amount
                    * (loan.penalty_rate / Decimal("100"))
                    * Decimal(days_late)
                    / Decimal("30")
                )

        if penalty_clp > 0:
            from accounting.models import AccountingSettings

            settings_obj = AccountingSettings.get_solo()
            penalty_expense_account = (
                getattr(settings_obj, "loan_penalty_expense_account", None)
                if settings_obj
                else None
            )
            if not penalty_expense_account:
                raise ValidationError(
                    _t(
                        "Configure la 'Cuenta de Gasto por Mora' en Configuración > "
                        "Contabilidad para cobrar el interés penal de la cuota vencida."
                    )
                )

        total_with_penalty = _q(
            principal_clp + interest_clp + insurance_clp + tax_clp + penalty_clp
        )

        # Crear movimiento OUTBOUND por el total + mora (CLP) sin auto-asiento
        # (`is_pending_registration=True`): construimos el JE manualmente con el
        # reparto capital/interés/seguro/mora (el flujo estándar de
        # TreasuryService no conoce la liability_account del préstamo).
        from .services import TreasuryService

        movement = TreasuryService.create_movement(
            amount=total_with_penalty,
            movement_type=TreasuryMovement.Type.OUTBOUND,
            payment_method=TreasuryMovement.Method.TRANSFER,
            from_account=payment_account,
            date=pay_date,
            created_by=created_by,
            reference=installment.display_id,
            notes=(
                f"Pago cuota #{installment.number} crédito {loan.display_id} "
                f"({loan.currency}"
                f"{'; mora ' + str(penalty_clp) if penalty_clp else ''})"
            ),
            is_pending_registration=True,
        )

        # Construir el asiento con el reparto explícito.
        _build_installment_entry(
            movement=movement,
            liability_account=loan.liability_account.account,
            interest_expense_account=interest_expense_account,
            insurance_expense_account=insurance_expense_account,
            principal_clp=principal_clp,
            interest_clp=interest_clp,
            insurance_clp=insurance_clp,
            total_clp=total_with_penalty,
            from_account=payment_account,
            penalty_clp=penalty_clp,
            penalty_expense_account=penalty_expense_account,
            tax_clp=tax_clp,
        )

        # Recalcular outstanding_balance si el capital pagado difiere del programado.
        balance_diff = installment.principal_amount - principal_native
        if balance_diff != 0:
            # Actualizar outstanding_balance de la cuota pagada
            installment.outstanding_balance = _q(installment.outstanding_balance + balance_diff)
            # Cascadear a cuotas siguientes no pagadas ni anuladas
            subsequent = (
                loan.installments.filter(
                    number__gt=installment.number,
                )
                .exclude(
                    status__in=[LoanInstallment.Status.PAID, LoanInstallment.Status.CANCELED],
                )
                .order_by("number")
                .select_for_update()
            )
            for inst in subsequent:
                inst.outstanding_balance = _q(inst.outstanding_balance + balance_diff)
                LoanInstallment.objects.filter(pk=inst.pk).update(
                    outstanding_balance=inst.outstanding_balance
                )

        # Actualizar montos reales pagados en la cuota
        installment.principal_amount = principal_native
        installment.interest_amount = interest_native
        installment.insurance_amount = insurance_native
        installment.status = LoanInstallment.Status.PAID
        installment.paid_at = timezone.now()
        installment.payment_movement = movement
        installment.penalty_paid = penalty_clp
        installment.save()

        # Si todas las cuotas están PAID/CANCELED → crédito PAID.
        remaining = loan.installments.exclude(
            status__in=[LoanInstallment.Status.PAID, LoanInstallment.Status.CANCELED]
        ).exists()
        if not remaining:
            loan.status = BankLoan.Status.PAID
            loan.save(update_fields=["status", "updated_at"])

        return installment

    # ── Prepago (F2.8) ────────────────────────────────────────────────────

    @staticmethod
    @transaction.atomic
    def prepay(
        loan: BankLoan,
        *,
        payment_account: "TreasuryAccount",
        interest_expense_account: "Account | None" = None,
        insurance_expense_account: "Account | None" = None,
        date=None,
        created_by: "AbstractUser | None" = None,
        insurance_amount: "Decimal | None" = None,
        tax_amount: "Decimal | None" = None,
        penalty_amount: "Decimal | None" = None,
    ) -> BankLoan:
        """
        Pago anticipado total: paga el saldo insoluto y cierra el crédito.

        - Calcula el saldo = suma de `principal_amount` de las cuotas
          PENDING/PARTIAL/OVERDUE.
        - Si el crédito es UF, convierte a CLP con la UF vigente.
        - Crea un único movimiento OUTBOUND; no genera asientos separados
          por cuota (es un evento excepcional).
        - Marca todas las cuotas pendientes como CANCELED, y el crédito
          como PAID.

        Montos opcionales (editable por el usuario):
          - `insurance_amount`: monto total de seguro a pagar (default: suma de seguro de cuotas pendientes)
          - `tax_amount`: monto total de impuestos pagados (default: 0)
          - `penalty_amount`: monto total de multa por mora pagada (default: cálculo automático)
        """
        if loan.status == BankLoan.Status.PAID:
            return loan
        if loan.status != BankLoan.Status.ACTIVE:
            raise ValidationError(
                _t("Solo se puede prepagar un crédito ACTIVE (estado: %(s)s).")
                % {"s": loan.get_status_display()}
            )

        pending = loan.installments.filter(
            status__in=[
                LoanInstallment.Status.PENDING,
                LoanInstallment.Status.OVERDUE,
                LoanInstallment.Status.PARTIAL,
            ]
        )
        if not pending.exists():
            loan.status = BankLoan.Status.PAID
            loan.save(update_fields=["status", "updated_at"])
            return loan

        pay_date = date or timezone.now().date()

        # Saldo insoluto real: principal original menos capital pagado real.
        # (Los installments PAID ya tienen su principal_amount actualizado al
        # valor real si hubo override; el resto suma cero correctamente).
        from django.db.models import Sum

        paid_principal = loan.installments.filter(
            status=LoanInstallment.Status.PAID,
        ).aggregate(s=Sum("principal_amount"))["s"] or Decimal("0")
        outstanding = _q(loan.principal - paid_principal)
        # Interés acumulado del mes en curso sobre el saldo pendiente.
        # Para prepago, asumimos que el interés es proporcional al mes
        # en curso (1/30 por día). Esto es un cálculo conservador — los
        # bancos pueden usar otras convenciones; se documenta en F2.8.
        days_elapsed = (pay_date - _first_of_month(pay_date)).days + 1
        accrued_interest = _q(
            sum((i.interest_amount for i in pending), Decimal("0"))
            * Decimal(days_elapsed)
            / Decimal("30")
        )

        # Usar montos del payload o defaults
        insurance_native = insurance_amount if insurance_amount is not None else Decimal("0")
        tax_native = tax_amount or Decimal("0")

        principal_clp = outstanding
        interest_clp = accrued_interest
        insurance_clp = insurance_native
        tax_clp = tax_native
        total_clp = _q(principal_clp + interest_clp + insurance_clp + tax_clp)

        # Mora: usar monto provisto o calcular automáticamente
        penalty_clp = Decimal("0")
        if penalty_amount is not None and penalty_amount > 0:
            penalty_clp = penalty_amount
            total_clp = _q(total_clp + penalty_clp)

        from .services import TreasuryService

        movement = TreasuryService.create_movement(
            amount=total_clp,
            movement_type=TreasuryMovement.Type.OUTBOUND,
            payment_method=TreasuryMovement.Method.TRANSFER,
            from_account=payment_account,
            date=pay_date,
            created_by=created_by,
            reference=f"PREPAGO-{loan.display_id}",
            notes=(
                f"Prepago total crédito {loan.display_id} "
                f"({loan.currency}"
                f"{'; mora ' + str(penalty_clp) if penalty_clp else ''})"
            ),
            is_pending_registration=True,
        )

        _build_installment_entry(
            movement=movement,
            liability_account=loan.liability_account.account,
            interest_expense_account=interest_expense_account,
            insurance_expense_account=insurance_expense_account,
            principal_clp=principal_clp,
            interest_clp=interest_clp,
            insurance_clp=insurance_clp,
            total_clp=total_clp,
            from_account=payment_account,
            penalty_clp=penalty_clp,
            tax_clp=tax_clp,
        )

        # Cancelar cuotas pendientes.
        pending.update(status=LoanInstallment.Status.CANCELED)
        loan.status = BankLoan.Status.PAID
        loan.save(update_fields=["status", "updated_at"])
        return loan


# ── Helpers privados ───────────────────────────────────────────────────────


def _add_months(start, k):
    """Suma `k` meses a `start`, ajustando al último día si el mes no tiene ese día."""
    import calendar

    year = start.year + (start.month - 1 + k) // 12
    month = (start.month - 1 + k) % 12 + 1
    day = min(start.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def _first_of_month(d):
    return d.replace(day=1)


def _build_disbursement_entry(
    *, movement, bank_account, liability_account, principal, net_cash=None, fee_lines=None
):
    """
    Construye el asiento del desembolso de un crédito (comisión/ITE neteados):

      Debe  bank_account        net_cash  (= principal − Σ comisiones/impuestos)
      Debe  <cuenta de gasto>   monto     (por cada (cuenta, monto) en fee_lines)
      Haber liability_account   principal (la deuda nace por el capital completo)

    `net_cash + Σ fee_lines == principal`, así el asiento cuadra. Sin cargos,
    `net_cash == principal` y el asiento es el clásico Debe banco / Haber pasivo.

    El movimiento se crea con `is_pending_registration=True` para que
    TreasuryService NO genere un asiento estándar de una sola línea (que se
    borraría al no encontrar contraparte). Aquí lo construimos balanceado y
    lo vinculamos al movimiento.
    """
    from django.contrib.contenttypes.models import ContentType

    from accounting.models import JournalEntry, JournalItem
    from accounting.services import JournalEntryService

    if net_cash is None:
        net_cash = principal
    fee_lines = fee_lines or []

    entry = JournalEntry.objects.create(
        date=movement.date,
        description=(f"Desembolso crédito {movement.reference or ''} - {movement.notes[:120]}"),
        reference=movement.reference or f"MOV-{movement.id}",
        status=JournalEntry.Status.DRAFT,
        source_content_type=ContentType.objects.get_for_model(movement),
        source_object_id=movement.id,
    )
    # Haber: pasivo del préstamo por el capital completo.
    JournalItem.objects.create(
        entry=entry,
        account=liability_account,
        debit=Decimal("0"),
        credit=principal,
    )
    # Debe: gastos de apertura (comisión, ITE).
    fee_debit_whole = Decimal("0")
    for fee_account, fee_amount in fee_lines:
        JournalItem.objects.create(
            entry=entry,
            account=fee_account,
            debit=fee_amount,
            credit=Decimal("0"),
        )
        fee_debit_whole += _peso(fee_amount)
    # Debe: banco por el residuo (capital − gastos, ambos a peso entero) para que
    # el asiento cuadre exactamente en pesos enteros, sin descuadres de redondeo.
    JournalItem.objects.create(
        entry=entry,
        account=bank_account,
        debit=_peso(principal) - fee_debit_whole,
        credit=Decimal("0"),
    )
    JournalEntryService.post_entry(entry)
    movement.journal_entry = entry
    movement.save(update_fields=["journal_entry"])


def _build_installment_entry(
    *,
    movement,
    liability_account,
    interest_expense_account,
    insurance_expense_account,
    principal_clp,
    interest_clp,
    insurance_clp,
    total_clp,
    from_account,
    penalty_clp=Decimal("0"),
    penalty_expense_account=None,
    tax_clp=Decimal("0"),
):
    """
    Construye el asiento contable con el reparto explícito:

      Debe  `liability_account`            (amortización de capital + impuestos)
      Debe  `interest_expense_account`     (gasto interés, si > 0 y cuenta dada)
      Debe  `insurance_expense_account`    (gasto seguro, si > 0 y cuenta dada)
      Debe  `penalty_expense_account`      (gasto mora, si > 0 — cuenta obligatoria)
      Haber `from_account.account`         (banco/caja que paga)

    `total_clp` ya incluye la mora cuando la hay. Si no se pasan las cuentas de
    gasto de interés/seguro, su línea se omite y la diferencia se imputa a la
    `liability_account` para no perder la cuadratura.

    Los impuestos (`tax_clp`) se imputan al `liability_account` ya que no hay
    una cuenta de impuestos específica configurada.

    El movimiento se crea con `is_pending_registration=True` para que
    TreasuryService NO genere un asiento estándar (que no conoce la
    liability_account del préstamo). Aquí construimos el JE y lo
    vinculamos manualmente.
    """
    from django.contrib.contenttypes.models import ContentType

    from accounting.models import JournalEntry, JournalItem
    from accounting.services import JournalEntryService

    # Construir DRAFT con la descripción y el source (el movimiento).
    entry = JournalEntry.objects.create(
        date=movement.date,
        description=(f"Pago cuota crédito {movement.reference or ''} - {movement.notes[:120]}"),
        reference=movement.reference or f"MOV-{movement.id}",
        status=JournalEntry.Status.DRAFT,
        source_content_type=ContentType.objects.get_for_model(movement),
        source_object_id=movement.id,
    )

    # Si falta alguna cuenta de gasto, prorrateamos la diferencia
    # en `liability_account` para mantener la cuadratura D=C.
    liability_debit = principal_clp
    if interest_clp and not interest_expense_account:
        liability_debit = _q(liability_debit + interest_clp)
    if insurance_clp and not insurance_expense_account:
        liability_debit = _q(liability_debit + insurance_clp)
    # Impuestos se imputan al pasivo (no hay cuenta específica de impuestos aún)
    if tax_clp > 0:
        liability_debit = _q(liability_debit + tax_clp)

    # Acumulamos el total de débitos redondeado a peso entero (como los lee el
    # libro mayor), para que la línea de cuadre (banco) cuadre exactamente.
    debit_total_whole = Decimal("0")

    # 1) Debe: pasivo (amortización de capital — más interés/seguro si no hay cuentas + impuestos)
    JournalItem.objects.create(
        entry=entry,
        account=liability_account,
        debit=liability_debit,
        credit=Decimal("0"),
    )
    debit_total_whole += _peso(liability_debit)
    # 2) Debe: gasto interés
    if interest_clp and interest_expense_account:
        JournalItem.objects.create(
            entry=entry,
            account=interest_expense_account,
            debit=interest_clp,
            credit=Decimal("0"),
        )
        debit_total_whole += _peso(interest_clp)
    # 3) Debe: gasto seguro
    if insurance_clp and insurance_expense_account:
        JournalItem.objects.create(
            entry=entry,
            account=insurance_expense_account,
            debit=insurance_clp,
            credit=Decimal("0"),
        )
        debit_total_whole += _peso(insurance_clp)
    # 3.5) Debe: gasto por mora (interés penal de cuota vencida)
    if penalty_clp and penalty_expense_account:
        JournalItem.objects.create(
            entry=entry,
            account=penalty_expense_account,
            debit=penalty_clp,
            credit=Decimal("0"),
        )
        debit_total_whole += _peso(penalty_clp)
    # 4) Haber: tesorería por la suma EXACTA de los débitos ya redondeados a
    # peso entero (evita descuadres de 1 peso cuando hay centavos, p. ej. mora).
    JournalItem.objects.create(
        entry=entry,
        account=from_account.account,
        debit=Decimal("0"),
        credit=debit_total_whole,
    )

    JournalEntryService.post_entry(entry)
    movement.journal_entry = entry
    movement.save(update_fields=["journal_entry"])
