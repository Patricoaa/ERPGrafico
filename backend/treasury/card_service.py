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

from decimal import Decimal, ROUND_HALF_UP
from typing import TYPE_CHECKING
from datetime import date as _date

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db import models as dj_models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _t

from .models import CreditCardStatement, TreasuryAccount, TreasuryMovement

if TYPE_CHECKING:
    from accounting.models import Account
    from django.contrib.auth.models import AbstractUser


class CardService:
    """Operaciones sobre la tarjeta de crédito propia."""

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
        billed_amount: Decimal = Decimal('0'),
        minimum_payment: Decimal = Decimal('0'),
        credit_limit: Decimal | None = None,
        notes: str = '',
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
            raise ValidationError(
                _t("La fecha de vencimiento no puede ser anterior al cierre.")
            )

        if CreditCardStatement.objects.filter(
            card_account=card_account,
            period_year=period_year,
            period_month=period_month,
        ).exists():
            raise ValidationError(
                _t("Ya existe un estado de cuenta para esta tarjeta y período.")
            )

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
                % {'s': statement.get_status_display()}
            )

        interest = statement.interest_charged or Decimal('0')
        fees = statement.fees_charged or Decimal('0')
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
                getattr(settings_obj, 'interest_expense_account', None) if settings_obj else None
            )
            if interest_expense_account is None:
                raise ValidationError(
                    _t("No hay cuenta de gasto por intereses configurada. "
                       "Configure `AccountingSettings.interest_expense_account` "
                       "o pase `interest_expense_account` explícitamente.")
                )

        if fees and not fees_expense_account:
            fees_expense_account = (
                getattr(settings_obj, 'bank_commission_account', None) if settings_obj else None
            )
            if fees_expense_account is None:
                raise ValidationError(
                    _t("No hay cuenta de gasto por comisiones configurada. "
                       "Configure `AccountingSettings.bank_commission_account` "
                       "o pase `fees_expense_account` explícitamente.")
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

        entry = JournalEntry.objects.create(
            date=apply_date,
            description=(
                f"Cargos financieros {statement.display_id} "
                f"({statement.period_month:02d}/{statement.period_year})"
            ),
            reference=f"CHG-{statement.display_id}",
            status=JournalEntry.Status.DRAFT,
            source_content_type=ContentType.objects.get_for_model(statement),
            source_object_id=statement.id,
        )

        # El Haber siempre es el pasivo (sube la deuda) por el total.
        JournalItem.objects.create(
            entry=entry, account=liability_acc,
            debit=Decimal('0'), credit=total,
        )

        # El Debe: las cuentas de gasto YA están validadas arriba
        # (Gap 1.5b, ADR-0037). Si llegamos aquí, son siempre válidas
        # y la imputación es Debe gasto / Haber pasivo — sin
        # workaround.
        if interest:
            JournalItem.objects.create(
                entry=entry, account=interest_expense_account,
                debit=interest, credit=Decimal('0'),
            )
        if fees:
            JournalItem.objects.create(
                entry=entry, account=fees_expense_account,
                debit=fees, credit=Decimal('0'),
            )

        JournalEntryService.post_entry(entry)

        movement.journal_entry = entry
        movement.save(update_fields=['journal_entry'])

        # Vincular el FK directo (Gap 1.4). Permite recálculo
        # posterior y búsqueda robusta por `reapply_charges` /
        # `reverse_statement`.
        statement.charges_movement = movement
        statement.notes = (
            f"[CHARGES] Movimiento {movement.display_id} aplicado el "
            f"{apply_date.isoformat()}.\n" + (statement.notes or '')
        ).strip()
        statement.save(update_fields=['charges_movement', 'notes', 'updated_at'])
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
                _t("Solo se pueden reaplicar cargos a un statement OPEN u OVERDUE "
                   "(estado: %(s)s).")
                % {'s': statement.get_status_display()}
            )

        old_movement = statement.charges_movement
        if old_movement is not None:
            from accounting.services import JournalEntryService
            if old_movement.journal_entry and old_movement.journal_entry.status in (
                'POSTED', 'CLOSED',
            ):
                # `reverse_entry` valida que no esté ya revertido.
                try:
                    JournalEntryService.reverse_entry(
                        old_movement.journal_entry,
                        description=(
                            f"REVERSO cargos {statement.display_id} (reaplicación)"
                        ),
                    )
                except ValidationError:
                    # Si ya estaba revertido, no es error: limpiamos igual.
                    pass
            # Borrar el movimiento (cascade del JE está manejado por
            # la FK PROTECT en TreasuryMovement.journal_entry; al
            # borrar el movimiento, primero desligamos el JE).
            old_movement.journal_entry = None
            old_movement.save(update_fields=['journal_entry'])
            old_movement.delete()
            statement.charges_movement = None
            statement.save(update_fields=['charges_movement'])

        return CardService.apply_charges(
            statement,
            interest_expense_account=interest_expense_account,
            fees_expense_account=fees_expense_account,
            date=date,
            created_by=created_by,
        )

    # ── Interés punitorio (Onda 3, ADR-0044) ──────────────────────────────

    @staticmethod
    def compute_punitory_interest(
        statement: CreditCardStatement,
        *,
        as_of_date: _date | None = None,
    ) -> Decimal:
        """
        Calcula el interés punitorio del emisor sobre el saldo
        impago a la fecha (Onda 3, ADR-0044).

        - Si `outstanding_balance <= 0` → 0.
        - Si `due_date >= as_of_date` (no vencido) → 0.
        - Si `settings.card_punitory_monthly_rate == 0` → 0
          (cálculo desactivado).
        - Meses de mora = `floor((as_of_date - due_date) / 30)`,
          mínimo 1.
        - Interés = `outstanding_balance × rate × meses_mora`,
          redondeado a 2 decimales con ROUND_HALF_UP.

        El cálculo es **on-demand**: no persiste. El caller decide
        si imputarlo vía `apply_punitory_interest`.
        """
        from accounting.models import AccountingSettings

        if as_of_date is None:
            from core.utils import get_current_date
            as_of_date = get_current_date()

        outstanding = statement.outstanding_balance
        if outstanding <= 0:
            return Decimal('0')
        if statement.due_date >= as_of_date:
            return Decimal('0')

        settings_obj, _ = AccountingSettings.objects.get_or_create()
        rate = settings_obj.card_punitory_monthly_rate or Decimal('0')
        if rate <= 0:
            return Decimal('0')

        # Meses de mora: 1 mes entero o fracción, mínimo 1.
        days_late = (as_of_date - statement.due_date).days
        months_late = max(1, days_late // 30)
        interest = (outstanding * rate * Decimal(months_late)).quantize(
            Decimal('0.01'), rounding=ROUND_HALF_UP,
        )
        return interest

    @staticmethod
    @transaction.atomic
    def apply_punitory_interest(
        statement: CreditCardStatement,
        *,
        as_of_date: _date | None = None,
        interest_expense_account: Account | None = None,
        created_by: "AbstractUser | None" = None,
    ) -> tuple[Decimal, TreasuryMovement | None]:
        """
        Calcula e imputa el interés punitorio al statement (Onda 3,
        ADR-0044). Idempotente por mes: si ya imputó el interés
        para el mes actual, no duplica el ADJUSTMENT.

        Devuelve `(interest, movement | None)`. Si el cálculo da
        0, devuelve `(0, None)` y no crea nada.

        El asiento: D=cuenta de gasto (configurable, default
        `settings.interest_expense_account`) / H=pasivo tarjeta.
        Referencia: `INT-PUN-{statement.display_id}-{YYYY-MM}`.
        """
        from accounting.models import AccountingSettings, Account as AccModel
        from .services import TreasuryService

        if statement.status not in (
            CreditCardStatement.Status.OPEN,
            CreditCardStatement.Status.OVERDUE,
            CreditCardStatement.Status.PARTIALLY_PAID,
        ):
            # No imputar interés a un statement PAID o CANCELED.
            return (Decimal('0'), None)

        if as_of_date is None:
            from core.utils import get_current_date
            as_of_date = get_current_date()

        interest = CardService.compute_punitory_interest(
            statement, as_of_date=as_of_date,
        )
        if interest <= 0:
            return (Decimal('0'), None)

        # Idempotencia por mes: no imputar dos veces el mismo mes.
        month_tag = as_of_date.strftime('%Y-%m')
        reference = f"INT-PUN-{statement.display_id}-{month_tag}"
        existing = TreasuryMovement.objects.filter(
            reference=reference,
            movement_type=TreasuryMovement.Type.ADJUSTMENT,
        ).first()
        if existing is not None:
            return (interest, existing)  # ya estaba aplicado

        # Resolver cuenta de gasto.
        if interest_expense_account is None:
            settings_obj, _ = AccountingSettings.objects.get_or_create()
            interest_expense_account = settings_obj.interest_expense_account
        if interest_expense_account is None:
            raise ValidationError(
                _t("No hay cuenta de gasto para imputar el interés "
                   "punitorio. Configure `AccountingSettings."
                   "interest_expense_account` o pase la cuenta "
                   "explícitamente.")
            )

        # Crear el ADJUSTMENT que imputa el interés.
        movement = TreasuryService.create_movement(
            amount=interest,
            movement_type=TreasuryMovement.Type.ADJUSTMENT,
            payment_method=TreasuryMovement.Method.CARD,
            from_account=statement.card_account,
            date=as_of_date,
            created_by=created_by,
            reference=reference,
            notes=(
                f"Interés punitorio {month_tag} sobre saldo impago "
                f"${statement.outstanding_balance:,.0f} "
                f"({statement.display_id})"
            ),
        )
        # Vincular al statement (trazabilidad via from_card_statement
        # FK; no es un "pago", sólo referencia). Esto permite
        # listar todos los movimientos relacionados al statement
        # (pagos + intereses punitorios + cargos) si fuera
        # necesario.
        movement.from_card_statement = statement
        movement.save(update_fields=['from_card_statement'])

        # NO capitalizamos: el interés punitorio es un ADJUSTMENT
        # independiente (D=gasto / H=pasivo). NO se suma a
        # `interest_charged` del statement para no inflar
        # `total_to_pay` y crear un efecto de capitalización no
        # deseado (ver ADR-0044, decisión D-5).
        #
        # La trazabilidad queda via el ADJUSTMENT vinculado al
        # statement por `from_card_statement`. La idempotencia
        # por mes se mantiene via la `reference` con YYYY-MM.

        return (interest, movement)

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
        - Si `settings.card_minimum_payment_block` y el statement
          tiene `minimum_payment > 0`, rechaza pagos parciales
          menores a `minimum_payment` con ValidationError.
        """
        from accounting.models import AccountingSettings
        from .services import TreasuryService

        if statement.status == CreditCardStatement.Status.PAID:
            return statement  # idempotente
        if statement.status not in (
            CreditCardStatement.Status.OPEN,
            CreditCardStatement.Status.OVERDUE,
            CreditCardStatement.Status.PARTIALLY_PAID,
        ):
            raise ValidationError(
                _t("Solo se puede pagar un statement OPEN, OVERDUE o "
                   "PARTIALLY_PAID (estado: %(s)s).")
                % {'s': statement.get_status_display()}
            )

        # Validación de tipo de cuenta de pago.
        valid_types = (
            TreasuryAccount.Type.CHECKING,
            TreasuryAccount.Type.CASH,
        )
        if payment_account.account_type not in valid_types:
            raise ValidationError(
                _t("La cuenta de pago debe ser una cuenta bancaria (CHECKING) o caja (CASH). "
                   "Tipo recibido: %(t)s.")
                % {'t': payment_account.get_account_type_display()}
            )

        total = statement.total_to_pay
        already_paid = statement.amount_paid or Decimal('0')
        outstanding = max(total - already_paid, Decimal('0'))

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
            statement.save(update_fields=[
                'amount_paid', 'status', 'paid_at', 'updated_at',
            ])
            return statement

        if amount <= 0:
            raise ValidationError(
                _t("El monto a pagar debe ser mayor a cero (recibido: %(a)s).")
                % {'a': str(amount)}
            )
        if amount > outstanding:
            # Truncar al saldo (no error). El operador puede pasar
            # `amount = total` por simplicidad y el sistema corrige.
            amount = outstanding

        # Validación de pago mínimo (Onda 3, ADR-0044, opcional).
        settings_obj, _ = AccountingSettings.objects.get_or_create()
        if (
            statement.minimum_payment
            and statement.minimum_payment > 0
            and settings_obj.card_minimum_payment_block
            and amount < statement.minimum_payment
            and amount < outstanding
        ):
            raise ValidationError(
                _t("Pago parcial ($%(a)s) menor al mínimo exigido "
                   "($%(m)s) y el bloqueo está activo. Si querés "
                   "habilitar pagos menores, desactivá "
                   "`card_minimum_payment_block` en AccountingSettings.")
                % {
                    'a': f"{amount:,.0f}",
                    'm': f"{statement.minimum_payment:,.0f}",
                }
            )

        # Validación de fondos. Permite pagar aunque no haya saldo
        # si `amount == 0` (statement vacío) — caso que ya no llega
        # acá por el check anterior.
        if amount > payment_account.current_balance:
            raise ValidationError(
                _t("Saldo insuficiente en %(acc)s. Disponible: $%(avail)s, a pagar: $%(amt)s.")
                % {
                    'acc': payment_account.name,
                    'avail': f"{payment_account.current_balance:,.0f}",
                    'amt': f"{amount:,.0f}",
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
        movement.save(update_fields=['from_card_statement'])
        # FK al ÚLTIMO pago (no OneToOne, Onda 3). El listado
        # completo está disponible vía `statement.payment_movements.all()`.
        statement.payment_movement = movement
        statement.payment_account = payment_account
        statement.amount_paid = (already_paid or Decimal('0')) + amount

        # Transición de status: PARTIALLY_PAID si queda saldo, PAID
        # si outstanding == 0.
        new_outstanding = total - statement.amount_paid
        if new_outstanding <= Decimal('0'):
            statement.status = CreditCardStatement.Status.PAID
            statement.paid_at = timezone.now()
        else:
            statement.status = CreditCardStatement.Status.PARTIALLY_PAID

        statement.save(update_fields=[
            'payment_movement', 'payment_account', 'amount_paid',
            'paid_at', 'status', 'updated_at',
        ])
        return statement

    # ── Cancelación (utility) ─────────────────────────────────────────────

    @staticmethod
    @transaction.atomic
    def cancel_statement(
        statement: CreditCardStatement,
        *,
        notes: str = '',
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
        statement.save(update_fields=['status', 'notes', 'updated_at'])
        return statement

    # ── Reversa transaccional completa (Gap 1.6) ──────────────────────────

    @staticmethod
    @transaction.atomic
    def reverse_statement(
        statement: CreditCardStatement,
        *,
        notes: str = '',
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
        from accounting.services import JournalEntryService
        from accounting.models import JournalEntry as JournalEntryModel

        if statement.status == CreditCardStatement.Status.CANCELED:
            return statement  # idempotente

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
                    _t("El movimiento de cargos está conciliado. Des-reconcílielo antes de reversar.")
                )
            if old_charges_mv.journal_entry and old_charges_mv.journal_entry.status in reversible_statuses:
                try:
                    JournalEntryService.reverse_entry(
                        old_charges_mv.journal_entry,
                        description=(
                            f"REVERSO cargos {statement.display_id} "
                            f"(anulación de statement)"
                        ),
                    )
                    reversal_lines.append(f"Cargos {old_charges_mv.display_id} reversados")
                except ValidationError:
                    # Si ya estaba revertido, no es error: limpiamos igual.
                    pass
            old_charges_mv.journal_entry = None
            old_charges_mv.save(update_fields=['journal_entry'])
            old_charges_mv.delete()
            statement.charges_movement = None

        # 2) Reversar pagos (Onda 3: N pagos parciales, no sólo
        # el último). Itera `payment_movements.all()` para revertir
        # todos los TRANSFERs vinculados al statement.
        old_payment_mvs = list(statement.payment_movements.all())
        for old_payment_mv in old_payment_mvs:
            if old_payment_mv.is_reconciled:
                raise ValidationError(
                    _t("El movimiento de pago %(id)s está conciliado. "
                       "Des-reconcílielo antes de reversar.")
                    % {'id': old_payment_mv.display_id}
                )
            if old_payment_mv.journal_entry and old_payment_mv.journal_entry.status in reversible_statuses:
                try:
                    JournalEntryService.reverse_entry(
                        old_payment_mv.journal_entry,
                        description=(
                            f"REVERSO pago {statement.display_id} "
                            f"(anulación de statement)"
                        ),
                    )
                    reversal_lines.append(f"Pago {old_payment_mv.display_id} reversado")
                except ValidationError:
                    pass
            old_payment_mv.journal_entry = None
            old_payment_mv.save(update_fields=['journal_entry'])
            old_payment_mv.delete()
        if old_payment_mvs:
            statement.payment_movement = None
            statement.payment_account = None
            statement.paid_at = None
            statement.amount_paid = Decimal('0')

        # 3) Marcar CANCELED.
        statement.status = CreditCardStatement.Status.CANCELED
        log_lines = [f"[REVERSAL] {timestamp}"]
        log_lines.extend(reversal_lines)
        if notes:
            log_lines.append(notes)
        statement.notes = (
            (statement.notes + "\n" + "\n".join(log_lines))
            if statement.notes else "\n".join(log_lines)
        )
        statement.save(update_fields=[
            'status', 'notes',
            'charges_movement', 'payment_movement', 'payment_account',
            'paid_at', 'amount_paid', 'updated_at',
        ])
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
        - Se incluyen también los `ADJUSTMENT` previos del propio statement
          (interest/fees que ya se aplicaron) para que el `billed_amount`
          refleje el "total facturado" cargado al cierre.

        Si difiere del valor actual y `commit=True`, actualiza y registra
        la fecha del recálculo en `notes`. Idempotente: una segunda llamada
        con los mismos movimientos no genera cambios.

        Retorna el monto calculado.
        """
        from calendar import monthrange

        period_start = _date(statement.period_year, statement.period_month, 1)
        # `cut_off_date` puede ser anterior o posterior al fin del mes —
        # el cargo de la tarjeta se acumula hasta el cierre real, no
        # necesariamente hasta el último día del mes.
        period_end = statement.cut_off_date
        if period_end < period_start:
            raise ValidationError(
                _t("cut_off_date (%(co)s) no puede ser anterior al inicio del período (%(ps)s).")
                % {'co': period_end.isoformat(), 'ps': period_start.isoformat()}
            )

        # OUTBOUND de compras del período (gasto real con la tarjeta).
        outbound_sum = (
            TreasuryMovement.objects
            .filter(
                from_account=statement.card_account,
                movement_type=TreasuryMovement.Type.OUTBOUND,
                date__gte=period_start,
                date__lte=period_end,
            )
            .aggregate(total=dj_models.Sum('amount'))['total']
            or Decimal('0')
        )

        # ADJUSTMENT previo del propio statement (interés + comisiones
        # ya aplicados vía `apply_charges`). Sumarlos evita que el
        # `billed_amount` se "pierda" el cargo financiero al recalcular.
        charges_sum = (
            TreasuryMovement.objects
            .filter(
                from_account=statement.card_account,
                movement_type=TreasuryMovement.Type.ADJUSTMENT,
                reference=statement.display_id,
            )
            .aggregate(total=dj_models.Sum('amount'))['total']
            or Decimal('0')
        )

        new_amount = (outbound_sum or Decimal('0')) + (charges_sum or Decimal('0'))
        if not commit:
            return new_amount

        if statement.billed_amount != new_amount:
            old_amount = statement.billed_amount or Decimal('0')
            statement.billed_amount = new_amount
            note = (
                f"[RECALC] billed_amount {old_amount} → {new_amount} "
                f"el {timezone.now().date().isoformat()} "
                f"(OUTBOUND={outbound_sum}, CHARGES={charges_sum})"
            )
            statement.notes = (
                (statement.notes + "\n" + note) if statement.notes else note
            )
            statement.save(update_fields=['billed_amount', 'notes', 'updated_at'])
        return new_amount

    # ── Cargos no facturados (Onda 4) ────────────────────────────────────

    @staticmethod
    def get_unbilled_charges(
        card_account: TreasuryAccount,
        cut_off_date: _date | None = None,
    ):
        """
        Retorna los cargos no facturados de una tarjeta de crédito.
        Son movimientos OUTBOUND/ADJUSTMENT sobre la cuenta CREDIT_CARD
        con is_billed=False, excluyendo pagos (TRANSFER).

        Si se proporciona cut_off_date, solo retorna cargos con date <= cut_off_date
        para que cada período facture solo las cuotas que corresponden.
        """
        qs = TreasuryMovement.objects.filter(
            from_account=card_account,
            movement_type__in=[
                TreasuryMovement.Type.OUTBOUND,
                TreasuryMovement.Type.ADJUSTMENT,
            ],
            is_billed=False,
        ).exclude(
            movement_type=TreasuryMovement.Type.TRANSFER,
        )

        if cut_off_date:
            qs = qs.filter(date__lte=cut_off_date)

        return qs.order_by('-date', '-id')

    @staticmethod
    def get_unbilled_summary(card_account: TreasuryAccount) -> dict:
        """
        Retorna resumen de cargos no facturados:
        - total: suma de todos los cargos no facturados
        - count: cantidad de cargos
        - purchases: suma de compras (OUTBOUND)
        - charges: suma de cargos financieros (ADJUSTMENT)
        """
        from django.db import models as dj_models

        qs = CardService.get_unbilled_charges(card_account)

        purchases = (
            qs.filter(movement_type=TreasuryMovement.Type.OUTBOUND)
            .aggregate(total=dj_models.Sum('amount'))['total']
            or Decimal('0')
        )
        charges = (
            qs.filter(movement_type=TreasuryMovement.Type.ADJUSTMENT)
            .aggregate(total=dj_models.Sum('amount'))['total']
            or Decimal('0')
        )
        count = qs.count()

        return {
            'total': purchases + charges,
            'count': count,
            'purchases': purchases,
            'charges': charges,
        }

    @staticmethod
    @transaction.atomic
    def add_unbilled_charge(
        *,
        card_account: TreasuryAccount,
        amount: Decimal,
        charge_type: str = 'OTHER',
        description: str = '',
        date: _date | None = None,
        created_by: "AbstractUser | None" = None,
    ) -> TreasuryMovement:
        """
        Agrega un cargo no facturado a la tarjeta de crédito.

        - `charge_type`: tipo de cargo (COMMISSION, TAX, FEE, INSURANCE, OTHER)
        - Crea un ADJUSTMENT sobre la card_account con is_billed=False
        - No genera asiento contable (se facturará después)

        Retorna el movimiento creado.
        """
        if card_account.account_type != TreasuryAccount.Type.CREDIT_CARD:
            raise ValidationError(
                _t("La cuenta debe ser de tipo Tarjeta de Crédito (CREDIT_CARD).")
            )
        if amount <= 0:
            raise ValidationError(_t("El monto debe ser mayor a cero."))

        if not date:
            date = timezone.now().date()

        charge_labels = {
            'COMMISSION': 'Comisión',
            'TAX': 'Impuesto',
            'FEE': 'Cargo',
            'INSURANCE': 'Seguro',
            'OTHER': 'Otro cargo',
        }
        charge_label = charge_labels.get(charge_type, charge_type)

        movement = TreasuryService.create_movement(
            amount=amount,
            movement_type=TreasuryMovement.Type.ADJUSTMENT,
            payment_method=TreasuryMovement.Method.CARD,
            date=date,
            created_by=created_by,
            from_account=card_account,
            reference=f"CARGO-{charge_type}-{date.strftime('%Y%m%d')}",
            notes=f"{charge_label}: {description}".strip(),
            is_pending_registration=True,
        )
        movement.is_billed = False
        movement.save(update_fields=['is_billed'])

        return movement

    @staticmethod
    @transaction.atomic
    def bill_unbilled_charges(
        *,
        card_account: TreasuryAccount,
        period_year: int,
        period_month: int,
        cut_off_date: _date,
        due_date: _date,
        minimum_payment: Decimal = Decimal('0'),
        credit_limit: Decimal | None = None,
        notes: str = '',
        created_by: "AbstractUser | None" = None,
    ) -> CreditCardStatement:
        """
        Factura los cargos no facturados de una tarjeta.

        1. Obtiene los movimientos no facturados con date <= cut_off_date
        2. Crea un CreditCardStatement con billed_amount = suma de cargos
        3. Marca los movimientos como is_billed=True y los vincula al statement
        4. Genera el asiento contable desglosado por grupo de compra (si aplica)

        Retorna el statement creado.
        """
        # Obtener cargos no facturados dentro del período
        unbilled = CardService.get_unbilled_charges(card_account, cut_off_date=cut_off_date)
        total = unbilled.aggregate(
            total=dj_models.Sum('amount')
        )['total'] or Decimal('0')

        if total <= 0:
            raise ValidationError(
                _t("No hay cargos no facturados para facturar en este período.")
            )

        # Agrupar por card_purchase_group para el desglose
        # Los movimientos sin grupo (card_purchase_group=None) van en "Sin compra"
        groups_data = {}
        standalone_movements = []

        for m in unbilled.select_related('card_purchase_group').iterator():
            group = m.card_purchase_group
            if group is None:
                standalone_movements.append(m)
                continue

            if group.id not in groups_data:
                groups_data[group.id] = {
                    'group': group,
                    'movements': [],
                }
            groups_data[group.id]['movements'].append(m)

        # Crear breakdown estructurado
        purchase_group_breakdown = []
        for gid, gd in groups_data.items():
            group = gd['group']
            movements = gd['movements']
            subtotal = sum(m.amount for m in movements)
            purchase_group_breakdown.append({
                'id': group.id,
                'uuid': str(group.uuid),
                'total_amount': str(group.total_amount),
                'installments': group.installments,
                'monthly_rate': str(group.monthly_rate),
                'principal_per_installment': str(group.principal_per_installment),
                'first_installment_date': str(group.first_installment_date) if group.first_installment_date else None,
                'partner_name': group.partner.name if group.partner else None,
                'partner_id': group.partner_id,
                'client_reference': group.client_reference,
                'subtotal': str(subtotal),
                'charges': [
                    {
                        'id': m.id,
                        'amount': str(m.amount),
                        'installment_number': m.installment_number,
                        'is_installment_interest': m.is_installment_interest,
                        'movement_type': m.movement_type,
                        'reference': m.reference,
                        'date': str(m.date),
                    }
                    for m in sorted(movements, key=lambda x: (x.installment_number or 0, x.id))
                ],
            })

        standalone_subtotal = sum(m.amount for m in standalone_movements)
        if standalone_movements:
            purchase_group_breakdown.append({
                'id': None,
                'uuid': None,
                'total_amount': None,
                'installments': None,
                'monthly_rate': None,
                'principal_per_installment': None,
                'first_installment_date': None,
                'partner_name': None,
                'partner_id': None,
                'client_reference': 'Sin compra asociada',
                'subtotal': str(standalone_subtotal),
                'charges': [
                    {
                        'id': m.id,
                        'amount': str(m.amount),
                        'installment_number': m.installment_number,
                        'is_installment_interest': m.is_installment_interest,
                        'movement_type': m.movement_type,
                        'reference': m.reference,
                        'date': str(m.date),
                    }
                    for m in standalone_movements
                ],
            })

        # Crear el statement
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

        # Marcar movimientos como facturados y vincular al statement
        unbilled.update(is_billed=True, billed_in_statement=statement)

        # Generar asiento contable con el desglose por grupo de compra
        CardService._create_billing_entry(
            statement=statement,
            total=total,
            unbilled_queryset=unbilled,
            purchase_group_breakdown=purchase_group_breakdown,
            created_by=created_by,
        )

        # Adjuntar breakdown al statement para la respuesta
        statement._purchase_group_breakdown = purchase_group_breakdown

        return statement

    @staticmethod
    def _create_billing_entry(
        statement: CreditCardStatement,
        total: Decimal,
        unbilled_queryset=None,
        purchase_group_breakdown=None,
        created_by=None,
    ):
        """
        Genera el asiento contable al facturar cargos:
          D: Gasto / Proveedor (según tipo de movimiento o grupo de compra)
          H: Pasivo tarjeta de crédito

        Si se proporciona purchase_group_breakdown, crea items de debe
        segmentados por cada grupo de compra (uno por grupo). De lo contrario
        usa la agrupación legacy por tipo de movimiento (OUTBOUND vs ADJUSTMENT).
        """
        from accounting.models import JournalEntry, JournalItem, AccountingSettings
        from django.contrib.contenttypes.models import ContentType

        settings = AccountingSettings.get_solo()
        liability_account = statement.card_account.account

        if not liability_account:
            return

        # Crear JournalEntry
        entry = JournalEntry.objects.create(
            date=statement.cut_off_date,
            description=f"Facturación TC {statement.card_account.name} - Período {statement.period_year}-{statement.period_month:02d}",
            reference=statement.display_id,
            status=JournalEntry.State.DRAFT,
            source_content_type=ContentType.objects.get_for_model(CreditCardStatement),
            source_object_id=statement.id,
        )

        # Haber: pasivo tarjeta de crédito
        JournalItem.objects.create(
            entry=entry,
            account=liability_account,
            debit=0,
            credit=total,
        )

        # ── Debe: segmentado por grupo de compra ──────────────────────
        if purchase_group_breakdown:
            for group_data in purchase_group_breakdown:
                subtotal = Decimal(group_data['subtotal'])
                if subtotal <= 0:
                    continue

                # Separar principal (OUTBOUND) vs interés (ADJUSTMENT)
                group_outbound = sum(
                    Decimal(c['amount'])
                    for c in group_data['charges']
                    if c['movement_type'] == TreasuryMovement.Type.OUTBOUND
                )
                group_adjustments = sum(
                    Decimal(c['amount'])
                    for c in group_data['charges']
                    if c['movement_type'] == TreasuryMovement.Type.ADJUSTMENT
                )

                # Item para principal de la compra
                if group_outbound > 0:
                    purchase_account = settings.bank_commission_account or liability_account
                    JournalItem.objects.create(
                        entry=entry,
                        account=purchase_account,
                        debit=group_outbound,
                        credit=0,
                    )

                # Item para intereses / ajustes
                if group_adjustments > 0:
                    expense_account = settings.interest_expense_account or liability_account
                    JournalItem.objects.create(
                        entry=entry,
                        account=expense_account,
                        debit=group_adjustments,
                        credit=0,
                    )

        else:
            # ── Fallback legacy: agrupar por tipo de movimiento ───────
            if unbilled_queryset is None:
                unbilled_queryset = CardService.get_unbilled_charges(statement.card_account)

            purchases = unbilled_queryset.filter(
                movement_type=TreasuryMovement.Type.OUTBOUND
            ).aggregate(total=dj_models.Sum('amount'))['total'] or Decimal('0')
            adjustments = unbilled_queryset.filter(
                movement_type=TreasuryMovement.Type.ADJUSTMENT
            ).aggregate(total=dj_models.Sum('amount'))['total'] or Decimal('0')

            if purchases > 0:
                purchase_account = settings.bank_commission_account or liability_account
                JournalItem.objects.create(
                    entry=entry,
                    account=purchase_account,
                    debit=purchases,
                    credit=0,
                )

            if adjustments > 0:
                expense_account = settings.interest_expense_account or liability_account
                JournalItem.objects.create(
                    entry=entry,
                    account=expense_account,
                    debit=adjustments,
                    credit=0,
                )

            if purchases == 0 and adjustments == 0 and total > 0:
                expense_account = settings.interest_expense_account or liability_account
                JournalItem.objects.create(
                    entry=entry,
                    account=expense_account,
                    debit=total,
                    credit=0,
                )

        # Publicar asiento si tiene >= 2 items
        if entry.items.count() >= 2:
            from accounting.services import JournalEntryService
            JournalEntryService.post_entry(entry)
            statement.charges_movement = None
            statement.save(update_fields=['updated_at'])
