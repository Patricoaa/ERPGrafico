"""CommentService — comentarios, hilos de un nivel, menciones y notificaciones (ADR-0111)."""

from __future__ import annotations

import re
from collections.abc import Sequence

from django.contrib.auth.models import Group
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.files.uploadedfile import UploadedFile
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from core.documents.refs import display_id_for
from core.entity_bus import broadcast_comments_changed
from core.models import Attachment, GroupProfile, User
from core.validators import validate_file_extension, validate_file_size
from workflow.models import Comment, CommentMention, Notification

from . import selectors
from .targets import CommentTarget, label_of, target_of

MAX_TEXT_LENGTH = 5000
MESSAGE_PREVIEW_LENGTH = 200
MAX_ATTACHMENTS = 5

# Tokens de mención persistidos en el texto: @[u:12] (usuario) y @[g:3] (equipo).
MENTION_RE = re.compile(r"@\[(u|g):(\d+)\]")

MENTION_TYPE = "comment_mention"
REPLY_TYPE = "comment_reply"


def display_name(user: User | None) -> str:
    if user is None:
        return "Sistema"
    return user.get_full_name() or user.username


def parse_mentions(text: str) -> tuple[set[int], set[int]]:
    user_ids: set[int] = set()
    group_ids: set[int] = set()
    for kind, pk in MENTION_RE.findall(text):
        (user_ids if kind == "u" else group_ids).add(int(pk))
    return user_ids, group_ids


def render_plain(text: str, names: dict[tuple[str, int], str]) -> str:
    """Reemplaza los tokens por @Nombre para títulos y mensajes de notificación."""
    return MENTION_RE.sub(lambda m: f"@{names.get((m[1], int(m[2])), '?')}", text)


