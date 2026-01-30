from django.apps import AppConfig

class AccountingConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'accounting'

    def ready(self):
        try:
            from core.permissions import PermissionRegistry
            PermissionRegistry.register('accounting', [
                ('view_dashboard_accounting', 'Can view accounting dashboard'),
            ])
        except ImportError:
            pass
