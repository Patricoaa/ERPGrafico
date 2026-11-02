"""
Uso externo de cajas POS con sesión abierta (ADR-0109, opción "advertir y exigir motivo").

Cuando un movimiento toca la cuenta de una caja que tiene una sesión POS abierta
y el movimiento no pertenece a esa sesión (pago de OC, cobro fuera del POS,
traspaso, nómina…), dentro de una request HTTP se exige un motivo:

- El cliente lo envía en el header ``X-POS-External-Reason`` (URL-encoded).
- Si falta, ``TreasuryService.create_movement`` lanza ``POSExternalReasonRequired``
  y este middleware agrega a la respuesta de error el header
  ``X-POS-External-Reason-Required`` con los datos de la sesión, para que el
  frontend pida el motivo y reintente. El motivo queda en
  ``TreasuryMovement.pos_external_reason`` y aparece en los informes X/Z.

Fuera de una request (Celery, comandos) no se bloquea: el movimiento se registra
sin motivo y el libro de caja igual lo cuenta y lo muestra como externo.
"""

from __future__ import annotations

import json
from contextvars import ContextVar
from urllib.parse import quote, unquote

from django.core.exceptions import ValidationError

REASON_HEADER = "X-POS-External-Reason"
CHALLENGE_HEADER = "X-POS-External-Reason-Required"

# Estado mutable por request: {"reason": str, "challenge": dict | None}.
# Se guarda un dict (no valores sueltos) para que el middleware lea el desafío
# aunque el view corra en otro contexto (ASGI copia contextvars, no el objeto).
_request_state: ContextVar[dict | None] = ContextVar("pos_external_reason_state", default=None)


class POSExternalReasonRequired(ValidationError):
    pass


class POSExternalReasonMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        state = {"reason": unquote(request.headers.get(REASON_HEADER, "")).strip(), "challenge": None}
        token = _request_state.set(state)
        try:
            response = self.get_response(request)
        finally:
            _request_state.reset(token)
        if state["challenge"] and response.status_code >= 400:
            response[CHALLENGE_HEADER] = quote(json.dumps(state["challenge"]))
        return response


def resolve_pos_external_reason(*, from_account, to_account, pos_session, is_pending_registration) -> str:
    """
    Devuelve el motivo a guardar en el movimiento ("" si no aplica).
    Lanza ``POSExternalReasonRequired`` si la request no trae motivo.
    """
    from .models import POSSession

    if is_pending_registration:
        return ""
    account_ids = [acc.id for acc in (from_account, to_account) if acc is not None]
    if not account_ids:
        return ""

    open_sessions = POSSession.objects.filter(
        status=POSSession.Status.OPEN,
        ledger_baseline_at__isnull=False,
        treasury_account_id__in=account_ids,
    ).select_related("user", "terminal", "treasury_account")
    if pos_session is not None:
        open_sessions = open_sessions.exclude(pk=pos_session.pk)
    session = open_sessions.first()
    if session is None:
        return ""

    state = _request_state.get()
    if state is None:
        return ""
    if state["reason"]:
        return state["reason"]

    cashier = session.user.get_full_name() or session.user.username
    account_name = session.treasury_account.name
    state["challenge"] = {
        "session_id": session.id,
        "account_id": session.treasury_account_id,
        "account_name": account_name,
        "terminal_name": session.terminal.name if session.terminal else "",
        "cashier_name": cashier,
        "opened_at": session.opened_at.isoformat(),
    }
    raise POSExternalReasonRequired(
        f"La caja «{account_name}» tiene la sesión POS #{session.id} abierta ({cashier}). "
        "Indique el motivo para registrar este movimiento fuera de la sesión."
    )