class CommentService:
    @staticmethod
    def can_moderate(user: User) -> bool:
        return user.has_perm("workflow.delete_comment")

    @staticmethod
    @transaction.atomic
    def create(
        *,
        target: CommentTarget,
        user: User,
        text: str,
        parent: Comment | None = None,
        files: Sequence[UploadedFile] = (),
    ) -> Comment:
        CommentService._validate_files(files)
        text = CommentService._clean_text(text, allow_empty=bool(files))
        if parent is not None:
            parent = CommentService._thread_root(parent, target)
        comment = Comment.objects.create(
            content_type=target.content_type,
            object_id=target.obj.pk,
            user=user,
            text=text,
            parent=parent,
        )
        CommentService._attach(comment, user, files)
        new_users, new_groups = CommentService._sync_mentions(comment)
        transaction.on_commit(
            lambda: CommentService._notify(comment, target, new_users, new_groups)
        )
        CommentService._broadcast_on_commit(target.label, target.obj.pk)
        return comment

    @staticmethod
    @transaction.atomic
    def edit(*, comment: Comment, user: User, text: str) -> Comment:
        if comment.user_id != user.pk:
            raise PermissionDenied("Solo el autor puede editar el comentario.")
        comment.text = CommentService._clean_text(text, allow_empty=comment.attachments.exists())
        comment.edited_at = timezone.now()
        comment.save(update_fields=["text", "edited_at", "updated_at"])
        new_users, new_groups = CommentService._sync_mentions(comment)
        # Solo las menciones nuevas se notifican; editar no re-notifica al hilo.
        if new_users or new_groups:
            transaction.on_commit(
                lambda: CommentService._notify(
                    comment, target_of(comment), new_users, new_groups, notify_thread=False
                )
            )
        CommentService._broadcast_on_commit(label_of(comment), comment.object_id)
        return comment

    @staticmethod
    @transaction.atomic
    def delete(*, comment: Comment, user: User) -> None:
        if comment.user_id != user.pk and not CommentService.can_moderate(user):
            raise PermissionDenied("No puedes eliminar este comentario.")
        comment.deleted_at = timezone.now()
        comment.deleted_by = user
        comment.save(update_fields=["deleted_at", "deleted_by", "updated_at"])
        CommentService._broadcast_on_commit(label_of(comment), comment.object_id)

    # ------------------------------------------------------------------ internals

    @staticmethod
    def _broadcast_on_commit(label: str, target_id: int) -> None:
        """Refresca en vivo los paneles abiertos sobre la entidad (entity bus, ADR-0111)."""
        transaction.on_commit(
            lambda: broadcast_comments_changed(label=label, instance_id=target_id)
        )

    @staticmethod
    def _clean_text(text: str, *, allow_empty: bool = False) -> str:
        """Un comentario solo con adjuntos puede no llevar texto."""
        text = (text or "").strip()
        if not text and not allow_empty:
            raise ValidationError({"text": "El comentario no puede estar vacío."})
        if len(text) > MAX_TEXT_LENGTH:
            raise ValidationError({"text": f"Máximo {MAX_TEXT_LENGTH} caracteres."})
        return text

    @staticmethod
    def _validate_files(files: Sequence[UploadedFile]) -> None:
        # Attachment.objects.create no ejecuta los validators del FileField: se aplican aquí.
        if len(files) > MAX_ATTACHMENTS:
            raise ValidationError({"files": f"Máximo {MAX_ATTACHMENTS} archivos por comentario."})
        for f in files:
            try:
                validate_file_size(f)
                validate_file_extension(f)
            except DjangoValidationError as exc:
                raise ValidationError({"files": f"{f.name}: {' '.join(exc.messages)}"}) from exc

    @staticmethod
    def _attach(comment: Comment, user: User, files: Sequence[UploadedFile]) -> None:
        for f in files:
            Attachment.objects.create(
                content_object=comment,
                file=f,
                original_filename=f.name[:255],
                user=user,
                file_size=f.size,
                mime_type=(f.content_type or "")[:100] or None,
            )

    @staticmethod
    def _thread_root(parent: Comment, target: CommentTarget) -> Comment:
        """Hilo de un nivel: responder a una respuesta cuelga del mismo comentario raíz."""
        root = parent.parent if parent.parent_id else parent
        if root.content_type_id != target.content_type.pk or root.object_id != target.obj.pk:
            raise ValidationError({"parent": "El comentario padre pertenece a otra entidad."})
        return root

    @staticmethod
    def _sync_mentions(comment: Comment) -> tuple[set[int], set[int]]:
        """Reconcilia CommentMention con los tokens del texto. Devuelve las menciones nuevas."""
        user_ids, group_ids = parse_mentions(comment.text)
        valid_users = set(
            User.objects.filter(pk__in=user_ids, is_active=True).values_list("id", flat=True)
        )
        valid_groups = set(
            Group.objects.filter(pk__in=group_ids, profile__kind=GroupProfile.TEAM)
            .values_list("id", flat=True)
        )
        invalid = (user_ids - valid_users) | (group_ids - valid_groups)
        if invalid:
            raise ValidationError({"text": "El comentario menciona usuarios o equipos inválidos."})

        existing = list(comment.mentions.all())
        old_users = {m.user_id for m in existing if m.user_id}
        old_groups = {m.group_id for m in existing if m.group_id}
        comment.mentions.filter(user_id__in=old_users - valid_users).delete()
        comment.mentions.filter(group_id__in=old_groups - valid_groups).delete()
        new_users = valid_users - old_users
        new_groups = valid_groups - old_groups
        CommentMention.objects.bulk_create(
            [CommentMention(comment=comment, user_id=pk) for pk in new_users]
            + [CommentMention(comment=comment, group_id=pk) for pk in new_groups]
        )
        return new_users, new_groups

    @staticmethod
    def _notify(
        comment: Comment,
        target: CommentTarget,
        mentioned_users: set[int],
        mentioned_groups: set[int],
        notify_thread: bool = True,
    ) -> None:
        mentioned = mentioned_users | selectors.team_member_ids(mentioned_groups)
        participants = (
            selectors.thread_participant_ids(comment.parent)
            if notify_thread and comment.parent_id
            else set()
        )
        candidates = (mentioned | participants) - {comment.user_id}
        if not candidates:
            return
        # Sin acceso a la entidad → no se notifica (no filtrar el contenido, ADR-0111).
        allowed = set(
            selectors.users_with_access(target.view_permission)
            .filter(pk__in=candidates)
            .values_list("id", flat=True)
        )
        author = display_name(comment.user)
        # Título compacto: el identificador de la entidad; el autor va en el mensaje.
        title = display_id_for(target.label, target.obj)[:255]
        preview = CommentService._preview(comment)
        data = {
            "label": target.label,
            "id": target.obj.pk,
            "comment_id": comment.pk,
            "thread_id": comment.parent_id or comment.pk,
        }
        for user_id in sorted(allowed):
            is_mention = user_id in mentioned
            verb = "te mencionó" if is_mention else "respondió"
            # save() individual para que el signal haga push por WebSocket.
            Notification.objects.create(
                user_id=user_id,
                title=title,
                message=f"{author} {verb}: {preview}",
                link=target.url,
                data=data,
                notification_type=MENTION_TYPE if is_mention else REPLY_TYPE,
                content_object=target.obj,
            )

    @staticmethod
    def _preview(comment: Comment) -> str:
        names: dict[tuple[str, int], str] = {}
        for m in comment.mentions.select_related("user", "group"):
            if m.user_id:
                names[("u", m.user_id)] = display_name(m.user)
            else:
                names[("g", m.group_id)] = m.group.name
        text = render_plain(comment.text, names)
        if not text:
            count = comment.attachments.count()
            text = f"adjuntó {count} archivo{'s' if count != 1 else ''}"
        if len(text) > MESSAGE_PREVIEW_LENGTH:
            text = text[: MESSAGE_PREVIEW_LENGTH - 1] + "…"
        return text
