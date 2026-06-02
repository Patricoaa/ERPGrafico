"""
check_service.py — Lógica de negocio para cheques recibidos de terceros.

Flujo soportado:
  receive()  → Check IN_PORTFOLIO + TreasuryMovement INBOUND a la cuenta puente.
  deposit()  → TreasuryMovement TRANSFER puente→banco; DEPOSITED.
  clear()    → CLEARED (cobrado definitivamente).
  bounce()   → Revierte movimientos (reversa contable); BOUNCED.
  void()     → VOIDED (solo desde IN_PORTFOLIO).

Reutiliza TreasuryService.create_movement para todos los movimientos de tesorería,
garantizando que se genere el asiento contable correcto sin código duplicado.
"""
from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone
from django.utils.translation import gettext_lazy as _t

from .models import Check, TreasuryAccount, TreasuryMovement

if TYPE_CHECKING:
    from django.contrib.auth.models import AbstractUser


# Transiciones de estado permitidas.
_VALID_TRANSITIONS: dict[str, set[str]] = {
    Check.Status.IN_PORTFOLIO: {Check.Status.DEPOSITED, Check.Status.VOIDED},
    Check.Status.DEPOSITED:    {Check.Status.CLEARED, Check.Status.BOUNCED},
    Check.Status.CLEARED:      set(),
    Check.Status.BOUNCED:      set(),
    Check.Status.VOIDED:       set(),
}


