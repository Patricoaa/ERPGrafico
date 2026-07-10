"""
card_service.py — Lógica de negocio para la tarjeta de crédito propia (Fase 3).

Responsabilidades:
  - open_statement(card_account, period_year, period_month, ...) — crea el
    CreditCardStatement del período.
  - apply_charges(statement, interest_expense_account=None,
    fees_expense_account=None) — imputa `interest_charged` y
    `fees_charged` como gasto financiero y sube la deuda
    (ADJUSTMENT / JournalEntry custom).
  - pay_statement(statement, payment_account, ...) — paga el total
    del statement desde una cuenta bancaria (TRANSFER banco→tarjeta).
  - cancel_statement(statement) — anula un statement OPEN.
  - recalculate_billed_amount(statement) — recalcula el monto facturado
    agregando los OUTBOUND del período (cierra el gap B del análisis
    del ciclo de vida, ver ADR-0037).

Patrón:
  - Todos los movimientos se generan vía `TreasuryService.create_movement`,
    garantizando la trazabilidad contable.
  - Para asientos con desglose custom (interés / fee), se usa
    `is_pending_registration=True` y se construye el JE a mano,
    análogo al patrón de `LoanService` (ADR-0033).
  -   Las cuentas de gasto financiero (`interest_expense_account`/
    `fees_expense_account`) se resuelven desde `AccountingSettings` si
    no se pasan como parámetro.

Ver `docs/50-audit/bancos/fase-3-tarjeta-credito.md` (F3.3, F3.4).
"""

from __future__ import annotations

from datetime import date as _date
from decimal import Decimal
from typing import TYPE_CHECKING

from django.core.exceptions import ValidationError
from django.db import models as dj_models
from django.db import transaction
from django.utils import timezone
from django.utils.translation import gettext_lazy as _t

from .models import (
    CardPendingCharge,
    CardPurchaseInstallment,
    CreditCardStatement,
    TreasuryAccount,
    TreasuryMovement,
)

if TYPE_CHECKING:
    from django.contrib.auth.models import AbstractUser

    from accounting.models import Account


