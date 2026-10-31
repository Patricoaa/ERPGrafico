"""RoleService: materializes Django group permissions from RBAC bundles."""
from django.contrib.auth.models import Group, Permission
from django.db.models import Q

from core.rbac.bundles import expand


class RoleService:
    @staticmethod
    def materialize(group: Group) -> None:
        """Compute and set group permissions from bundles + extra - excluded."""
        try:
            profile = group.profile
        except Exception:
            return
        if profile.kind != "ROLE":
            return

        target_codes = expand(profile.bundles)
        target_codes |= set(profile.extra_permissions)
        target_codes -= set(profile.excluded_permissions)

        if target_codes:
            q = Q()
            for code in target_codes:
                parts = code.split(".", 1)
                if len(parts) == 2:
                    q |= Q(content_type__app_label=parts[0], codename=parts[1])
            perm_objs = Permission.objects.filter(q).select_related("content_type")
        else:
            perm_objs = Permission.objects.none()

        group.permissions.set(perm_objs)

    @staticmethod
    def materialize_all() -> int:
        """Materialize all ROLE groups. Returns count processed."""
        from core.models import GroupProfile

        count = 0
        for profile in GroupProfile.objects.filter(kind="ROLE").select_related("group"):
            RoleService.materialize(profile.group)
            count += 1
        return count
