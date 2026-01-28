from django.apps import AppConfig

class SalesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'sales'

    def ready(self):
        try:
            from core.permissions import PermissionRegistry
            PermissionRegistry.register('sales', [
                ('view_dashboard_sales', 'Can view sales dashboard'),
                ('approve_large_orders', 'Can approve large orders'),
                ('override_credit_limit', 'Can override credit limit'),
            ])
        except ImportError:
            pass