class CardService:
    @classmethod
    def pay_statement_from_request(cls, request, stmt):
        from .models import TreasuryAccount
        from rest_framework.exceptions import ValidationError
        v = request.data
        try:
            pa = TreasuryAccount.objects.get(pk=v['payment_account'])
        except TreasuryAccount.DoesNotExist: raise ValidationError('payment_account no existe.')
        return cls.pay_statement(stmt, payment_account=pa, amount=v.get('amount'), date=v.get('date'), created_by=request.user)

    @classmethod
    def apply_charges_from_request(cls, request, stmt):
        from rest_framework.exceptions import ValidationError
        from core.models import Account
        v = request.data
        ie = None
        fe = None
        if v.get('interest_expense_account'):
            try: ie = Account.objects.get(pk=v['interest_expense_account'])
            except Account.DoesNotExist: raise ValidationError('interest_expense_account no existe.')
        if v.get('fees_expense_account'):
            try: fe = Account.objects.get(pk=v['fees_expense_account'])
            except Account.DoesNotExist: raise ValidationError('fees_expense_account no existe.')
        return cls.apply_charges(stmt, interest_expense_account=ie, fees_expense_account=fe, created_by=request.user)

    @classmethod
    def reapply_charges_from_request(cls, request, stmt):
        from rest_framework.exceptions import ValidationError
        from core.models import Account
        v = request.data
        ie = None
        fe = None
        if v.get('interest_expense_account'):
            try: ie = Account.objects.get(pk=v['interest_expense_account'])
            except Account.DoesNotExist: raise ValidationError('interest_expense_account no existe.')
        if v.get('fees_expense_account'):
            try: fe = Account.objects.get(pk=v['fees_expense_account'])
            except Account.DoesNotExist: raise ValidationError('fees_expense_account no existe.')
        return cls.reapply_charges(stmt, interest_expense_account=ie, fees_expense_account=fe, created_by=request.user)

    @classmethod
    def update_charge_from_request(cls, request):
        from rest_framework.exceptions import ValidationError
        from .models import CardPendingCharge
        from .serializers import CardPendingChargeSerializer
        cid = request.data.get('id')
        if not cid: raise ValidationError('id del cargo requerido.')
        try: charge = CardPendingCharge.objects.get(pk=cid, is_billed=False)
        except CardPendingCharge.DoesNotExist: raise ValidationError('Cargo no encontrado.')
        serializer = CardPendingChargeSerializer(charge, data=request.data, partial=True, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return serializer.data

    @classmethod
    def delete_charge_from_request(cls, request):
        from rest_framework.exceptions import ValidationError
        from .models import CardPendingCharge
        cid = request.data.get('id')
        if not cid: raise ValidationError('id del cargo requerido.')
        try: charge = CardPendingCharge.objects.get(pk=cid, is_billed=False)
        except CardPendingCharge.DoesNotExist: raise ValidationError('Cargo no encontrado.')
        charge.delete()

    """Operaciones sobre la tarjeta de crédito propia."""

    @staticmethod
    def add_unbilled_charge_from_payload(data: dict, user) -> dict:
        from .models import TreasuryAccount
        from .serializers import CardPendingChargeSerializer
        
        card_account_id = data.get("card_account")
        amount = data.get("amount")
        charge_type = data.get("charge_type", "OTHER")
        description = data.get("description", "")
        date_str = data.get("date")

        if not card_account_id:
            raise ValidationError("card_account es requerido.")
        if not amount:
            raise ValidationError("amount es requerido.")

        try:
            card_account = TreasuryAccount.objects.get(pk=card_account_id)
        except TreasuryAccount.DoesNotExist:
            raise ValidationError("card_account no existe.")

        charge_date = None
        if date_str:
            from datetime import date as _date_type
            try:
                charge_date = _date_type.fromisoformat(date_str)
            except ValueError:
                raise ValidationError("Formato de fecha inválido. Use YYYY-MM-DD.")

        movement = CardService.add_unbilled_charge(
            card_account=card_account,
            amount=Decimal(str(amount)),
            charge_type=charge_type,
            description=description,
            date=charge_date,
            created_by=user,
        )

        p = CardPendingChargeSerializer(movement).data
        return {
            "id": p["id"],
            "amount": str(p["amount"]),
            "date": p["date"].isoformat() if hasattr(p["date"], "isoformat") else p["date"],
            "charge_type": p["charge_type"],
            "charge_type_display": p["charge_type_display"],
            "description": p.get("description", ""),
            "reference": "",
            "source": "pending",
            "from_account_name": None,
            "partner_name": None,
        }

    @staticmethod
    def bill_charges_from_payload(data: dict, user) -> dict:
        from .models import TreasuryAccount
        from datetime import date as _date_type

        card_account_id = data.get("card_account")
        period_year = data.get("period_year")
        period_month = data.get("period_month")
        cut_off_date_str = data.get("cut_off_date")
        due_date_str = data.get("due_date")
        minimum_payment = data.get("minimum_payment", "0")
        notes = data.get("notes", "")

        if not card_account_id:
            raise ValidationError("card_account es requerido.")
        if not period_year or not period_month:
            raise ValidationError("period_year y period_month son requeridos.")
        if not cut_off_date_str or not due_date_str:
            raise ValidationError("cut_off_date y due_date son requeridos.")

        try:
            card_account = TreasuryAccount.objects.get(pk=card_account_id)
        except TreasuryAccount.DoesNotExist:
            raise ValidationError("card_account no existe.")

        try:
            cut_off_date = _date_type.fromisoformat(cut_off_date_str)
            due_date = _date_type.fromisoformat(due_date_str)
        except ValueError:
            raise ValidationError("Formato de fecha inválido. Use YYYY-MM-DD.")

        statement = CardService.bill_unbilled_charges(
            card_account=card_account,
            period_year=int(period_year),
            period_month=int(period_month),
            cut_off_date=cut_off_date,
            due_date=due_date,
            minimum_payment=Decimal(str(minimum_payment)),
            notes=notes,
            created_by=user,
        )

        from .serializers import CreditCardStatementSerializer
        result = CreditCardStatementSerializer(statement).data
        breakdown = getattr(statement, "_purchase_group_breakdown", None)
        if breakdown:
            result["purchase_group_breakdown"] = breakdown
        return result

    # ── Apertura del estado de cuenta (F3.2) ─────────────────────────────

    @staticmethod
    @transaction.atomic
    def open_statement(
        *,
        card_account: TreasuryAccount,
        period_year: int,
        period_month: int,
        cut_off_date: _date,
        due_date: _date,
        billed_amount: Decimal = Decimal("0"),
        minimum_payment: Decimal = Decimal("0"),
        credit_limit: Decimal | None = None,
        notes: str = "",
        created_by: "AbstractUser | None" = None,
    ) -> CreditCardStatement:
        """
        Abre un CreditCardStatement para el período. El estado inicial es
        OPEN. Si ya existe uno para la misma tarjeta/período, lanza
        ValidationError.
        """
        if card_account.account_type != TreasuryAccount.Type.CREDIT_CARD:
            raise ValidationError(
                _t("La cuenta debe ser de tipo Tarjeta de Crédito (CREDIT_CARD).")
            )
        if period_month < 1 or period_month > 12:
            raise ValidationError(_t("El mes debe estar entre 1 y 12."))
        if due_date < cut_off_date:
            raise ValidationError(_t("La fecha de vencimiento no puede ser anterior al cierre."))

        if CreditCardStatement.objects.filter(
            card_account=card_account,
            period_year=period_year,
            period_month=period_month,
        ).exists():
            raise ValidationError(_t("Ya existe un estado de cuenta para esta tarjeta y período."))

        return CreditCardStatement.objects.create(
            card_account=card_account,
            period_year=period_year,
            period_month=period_month,
            cut_off_date=cut_off_date,
            due_date=due_date,
            billed_amount=billed_amount,
            minimum_payment=minimum_payment,
            credit_limit=credit_limit,
            notes=notes,
            created_by=created_by,
        )

    # ── Aplicar interés / comisiones (F3.3) ──────────────────────────────

    @staticmethod
    @transaction.atomic
    def apply_charges(
        statement: CreditCardStatement,
        *,
        interest_expense_account: "Account | None" = None,
        fees_expense_account: "Account | None" = None,
        date: _date | None = None,
        created_by: "AbstractUser | None" = None,
    ) -> CreditCardStatement:
        """
        Imputa los `interest_charged` y `fees_charged` del statement
        como gasto financiero y sube la deuda.

        Genera un `TreasuryMovement` ADJUSTMENT sobre la `card_account`
        (LIABILITY) y un `JournalEntry` con el desglose:
          - Debe  `interest_expense_account`  (si > 0 y configurada)
          - Debe  `fees_expense_account`      (si > 0 y configurada)
          - Haber `card_account.account`      (LIABILITY — sube la deuda)

        Si falta la cuenta de gasto, el monto se imputa a la
        `liability_account` (workaround análogo al de `LoanService`,
        preservando la cuadratura D=C).

        Idempotente: si ya existe un movimiento vinculado al
        statement, no genera otro (a menos que `billed_amount` /
        `interest_charged` / `fees_charged` cambien, en cuyo caso
        se delega al operador revertir manualmente — ver TODO).
        """
        if statement.status != CreditCardStatement.Status.OPEN:
            raise ValidationError(
                _t("Solo se pueden aplicar cargos a un statement OPEN (estado: %(s)s).")
                % {"s": statement.get_status_display()}
            )

        interest = statement.interest_charged or Decimal("0")
        fees = statement.fees_charged or Decimal("0")
        total = interest + fees
        if total <= 0:
            # Nada que aplicar. La resolución de cuentas no es necesaria.
            return statement

        # Resolver cuentas de gasto desde settings si no se pasan como parámetro.
        # Gap 1.5b (ADR-0037): ya NO usamos el workaround del pasivo. Si
        # falta la cuenta de gasto (sea de interés o de comisiones),
        # levantamos `ValidationError` para forzar la configuración en
        # `AccountingSettings` antes de imputar cargos.
        from accounting.models import AccountingSettings

        settings_obj = AccountingSettings.get_solo()

        if interest and not interest_expense_account:
            interest_expense_account = (
                getattr(settings_obj, "interest_expense_account", None) if settings_obj else None
            )
            if interest_expense_account is None:
                raise ValidationError(
                    _t(
                        "No hay cuenta de gasto por intereses configurada. "
                        "Configure `AccountingSettings.interest_expense_account` "
                        "o pase `interest_expense_account` explícitamente."
                    )
                )

        if fees and not fees_expense_account:
            fees_expense_account = (
                getattr(settings_obj, "bank_commission_account", None) if settings_obj else None
            )
            if fees_expense_account is None:
                raise ValidationError(
                    _t(
                        "No hay cuenta de gasto por comisiones configurada. "
                        "Configure `AccountingSettings.bank_commission_account` "
                        "o pase `fees_expense_account` explícitamente."
                    )
                )

        # Idempotencia por FK directo (Gap 1.4, ADR-0037): si el
        # statement ya tiene un cargo aplicado, no generamos otro. Para
        # recalcular, usar `reapply_charges` (que reversa y vuelve a
        # imputar). El fallback a búsqueda por `reference` se conserva
        # para data legacy donde el FK aún no estaba populado (migración
        # 0068 lo backfillea, pero mantenemos el safety net).
        if statement.charges_movement_id is not None:
            return statement
        legacy_existing = TreasuryMovement.objects.filter(
            reference=statement.display_id,
            movement_type=TreasuryMovement.Type.ADJUSTMENT,
            from_account=statement.card_account,
        ).exists()
        if legacy_existing and statement.charges_movement_id is None:
            # Data legacy: el ADJUSTMENT existe pero el FK no se
            # populó (caso raro post-backfill). El próximo
            # `reapply_charges` lo vinculará. Por ahora, no duplicamos.
            return statement

        card_acc = statement.card_account
        liability_acc = card_acc.account

        apply_date = date or statement.cut_off_date or timezone.now().date()

        # 1) Crear movimiento ADJUSTMENT (sin auto-asiento).
        movement = TreasuryMovement.objects.create(
            movement_type=TreasuryMovement.Type.ADJUSTMENT,
            payment_method=TreasuryMovement.Method.OTHER,
            amount=total,
            date=apply_date,
            from_account=card_acc,
            reference=statement.display_id,
            notes=(
                f"[CHARGES] Interés ${interest} + Comisiones ${fees} del "
                f"estado de cuenta {statement.display_id}"
            ),
            created_by=created_by,
        )

        # 2) Construir el JE custom con el desglose.
        from django.contrib.contenttypes.models import ContentType

        from accounting.models import JournalEntry, JournalItem
        from accounting.services import JournalEntryService

        from core.prefix_registry import EntityPrefix
        doc_ref = f"{EntityPrefix.CARD_PENDING_CHARGE}-{statement.display_id}"
        entry = JournalEntry.objects.create(
            date=apply_date,
            description=GlosaBuilder.build(
                GlosaBuilder.CARGOS_FINANCIEROS, statement.display_id, "",
                total, extra=[f"{statement.period_month:02d}/{statement.period_year}"],
            ),
            reference=doc_ref,
            status=JournalEntry.Status.DRAFT,
            source_content_type=ContentType.objects.get_for_model(statement),
            source_object_id=statement.id,
        )

        # El Haber siempre es el pasivo (sube la deuda) por el total.
        JournalItem.objects.create(
            entry=entry,
            account=liability_acc,
            debit=Decimal("0"),
            credit=total,
            label=GlosaBuilder.item(Roles.PASIVO_TC, statement.display_id, doc_ref),
        )

        if interest:
            JournalItem.objects.create(
                entry=entry,
                account=interest_expense_account,
                debit=interest,
                credit=Decimal("0"),
                label=GlosaBuilder.item(Roles.INTERES, "Cargos financieros", doc_ref),
            )
        if fees:
            JournalItem.objects.create(
                entry=entry,
                account=fees_expense_account,
                debit=fees,
                credit=Decimal("0"),
                label=GlosaBuilder.item(Roles.GASTO, "Comisiones TC", doc_ref),
            )

        JournalEntryService.post_entry(entry)

        movement.journal_entry = entry
        movement.save(update_fields=["journal_entry"])

        # Vincular el FK directo (Gap 1.4). Permite recálculo
        # posterior y búsqueda robusta por `reapply_charges` /
        # `reverse_statement`.
        statement.charges_movement = movement
        statement.notes = (
            f"[CHARGES] Movimiento {movement.display_id} aplicado el "
            f"{apply_date.isoformat()}.\n" + (statement.notes or "")
        ).strip()
        statement.save(update_fields=["charges_movement", "notes", "updated_at"])
        return statement

    # ── Reaplicar cargos (Gap 1.4) ──────────────────────────────────────

    @staticmethod
    @transaction.atomic
    def reapply_charges(
        statement: CreditCardStatement,
        *,
        interest_expense_account: "Account | None" = None,
        fees_expense_account: "Account | None" = None,
        date: _date | None = None,
        created_by: "AbstractUser | None" = None,
    ) -> CreditCardStatement:
        """
        Reversa el cargo actual (si existe) y vuelve a imputar con los
        valores actualizados de `interest_charged` y `fees_charged`.

        Pensado para cuando el operador edita los montos del statement
        después de aplicar cargos: en vez de revertir manualmente y
        reaplicar, esta operación lo hace atómicamente.

        - Reversa el `JournalEntry` vinculado al `charges_movement`
          (queda como `REVERSAL`, conserva audit trail).
        - Borra el `charges_movement` y limpia el FK en el statement.
        - Llama a `apply_charges` con los nuevos valores.

        Idempotente: si no hay cargo previo, sólo llama a `apply_charges`.
        """
        if statement.status not in (
            CreditCardStatement.Status.OPEN,
            CreditCardStatement.Status.OVERDUE,
        ):
            raise ValidationError(
                _t("Solo se pueden reaplicar cargos a un statement OPEN u OVERDUE (estado: %(s)s).")
                % {"s": statement.get_status_display()}
            )

        old_movement = statement.charges_movement
        if old_movement is not None:
            from accounting.services import JournalEntryService

            if old_movement.journal_entry and old_movement.journal_entry.status in (
                "POSTED",
                "CLOSED",
            ):
                # `reverse_entry` valida que no esté ya revertido.
                try:
                    JournalEntryService.reverse_entry(
                        old_movement.journal_entry,
                        description=(f"REVERSO cargos {statement.display_id} (reaplicación)"),
                    )
                except ValidationError:
                    # Si ya estaba revertido, no es error: limpiamos igual.
                    pass
            # Borrar el movimiento (cascade del JE está manejado por
            # la FK PROTECT en TreasuryMovement.journal_entry; al
            # borrar el movimiento, primero desligamos el JE).
            old_movement.journal_entry = None
            old_movement.save(update_fields=["journal_entry"])
            old_movement.delete()
            statement.charges_movement = None
            statement.save(update_fields=["charges_movement"])

        return CardService.apply_charges(
            statement,
            interest_expense_account=interest_expense_account,
            fees_expense_account=fees_expense_account,
            date=date,
            created_by=created_by,
        )

    # ── Pago del estado de cuenta (F3.4) ─────────────────────────────────

    @staticmethod
    @transaction.atomic
    def pay_statement(
        statement: CreditCardStatement,
        *,
        payment_account: TreasuryAccount,
        date: _date | None = None,
        amount: Decimal | None = None,
        created_by: "AbstractUser | None" = None,
    ) -> CreditCardStatement:
        """
        Paga el statement desde una cuenta bancaria (CHECKING o CASH).

        - `amount` opcional: si None o >= `outstanding_balance`, paga
          el saldo total. Si < `outstanding_balance`, es un pago
          parcial: el status pasa a `PARTIALLY_PAID` (no `PAID`).
        - Crea un `TreasuryMovement` TRANSFER desde `payment_account`
          (origen = banco) hacia la `card_account` (destino = tarjeta /
          LIABILITY).
        - El asiento estándar de TreasuryService (TRANSFER) hace
          Debe `card_account` (LIABILITY — baja deuda) / Haber
          `payment_account` (banco — baja saldo). Esto es correcto
          para LIABILITIES y ASSETS, así que no necesita JE custom.
        - Si el total a pagar es 0, solo marca el statement como PAID
          (caso raro: statement vacío).
        - Idempotente: si ya está PAID, retorna sin error. Si está
          `PARTIALLY_PAID`, acepta pagos parciales adicionales
          hasta completar el total.

        Validaciones (Gap 1.3, ADR-0037 + Onda 3, ADR-0044):
        - `payment_account` debe ser ASSET (CHECKING o CASH). Cualquier
          otro tipo (otra tarjeta, BRIDGE, CHECK_PORTFOLIO…) es rechazado.
        - Si es CHECKING, debe tener saldo suficiente. Si es CASH, también
          (la validación de CASH ya existe en TreasuryService, pero la
          hacemos explícita aquí para no depender de ella).
        """
        from .services import TreasuryService

        if statement.status == CreditCardStatement.Status.PAID:
            return statement  # idempotente
        if statement.status not in (
            CreditCardStatement.Status.OPEN,
            CreditCardStatement.Status.OVERDUE,
            CreditCardStatement.Status.PARTIALLY_PAID,
        ):
            raise ValidationError(
                _t(
                    "Solo se puede pagar un statement OPEN, OVERDUE o "
                    "PARTIALLY_PAID (estado: %(s)s)."
                )
                % {"s": statement.get_status_display()}
            )

        # Validación de tipo de cuenta de pago.
        valid_types = (
            TreasuryAccount.Type.CHECKING,
            TreasuryAccount.Type.CASH,
        )
        if payment_account.account_type not in valid_types:
            raise ValidationError(
                _t(
                    "La cuenta de pago debe ser una cuenta bancaria (CHECKING) o caja (CASH). "
                    "Tipo recibido: %(t)s."
                )
                % {"t": payment_account.get_account_type_display()}
            )

        total = statement.total_to_pay
        already_paid = statement.amount_paid or Decimal("0")
        outstanding = max(total - already_paid, Decimal("0"))

        # Resolver el monto a pagar.
        pay_date = date or timezone.now().date()
        if amount is None:
            amount = outstanding  # default: pagar todo el saldo
        else:
            amount = Decimal(str(amount))

        # Caso especial: statement con saldo 0 (Onda 3) — marca PAID
        # sin crear movimiento, aunque el caller no haya pasado
        # `amount` explícitamente. Esto cubre: (a) un statement
        # recién emitido sin consumos (billed=0), (b) un statement
        # con todos los pagos parciales ya completados, etc.
        # En estos casos no hay nada que pagar pero el operador
        # quiere "cerrar" el statement a PAID.
        if outstanding <= 0:
            statement.amount_paid = already_paid
            statement.status = CreditCardStatement.Status.PAID
            statement.paid_at = timezone.now()
            statement.save(
                update_fields=[
                    "amount_paid",
                    "status",
                    "paid_at",
                    "updated_at",
                ]
            )
            return statement

        if amount <= 0:
            raise ValidationError(
                _t("El monto a pagar debe ser mayor a cero (recibido: %(a)s).") % {"a": str(amount)}
            )
        if amount > outstanding:
            # Truncar al saldo (no error). El operador puede pasar
            # `amount = total` por simplicidad y el sistema corrige.
            amount = outstanding

        # Validación de fondos. Permite pagar aunque no haya saldo
        # si `amount == 0` (statement vacío) — caso que ya no llega
        # acá por el check anterior.
        if amount > payment_account.current_balance:
            raise ValidationError(
                _t("Saldo insuficiente en %(acc)s. Disponible: $%(avail)s, a pagar: $%(amt)s.")
                % {
                    "acc": payment_account.name,
                    "avail": f"{payment_account.current_balance:,.0f}",
                    "amt": f"{amount:,.0f}",
                }
            )

        # Crear el movimiento TRANSFER.
        movement = TreasuryService.create_movement(
            amount=amount,
            movement_type=TreasuryMovement.Type.TRANSFER,
            payment_method=TreasuryMovement.Method.TRANSFER,
            from_account=payment_account,
            to_account=statement.card_account,
            date=pay_date,
            created_by=created_by,
            reference=statement.display_id,
            notes=(
                f"Pago {'parcial' if amount < outstanding else 'total'} "
                f"estado de cuenta {statement.display_id} "
                f"({statement.period_month:02d}/{statement.period_year})"
            ),
        )
        # Vincular el movimiento al statement via `from_card_statement`
        # (Onda 3, ADR-0044). Esto permite listar todos los pagos
        # parciales del statement via `statement.payment_movements.all()`.
        movement.from_card_statement = statement
        movement.save(update_fields=["from_card_statement"])
        # FK al ÚLTIMO pago (no OneToOne, Onda 3). El listado
        # completo está disponible vía `statement.payment_movements.all()`.
        statement.payment_movement = movement
        statement.payment_account = payment_account
        statement.amount_paid = (already_paid or Decimal("0")) + amount

        # Transición de status: PARTIALLY_PAID si queda saldo, PAID
        # si outstanding == 0.
        new_outstanding = total - statement.amount_paid
        if new_outstanding <= Decimal("0"):
            statement.status = CreditCardStatement.Status.PAID
            statement.paid_at = timezone.now()
        else:
            statement.status = CreditCardStatement.Status.PARTIALLY_PAID

        statement.save(
            update_fields=[
                "payment_movement",
                "payment_account",
                "amount_paid",
                "paid_at",
                "status",
                "updated_at",
            ]
        )
        return statement

    # ── Cancelación (utility) ─────────────────────────────────────────────

    @staticmethod
    @transaction.atomic
    def cancel_statement(
        statement: CreditCardStatement,
        *,
        notes: str = "",
    ) -> CreditCardStatement:
        """
        Anula un statement OPEN. Si ya se aplicaron cargos y/o pagos,
        el operador debe revertir los movimientos manualmente antes.
        """
        if statement.status == CreditCardStatement.Status.PAID:
            raise ValidationError(
                _t("No se puede anular un statement ya pagado. Revierta el pago primero.")
            )
        statement.status = CreditCardStatement.Status.CANCELED
        if notes:
            statement.notes = (statement.notes + "\n" + notes).strip() if statement.notes else notes
        statement.save(update_fields=["status", "notes", "updated_at"])
        return statement

    # ── Reversa transaccional completa (Gap 1.6) ──────────────────────────

    @staticmethod
    @transaction.atomic
    def reverse_statement(
        statement: CreditCardStatement,
        *,
        notes: str = "",
    ) -> CreditCardStatement:
        """
        Reversa contablemente todos los movimientos vinculados al
        statement en una sola operación atómica (Gap 1.6, ADR-0037):

        1. Reversa el `JournalEntry` del cargo (si existe) y borra el
           `charges_movement` con su FK desligada.
        2. Reversa el `JournalEntry` del pago (si existe) y borra el
           `payment_movement` con su FK desligada.
        3. Marca el statement como `CANCELED` con timestamp en `notes`.

        Deja la tarjeta y el banco en el mismo balance que antes de
        aplicar cargos o pagar. Útil para corregir errores de carga
        del estado de cuenta.

        Si el statement no tiene movimientos vinculados, sólo cambia
        el estado a CANCELED (equivalente a `cancel_statement`).

        Si el statement ya está CANCELED, es idempotente (no-op).
        Si está OPEN/OVERDUE, ejecuta la reversa.

        Raises `ValidationError` si el cargo/pago está reconciliado
        contra el banco (no se puede reversar sin des-reconciliar).
        """
        from accounting.models import JournalEntry as JournalEntryModel
        from accounting.services import JournalEntryService

        if statement.status == CreditCardStatement.Status.CANCELED:
            return statement  # idempotente

        if statement.status == CreditCardStatement.Status.PAID:
            raise ValidationError(
                "No se puede anular un estado de cuenta pagado. "
                "Revierta el pago primero."
            )

        timestamp = timezone.now().isoformat()
        reversal_lines: list[str] = []
        reversible_statuses = (
            JournalEntryModel.Status.POSTED,
            JournalEntryModel.Status.CLOSED,
        )

        # 1) Reversar cargo (si existe).
        old_charges_mv = statement.charges_movement
        if old_charges_mv is not None:
            if old_charges_mv.is_reconciled:
                raise ValidationError(
                    _t(
                        "El movimiento de cargos está conciliado. Des-reconcílielo antes de reversar."
                    )
                )
            if (
                old_charges_mv.journal_entry
                and old_charges_mv.journal_entry.status in reversible_statuses
            ):
                try:
                    JournalEntryService.reverse_entry(
                        old_charges_mv.journal_entry,
                        description=(
                            f"REVERSO cargos {statement.display_id} (anulación de statement)"
                        ),
                    )
                    reversal_lines.append(f"Cargos {old_charges_mv.display_id} reversados")
                except ValidationError:
                    # Si ya estaba revertido, no es error: limpiamos igual.
                    pass
            old_charges_mv.journal_entry = None
            old_charges_mv.save(update_fields=["journal_entry"])
            old_charges_mv.delete()
            statement.charges_movement = None

        # 2) Reversar pagos (Onda 3: N pagos parciales, no sólo
        # el último). Itera `payment_movements.all()` para revertir
        # todos los TRANSFERs vinculados al statement.
        old_payment_mvs = list(statement.payment_movements.all())
        for old_payment_mv in old_payment_mvs:
            if old_payment_mv.is_reconciled:
                raise ValidationError(
                    _t(
                        "El movimiento de pago %(id)s está conciliado. "
                        "Des-reconcílielo antes de reversar."
                    )
                    % {"id": old_payment_mv.display_id}
                )
            if (
                old_payment_mv.journal_entry
                and old_payment_mv.journal_entry.status in reversible_statuses
            ):
                try:
                    JournalEntryService.reverse_entry(
                        old_payment_mv.journal_entry,
                        description=(
                            f"REVERSO pago {statement.display_id} (anulación de statement)"
                        ),
                    )
                    reversal_lines.append(f"Pago {old_payment_mv.display_id} reversado")
                except ValidationError:
                    pass
            old_payment_mv.journal_entry = None
            old_payment_mv.save(update_fields=["journal_entry"])
            old_payment_mv.delete()
        if old_payment_mvs:
            statement.payment_movement = None
            statement.payment_account = None
            statement.paid_at = None
            statement.amount_paid = Decimal("0")

        # 2.5) Des-facturar cuotas del cronograma y cargos (ADR-0046), y
        # reversar el asiento de cargos diferidos si existe. Así las cuotas
        # y los cargos vuelven a "pendiente" y se pueden re-facturar.
        from django.contrib.contenttypes.models import ContentType as _CT

        ct_stmt = _CT.objects.get_for_model(CreditCardStatement)
        billing_entries = JournalEntryModel.objects.filter(
            source_content_type=ct_stmt,
            source_object_id=statement.id,
            reference=statement.display_id,
            status__in=reversible_statuses,
        )
        for je in billing_entries:
            try:
                JournalEntryService.reverse_entry(
                    je,
                    description=(
                        f"REVERSO facturación {statement.display_id} (anulación de statement)"
                    ),
                )
                reversal_lines.append(f"Facturación {statement.display_id} reversada")
            except ValidationError:
                pass
        # Volver a "no facturado": cargos pendientes + cuotas del cronograma.
        CardPendingCharge.objects.filter(billed_in_statement=statement).update(
            is_billed=False,
            billed_in_statement=None,
        )
        CardPurchaseInstallment.objects.filter(billed_in_statement=statement).update(
            is_billed=False,
            billed_in_statement=None,
        )

        # 3) Marcar CANCELED.
        statement.status = CreditCardStatement.Status.CANCELED
        log_lines = [f"[REVERSAL] {timestamp}"]
        log_lines.extend(reversal_lines)
        if notes:
            log_lines.append(notes)
        statement.notes = (
            (statement.notes + "\n" + "\n".join(log_lines))
            if statement.notes
            else "\n".join(log_lines)
        )
        statement.save(
            update_fields=[
                "status",
                "notes",
                "charges_movement",
                "payment_movement",
                "payment_account",
                "paid_at",
                "amount_paid",
                "updated_at",
            ]
        )
        return statement

    # ── Recalcular billed_amount desde movimientos (Gap 1.2) ─────────────

    @staticmethod
    @transaction.atomic
    def recalculate_billed_amount(
        statement: CreditCardStatement,
        *,
        commit: bool = True,
    ) -> Decimal:
        """
        Recalcula `billed_amount` del statement sumando los `OUTBOUND`
        sobre `card_account` con `date` en [period_start, cut_off_date].

        - `period_start` = primer día del mes del período.
        - `period_end`   = `cut_off_date` del statement.
        - E3: `billed_amount` representa SOLO el principal facturado
          (compras directas + cuotas del cronograma). El interés y las
          comisiones del statement viven en `interest_charged` /
          `fees_charged` y `total_to_pay` los suma aparte; NO se incluyen
          acá (incluirlos contaría el cargo financiero dos veces).

        Si difiere del valor actual y `commit=True`, actualiza y registra
        la fecha del recálculo en `notes`. Idempotente: una segunda llamada
        con los mismos movimientos no genera cambios.

        Retorna el monto calculado.
        """

        period_start = _date(statement.period_year, statement.period_month, 1)
        # `cut_off_date` puede ser anterior o posterior al fin del mes —
        # el cargo de la tarjeta se acumula hasta el cierre real, no
        # necesariamente hasta el último día del mes.
        period_end = statement.cut_off_date
        if period_end < period_start:
            raise ValidationError(
                _t("cut_off_date (%(co)s) no puede ser anterior al inicio del período (%(ps)s).")
                % {"co": period_end.isoformat(), "ps": period_start.isoformat()}
            )

        # OUTBOUND de cargos directos del período (gasto ad-hoc con la
        # tarjeta). Se EXCLUYE el OUTBOUND del uso de una compra en cuotas
        # (ADR-0046: `card_purchase_group` set + `installment_number` NULL),
        # porque ese pasivo se factura cuota a cuota vía el cronograma, no
        # por su monto total en el período. Las cuotas legacy
        # (`installment_number` set) sí se cuentan.
        outbound_sum = TreasuryMovement.objects.filter(
            from_account=statement.card_account,
            movement_type=TreasuryMovement.Type.OUTBOUND,
            date__gte=period_start,
            date__lte=period_end,
        ).exclude(
            card_purchase_group__isnull=False,
            installment_number__isnull=True,
        ).aggregate(total=dj_models.Sum("amount"))["total"] or Decimal("0")

        # Cuotas del cronograma (ADR-0046) facturadas en ESTE statement.
        schedule_sum = CardPurchaseInstallment.objects.filter(
            billed_in_statement=statement
        ).aggregate(total=dj_models.Sum("principal_amount"))["total"] or Decimal("0")

        # E3: NO se suman los `ADJUSTMENT` de interés/comisiones de
        # `apply_charges`. Esos cargos financieros se reflejan en
        # `interest_charged` / `fees_charged` y `total_to_pay` los agrega
        # aparte; incluirlos en `billed_amount` los contaría dos veces
        # (inflando el total a pagar).
        new_amount = (outbound_sum or Decimal("0")) + (schedule_sum or Decimal("0"))
        if not commit:
            return new_amount

        if statement.billed_amount != new_amount:
            old_amount = statement.billed_amount or Decimal("0")
            statement.billed_amount = new_amount
            note = (
                f"[RECALC] billed_amount {old_amount} → {new_amount} "
                f"el {timezone.now().date().isoformat()} "
                f"(OUTBOUND={outbound_sum}, SCHEDULE={schedule_sum})"
            )
            statement.notes = (statement.notes + "\n" + note) if statement.notes else note
            statement.save(update_fields=["billed_amount", "notes", "updated_at"])
        return new_amount

    # ── Cargos no facturados (Onda 4) ────────────────────────────────────

    @staticmethod
    def get_pending_charges(
        card_account: TreasuryAccount,
        cut_off_date: _date | None = None,
    ):
        """
        Retorna los cargos pendientes (no facturados) de una tarjeta de
        crédito que NO son TreasuryMovement: comisiones, impuestos, seguros
        y otros cargos creados con `add_unbilled_charge`.

        Estos cargos se facturan en el statement y SOLO al pagar se genera
        un TreasuryMovement TRANSFER (un solo movimiento por evento real).
        """
        qs = CardPendingCharge.objects.filter(
            card_account=card_account,
            is_billed=False,
        )
        if cut_off_date:
            qs = qs.filter(date__lte=cut_off_date)

        return qs.order_by("-date", "-id")

    @staticmethod
    def get_unbilled_installments(
        card_account: TreasuryAccount,
        cut_off_date: _date | None = None,
    ):
        """
        Cuotas del cronograma (ADR-0046) aún no facturadas de una TC.
        Si se pasa `cut_off_date`, solo las que vencen hasta esa fecha.
        """
        qs = CardPurchaseInstallment.objects.filter(
            card_purchase_group__card_account=card_account,
            is_billed=False,
        ).select_related("card_purchase_group", "card_purchase_group__partner")
        if cut_off_date:
            qs = qs.filter(due_date__lte=cut_off_date)
        return qs.order_by("due_date", "number", "id")

    @staticmethod
    def get_unbilled_summary(
        card_account: TreasuryAccount,
        cut_off_date: _date | None = None,
    ) -> dict:
        """
        Retorna resumen de cargos no facturados:
        - total: suma de todos los cargos no facturados (pendientes + cuotas)
        - count: cantidad de cargos
        - charges: suma de cargos financieros (CardPendingCharge)
        - installments: suma del principal de cuotas pendientes (cronograma)
        """
        from django.db import models as dj_models

        pending = CardService.get_pending_charges(card_account, cut_off_date=cut_off_date)
        charges = pending.aggregate(total=dj_models.Sum("amount"))["total"] or Decimal("0")
        sched_qs = CardService.get_unbilled_installments(card_account, cut_off_date=cut_off_date)
        installments = sched_qs.aggregate(total=dj_models.Sum("principal_amount"))[
            "total"
        ] or Decimal("0")
        count = pending.count() + sched_qs.count()

        return {
            "total": charges + installments,
            "count": count,
            "charges": charges,
            "installments": installments,
        }

    # ── Forecast / Forward-looking analytics ─────────────────

    @staticmethod
    def get_forecast(
        card_account: TreasuryAccount,
        cut_off_date: _date | None = None,
    ) -> dict:
        """
        Retorna datos prospectivos para el dashboard forward-looking
        de cargos no facturados:
          - next_statement_date / days_to_next_statement
          - next_statement_total (cargos + cuotas que caerían en el
            próximo cierre)
          - by_month: agregación de cuotas por mes calendario
            { 'YYYY-MM': { total, count } }
          - credit_limit, total_used, available_credit
        """
        from datetime import date as _date_type

        today = _date_type.today()

        # ── Próxima fecha de cierre estimada ───────────────────────
        last_stmt = (
            CreditCardStatement.objects.filter(card_account=card_account)
            .order_by("-period_year", "-period_month")
            .first()
        )
        if last_stmt:
            ref = last_stmt.cut_off_date
            next_cutoff = _date_type(
                ref.year + (ref.month // 12),
                (ref.month % 12) + 1,
                min(ref.day, 28),
            )
        else:
            next_month = today.replace(day=28) + _date_type.resolution * 4
            next_cutoff = _date_type(next_month.year, next_month.month, 1) - _date_type.resolution
            next_cutoff = _date_type(next_cutoff.year, next_cutoff.month, 28)

        days_to_next = (next_cutoff - today).days

        pending_until_cutoff = CardService.get_pending_charges(
            card_account, cut_off_date=next_cutoff
        )
        sched_until_cutoff = CardService.get_unbilled_installments(
            card_account, cut_off_date=next_cutoff
        )
        pending = CardService.get_pending_charges(card_account, cut_off_date=cut_off_date)
        sched_all = CardService.get_unbilled_installments(card_account, cut_off_date=cut_off_date)

        pending_total_until = pending_until_cutoff.aggregate(total=dj_models.Sum("amount"))[
            "total"
        ] or Decimal("0")
        sched_total_until = sched_until_cutoff.aggregate(total=dj_models.Sum("principal_amount"))[
            "total"
        ] or Decimal("0")
        next_stmt_total = pending_total_until + sched_total_until

        by_month: dict[str, dict] = {}
        for inst in sched_all:
            key = inst.due_date.strftime("%Y-%m")
            bucket = by_month.setdefault(key, {"total": Decimal("0"), "count": 0})
            bucket["total"] += inst.principal_amount
            bucket["count"] += 1

        by_month_serializable = {}
        for k, v in by_month.items():
            by_month_serializable[k] = {
                "total": str(v["total"]),
                "count": v["count"],
            }

        credit_limit = card_account.credit_limit
        available = card_account.available_credit

        pending_total = pending.aggregate(total=dj_models.Sum("amount"))["total"] or Decimal("0")
        sched_total = sched_all.aggregate(total=dj_models.Sum("principal_amount"))[
            "total"
        ] or Decimal("0")
        total_unbilled = pending_total + sched_total
        current_debt = (
            abs(card_account.current_balance) if card_account.current_balance else Decimal("0")
        )
        total_used = current_debt + total_unbilled

        return {
            "next_statement_date": next_cutoff.isoformat(),
            "days_to_next_statement": max(days_to_next, 0),
            "next_statement_total": str(next_stmt_total),
            "pending_until_next_statement": str(pending_total_until),
            "installments_until_next_statement": str(sched_total_until),
            "by_month": by_month_serializable,
            "credit_limit": str(credit_limit) if credit_limit else None,
            "total_used": str(total_used),
            "current_debt": str(current_debt),
            "total_unbilled": str(total_unbilled),
            "available_credit": str(available) if available is not None else None,
        }

    @staticmethod
    @transaction.atomic
    def add_unbilled_charge(
        *,
        card_account: TreasuryAccount,
        amount: Decimal,
        charge_type: str = "OTHER",
        description: str = "",
        date: _date | None = None,
        created_by: "AbstractUser | None" = None,
    ):
        """
        Agrega un cargo pendiente de facturar a la tarjeta de crédito.

        - `charge_type`: tipo de cargo (COMMISSION, TAX, FEE, INSURANCE, OTHER)
        - Crea un CardPendingCharge (NO un TreasuryMovement — el único
          movimiento de tesorería en el ciclo es el TRANSFER al pagar).
        - No genera asiento contable (se contabiliza al facturar).

        Retorna el CardPendingCharge creado.
        """
        if card_account.account_type != TreasuryAccount.Type.CREDIT_CARD:
            raise ValidationError(
                _t("La cuenta debe ser de tipo Tarjeta de Crédito (CREDIT_CARD).")
            )
        if amount <= 0:
            raise ValidationError(_t("El monto debe ser mayor a cero."))

        if not date:
            date = timezone.now().date()

        charge = CardPendingCharge.objects.create(
            card_account=card_account,
            amount=amount,
            charge_type=charge_type,
            description=description,
            date=date,
            created_by=created_by,
        )
        return charge

    @staticmethod
    @transaction.atomic
    def bill_unbilled_charges(
        *,
        card_account: TreasuryAccount,
        period_year: int,
        period_month: int,
        cut_off_date: _date,
        due_date: _date,
        minimum_payment: Decimal = Decimal("0"),
        credit_limit: Decimal | None = None,
        notes: str = "",
        created_by: "AbstractUser | None" = None,
    ) -> CreditCardStatement:
        """
        Factura los cargos pendientes de una TC en un statement mensual
        (ADR-0046).

        Dos fuentes:
          1. Cuotas del cronograma (`CardPurchaseInstallment`) con
             `due_date <= cut_off_date` aún no facturadas. El uso de la
             tarjeta ya se contabilizó al comprar; acá NO se postea
             principal.
          2. Cargos pendientes (`get_pending_charges`): comisiones/
             impuestos (CardPendingCharge, diferidos, sin asiento).
             Se contabilizan al facturar.

        Marca ambas fuentes como facturadas, arma el desglose por grupo
        de compra y retorna el statement.
        """
        # 1) Cuotas del cronograma que vencen hasta el cierre.
        schedule_rows = list(
            CardPurchaseInstallment.objects.filter(
                card_purchase_group__card_account=card_account,
                is_billed=False,
                due_date__lte=cut_off_date,
            ).select_related("card_purchase_group", "card_purchase_group__partner")
        )
        schedule_total = sum((r.principal_amount for r in schedule_rows), Decimal("0"))

        # 2) Cargos pendientes (CardPendingCharge — diferidos, sin asiento).
        pending = CardService.get_pending_charges(card_account, cut_off_date=cut_off_date)
        pending_rows = list(pending)
        pending_total = sum((p.amount for p in pending_rows), Decimal("0"))

        total = schedule_total + pending_total
        if total <= 0:
            raise ValidationError(_t("No hay cargos no facturados para facturar en este período."))

        # ── Desglose por grupo de compra (cronograma + pendientes) ──
        groups_data: dict = {}
        standalone_charges: list = []

        def _add_charge(group, charge):
            if group is None:
                standalone_charges.append(charge)
                return
            bucket = groups_data.setdefault(group.id, {"group": group, "charges": []})
            bucket["charges"].append(charge)

        for r in schedule_rows:
            g = r.card_purchase_group
            _add_charge(
                g,
                {
                    "id": r.id,
                    "amount": str(r.principal_amount),
                    "installment_number": r.number,
                    "is_installment_interest": False,
                    "movement_type": TreasuryMovement.Type.OUTBOUND,
                    "reference": f"{EntityPrefix.CARD_PURCHASE_GROUP}-{g.uuid}-i{r.number}",
                    "date": str(r.due_date),
                },
            )
        for p in pending_rows:
            _add_charge(
                None,
                {
                    "id": p.id,
                    "amount": str(p.amount),
                    "installment_number": None,
                    "is_installment_interest": False,
                    "movement_type": "ADJUSTMENT",
                    "reference": f"{EntityPrefix.CARD_PENDING_CHARGE}-{p.id}",
                    "date": str(p.date),
                },
            )

        purchase_group_breakdown = []
        for _gid, gd in groups_data.items():
            group = gd["group"]
            charges = sorted(gd["charges"], key=lambda c: (c["installment_number"] or 0, c["id"]))
            subtotal = sum((Decimal(c["amount"]) for c in charges), Decimal("0"))
            purchase_group_breakdown.append(
                {
                    "id": group.id,
                    "uuid": str(group.uuid),
                    "total_amount": str(group.total_amount),
                    "installments": group.installments,
                    "monthly_rate": str(group.monthly_rate),
                    "principal_per_installment": str(group.principal_per_installment),
                    "first_installment_date": str(group.first_installment_date)
                    if group.first_installment_date
                    else None,
                    "partner_name": group.partner.name if group.partner else None,
                    "partner_id": group.partner_id,
                    "client_reference": group.client_reference,
                    "subtotal": str(subtotal),
                    "charges": charges,
                }
            )
        if standalone_charges:
            standalone_subtotal = sum(
                (Decimal(c["amount"]) for c in standalone_charges), Decimal("0")
            )
            purchase_group_breakdown.append(
                {
                    "id": None,
                    "uuid": None,
                    "total_amount": None,
                    "installments": None,
                    "monthly_rate": None,
                    "principal_per_installment": None,
                    "first_installment_date": None,
                    "partner_name": None,
                    "partner_id": None,
                    "client_reference": "Sin compra asociada",
                    "subtotal": str(standalone_subtotal),
                    "charges": standalone_charges,
                }
            )

        # Crear el statement.
        statement = CardService.open_statement(
            card_account=card_account,
            period_year=period_year,
            period_month=period_month,
            cut_off_date=cut_off_date,
            due_date=due_date,
            billed_amount=total,
            minimum_payment=minimum_payment,
            credit_limit=credit_limit,
            notes=notes,
            created_by=created_by,
        )

        # Marcar facturado: cuotas del cronograma + pendientes.
        if schedule_rows:
            CardPurchaseInstallment.objects.filter(
                id__in=[r.id for r in schedule_rows],
            ).update(is_billed=True, billed_in_statement=statement)
        if pending_rows:
            CardPendingCharge.objects.filter(
                id__in=[p.id for p in pending_rows],
            ).update(is_billed=True, billed_in_statement=statement)

        # Asiento: cargos diferidos (CardPendingCharge sin asiento previo).
        CardService._create_billing_entry(statement, pending_rows=pending_rows)

        statement._purchase_group_breakdown = purchase_group_breakdown
        return statement

    @staticmethod
    def _create_billing_entry(
        statement: CreditCardStatement,
        *,
        pending_rows=None,
    ):
        """
        Postea el asiento de facturación para los cargos **diferidos**
        (CardPendingCharge sin asiento previo):
          D: Gasto financiero  /  H: Pasivo tarjeta de crédito

        Solo se contabilizan los objetos con `journal_entry IS NULL`.
        """
        from django.contrib.contenttypes.models import ContentType

        from accounting.glosa_builder import GlosaBuilder, Roles
        from accounting.models import AccountingSettings, JournalEntry, JournalItem
        from accounting.services import JournalEntryService

        p_rows = pending_rows or []
        deferred = [p for p in p_rows if p.journal_entry_id is None]
        total = sum((d.amount for d in deferred), Decimal("0"))
        if total <= 0:
            return

        settings = AccountingSettings.get_solo()
        liability_account = statement.card_account.account
        expense_account = None
        if settings:
            expense_account = settings.bank_commission_account or settings.interest_expense_account
        if not liability_account or not expense_account or expense_account == liability_account:
            # Sin cuenta de gasto válida no posteamos: evita un asiento que
            # se auto-cancela (D=pasivo / H=pasivo) y deja el cargo sin
            # imputar al gasto. El operador debe configurar la cuenta.
            return

        doc_ref = statement.display_id
        entry = JournalEntry.objects.create(
            date=statement.cut_off_date,
            description=GlosaBuilder.build(
                GlosaBuilder.CARGOS_DIFERIDOS, doc_ref, statement.card_account.name,
                total, extra=[f"{statement.period_year}-{statement.period_month:02d}"],
            ),
            reference=doc_ref,
            status=JournalEntry.State.DRAFT,
            source_content_type=ContentType.objects.get_for_model(CreditCardStatement),
            source_object_id=statement.id,
        )
        JournalItem.objects.create(
            entry=entry,
            account=liability_account,
            debit=Decimal("0"),
            credit=total,
            label=GlosaBuilder.item(Roles.PASIVO_TC, "Cargos diferidos", doc_ref),
        )
        JournalItem.objects.create(
            entry=entry,
            account=expense_account,
            debit=total,
            credit=Decimal("0"),
            label=GlosaBuilder.item(Roles.GASTO, "Cargos TC diferidos", doc_ref),
        )
        JournalEntryService.post_entry(entry)

        # Vincular el asiento a los cargos diferidos (quedan "posteados",
        # idempotencia ante una segunda facturación accidental).
        for d in deferred:
            d.journal_entry = entry
            d.save(update_fields=["journal_entry"])
