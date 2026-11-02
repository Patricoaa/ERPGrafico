from __future__ import annotations

from django.contrib.auth.models import Group
from django.db.models import Count, Prefetch, Q, QuerySet

from core.models import Attachment, GroupProfile, User
from workflow.models import Comment

from .targets import CommentTarget

MENTIONABLE_LIMIT = 10

_COMMENT_PREFETCH = ("mentions__user", "mentions__group", "attachments")


def thread_roots(target: CommentTarget) -> list[Comment]:
    """Hilos de la entidad: raíces + respuestas vivas, todo precargado (zero N+1).

    Una raíz eliminada solo se conserva si tiene respuestas vivas, para no romper el hilo.
    """
    replies = (
        Comment.objects.filter(deleted_at__isnull=True)
        .select_related("user")
        .prefetch_related(*_COMMENT_PREFETCH)
        .order_by("created_at")
    )
    roots = (
        Comment.objects.filter(
            content_type=target.content_type, object_id=target.obj.pk, parent__isnull=True
        )
        .select_related("user")
        .prefetch_related(*_COMMENT_PREFETCH, Prefetch("replies", queryset=replies))
        .order_by("created_at")
    )
    return [c for c in roots if not c.is_deleted or c.replies.all()]


def comment_queryset() -> QuerySet[Comment]:
    return Comment.objects.filter(deleted_at__isnull=True).select_related("user", "content_type")


def comment_detail(pk: int) -> Comment:
    return (
        Comment.objects.select_related("user")
        .prefetch_related(*_COMMENT_PREFETCH)
        .get(pk=pk)
    )


def comment_attachment(comment: Comment, attachment_id: int) -> Attachment | None:
    return comment.attachments.filter(pk=attachment_id).first()


def find_parent(pk: int) -> Comment | None:
    """Padre de una respuesta. Incluye raíces eliminadas: su hilo sigue vivo."""
    return Comment.objects.select_related("parent").filter(pk=pk).first()


def allowed_ids(target: CommentTarget | None, users: list[User]) -> set[int] | None:
    """Ids de ``users`` con acceso a ``target``; None si no hay target que evaluar."""
    if target is None:
        return None
    return set(
        users_with_access(target.view_permission)
        .filter(pk__in=[u.pk for u in users])
        .values_list("id", flat=True)
    )


def thread_participant_ids(root: Comment) -> set[int]:
    """Autor de la raíz + autores de respuestas vivas."""
    ids = set(
        Comment.objects.filter(parent=root, deleted_at__isnull=True, user__isnull=False)
        .values_list("user_id", flat=True)
    )
    if root.user_id and not root.is_deleted:
        ids.add(root.user_id)
    return ids


def users_with_access(permission: str) -> QuerySet[User]:
    return User.objects.with_perm(permission, is_active=True, include_superusers=True)


def team_member_ids(group_ids: set[int]) -> set[int]:
    if not group_ids:
        return set()
    return set(
        User.objects.filter(groups__in=group_ids, is_active=True).values_list("id", flat=True)
    )


def mentionable_users(query: str) -> QuerySet[User]:
    qs = User.objects.filter(is_active=True)
    for term in query.split():
        qs = qs.filter(
            Q(username__icontains=term)
            | Q(first_name__icontains=term)
            | Q(last_name__icontains=term)
        )
    return qs.order_by("first_name", "last_name", "username")[:MENTIONABLE_LIMIT]


def mentionable_teams(query: str) -> QuerySet[Group]:
    qs = Group.objects.filter(profile__kind=GroupProfile.TEAM)
    if query:
        qs = qs.filter(name__icontains=query)
    return (
        qs.annotate(member_count=Count("user", filter=Q(user__is_active=True)))
        .order_by("name")[:MENTIONABLE_LIMIT]
    )
