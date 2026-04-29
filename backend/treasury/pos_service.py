"""
POSService — business logic for POS session lifecycle (open / close).
Extracted from POSSessionViewSet to keep views thin.
"""
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from .models import (
    POSSession,
    POSSessionAudit,
    POSTerminal,
    TreasuryAccount,
    TreasuryMovement,
)
from .services import TreasuryService


class POSService:

    # ------------------------------------------------------------------ #
    # Open session                                                         #
    # ------------------------------------------------------------------ #

    @staticmethod
    @transaction.atomic
    def open_session(
        *,
        user,
        terminal_id: int | None = None,
        treasury_account_id: int | None = None,
        opening_balance: Decimal,
        fund_source_id: int | None = None,
        justify_reason: str | None = None,
        justify_target_id: int | None = None,
        notes: str = "",
    ) -> POSSession:
        """
        Opens a POS session.

        - Uses terminal_id (preferred) or treasury_account_id (legacy).
        - If fund_source_id is provided, computes the diff between the declared
          opening_balance and the fund source book balance and creates an
          adjustment movement.

        Raises ValidationError on any business rule violation.
        """
        if POSSession.objects.filter(user=user, status="OPEN").exists():
            raise ValidationError("Ya tiene una sesión abierta.")

        if terminal_id:
            try:
                terminal = POSTerminal.objects.select_related("default_treasury_account").get(
                    id=terminal_id, is_active=True
                )
            except POSTerminal.DoesNotExist:
                raise ValidationError("Terminal no encontrado o inactivo.")

            session = POSSession.objects.create(
                terminal=terminal,
                treasury_account=terminal.default_treasury_account,
                user=user,
                opening_balance=opening_balance,
                status="OPEN",
            )

        elif treasury_account_id:
            try:
                treasury_account = TreasuryAccount.objects.get(id=treasury_account_id)
            except TreasuryAccount.DoesNotExist:
                raise ValidationError("Caja no encontrada.")

            session = POSSession.objects.create(
                treasury_account=treasury_account,
                terminal=None,
                user=user,
                opening_balance=opening_balance,
                status="OPEN",
            )

        else:
            raise ValidationError("Debe especificar terminal_id o treasury_account_id.")

        if fund_source_id:
            _apply_opening_fund_adjustment(
                session=session,
                fund_source_id=fund_source_id,
                opening_balance=opening_balance,
                justify_reason=justify_reason or "UNKNOWN",
                justify_target_id=justify_target_id,
                notes=notes,
                user=user,
            )

        return session

    # ------------------------------------------------------------------ #
    # Close session                                                        #
    # ------------------------------------------------------------------ #

    @staticmethod
    @transaction.atomic
    def close_session(
        *,
        session: POSSession,
        actual_cash: Decimal,
        notes: str = "",
        justify_reason: str = "UNKNOWN",
        justify_target_id: int | None = None,
        withdrawal_amount: Decimal = Decimal("0"),
        cash_destination_id: int | None = None,
        user,
    ) -> tuple[POSSession, POSSessionAudit]:
        """
        Closes a POS session with a cash audit (arqueo de caja).

        Steps:
        1. Create POSSessionAudit.
        2. If there is a cash difference, create an adjustment movement.
        3. If withdrawal_amount > 0, create a transfer to cash_destination.
        4. Clean up draft carts.
        5. Mark session CLOSED.

        Returns (session, audit).
        Raises ValidationError on business rule violations.
        """
        if session.status == "CLOSED":
            raise ValidationError("Esta sesión ya está cerrada.")

        # Clear any partial audit from a failed previous close attempt
        if hasattr(session, "audit"):
            session.audit.delete()
            session.refresh_from_db()

        expected_cash = session.expected_cash
        difference = actual_cash - expected_cash

        audit = POSSessionAudit.objects.create(
            session=session,
            expected_amount=expected_cash,
            actual_amount=actual_cash,
            difference=difference,
            notes=notes,
        )

        pos_treasury = _get_session_treasury(session)

        # Cash difference adjustment
        if difference != 0:
            movement = _create_difference_movement(
                session=session,
                pos_treasury=pos_treasury,
                difference=difference,
                justify_reason=justify_reason,
                justify_target_id=justify_target_id,
                notes=notes,
                user=user,
            )
            if movement.journal_entry:
                audit.journal_entry = movement.journal_entry
                audit.save()

        # Physical cash withdrawal to safe/bank
        if withdrawal_amount > 0 and cash_destination_id:
            to_account = TreasuryAccount.objects.get(id=cash_destination_id)
            TreasuryService.create_movement(
                movement_type=TreasuryMovement.Type.TRANSFER,
                from_account=pos_treasury,
                to_account=to_account,
                amount=withdrawal_amount,
                justify_reason="RETIREMENT",
                pos_session=session,
                created_by=user,
                notes=f"Retiro de cierre sesión #{session.id}",
                reference=f"Retiro de Cierre POS - Sesión #{session.id}",
            )

        # Clean up draft carts
        from sales.draft_cart_service import DraftCartService
        DraftCartService.cleanup_on_session_close(session.id)

        session.status = "CLOSED"
        session.closed_at = timezone.now()
        session.closed_by = user
        session.save()

        return session, audit


