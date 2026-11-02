from __future__ import annotations

from django.http import FileResponse
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response

from . import selectors
from .permissions import CommentTargetPermission, require_target_access
from .serializers import (
    CommentEditSerializer,
    CommentSerializer,
    CommentThreadSerializer,
    CommentWriteSerializer,
    MentionableTeamSerializer,
    MentionableUserSerializer,
)
from .services import CommentService
from .targets import CommentTarget, parse_target, resolve_target


class CommentViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """Comentarios sobre cualquier entidad: ``?target=app.model:id`` (ADR-0111)."""

    permission_classes = [CommentTargetPermission]
    # Visibilidad heredada del target; autoría y moderación en CommentService.
    action_permissions = {"mentionables": None, "download_attachment": None}
    http_method_names = ["get", "post", "patch", "delete"]

    def get_queryset(self):
        return selectors.comment_queryset()

    def list(self, request):
        target = self._target(request.query_params.get("target"))
        roots = selectors.thread_roots(target)
        return Response(CommentThreadSerializer(roots, many=True, context=self._context()).data)

    def create(self, request):
        payload = CommentWriteSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        target = self._target(payload.validated_data["target"])
        parent = self._parent(payload.validated_data.get("parent_id"))
        comment = CommentService.create(
            target=target,
            user=request.user,
            text=payload.validated_data["text"],
            parent=parent,
            files=payload.validated_data["files"],
        )
        return Response(self._detail(comment.pk), status=status.HTTP_201_CREATED)

    def partial_update(self, request, pk=None):
        comment = self.get_object()
        payload = CommentEditSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        CommentService.edit(
            comment=comment, user=request.user, text=payload.validated_data["text"]
        )
        return Response(self._detail(comment.pk))

    def destroy(self, request, pk=None):
        CommentService.delete(comment=self.get_object(), user=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get"], url_path=r"attachments/(?P<attachment_id>\d+)")
    def download_attachment(self, request, pk=None, attachment_id=None):
        """Descarga con el permiso de la entidad comentada (get_object → has_object_permission)."""
        attachment = selectors.comment_attachment(self.get_object(), int(attachment_id))
        if attachment is None:
            raise NotFound("El adjunto no existe.")
        return FileResponse(
            attachment.file.open("rb"), as_attachment=True, filename=attachment.original_filename
        )

    @action(detail=False, methods=["get"])
    def mentionables(self, request):
        query = request.query_params.get("q", "").strip()
        raw_target = request.query_params.get("target")
        target = self._target(raw_target) if raw_target else None
        users = list(selectors.mentionable_users(query))
        allowed = selectors.allowed_ids(target, users)
        return Response({
            "users": MentionableUserSerializer(users, many=True, context={"allowed_ids": allowed}).data,
            "teams": MentionableTeamSerializer(selectors.mentionable_teams(query), many=True).data,
        })

    # ------------------------------------------------------------------ helpers

    def _target(self, raw: str | None) -> CommentTarget:
        target = resolve_target(*parse_target(raw))
        require_target_access(self.request.user, target)
        return target

    def _parent(self, parent_id: int | None):
        if parent_id is None:
            return None
        parent = selectors.find_parent(parent_id)
        if parent is None:
            raise ValidationError({"parent_id": "El comentario padre no existe."})
        return parent

    def _context(self) -> dict:
        user = self.request.user
        return {"user": user, "can_moderate": CommentService.can_moderate(user)}

    def _detail(self, pk: int) -> dict:
        return CommentSerializer(selectors.comment_detail(pk), context=self._context()).data
