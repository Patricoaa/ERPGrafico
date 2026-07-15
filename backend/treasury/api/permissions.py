from rest_framework import permissions

from treasury.models import POSSession


class IsPOSSessionActive(permissions.BasePermission):
    """
    Controla acceso a endpoints que operan sobre sesiones POS.

    - Métodos seguros (GET/HEAD/OPTIONS): permite si la sesión existe (OPEN o cerrada).
      Esto permite leer historial, reportes y auditorías de sesiones cerradas.
    - Métodos inseguros (POST/PUT/PATCH/DELETE): requiere que la sesión esté OPEN.
      Esto impide operar sobre sesiones ya cerradas.

    Busca el session_id en (por orden):
    1. request.data.pos_session_id
    2. request.query_params.pos_session_id
    3. view.kwargs.pk (cuando el viewset opera sobre sesiones, ej. POSSessionViewSet)

    Si no encuentra referencia a una sesión, permite métodos seguros y deniega inseguros.
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

        if request.method in permissions.SAFE_METHODS:
            return POSSession.objects.filter(id=pos_session_id).exists()

        return POSSession.objects.filter(
            id=pos_session_id, status=POSSession.Status.OPEN,
        ).exists()

    def _is_session_viewset(self, view):
        model = getattr(getattr(view, "queryset", None), "model", None)
        return model is not None and issubclass(model, POSSession)
