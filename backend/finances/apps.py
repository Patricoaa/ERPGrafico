from django.apps import AppConfig

class FinancesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'finances'

    def ready(self):
        try:
            from core.permissions import PermissionRegistry
            PermissionRegistry.register('finances', [
                ('view_dashboard_finances', 'Can view finances dashboard'),
            ])
        except ImportError:
            pass
