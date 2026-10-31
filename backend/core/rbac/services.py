"""RoleService: materializes Django group permissions from RBAC bundles."""
from typing import TypedDict

from django.contrib.auth.models import Group, Permission
from django.db.models import Q

from core.rbac.bundles import expand


class SodWarning(TypedDict):
    rule: str   # SodRule key
    label: str
    user: str   # username or "group-level check"


class RoleService:
    @staticmethod
    def materialize(group: Group) -> None:
        """Compute and set group permissions from bundles + extra - excluded.

        Skips groups with no bundles and no extra_permissions configured —
        those have not been given a permission composition yet and should not
        have their permissions cleared.
        """
        try:
            profile = group.profile
        except AttributeError:
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

    @staticmethod
    def get_composition(group) -> dict:
        """Return current composition + effective_permissions for a group."""
        profile = group.profile
        effective = sorted(
            f"{p.content_type.app_label}.{p.codename}"
            for p in group.permissions.select_related("content_type")
        )
        return {
            "bundles": profile.bundles,
            "extra_permissions": profile.extra_permissions,
            "excluded_permissions": profile.excluded_permissions,
            "effective_permissions": effective,
        }

    @staticmethod
    def apply_composition(group, data: dict, actor, request) -> list[SodWarning]:
        """Validate and apply a role composition PUT.

        Raises DRF ValidationError or PermissionDenied on failure.
        Returns sod_warnings on success.
        """
        from rest_framework.exceptions import PermissionDenied, ValidationError

        from core.rbac.bundles import BUNDLES
        from core.rbac.bundles import expand as _expand
        from core.rbac.catalog import permission_catalog

        profile = group.profile
        if profile.kind == "TEAM":
            raise ValidationError({"detail": "No se puede editar la composición de un grupo TEAM."})
        if profile.is_system:
            raise ValidationError({"detail": "No se puede editar la composición de un rol del sistema."})

        bundles = list(data.get("bundles") or [])
        extra = list(data.get("extra_permissions") or [])
        excluded = list(data.get("excluded_permissions") or [])

        catalog = permission_catalog()
        invalid = [b for b in bundles if b not in BUNDLES] + [c for c in extra + excluded if c not in catalog]
        if invalid:
            raise ValidationError({"invalid": invalid})

        if not actor.is_superuser:
            actor_perms = actor.get_all_permissions()
            if (_expand(bundles) | set(extra)) - actor_perms:
                raise PermissionDenied("No puede asignar permisos que no posee.")

        return RoleService.set_role_composition(group, bundles, extra, excluded, actor, request)

    @staticmethod
    def check_sod(user_bundles: set[str]) -> list[SodWarning]:
        """Check SOD_RULES against a set of bundle keys. Returns warnings."""
        from core.rbac.sod import SOD_RULES

        warnings: list[SodWarning] = []
        for rule in SOD_RULES:
            b1, b2 = rule["bundles"]
            if b1 in user_bundles and b2 in user_bundles:
                warnings.append(
                    SodWarning(rule=rule["key"], label=rule["label"], user="group-level check")
                )
        return warnings

    @staticmethod
    def set_role_composition(group: Group, bundles: list, extra: list, excluded: list, actor, request) -> list[SodWarning]:
        """Set a group's composition, materialize, check SoD, audit. Returns sod_warnings."""
        from django.db import transaction

        from core.models import ActionLog
        from core.services import ActionLoggingService

        with transaction.atomic():
            profile = group.profile

            # 1. Get old effective perms (for audit)
            old_perms = set(
                f"{p.content_type.app_label}.{p.codename}"
                for p in group.permissions.select_related("content_type")
            )

            # 2. Update profile fields
            profile.bundles = bundles
            profile.extra_permissions = extra
            profile.excluded_permissions = excluded

            # 3. Validate
            profile.full_clean()
            profile.save()

            # 4. Materialize
            RoleService.materialize(group)

            # 5. Get new effective perms
            group.refresh_from_db()
            new_perms = set(
                f"{p.content_type.app_label}.{p.codename}"
                for p in group.permissions.select_related("content_type")
            )

            added = new_perms - old_perms
            removed = old_perms - new_perms

            # 6. Audit log
            if added or removed:
                ActionLoggingService.log_action(
                    user=actor,
                    action_type=ActionLog.Type.SECURITY,
                    description=(
                        f"Composición de rol '{group.name}' modificada. "
                        f"+{len(added)} permisos, -{len(removed)} permisos."
                    ),
                    request=request,
                    metadata={
                        "group_id": group.pk,
                        "group_name": group.name,
                        "added": sorted(added),
                        "removed": sorted(removed),
                    },
                )

            # 7. Compute effective bundles for SoD check
            effective_bundles = set(bundles)

            # 8. Check SoD
            sod_warnings = RoleService.check_sod(effective_bundles)

            # Log SoD conflicts
            if sod_warnings:
                ActionLoggingService.log_action(
                    user=actor,
                    action_type=ActionLog.Type.SECURITY,
                    description=(
                        f"SoD: rol '{group.name}' tiene {len(sod_warnings)} conflicto(s)."
                    ),
                    request=request,
                    metadata={
                        "group_id": group.pk,
                        "group_name": group.name,
                        "sod_conflicts": [
                            {"rule": w["rule"], "label": w["label"]} for w in sod_warnings
                        ],
                    },
                )

        return sod_warnings

    @staticmethod
    def validate_new_user_groups(actor, new_groups: list) -> None:
        """No-escalation pre-save check for user creation.

        Called BEFORE serializer.save() so a PermissionDenied raised here
        never commits the new user to the DB (C1 fix).

        Raises PermissionDenied if actor tries to assign a group whose
        permissions exceed the actor's own.  Superusers are exempt.
        """
        from rest_framework.exceptions import PermissionDenied

        if actor.is_superuser or not new_groups:
            return
        actor_perms = actor.get_all_permissions()
        for group in new_groups:
            group_perms = set(
                f"{p.content_type.app_label}.{p.codename}"
                for p in group.permissions.select_related("content_type")
            )
            if group_perms - actor_perms:
                raise PermissionDenied(
                    f"No puede asignar el grupo '{group.name}': "
                    f"contiene permisos que usted no posee."
                )

    @staticmethod
    def audit_new_user_groups(instance, new_groups: list, actor, request) -> None:
        """Compute SoD and write audit log after a new user is saved with groups."""
        all_bundles: set[str] = set()
        for group in new_groups:
            try:
                profile = group.profile
                if profile.kind == "ROLE":
                    all_bundles.update(profile.bundles)
            except AttributeError:
                pass
        sod_warnings = RoleService.check_sod(all_bundles)
        after = set(instance.groups.values_list("name", flat=True))
        RoleService.log_user_roles_change(instance, set(), after, actor, request, sod_warnings=sod_warnings)

    @staticmethod
    def validate_role_assignment(actor, target, new_groups: list) -> list[SodWarning]:
        """Check no-escalation and SoD for assigning new_groups to target user.

        Raises PermissionDenied if:
        - actor == target and groups are changing
        - Any permission in a group being added is not in actor.get_all_permissions()
          (unless actor.is_superuser)

        Returns SoD warnings for the target's final effective bundles.
        """
        from rest_framework.exceptions import PermissionDenied

        # Self-assignment check
        if actor.pk == target.pk:
            current_group_ids = set(target.groups.values_list("id", flat=True))
            new_group_ids = {g.pk for g in new_groups}
            if current_group_ids != new_group_ids:
                raise PermissionDenied("No puede modificar sus propios grupos.")

        # No-escalation check (skip for superusers).
        # Also enforces demotion guard: removing a group with perms the actor
        # lacks is equally privileged — compute the diff (added + removed)
        # and verify actor_perms covers every changed group.
        if not actor.is_superuser:
            actor_perms = actor.get_all_permissions()
            current_group_ids = set(target.groups.values_list("id", flat=True)) if target else set()
            new_group_ids = {g.pk for g in new_groups}
            changed_groups = [g for g in new_groups if g.pk not in current_group_ids]  # added
            changed_groups += [g for g in target.groups.all() if g.pk not in new_group_ids]  # removed
            for group in changed_groups:
                group_perms = set(
                    f"{p.content_type.app_label}.{p.codename}"
                    for p in group.permissions.select_related("content_type")
                )
                forbidden = group_perms - actor_perms
                if forbidden:
                    raise PermissionDenied(
                        f"No puede modificar el grupo '{group.name}': "
                        f"contiene permisos que usted no posee."
                    )

        # SoD check across all groups
        all_bundles: set[str] = set()
        for group in new_groups:
            try:
                profile = group.profile
                if profile.kind == "ROLE":
                    all_bundles.update(profile.bundles)
            except AttributeError:
                pass

        return RoleService.check_sod(all_bundles)

    @staticmethod
    def log_user_roles_change(user, before: set, after: set, actor, request, *, sod_warnings: list | None = None) -> None:
        """Log ActionLog SECURITY if before != after."""
        if before == after:
            return
        from core.models import ActionLog
        from core.services import ActionLoggingService

        added = after - before
        removed = before - after
        metadata: dict = {
            "user_id": user.pk,
            "username": user.username,
            "added_groups": sorted(added),
            "removed_groups": sorted(removed),
        }
        if sod_warnings:
            metadata["sod_conflicts"] = [
                {"rule": w["rule"], "label": w["label"]} for w in sod_warnings
            ]
        ActionLoggingService.log_action(
            user=actor,
            action_type=ActionLog.Type.SECURITY,
            description=(
                f"Grupos del usuario '{user.username}' modificados. "
                f"+{len(added)} grupos, -{len(removed)} grupos."
            ),
            request=request,
            metadata=metadata,
        )
