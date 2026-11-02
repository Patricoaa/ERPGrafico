"""Serializers de comentarios. Sin ORM: todo llega precargado desde selectors (zero N+1)."""

from __future__ import annotations

from rest_framework import serializers

from workflow.models import Comment

from .services import MAX_ATTACHMENTS, MAX_TEXT_LENGTH, display_name


class CommentWriteSerializer(serializers.Serializer):
    """JSON o multipart (`files` repetido). El texto puede ir vacío si hay adjuntos."""

    target = serializers.CharField()
    text = serializers.CharField(
        max_length=MAX_TEXT_LENGTH, trim_whitespace=True, required=False, allow_blank=True, default=""
    )
    parent_id = serializers.IntegerField(required=False, allow_null=True)
    files = serializers.ListField(
        child=serializers.FileField(), required=False, default=list, max_length=MAX_ATTACHMENTS
    )


class CommentEditSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=MAX_TEXT_LENGTH, trim_whitespace=True, allow_blank=True)


class CommentSerializer(serializers.ModelSerializer):
    """Contexto requerido: ``user`` (request.user) y ``can_moderate`` (bool)."""

    author = serializers.SerializerMethodField()
    text = serializers.SerializerMethodField()
    mentions = serializers.SerializerMethodField()
    attachments = serializers.SerializerMethodField()
    is_deleted = serializers.BooleanField(read_only=True)
    can_edit = serializers.SerializerMethodField()
    can_delete = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = [
            "id", "parent_id", "author", "text", "mentions", "attachments",
            "created_at", "edited_at", "is_deleted", "can_edit", "can_delete",
        ]
        read_only_fields = fields

    def get_author(self, obj: Comment) -> dict | None:
        if obj.user is None:
            return None
        return {"id": obj.user.pk, "name": display_name(obj.user)}

    def get_text(self, obj: Comment) -> str:
        return "" if obj.is_deleted else obj.text

    def get_mentions(self, obj: Comment) -> list[dict]:
        if obj.is_deleted:
            return []
        return [
            {"kind": "user", "id": m.user_id, "name": display_name(m.user)}
            if m.user_id
            else {"kind": "team", "id": m.group_id, "name": m.group.name}
            for m in obj.mentions.all()
        ]

    def get_attachments(self, obj: Comment) -> list[dict]:
        """Metadatos precargados; el archivo se baja por el endpoint con permisos (no URL firmada)."""
        if obj.is_deleted:
            return []
        return [
            {"id": a.pk, "name": a.original_filename, "size": a.file_size or 0, "mime_type": a.mime_type}
            for a in obj.attachments.all()
        ]

    def _is_author(self, obj: Comment) -> bool:
        user = self.context.get("user")
        return bool(user and obj.user_id == user.pk)

    def get_can_edit(self, obj: Comment) -> bool:
        return not obj.is_deleted and self._is_author(obj)

    def get_can_delete(self, obj: Comment) -> bool:
        return not obj.is_deleted and (self._is_author(obj) or bool(self.context.get("can_moderate")))


class CommentThreadSerializer(CommentSerializer):
    replies = serializers.SerializerMethodField()

    class Meta(CommentSerializer.Meta):
        fields = [*CommentSerializer.Meta.fields, "replies"]
        read_only_fields = fields

    def get_replies(self, obj: Comment) -> list[dict]:
        return CommentSerializer(obj.replies.all(), many=True, context=self.context).data


class MentionableUserSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.SerializerMethodField()
    username = serializers.CharField()
    has_access = serializers.SerializerMethodField()

    def get_name(self, obj) -> str:
        return display_name(obj)

    def get_has_access(self, obj) -> bool | None:
        allowed = self.context.get("allowed_ids")
        return None if allowed is None else obj.pk in allowed


class MentionableTeamSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    member_count = serializers.IntegerField()
