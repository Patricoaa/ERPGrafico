from rest_framework import permissions

from treasury.models import POSSession


class IsPOSSessionActive(permissions.BasePermission):
    """
    Permite solo si la sesión POS referenciada en el request está OPEN.

    Busca el session_id en (por orden):
    1. request.data.pos_session_id
    2. request.query_params.pos_session_id
    3. view.kwargs.pk (cuando el viewset opera sobre sesiones, ej. POSSessionViewSet)

    Si no encuentra referencia a una sesión, permite métodos seguros (GET/HEAD/OPTIONS)
    y deniega métodos inseguros.
    """

    message = "La sesión de caja no está activa o ha sido cerrada."

    def has_permission(self, request, view):
        pos_session_id = (
            request.data.get("pos_session_id")
            or request.query_params.get("pos_session_id")
        )

        if not pos_session_id:
            pk = view.kwargs.get("pk")
            if pk is not None and self._is_session_viewset(view):
                pos_session_id = pk

        if not pos_session_id:
            return request.method in permissions.SAFE_METHODS

        try:
            pos_session_id = int(pos_session_id)
        except (TypeError, ValueError):
            return False

        return POSSession.objects.filter(
            id=pos_session_id, status=POSSession.Status.OPEN,
        ).exists()

    def _is_session_viewset(self, view):
        model = getattr(getattr(view, "queryset", None), "model", None)
        return model is not None and issubclass(model, POSSession)
