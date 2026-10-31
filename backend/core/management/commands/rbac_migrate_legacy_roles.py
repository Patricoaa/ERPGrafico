"""rbac_migrate_legacy_roles — migrate users from legacy groups to seeded roles.

Usage:
  python manage.py rbac_migrate_legacy_roles          # plan (dry-run, default)
  python manage.py rbac_migrate_legacy_roles --apply  # execute migration
  python manage.py rbac_migrate_legacy_roles --apply --allow-unassigned

Legacy groups and their mapping to seeded roles:
  ADMIN     → ["Administrador del sistema", "Gerencia"]   (two roles)
  MANAGER   → ["Gerencia"]
  READ_ONLY → ["Auditor"]
  OPERATOR  → team-based routing via TEAM_TO_ROLE dict
               (no match → unassigned / "sin propuesta")

OPERATOR team routing:
  "Ventas"         → "Ventas"
  "Bodega"         → "Bodega y Despacho"
  "Despacho"       → "Bodega y Despacho"
  "Diseño"         → "Producción"
  "Pre-Prensa"     → "Producción"
  "Taller"         → "Producción"
  "Terminaciones"  → "Producción"
  "Supervisor"     → "Jefatura de Producción"
  "Administración" → "Administración y Finanzas"

After --apply (wrapped in transaction.atomic):
  - Each user in a legacy group is added to the corresponding seeded role group(s).
  - Legacy groups are deleted.
  - An ActionLog entry is created for the migration.

Safety checks (--apply):
  - If any active user was in ONLY legacy groups and would have no seeded role,
    the command aborts unless --allow-unassigned is passed.
"""

from django.contrib.auth.models import Group
from django.core.management.base import BaseCommand, CommandError


# Mapping from legacy group name to ONE OR MORE seeded role names.
LEGACY_MAPPING: dict[str, list[str]] = {
    "ADMIN": ["Administrador del sistema", "Gerencia"],
    "MANAGER": ["Gerencia"],
    "READ_ONLY": ["Auditor"],
    # OPERATOR is handled separately via TEAM_TO_ROLE
}

LEGACY_NAMES: frozenset[str] = frozenset(LEGACY_MAPPING.keys()) | {"OPERATOR"}

# For OPERATOR users: map each team group name to the target seeded role.
TEAM_TO_ROLE: dict[str, str] = {
    "Ventas": "Ventas",
    "Bodega": "Bodega y Despacho",
    "Despacho": "Bodega y Despacho",
    "Diseño": "Producción",
    "Pre-Prensa": "Producción",
    "Taller": "Producción",
    "Terminaciones": "Producción",
    "Supervisor": "Jefatura de Producción",
    "Administración": "Administración y Finanzas",
}


