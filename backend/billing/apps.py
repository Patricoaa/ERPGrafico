from django.apps import AppConfig

class BillingConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'billing'

    def ready(self):
        try:
            from core.permissions import PermissionRegistry
            PermissionRegistry.register('billing', [
                ('view_dashboard_billing', 'Can view billing dashboard'),
            ])
        except ImportError:
            pass
