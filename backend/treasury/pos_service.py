"""
POSService — business logic for POS session lifecycle (open / close).
Extracted from POSSessionViewSet to keep views thin.
"""

from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied

from core.prefix_registry import EntityPrefix

from .models import (
    POSOperatorPass,
    POSSession,
    POSSessionAudit,
    POSTerminal,
    TreasuryAccount,
    TreasuryMovement,
)
from .pos_operator_service import POSOperatorService
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
        terminal_id: int,
        opening_balance: Decimal,
        justify_reason: str | None = None,
        justify_target_id: int | None = None,
        notes: str = "",
        mode: str = POSSession.Mode.SINGLE,
    ) -> POSSession:
        """
        Opens a POS session.

        - `mode` (SINGLE | MULTI) es el modo de caja de este dispositivo (la cuenta que abre).

        - Requires a terminal_id; the session treasury account is snapshotted
          from terminal.default_treasury_account at open time.
        - The declared opening_balance is always compared against the book
          balance of that same account; any difference creates an adjustment
          movement (ADR-0109).
        - Only one open session per treasury account (others must join it).
        - Starts the session cash ledger (ledger_baseline_at) after the
          adjustment, so expected cash = opening_balance + account movements.

        Raises ValidationError on any business rule violation.
        """
        if mode not in POSSession.Mode.values:
            raise ValidationError("Modo de caja inválido.")

        if POSSession.objects.filter(user=user, status="OPEN").exists():
            raise ValidationError("Ya tiene una sesión abierta.")

        try:
            terminal = POSTerminal.objects.select_related("default_treasury_account").get(
                id=terminal_id, is_active=True
            )
        except POSTerminal.DoesNotExist:
            raise ValidationError("Caja POS no encontrada o inactiva.")

        if not terminal.default_treasury_account:
            raise ValidationError(
                "El terminal no tiene una cuenta de tesorería por defecto; no se puede abrir la sesión."
            )

        cash_account = TreasuryAccount.objects.select_for_update().get(
            pk=terminal.default_treasury_account_id
        )
        busy = POSSession.objects.filter(status="OPEN", treasury_account=cash_account).first()
        if busy:
            raise ValidationError(
                f"La caja «{cash_account.name}» ya tiene la sesión #{busy.id} abierta. "
                "Únase a esa sesión en lugar de abrir otra."
            )

        session = POSSession.objects.create(
            terminal=terminal,
            treasury_account=cash_account,
            user=user,
            opening_balance=opening_balance,
            status="OPEN",
        )
        session.set_device_mode(user, mode)

        _apply_opening_fund_adjustment(
            session=session,
            opening_balance=opening_balance,
            justify_reason=justify_reason or "UNKNOWN",
            justify_target_id=justify_target_id,
            notes=notes,
            user=user,
        )

        session.ledger_baseline_at = timezone.now()
        session.save(update_fields=["ledger_baseline_at"])
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

        Only the session opener or a superuser may close it (PermissionDenied otherwise).

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

        # Solo quien abrió la sesión de POS o un superusuario puede cerrarla;
        # quien se une a una sesión compartida opera, pero no la cierra.
        if user.pk != session.user_id and not user.is_superuser:
            raise PermissionDenied(
                "Solo quien abrió la sesión de POS o un superusuario puede cerrarla."
            )

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
                reference=f"{EntityPrefix.POS_SESSION}-RETIRO-{session.id}",
            )

        # Clean up draft carts
        from sales.draft_cart_service import DraftCartService

        DraftCartService.cleanup_on_session_close(session.id)

        session.status = "CLOSED"
        session.closed_at = timezone.now()
        session.closed_by = user
        session.save()

        # Cerrada la sesión, ningún pase de operador sigue vigente.
        POSOperatorPass.objects.filter(session=session, ended_at__isnull=True).update(
            ended_at=timezone.now(), end_reason=POSOperatorPass.EndReason.EXPIRED
        )

        return session, audit

    # ------------------------------------------------------------------ #
    # Request wrappers                                                    #
    # ------------------------------------------------------------------ #

    @staticmethod
    def open_session_from_request(request):
        return POSService.open_session(
            user=request.user,
            terminal_id=request.data.get("terminal_id"),
            opening_balance=Decimal(str(request.data.get("opening_balance", "0"))),
            justify_reason=request.data.get("justify_reason"),
            justify_target_id=request.data.get("justify_target_id"),
            notes=request.data.get("notes", ""),
            mode=request.data.get("mode") or POSSession.Mode.SINGLE,
        )

    @staticmethod
    def join_session(*, session: POSSession, user, mode: str) -> POSSession:
        """Registra el modo de caja con el que ``user`` se une a una sesión abierta."""
        if mode not in POSSession.Mode.values:
            raise ValidationError("Modo de caja inválido.")
        if session.status != POSSession.Status.OPEN:
            raise ValidationError("La sesión de caja está cerrada.")
        session.set_device_mode(user, mode)
        return session

    @staticmethod
    def close_session_from_request(request, session: POSSession):
        if session.status == "CLOSED":
            raise ValidationError("Esta sesión ya está cerrada.")
        actor = POSOperatorService.actor_from_request(request, session, "SESSION_CLOSE")
        # El pase se consume junto con el cierre: si el cierre falla, vuelve a estar vigente.
        with transaction.atomic():
            if actor.operator_pass:
                POSOperatorService.end(actor.operator_pass, POSOperatorPass.EndReason.CONSUMED)
            return POSService.close_session(
                session=session,
                actual_cash=Decimal(str(request.data.get("actual_cash", "0"))),
                notes=request.data.get("notes", ""),
                justify_reason=request.data.get("justify_reason", "UNKNOWN"),
                justify_target_id=request.data.get("justify_target_id"),
                withdrawal_amount=Decimal(str(request.data.get("withdrawal_amount", "0"))),
                cash_destination_id=request.data.get("cash_destination_id"),
                user=actor.operator,
            )

    # ------------------------------------------------------------------ #
    # Manual Movement                                                      #
    # ------------------------------------------------------------------ #

    @staticmethod
    def register_manual_movement_from_request(request, session: "POSSession") -> "TreasuryMovement":
        is_inflow = request.data.get("is_inflow", False)
        if isinstance(is_inflow, str):
            is_inflow = is_inflow.lower() == "true"
        else:
            is_inflow = bool(is_inflow)

        if session.status != "OPEN":
            raise ValidationError("La sesión no está abierta")
        actor = POSOperatorService.actor_from_request(request, session, "CASH_MOVEMENT")
        with transaction.atomic():
            movement = POSService.register_manual_movement(
                session=session,
                move_type=request.data.get("type"),
                amount=Decimal(str(request.data.get("amount", "0"))),
                is_inflow=is_inflow,
                notes=request.data.get("notes", ""),
                target_account_id=request.data.get("target_account_id"),
                user=actor.operator,
            )
            if actor.operator_pass:
                POSOperatorService.end(actor.operator_pass, POSOperatorPass.EndReason.CONSUMED)
        return movement

    @staticmethod
    @transaction.atomic
    def register_manual_movement(
        *,
        session: POSSession,
        move_type: str,
        amount: Decimal,
        is_inflow: bool,
        notes: str = "",
        target_account_id: int | None = None,
        user,
    ) -> TreasuryMovement:
        from accounting.models import AccountingSettings

        if session.status != "OPEN":
            raise ValidationError("La sesión no está abierta")

        if amount <= 0:
            raise ValidationError("El monto debe ser mayor a cero")

        settings = AccountingSettings.get_solo()
        if not settings:
            raise ValidationError("Configuración contable no encontrada")

        direction = "IN" if is_inflow else "OUT"

        if move_type == "TRANSFER":
            if not target_account_id:
                raise ValidationError("Debe especificar la cuenta para traspasos")

            try:
                target_obj = TreasuryAccount.objects.get(id=target_account_id)
            except TreasuryAccount.DoesNotExist:
                raise ValidationError("Cuenta no encontrada")

            treasury_account_obj = _get_session_treasury(session)

            if treasury_account_obj == target_obj:
                raise ValidationError("No puede transferir a la misma cuenta de origen")

        else:
            target_account = TreasuryService._get_reason_account(settings, move_type, direction)
            if not target_account:
                lbl = _LABEL_MAP.get(move_type, move_type)
                raise ValidationError(f"Cuenta contable no configurada para {lbl}")

        if not is_inflow and amount > session.expected_cash:
            raise ValidationError(f"Saldo insuficiente en efectivo. Máximo disponible para retiro: ${session.expected_cash:,.0f}")

        treasury_account_obj = _get_session_treasury(session)
        if not treasury_account_obj:
            raise ValidationError("No se pudo determinar la cuenta de tesorería para esta sesión")

        from_account = None
        to_account = None

        if move_type == "TRANSFER":
            if is_inflow:
                from_account = TreasuryAccount.objects.get(id=target_account_id)
                to_account = treasury_account_obj
            else:
                from_account = treasury_account_obj
                to_account = TreasuryAccount.objects.get(id=target_account_id)
        elif is_inflow:
            to_account = treasury_account_obj
        else:
            from_account = treasury_account_obj

        movement = TreasuryService.create_movement(
            amount=amount,
            movement_type=TreasuryMovement.Type.TRANSFER
            if move_type == "TRANSFER"
            else (TreasuryMovement.Type.INBOUND if is_inflow else TreasuryMovement.Type.OUTBOUND),
            created_by=user,
            from_account=from_account,
            to_account=to_account,
            pos_session=session,
            notes=notes,
            justify_reason=move_type,
        )
        movement.reference = f"{EntityPrefix.POS_SESSION}-MANUAL-{movement.id}"
        movement.save(update_fields=["reference"])

        session.refresh_from_db()
        return movement


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
    opening_balance: Decimal,
    justify_reason: str,
    justify_target_id: int | None,
    notes: str,
    user,
) -> None:
    """Creates a movement to justify the difference between declared opening balance and the cash account book balance."""
    pos_treasury = _get_session_treasury(session)
    book_balance = pos_treasury.fresh_balance()
    diff = opening_balance - book_balance

    if diff == 0:
        return

    label = _LABEL_MAP.get(justify_reason, justify_reason)

    if justify_reason == "TRANSFER":
        target = None
        if justify_target_id:
            target = TreasuryAccount.objects.filter(id=justify_target_id).first()
        if diff > 0:
            # Excedente: el efectivo vino desde la cuenta indicada
            from_account, to_account = target, pos_treasury
        else:
            # Faltante: el efectivo se fue hacia la cuenta indicada
            from_account, to_account = pos_treasury, target
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
        reference=f"{EntityPrefix.POS_SESSION}-AJUSTE-{session.id}",
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

    return TreasuryService.create_movement(
        movement_type=movement_type,
        amount=abs(difference),
        created_by=user,
        from_account=from_account,
        to_account=to_account,
        pos_session=session,
        notes=f"Ajuste al Cierre: {notes or 'Sin observaciones'}",
        justify_reason=justify_reason,
        reference=f"{EntityPrefix.POS_SESSION}-EXCEDENTE-{session.id}",
    )
