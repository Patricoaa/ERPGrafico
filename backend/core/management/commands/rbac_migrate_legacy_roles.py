"""rbac_migrate_legacy_roles — migrate users from legacy groups to seeded roles.

Usage:
  python manage.py rbac_migrate_legacy_roles          # plan (dry-run, default)
  python manage.py rbac_migrate_legacy_roles --apply  # execute migration
  python manage.py rbac_migrate_legacy_roles --apply --allow-unassigned

Legacy groups and their mapping to seeded roles:
  ADMIN     → "Administrador del sistema"
  MANAGER   → "Gerencia"
  OPERATOR  → "Producción"   (general operator → production role)
  READ_ONLY → "Auditor"

After --apply:
  - Each user in a legacy group is added to the corresponding seeded role group.
  - Legacy groups are deleted.
  - An ActionLog entry is created for the migration.

Safety checks (--apply):
  - If any active user was in ONLY legacy groups and their legacy groups don't
    map to a seeded role, the command aborts unless --allow-unassigned is passed.
"""

from django.contrib.auth.models import Group
from django.core.management.base import BaseCommand, CommandError


# Mapping from legacy group name to seeded role group name
_LEGACY_TO_SEEDED: dict[str, str] = {
    "ADMIN": "Administrador del sistema",
    "MANAGER": "Gerencia",
    "OPERATOR": "Producción",
    "READ_ONLY": "Auditor",
}

_LEGACY_NAMES: frozenset[str] = frozenset(_LEGACY_TO_SEEDED.keys())


class Command(BaseCommand):
    help = (
        "Migrate users from legacy groups (ADMIN, MANAGER, OPERATOR, READ_ONLY) "
        "to seeded roles.  Default mode is --plan (dry-run)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--apply",
            action="store_true",
            default=False,
            help="Execute the migration (default is --plan / dry-run).",
        )
        parser.add_argument(
            "--allow-unassigned",
            action="store_true",
            default=False,
            help=(
                "Allow migration even if some users would have no seeded role "
                "after the legacy groups are deleted."
            ),
        )

    def handle(self, *args, **options):
        apply_mode: bool = options["apply"]
        allow_unassigned: bool = options["allow_unassigned"]

        # Collect legacy groups that actually exist
        legacy_groups = {
            name: grp
            for name in _LEGACY_NAMES
            if (grp := Group.objects.filter(name=name).first()) is not None
        }

        if not legacy_groups:
            self.stdout.write(
                self.style.SUCCESS("No legacy groups found. Nothing to migrate.")
            )
            return

        self.stdout.write(
            f"Legacy groups present: {', '.join(legacy_groups.keys())}"
        )

        # Build migration plan: legacy group → seeded role group
        plan: list[dict] = []
        for legacy_name, legacy_group in legacy_groups.items():
            seeded_name = _LEGACY_TO_SEEDED[legacy_name]
            seeded_group = Group.objects.filter(name=seeded_name).first()
            users = list(
                legacy_group.user_set.filter(is_active=True).values_list(
                    "username", flat=True
                )
            )
            plan.append(
                {
                    "legacy_name": legacy_name,
                    "legacy_group": legacy_group,
                    "seeded_name": seeded_name,
                    "seeded_group": seeded_group,
                    "users": users,
                }
            )

        # Print the plan
        self.stdout.write("\nMigration plan:")
        self.stdout.write("─" * 60)
        for entry in plan:
            status = "✓" if entry["seeded_group"] else "✗ (target group missing)"
            self.stdout.write(
                f"  {entry['legacy_name']:12} → {entry['seeded_name']!r:30} {status}"
            )
            if entry["users"]:
                self.stdout.write(f"     Users: {', '.join(entry['users'][:10])}")
                if len(entry["users"]) > 10:
                    self.stdout.write(f"     ... and {len(entry['users']) - 10} more")
            else:
                self.stdout.write("     Users: (none)")
        self.stdout.write("─" * 60)

        # Safety check: users with only legacy groups that don't map to a seeded role
        if not allow_unassigned:
            self._check_no_orphaned_users(plan)

        if not apply_mode:
            self.stdout.write(
                self.style.WARNING(
                    "\nDry-run complete.  Pass --apply to execute the migration."
                )
            )
            return

        # ------------------------------------------------------------------ #
        # APPLY                                                                #
        # ------------------------------------------------------------------ #
        from core.models import ActionLog

        total_users_migrated = 0
        deleted_groups: list[str] = []

        for entry in plan:
            legacy_group = entry["legacy_group"]
            seeded_group = entry["seeded_group"]
            legacy_name = entry["legacy_name"]

            if seeded_group is None:
                self.stdout.write(
                    self.style.WARNING(
                        f"  Skipping {legacy_name}: target group "
                        f"'{entry['seeded_name']}' not found. "
                        f"Run sync_permissions first."
                    )
                )
                continue

            users_in_legacy = list(legacy_group.user_set.all())
            for user in users_in_legacy:
                user.groups.add(seeded_group)
                user.groups.remove(legacy_group)
            total_users_migrated += len(users_in_legacy)
            self.stdout.write(
                f"  Migrated {len(users_in_legacy)} user(s): "
                f"{legacy_name} → {entry['seeded_name']!r}"
            )

            legacy_group.delete()
            deleted_groups.append(legacy_name)
            self.stdout.write(f"  Deleted legacy group: {legacy_name}")

        # Log the migration
        ActionLog.objects.create(
            user=None,
            action_type=ActionLog.Type.SECURITY,
            description=(
                f"rbac_migrate_legacy_roles --apply: "
                f"migrated {total_users_migrated} user(s), "
                f"deleted groups: {', '.join(deleted_groups)}"
            ),
            metadata={
                "total_users_migrated": total_users_migrated,
                "deleted_groups": deleted_groups,
                "mapping": _LEGACY_TO_SEEDED,
            },
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"\nMigration complete: {total_users_migrated} user(s) migrated, "
                f"{len(deleted_groups)} legacy group(s) deleted."
            )
        )

    def _check_no_orphaned_users(self, plan: list[dict]) -> None:
        """Abort if any active user would have no seeded role after migration."""
        from django.contrib.auth import get_user_model

        User = get_user_model()
        all_legacy_groups = {entry["legacy_group"].pk for entry in plan}

        # Active users who belong to at least one legacy group
        legacy_users = User.objects.filter(
            is_active=True, groups__in=all_legacy_groups
        ).prefetch_related("groups").distinct()

        orphaned: list[str] = []
        for user in legacy_users:
            non_legacy = [
                g for g in user.groups.all() if g.pk not in all_legacy_groups
            ]
            if not non_legacy:
                orphaned.append(user.username)

        if orphaned:
            raise CommandError(
                f"Aborting: {len(orphaned)} active user(s) would have no group "
                f"after migration: {', '.join(orphaned[:10])}"
                + (" ..." if len(orphaned) > 10 else "")
                + "\nPass --allow-unassigned to skip this check."
            )
