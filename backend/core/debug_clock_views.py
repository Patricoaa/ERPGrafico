"""Endpoint del reloj de depuración (ADR-0139 D4). No existe fuera de DEBUG + DEBUG_CLOCK_ENABLED=1."""

from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from . import debug_clock


class DebugClockPermission(BasePermission):
    """404 si el reloj está deshabilitado; si no, exige superusuario."""

    def has_permission(self, request, view):
        if not debug_clock.is_enabled():
            raise NotFound()
        user = request.user
        return bool(user and user.is_authenticated and user.is_superuser)


class DebugClockView(APIView):
    def get_permissions(self):
        # Superusuario, no RBAC por permiso de modelo: herramienta de desarrollo sin modelo.
        return [DebugClockPermission()]

    def get(self, request):
        return Response(debug_clock.state())

    def post(self, request):
        try:
            target = debug_clock.parse_local_datetime(str(request.data.get("datetime", "")))
        except ValueError as exc:
            raise ValidationError({"datetime": "Formato esperado: AAAA-MM-DDTHH:MM (hora local)."}) from exc
        debug_clock.set_clock(target)
        debug_clock.apply_debug_clock()
        debug_clock.audit_change("debug_clock.set", request.user, request, target)
        return Response(debug_clock.state(), status=status.HTTP_200_OK)

    def delete(self, request):
        debug_clock.reset_clock()
        debug_clock.apply_debug_clock()
        debug_clock.audit_change("debug_clock.reset", request.user, request)
        return Response(debug_clock.state(), status=status.HTTP_200_OK)
