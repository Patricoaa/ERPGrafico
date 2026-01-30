from django.apps import AppConfig

class ProductionConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'production'

    def ready(self):
        import production.signals
        try:
            from core.permissions import PermissionRegistry
            PermissionRegistry.register('production', [
                ('view_dashboard_production', 'Can view production dashboard'),
            ])
        except ImportError:
            pass
