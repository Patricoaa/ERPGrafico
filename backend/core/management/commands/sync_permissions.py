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

        # 4. Assign Default Permissions
        admin_group = Group.objects.get(name=Roles.ADMIN)
        all_perms = Permission.objects.all()
        admin_group.permissions.set(all_perms)
        
        # READ_ONLY: All 'view_' permissions
        read_only_group = Group.objects.get(name=Roles.READ_ONLY)
        view_perms = Permission.objects.filter(codename__startswith='view_')
        read_only_group.permissions.set(view_perms)
        
        # MANAGER: Currently same as Admin, can refine later
        manager_group = Group.objects.get(name=Roles.MANAGER)
        manager_group.permissions.set(all_perms)

        # OPERATOR: Focus on Production and Inventory
        operator_group = Group.objects.get(name=Roles.OPERATOR)
        
        operator_codenames = [
            # Dashboards
            'view_dashboard_production', 'view_dashboard_inventory',
            'view_dashboard_sales', 'view_dashboard_billing',
            'view_dashboard_purchasing', 'view_dashboard_contacts',
            'view_dashboard_treasury',
            
            # Core / Settings
            'view_companysettings', 'view_user',
            
            # Accounting & Auxiliary reads
            'view_account', 'view_tax', 'view_pricelist', 'view_cashbox',
            
            # Production
            'view_workorder', 'add_workorder', 'change_workorder',
            'view_productionconsumption', 'add_productionconsumption', 'change_productionconsumption',
            'view_billofmaterials',
            
            # Inventory
            'view_product', 'view_warehouse', 'view_uom', 'view_productcategory',
            
            # Sales & POS
            'view_saleorder', 'add_saleorder', 'change_saleorder',
            'view_saleline', 'add_saleline', 'change_saleline',
            'view_saledelivery', 'add_saledelivery', 'change_saledelivery',
            'view_salereturn', 'add_salereturn', 'change_salereturn',
            'view_draftcart', 'add_draftcart', 'change_draftcart', 'delete_draftcart',
            
            # Billing / Invoicing
            'view_invoice', 'add_invoice', 'change_invoice',
            
            # Purchasing
            'view_purchaseorder', 'add_purchaseorder', 'change_purchaseorder',
            'view_purchaseline', 'add_purchaseline', 'change_purchaseline',
            'view_purchasereceipt', 'add_purchasereceipt', 'change_purchasereceipt',
            'view_purchasereturn', 'add_purchasereturn', 'change_purchasereturn',
            
            # Contacts
            'view_contact', 'add_contact', 'change_contact',
            
            # Treasury (for POS and basic payments)
            'view_possession', 'add_possession', 'change_possession',
            'view_posterminal', 'view_paymentmethod',
            'view_treasuryaccount', 'view_treasurymovement', 'add_treasurymovement',
            
            # Workflow
            'view_task', 'add_task', 'change_task',
        ]
        
        # We use __in for codenames
        operator_perms = Permission.objects.filter(codename__in=operator_codenames)
        operator_group.permissions.set(operator_perms)
        
        self.stdout.write(self.style.SUCCESS("Permission Sync Complete."))