def _resolve_operator_roles(user, legacy_group_pks: frozenset) -> list[str]:
    """Return the seeded role names for an OPERATOR user via team routing.

    Returns an empty list if no team matches (user will be unassigned).
    """
    seen: set[str] = set()
    result: list[str] = []
    for group in user.groups.all():
        if group.pk in legacy_group_pks:
            continue
        role_name = TEAM_TO_ROLE.get(group.name)
        if role_name and role_name not in seen:
            seen.add(role_name)
            result.append(role_name)
    return result


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
                "Allow migration even if some OPERATOR users would have no seeded "
                "role after the legacy groups are deleted."
            ),
        )

    def handle(self, *args, **options):
        apply_mode: bool = options["apply"]
        allow_unassigned: bool = options["allow_unassigned"]

        # ------------------------------------------------------------------ #
        # Collect legacy groups that actually exist                            #
        # ------------------------------------------------------------------ #
        legacy_groups: dict[str, Group] = {}
        for name in LEGACY_NAMES:
            grp = Group.objects.filter(name=name).first()
            if grp is not None:
                legacy_groups[name] = grp

        if not legacy_groups:
            self.stdout.write(
                self.style.SUCCESS("No legacy groups found. Nothing to migrate.")
            )
            return

        self.stdout.write(
            f"Legacy groups present: {', '.join(legacy_groups.keys())}"
        )

        legacy_group_pks = frozenset(g.pk for g in legacy_groups.values())

        # ------------------------------------------------------------------ #
        # Build plan                                                           #
        # ------------------------------------------------------------------ #
        # plan_entries: list of {legacy_name, users_and_targets: [(user, [role_names])]}
        plan_entries: list[dict] = []

        for legacy_name, legacy_group in legacy_groups.items():
            users_in_group = list(
                legacy_group.user_set.filter(is_active=True)
                .prefetch_related("groups")
            )

            if legacy_name == "OPERATOR":
                users_and_targets = [
                    (u, _resolve_operator_roles(u, legacy_group_pks))
                    for u in users_in_group
                ]
                plan_entries.append({
                    "legacy_name": legacy_name,
                    "legacy_group": legacy_group,
                    "mapping": "team-based",
                    "users_and_targets": users_and_targets,
                })
            else:
                target_names = LEGACY_MAPPING[legacy_name]
                users_and_targets = [(u, target_names) for u in users_in_group]
                plan_entries.append({
                    "legacy_name": legacy_name,
                    "legacy_group": legacy_group,
                    "mapping": ", ".join(target_names),
                    "users_and_targets": users_and_targets,
                })

        # ------------------------------------------------------------------ #
        # Print plan                                                           #
        # ------------------------------------------------------------------ #
        self.stdout.write("\nMigration plan:")
        self.stdout.write("─" * 70)
        for entry in plan_entries:
            self.stdout.write(
                f"  {entry['legacy_name']:12} → {entry['mapping']}"
            )
            for user, targets in entry["users_and_targets"]:
                targets_str = ", ".join(f"'{t}'" for t in targets) if targets else "(sin propuesta)"
                self.stdout.write(f"     {user.username}: {targets_str}")
        self.stdout.write("─" * 70)

        # ------------------------------------------------------------------ #
        # Safety check: orphaned OPERATOR users                               #
        # ------------------------------------------------------------------ #
        if not allow_unassigned:
            self._check_no_orphaned_operators(plan_entries)

        if not apply_mode:
            self.stdout.write(
                self.style.WARNING(
                    "\nDry-run complete.  Pass --apply to execute the migration."
                )
            )
            return

        # ------------------------------------------------------------------ #
        # I12: verify all target seeded groups exist before applying          #
        # ------------------------------------------------------------------ #
        all_target_names: set[str] = set()
        for entry in plan_entries:
            for _, target_names in entry["users_and_targets"]:
                all_target_names.update(target_names)

        existing_names = set(
            Group.objects.filter(name__in=all_target_names).values_list("name", flat=True)
        )
        missing_seeded = sorted(all_target_names - existing_names)
        if missing_seeded:
            raise CommandError(
                f"Aborting: seeded group(s) missing from DB: "
                f"{', '.join(missing_seeded)}. "
                f"Run 'manage.py sync_permissions' first."
            )

        # ------------------------------------------------------------------ #
        # APPLY — wrapped in atomic so partial migrations never commit         #
        # ------------------------------------------------------------------ #
        from django.db import transaction
        from core.models import ActionLog

        with transaction.atomic():
            total_users_migrated = 0
            deleted_group_names: list[str] = []

            for entry in plan_entries:
                legacy_group = entry["legacy_group"]
                legacy_name = entry["legacy_name"]

                for user, target_names in entry["users_and_targets"]:
                    for role_name in target_names:
                        seeded_group = Group.objects.filter(name=role_name).first()
                        if seeded_group is None:
                            self.stdout.write(
                                self.style.WARNING(
                                    f"  Skipping '{role_name}' for {user.username}: "
                                    f"group not found. Run sync_permissions first."
                                )
                            )
                            continue
                        user.groups.add(seeded_group)
                    user.groups.remove(legacy_group)
                    total_users_migrated += 1

                self.stdout.write(
                    f"  Migrated {len(entry['users_and_targets'])} user(s) from "
                    f"{legacy_name}"
                )
                legacy_group.delete()
                deleted_group_names.append(legacy_name)
                self.stdout.write(f"  Deleted legacy group: {legacy_name}")

            ActionLog.objects.create(
                user=None,
                action_type=ActionLog.Type.SECURITY,
                description=(
                    f"rbac_migrate_legacy_roles --apply: "
                    f"migrated {total_users_migrated} user(s), "
                    f"deleted groups: {', '.join(deleted_group_names)}"
                ),
                metadata={
                    "total_users_migrated": total_users_migrated,
                    "deleted_groups": deleted_group_names,
                    "legacy_mapping": {k: v for k, v in LEGACY_MAPPING.items()},
                    "team_to_role": TEAM_TO_ROLE,
                },
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"\nMigration complete: {total_users_migrated} user(s) migrated, "
                f"{len(deleted_group_names)} legacy group(s) deleted."
            )
        )

    def _check_no_orphaned_operators(self, plan_entries: list[dict]) -> None:
        """Abort if any active OPERATOR user would have no seeded role."""
        orphaned: list[str] = []
        for entry in plan_entries:
            if entry["legacy_name"] != "OPERATOR":
                continue
            for user, targets in entry["users_and_targets"]:
                if not targets:
                    orphaned.append(user.username)

        if orphaned:
            raise CommandError(
                f"Aborting: {len(orphaned)} active OPERATOR user(s) have no team "
                f"match and would be unassigned: {', '.join(orphaned[:10])}"
                + (" ..." if len(orphaned) > 10 else "")
                + "\nPass --allow-unassigned to skip this check."
            )
