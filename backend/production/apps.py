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

        try:
            from core.registry import UniversalRegistry, SearchableEntity
            from production.models import WorkOrder
            UniversalRegistry.register(SearchableEntity(
                model=WorkOrder,
                label='production.workorder',
                icon='wrench',
                search_fields=('number', 'description', 'contact__name'),
                display_template='OT-{number} · {description}',
                list_url='/production/orders',
                detail_url_pattern='/production/orders/{id}',
                permission='production.view_workorder',
            ))
        except Exception:
            pass