class CheckService:
    """Operaciones sobre cheques recibidos."""

    # ── Recepción ─────────────────────────────────────────────────────────

    @staticmethod
    @transaction.atomic
    def receive(
        *,
        bank_id: int,
        check_number: str,
        amount: Decimal,
        issue_date,
        due_date,
        counterparty_id: int | None = None,
        drawer_name: str = "",
        notes: str = "",
        invoice_id: int | None = None,
        sale_order_id: int | None = None,
        created_by: "AbstractUser | None" = None,
        portfolio_account: "TreasuryAccount | None" = None,
    ) -> Check:
        """
        Registra un cheque recibido y genera el movimiento INBOUND a la
        cuenta puente "Cheques en Cartera".

        portfolio_account: si se omite, se resuelve desde AccountingSettings.
        """
        portfolio_account = portfolio_account or CheckService._get_portfolio_account()

        from .services import TreasuryService

        movement = TreasuryService.create_movement(
            amount=amount,
            movement_type=TreasuryMovement.Type.INBOUND,
            payment_method=TreasuryMovement.Method.OTHER,
            to_account=portfolio_account,
            date=due_date,
            created_by=created_by,
            notes=f"Cheque {check_number} recibido",
            invoice=_obj_or_none('billing.Invoice', invoice_id),
            sale_order=_obj_or_none('sales.SaleOrder', sale_order_id),
            partner=_obj_or_none('contacts.Contact', counterparty_id),
        )

        check = Check.objects.create(
            direction=Check.Direction.RECEIVED,
            status=Check.Status.IN_PORTFOLIO,
            bank_id=bank_id,
            check_number=check_number,
            amount=amount,
            issue_date=issue_date,
            due_date=due_date,
            counterparty_id=counterparty_id,
            drawer_name=drawer_name,
            portfolio_account=portfolio_account,
            receipt_movement=movement,
            invoice_id=invoice_id,
            sale_order_id=sale_order_id,
            notes=notes,
            created_by=created_by,
        )
        return check

    # ── Depósito ──────────────────────────────────────────────────────────

    @staticmethod
    @transaction.atomic
    def deposit(
        check: Check,
        deposit_account: TreasuryAccount,
        *,
        date=None,
        created_by: "AbstractUser | None" = None,
    ) -> Check:
        """Transfiere el cheque de cartera al banco; pasa a DEPOSITED."""
        CheckService._assert_transition(check, Check.Status.DEPOSITED)

        from .services import TreasuryService

        movement = TreasuryService.create_movement(
            amount=check.amount,
            movement_type=TreasuryMovement.Type.TRANSFER,
            payment_method=TreasuryMovement.Method.OTHER,
            from_account=check.portfolio_account,
            to_account=deposit_account,
            date=date or timezone.now().date(),
            created_by=created_by,
            notes=f"Depósito {check.display_id}",
        )

        check.status = Check.Status.DEPOSITED
        check.deposit_account = deposit_account
        check.settlement_movement = movement
        check.deposited_at = timezone.now()
        check.save()
        return check

    # ── Cobro definitivo ─────────────────────────────────────────────────

    @staticmethod
    @transaction.atomic
    def clear(check: Check) -> Check:
        """Marca el cheque como cobrado definitivamente (CLEARED)."""
        CheckService._assert_transition(check, Check.Status.CLEARED)
        check.status = Check.Status.CLEARED
        check.cleared_at = timezone.now()
        check.save()
        return check

    # ── Protesto ──────────────────────────────────────────────────────────

    @staticmethod
    @transaction.atomic
    def bounce(
        check: Check,
        *,
        notes: str = "",
        created_by: "AbstractUser | None" = None,
    ) -> Check:
        """
        Protesta el cheque: genera movimientos de reversa y reinstala el
        documento original como no pagado.
        """
        CheckService._assert_transition(check, Check.Status.BOUNCED)

        from .services import TreasuryService

        # 1) Reversa del depósito (banco → cartera)
        if check.settlement_movement:
            TreasuryService.create_movement(
                amount=check.amount,
                movement_type=TreasuryMovement.Type.TRANSFER,
                payment_method=TreasuryMovement.Method.OTHER,
                from_account=check.deposit_account,
                to_account=check.portfolio_account,
                date=timezone.now().date(),
                created_by=created_by,
                notes=f"Reversa depósito {check.display_id} (protesto)",
            )

        # 2) Reversa de la recepción (cartera → externo): OUTBOUND
        if check.receipt_movement:
            TreasuryService.create_movement(
                amount=check.amount,
                movement_type=TreasuryMovement.Type.OUTBOUND,
                payment_method=TreasuryMovement.Method.OTHER,
                from_account=check.portfolio_account,
                date=timezone.now().date(),
                created_by=created_by,
                invoice=_obj_or_none('billing.Invoice', check.invoice_id),
                sale_order=_obj_or_none('sales.SaleOrder', check.sale_order_id),
                partner=check.counterparty,
                notes=f"Reversa recepción {check.display_id} (protesto)",
            )

        check.status = Check.Status.BOUNCED
        check.bounced_at = timezone.now()
        if notes:
            check.notes = (check.notes + "\n" + notes).strip()
        check.save()
        return check

    # ── Anulación ─────────────────────────────────────────────────────────

    @staticmethod
    @transaction.atomic
    def void(check: Check, *, notes: str = "") -> Check:
        """Anula el cheque (solo desde IN_PORTFOLIO). Genera reversa OUTBOUND."""
        CheckService._assert_transition(check, Check.Status.VOIDED)

        from .services import TreasuryService

        if check.receipt_movement:
            TreasuryService.create_movement(
                amount=check.amount,
                movement_type=TreasuryMovement.Type.OUTBOUND,
                payment_method=TreasuryMovement.Method.OTHER,
                from_account=check.portfolio_account,
                date=timezone.now().date(),
                invoice=_obj_or_none('billing.Invoice', check.invoice_id),
                sale_order=_obj_or_none('sales.SaleOrder', check.sale_order_id),
                partner=check.counterparty,
                notes=f"Anulación {check.display_id}",
            )

        check.status = Check.Status.VOIDED
        if notes:
            check.notes = (check.notes + "\n" + notes).strip()
        check.save()
        return check

    # ── Reportería ────────────────────────────────────────────────────────

    @staticmethod
    def get_portfolio_summary() -> dict:
        """Cheques IN_PORTFOLIO: total y lista ordenada por vencimiento."""
        from django.db.models import Sum
        qs = Check.objects.filter(
            direction=Check.Direction.RECEIVED,
            status=Check.Status.IN_PORTFOLIO,
        ).select_related('bank', 'counterparty', 'portfolio_account')
        total = qs.aggregate(total=Sum('amount'))['total'] or Decimal('0')
        return {'checks': list(qs), 'total': total}

    @staticmethod
    def get_in_transit_summary() -> dict:
        """Cheques DEPOSITED pendientes de confirmación bancaria."""
        from django.db.models import Sum
        qs = Check.objects.filter(
            direction=Check.Direction.RECEIVED,
            status=Check.Status.DEPOSITED,
        ).select_related('bank', 'counterparty', 'deposit_account')
        total = qs.aggregate(total=Sum('amount'))['total'] or Decimal('0')
        return {'checks': list(qs), 'total': total}

    # ── Helpers privados ─────────────────────────────────────────────────

    @staticmethod
    def _get_portfolio_account() -> TreasuryAccount:
        from accounting.models import AccountingSettings
        s = AccountingSettings.get_solo()
        if not s or not s.check_portfolio_account_id:
            raise ValidationError(
                _t("No hay cuenta 'Cheques en Cartera' configurada. "
                  "Configúrela en Ajustes Contables antes de registrar cheques.")
            )
        portfolio, _ = TreasuryAccount.objects.get_or_create(
            account_type=TreasuryAccount.Type.CHECK_PORTFOLIO,
            defaults={
                'name': 'Cheques en Cartera',
                'account': s.check_portfolio_account,
                'currency': 'CLP',
            },
        )
        return portfolio

    @staticmethod
    def _assert_transition(check: Check, target: str) -> None:
        allowed = _VALID_TRANSITIONS.get(check.status, set())
        if target not in allowed:
            raise ValidationError(
                _t("No se puede pasar de '%(from)s' a '%(to)s'.")
                % {
                    'from': check.get_status_display(),
                    'to': dict(Check.Status.choices)[target],
                }
            )


def _obj_or_none(model_label: str, pk: int | None):
    """Carga un objeto por PK o retorna None. Evita imports circulares."""
    if pk is None:
        return None
    from django.apps import apps
    Model = apps.get_model(model_label)
    try:
        return Model.objects.get(pk=pk)
    except Model.DoesNotExist:
        return None
