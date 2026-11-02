"""Visibilidad de comentarios heredada de la entidad comentada (ADR-0111).

No hay permisos por objeto: quien tiene ``view_<model>`` de la entidad puede ver y
comentar en ella. Editar es exclusivo del autor; eliminar, del autor o de un moderador
(``workflow.delete_comment``), ambos verificados en CommentService.
"""

from __future__ import annotations

from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission

from .targets import CommentTarget, target_of


def require_target_access(user, target: CommentTarget) -> None:
    if not user.has_perm(target.view_permission):
        raise PermissionDenied("No tienes acceso a esta entidad.")


class CommentTargetPermission(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        return request.user.has_perm(target_of(obj).view_permission)
