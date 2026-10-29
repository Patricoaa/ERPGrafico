"""Merge duplicate Permission rows created by the old PermissionRegistry bug.

For each ``(content_type__app_label, codename)`` combination that has more
than one ``auth_permission`` row:

1. Pick the **keeper** — the row whose ``content_type`` belongs to a model
   that actually declares that codename (default permission or
   ``Meta.permissions``).  When no perfect match is found, keep the one
   with the lowest ``pk`` (oldest).
2. Migrate ``Group.permissions`` and ``User.user_permissions`` M2M references
   from every duplicate to the keeper (idempotent — uses SQL to avoid
   integrity errors on already-existing relations).
3. Delete the duplicates.

The function is importable both from a ``RunPython`` migration and from tests.
"""

from django.contrib.auth.models import Group, Permission
from django.contrib.contenttypes.models import ContentType
from django.db.models import Count


def _model_declares_codename(content_type: ContentType, codename: str) -> bool:
    """Return True if the model behind *content_type* declares *codename*
    either as a default permission or in ``Meta.permissions``."""
    try:
        model = content_type.model_class()
        if model is None:
            return False
    except Exception:
        return False

    meta = model._meta

    # Default permissions: view_<model>, add_<model>, change_<model>, delete_<model>
    default_codenames = {
        f"{action}_{meta.model_name}" for action in meta.default_permissions
    }
    if codename in default_codenames:
        return True

    # Meta.permissions
    custom_codenames = {code for code, _name in meta.permissions}
    return codename in custom_codenames


def merge_duplicate_permissions() -> int:
    """Merge duplicate Permission rows.  Returns the number of rows deleted."""

    # Find (app_label, codename) pairs with more than one Permission.
    from django.db.models import F

    dupes = (
        Permission.objects.values(
            app_label=F("content_type__app_label"), codename_val=F("codename")
        )
        .annotate(cnt=Count("id"))
        .filter(cnt__gt=1)
    )

    deleted = 0

    for entry in dupes:
        app_label = entry["app_label"]
        codename = entry["codename_val"]

        rows = list(
            Permission.objects.filter(
                content_type__app_label=app_label, codename=codename
            )
            .select_related("content_type")
            .order_by("pk")
        )
        if len(rows) < 2:
            continue

        # Pick the keeper: prefer the one whose CT model declares the codename.
        keeper = None
        for perm in rows:
            if _model_declares_codename(perm.content_type, codename):
                keeper = perm
                break
        if keeper is None:
            keeper = rows[0]  # fallback: oldest

        duplicates = [p for p in rows if p.pk != keeper.pk]

        for dup in duplicates:
            # Migrate group.permissions M2M references.
            for group in Group.objects.filter(permissions=dup):
                group.permissions.remove(dup)
                group.permissions.add(keeper)

            # Migrate user.user_permissions M2M references.
            from django.contrib.auth import get_user_model
            User = get_user_model()
            for user in User.objects.filter(user_permissions=dup):
                user.user_permissions.remove(dup)
                user.user_permissions.add(keeper)

            dup.delete()
            deleted += 1

    return deleted
