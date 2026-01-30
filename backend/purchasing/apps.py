from django.apps import AppConfig

class PurchasingConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'purchasing'

    def ready(self):
        try:
            from core.permissions import PermissionRegistry
            PermissionRegistry.register('purchasing', [
                ('view_dashboard_purchasing', 'Can view purchasing dashboard'),
            ])
        except ImportError:
            pass
