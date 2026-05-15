from django.apps import AppConfig

class ProductionConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'production'

    def ready(self):
        import production.signals
        import production.tasks
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
                title_singular='Orden de Trabajo',
                title_plural='Ordenes de Trabajo',
                icon='wrench',
                search_fields=('number', 'description', 'related_contact__name'),
                short_display_template='OT-{number}',
                display_template='OT-{number}',
                subtitle_template='{description}',
                extra_info_template='{status}',
                list_url='/production/orders',
                detail_url_pattern='/production/orders/{id}',
                permission='production.view_workorder',
            ))
        except Exception:
            pass
