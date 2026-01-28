from django.core.management.base import BaseCommand
from django.contrib.auth.models import Group, Permission
from core.permissions import PermissionRegistry, Roles
from django.apps import apps

class Command(BaseCommand):
    help = 'Syncs permissions and standard roles to the database'

    def handle(self, *args, **options):
        self.stdout.write("Syncing Permissions...")
        
        # 1. Trigger AppConfigurations to ensure they have registered their perms
        # defined in 'ready'. (Django does this automatically on startup)
        
        # 2. Sync Permissions to DB
        count = PermissionRegistry.sync_to_db()
        self.stdout.write(self.style.SUCCESS(f"Synced {count} custom permissions."))

        # 3. Ensure Standard Groups Exist
        self.stdout.write("Syncing Groups...")
        groups = {
            Roles.ADMIN: "Full System Access",
            Roles.MANAGER: "Department Manager Access",
            Roles.OPERATOR: "Standard Operational Access",
            Roles.READ_ONLY: "Read Only Access"
        }

        for role_name, desc in groups.items():
            group, created = Group.objects.get_or_create(name=role_name)
            if created:
                self.stdout.write(f"Created Group: {role_name}")
            else:
                self.stdout.write(f"Group exists: {role_name}")

        # 4. Assign Default Permissions (Example logic - can be refined)
        admin_group = Group.objects.get(name=Roles.ADMIN)
        # Admin gets everything
        all_perms = Permission.objects.all()
        admin_group.permissions.set(all_perms)
        
        # Operator gets all 'view', 'add', 'change' provided by Django for key apps, but maybe restricted delete
        operator_group = Group.objects.get(name=Roles.OPERATOR)
        
        # This is a heuristic assignment; in production we might want this explicitly defined in the registry too
        # For now, let's just ensure Admin has everything.
        
        self.stdout.write(self.style.SUCCESS("Permission Sync Complete."))