# ------------------------------------------------------------------ #
# Private helpers                                                      #
# ------------------------------------------------------------------ #

_LABEL_MAP = {
    "PARTNER_WITHDRAWAL": "Retiro Socio",
    "THEFT": "Robo / Pérdida",
    "TIP": "Propina",
    "ROUNDING": "Redondeo",
    "OTHER_IN": "Otro Ingreso",
    "OTHER_OUT": "Otro Egreso",
    "COUNTING_ERROR": "Error de Conteo",
    "SYSTEM_ERROR": "Error de Sistema",
    "CASHBACK": "Vuelto Incorrecto",
}


def _get_session_treasury(session: POSSession) -> TreasuryAccount | None:
    if session.treasury_account:
        return session.treasury_account
    if session.terminal and session.terminal.default_treasury_account:
        return session.terminal.default_treasury_account
    return None


def _apply_opening_fund_adjustment(
    *,
    session: POSSession,
    fund_source_id: int,
    opening_balance: Decimal,
    justify_reason: str,
    justify_target_id: int | None,
    notes: str,
    user,
) -> None:
    """Creates a movement to justify the difference between declared opening balance and fund source."""
    try:
        fund_source = TreasuryAccount.objects.get(id=fund_source_id)
    except TreasuryAccount.DoesNotExist:
        return  # Non-fatal: warn in calling code if needed

    book_balance = fund_source.account.balance
    diff = opening_balance - book_balance

    if diff == 0:
        return

    pos_treasury = _get_session_treasury(session)
    label = _LABEL_MAP.get(justify_reason, justify_reason)

    if justify_reason == "TRANSFER":
        if diff > 0:
            from_account, to_account = fund_source, pos_treasury
        else:
            from_account = pos_treasury
            to_account = None
            if justify_target_id:
                to_account = TreasuryAccount.objects.filter(id=justify_target_id).first()
        movement_type = TreasuryMovement.Type.TRANSFER
    else:
        if diff > 0:
            from_account, to_account = None, pos_treasury
            movement_type = TreasuryMovement.Type.INBOUND
        else:
            from_account, to_account = pos_treasury, None
            movement_type = TreasuryMovement.Type.OUTBOUND

    full_notes = f"Ajuste de Apertura POS #{session.id}. Fondo: {opening_balance}, Libros: {book_balance}. Motivo: {label}"
    if notes:
        full_notes += f" - {notes}"

    TreasuryService.create_movement(
        movement_type=movement_type,
        amount=abs(diff),
        created_by=user,
        from_account=from_account,
        to_account=to_account,
        pos_session=session,
        notes=full_notes,
        justify_reason=justify_reason,
        reference=f"Ajuste de Apertura POS ({label}) - Sesión #{session.id}",
    )


def _create_difference_movement(
    *,
    session: POSSession,
    pos_treasury: TreasuryAccount | None,
    difference: Decimal,
    justify_reason: str,
    justify_target_id: int | None,
    notes: str,
    user,
) -> TreasuryMovement:
    """Handles cash difference adjustment on session close."""
    if justify_reason == "TRANSFER":
        if difference < 0:
            from_account, to_account = pos_treasury, None
            if justify_target_id:
                to_account = TreasuryAccount.objects.filter(id=justify_target_id).first()
        else:
            to_account = pos_treasury
            from_account = None
            if justify_target_id:
                from_account = TreasuryAccount.objects.filter(id=justify_target_id).first()
        movement_type = TreasuryMovement.Type.TRANSFER
    else:
        if difference < 0:
            from_account, to_account = pos_treasury, None
            movement_type = TreasuryMovement.Type.OUTBOUND
        else:
            from_account, to_account = None, pos_treasury
            movement_type = TreasuryMovement.Type.INBOUND

    surplus_label = "Sobrante" if difference > 0 else "Faltante"
    return TreasuryService.create_movement(
        movement_type=movement_type,
        amount=abs(difference),
        created_by=user,
        from_account=from_account,
        to_account=to_account,
        pos_session=session,
        notes=f"Ajuste al Cierre: {notes or 'Sin observaciones'}",
        justify_reason=justify_reason,
        reference=f"{surplus_label} de Caja ({justify_reason}) - Sesión #{session.id}",
    )
