"""
Ediciones de documentos hechas desde el panel de ventas del POS (spec 2026-11-10).

Mientras hay un documento abierto en el panel, el frontend agrega a cada request el
encabezado ``X-POS-Document-Context: <id de la sesión POS>``. Para las escrituras:

- sesión SINGLE: la edición queda registrada a nombre de la cuenta logueada;
- sesión MULTI: se exige un pase de operador ``DOCUMENT_EDIT`` (403 ``pos_operator_required``)
  y la edición queda registrada con el operador.

Sin el encabezado, con una sesión inexistente o cerrada, o con un método de lectura,
la request no se toca. El pase no se consume por request: lo termina el frontend al
salir del documento o el siguiente ``identify`` de la pestaña.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from rest_framework.renderers import JSONRenderer

logger = logging.getLogger(__name__)

CONTEXT_HEADER = "X-POS-Document-Context"
_UNSAFE = {"POST", "PUT", "PATCH", "DELETE"}
# Rutas que nunca cuentan como "editar un documento": el propio POS y la sesión.
_EXEMPT_PREFIXES = (
    "/api/sales/pos-drafts/",
    "/api/treasury/pos-sessions/",
    "/api/token/",
    "/api/auth/",
    "/api/core/auth/",
)
_CHECKOUT_PATH = "/api/sales/orders/"  # POST = cobro; su propio actor lo resuelve SalesService


@dataclass
class _Context:
    session: object
    actor: object


def _is_exempt(request) -> bool:
    path = request.path
    return path.startswith(_EXEMPT_PREFIXES) or (request.method == "POST" and path == _CHECKOUT_PATH)


def _authenticate(request):
    from rest_framework_simplejwt.authentication import JWTAuthentication

    try:
        result = JWTAuthentication().authenticate(request)
    except Exception:  # noqa: BLE001 — un JWT inválido lo resuelve la vista (401)
        return None
    return result[0] if result else None


def _error_response(exc):
    from core.api.exceptions import erpgrafico_exception_handler

    response = erpgrafico_exception_handler(exc, {})
    response.accepted_renderer = JSONRenderer()
    response.accepted_media_type = "application/json"
    response.renderer_context = {}
    response.render()
    return response


class POSDocumentContextMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        from treasury.pos_operator_service import POSOperatorRequired

        try:
            ctx = self._context(request)
        except POSOperatorRequired as exc:
            return _error_response(exc)
        response = self.get_response(request)
        if ctx is not None and 200 <= response.status_code < 300:
            try:
                self._record(request, response, ctx)
            except Exception:  # noqa: BLE001 — el seguimiento no puede deshacer una escritura ya confirmada
                logger.exception("No se pudo registrar el seguimiento de la edición del documento")
        return response

    @staticmethod
    def _context(request) -> _Context | None:
        raw = request.headers.get(CONTEXT_HEADER)
        if not raw or request.method not in _UNSAFE or _is_exempt(request):
            return None
        try:
            session_id = int(raw)
        except ValueError:
            return None

        from treasury.models import POSSession
        from treasury.pos_operator_service import PASS_HEADER, Actor, POSOperatorService

        session = POSSession.objects.filter(id=session_id, status=POSSession.Status.OPEN).first()
        if session is None:
            return None
        user = _authenticate(request)
        if user is None:
            return None
        if not session.is_multi_user:
            return _Context(session, Actor(user, user, None))
        actor = POSOperatorService.resolve_actor(
            session=session, device_user=user,
            raw_token=request.headers.get(PASS_HEADER), purpose="DOCUMENT_EDIT",
        )
        return _Context(session, actor)

    @staticmethod
    def _record(request, response, ctx: _Context) -> None:
        from sales.tracking_service import SaleTrackingService

        view = getattr(response, "renderer_context", {}).get("view")
        model = getattr(getattr(view, "queryset", None), "model", None)
        if model is None and view is not None:
            try:
                model = getattr(getattr(view.get_serializer_class(), "Meta", None), "model", None)
            except Exception:  # noqa: BLE001 — la etiqueta de la entidad es informativa
                model = None
        entity_type = f"{model._meta.app_label}.{model._meta.model_name}" if model is not None else ""
        match = getattr(request, "resolver_match", None)
        pk = match.kwargs.get("pk") if match else None
        entity_id = int(pk) if pk is not None and str(pk).isdigit() else None

        op_pass = ctx.actor.operator_pass
        sale_order_id = None
        if entity_type == "sales.saleorder":
            sale_order_id = entity_id
        elif op_pass is not None and op_pass.target_type == "sales.saleorder":
            sale_order_id = op_pass.target_id

        if sale_order_id is not None:
            from sales.models import SaleOrder

            if not SaleOrder.objects.filter(pk=sale_order_id).exists():
                sale_order_id = None  # destino del pase inexistente: se registra la edición sin orden
        action = getattr(view, "action", None) or "-"
        SaleTrackingService.record_document_edit(
            actor=ctx.actor,
            pos_session=ctx.session,
            entity_type=entity_type,
            entity_id=entity_id,
            detail=f"{request.method} {action}",
            sale_order_id=sale_order_id,
        )
