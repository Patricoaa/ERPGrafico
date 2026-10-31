"""sync_permissions — idempotent command to sync RBAC permissions and seeded roles.

Steps:
  1. Sync custom permissions to DB via PermissionRegistry.
  2. For each SeededRole in SEEDED_ROLES: get-or-create Group + GroupProfile.
     Never overwrite an existing, already-configured GroupProfile (preserves
     admin customisations).
  3. Materialize all ROLE groups via RoleService.
"""

from django.contrib.auth.models import Group
from django.core.management.base import BaseCommand

from core.permissions import PermissionRegistry
from core.rbac.seed import SEEDED_ROLES


class Command(BaseCommand):
    help = "Syncs permissions and seeded role groups to the database"

    def handle(self, *args, **options):
        verbosity = options.get("verbosity", 1)

        # ------------------------------------------------------------------ #
        # 1. Sync custom permissions                                          #
        # ------------------------------------------------------------------ #
        if verbosity >= 1:
            self.stdout.write("Syncing Permissions...")
        count = PermissionRegistry.sync_to_db()
        if verbosity >= 1:
            self.stdout.write(self.style.SUCCESS(f"Synced {count} custom permissions."))

        # ------------------------------------------------------------------ #
        # 2. Create / configure seeded role groups                            #
        # ------------------------------------------------------------------ #
        from core.models import GroupProfile

        if verbosity >= 1:
            self.stdout.write("Syncing seeded roles...")

        for key, role_data in SEEDED_ROLES.items():
            group, group_created = Group.objects.get_or_create(name=role_data["name"])

            if group_created:
                # The post_save signal auto-created a TEAM profile.
                # Configure it properly for this seeded role.
                profile = group.profile
                profile.kind = GroupProfile.ROLE
                profile.is_system = role_data["is_system"]
                profile.description = role_data["description"]
                profile.bundles = list(role_data["bundles"])
                profile.save()
                if verbosity >= 2:
                    self.stdout.write(f"  Created seeded role: {role_data['name']}")
            else:
                # Group already exists — only configure profile if it has no
                # bundles and is still in the default TEAM state (auto-created
                # by signal).  If bundles are already set, an admin may have
                # customised the profile → preserve it.
                try:
                    profile = group.profile
                except GroupProfile.DoesNotExist:
                    GroupProfile.objects.create(
                        group=group,
                        kind=GroupProfile.ROLE,
                        is_system=role_data["is_system"],
                        description=role_data["description"],
                        bundles=list(role_data["bundles"]),
                    )
                    if verbosity >= 2:
                        self.stdout.write(
                            f"  Created missing profile for: {role_data['name']}"
                        )
                else:
                    if not profile.bundles and profile.kind == GroupProfile.TEAM:
                        # Default auto-created profile — configure it
                        profile.kind = GroupProfile.ROLE
                        profile.is_system = role_data["is_system"]
                        profile.description = role_data["description"]
                        profile.bundles = list(role_data["bundles"])
                        profile.save()
                        if verbosity >= 2:
                            self.stdout.write(
                                f"  Configured existing group: {role_data['name']}"
                            )
                    else:
                        # Already configured — preserve admin customisations
                        if verbosity >= 2:
                            self.stdout.write(
                                f"  Preserved existing profile: {role_data['name']}"
                            )

        # ------------------------------------------------------------------ #
        # 3. Materialize permissions for all ROLE groups                      #
        # ------------------------------------------------------------------ #
        from core.rbac.services import RoleService

        materialized = RoleService.materialize_all()
        if verbosity >= 1:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Permission Sync Complete. Materialized {materialized} role(s)."
                )
            )
