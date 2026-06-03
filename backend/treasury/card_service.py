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

Patrón:
  - Todos los movimientos se generan vía `TreasuryService.create_movement`,
    garantizando la trazabilidad contable.
  - Para asientos con desglose custom (interés / fee), se usa
    `is_pending_registration=True` y se construye el JE a mano,
    análogo al patrón de `LoanService` (ADR-0033).
  - Las cuentas de gasto financiero (`interest_expense_account`/
    `fees_expense_account`) se pasan como parámetro hasta que F5.1 las
    añada a `AccountingSettings`.

Ver `docs/50-audit/bancos/fase-3-tarjeta-credito.md` (F3.3, F3.4).
"""
from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING
from datetime import date as _date

from django.core.exceptions import ValidationError
from django.db import transaction
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
            # Nada que aplicar.
            return statement

        # Idempotencia: si ya hay un ADJUSTMENT con la referencia del
        # statement, no generamos otro. El operador puede revertir el
        # movimiento manualmente si necesita recalcular.
        existing = TreasuryMovement.objects.filter(
            reference=statement.display_id,
            movement_type=TreasuryMovement.Type.ADJUSTMENT,
        ).exists()
        if existing:
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

        # El Debe: si la cuenta de gasto está configurada, va ahí;
        # si NO, se imputa al pasivo (workaround análogo al de
        # LoanService — preserva la cuadratura D=C).
        if interest:
            target_acc = interest_expense_account or liability_acc
            JournalItem.objects.create(
                entry=entry, account=target_acc,
                debit=interest, credit=Decimal('0'),
            )
        if fees:
            target_acc = fees_expense_account or liability_acc
            JournalItem.objects.create(
                entry=entry, account=target_acc,
                debit=fees, credit=Decimal('0'),
            )

        JournalEntryService.post_entry(entry)

        movement.journal_entry = entry
        movement.save(update_fields=['journal_entry'])

        statement.notes = (
            f"[CHARGES] Movimiento {movement.display_id} aplicado el "
            f"{apply_date.isoformat()}.\n" + (statement.notes or '')
        ).strip()
        statement.save(update_fields=['notes', 'updated_at'])
        return statement

    # ── Pago del estado de cuenta (F3.4) ─────────────────────────────────

    @staticmethod
    @transaction.atomic
    def pay_statement(
        statement: CreditCardStatement,
        *,
        payment_account: TreasuryAccount,
        date: _date | None = None,
        created_by: "AbstractUser | None" = None,
    ) -> CreditCardStatement:
        """
        Paga el statement desde una cuenta bancaria (CHECKING o CASH).

        - Crea un `TreasuryMovement` TRANSFER desde `payment_account`
          (origen = banco) hacia la `card_account` (destino = tarjeta /
          LIABILITY).
        - El asiento estándar de TreasuryService (TRANSFER) hace
          Debe `card_account` (LIABILITY — baja deuda) / Haber
          `payment_account` (banco — baja saldo). Esto es correcto
          para LIABILITIES y ASSETS, así que no necesita JE custom.
        - Si el total a pagar es 0, solo marca el statement como PAID
          (caso raro: statement vacío).
        - Idempotente: si ya está PAID, retorna sin error.
        """
        if statement.status == CreditCardStatement.Status.PAID:
            return statement  # idempotente
        if statement.status not in (
            CreditCardStatement.Status.OPEN,
            CreditCardStatement.Status.OVERDUE,
        ):
            raise ValidationError(
                _t("Solo se puede pagar un statement OPEN u OVERDUE (estado: %(s)s).")
                % {'s': statement.get_status_display()}
            )

        total = statement.total_to_pay
        pay_date = date or timezone.now().date()

        from .services import TreasuryService

        if total > 0:
            movement = TreasuryService.create_movement(
                amount=total,
                movement_type=TreasuryMovement.Type.TRANSFER,
                payment_method=TreasuryMovement.Method.TRANSFER,
                from_account=payment_account,
                to_account=statement.card_account,
                date=pay_date,
                created_by=created_by,
                reference=statement.display_id,
                notes=(
                    f"Pago estado de cuenta {statement.display_id} "
                    f"({statement.period_month:02d}/{statement.period_year})"
                ),
            )
            statement.payment_movement = movement

        statement.payment_account = payment_account
        statement.paid_at = timezone.now()
        statement.status = CreditCardStatement.Status.PAID
        statement.save(update_fields=[
            'payment_movement', 'payment_account',
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
