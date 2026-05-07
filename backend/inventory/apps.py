from django.apps import AppConfig

class InventoryConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'inventory'

    def ready(self):
        import inventory.signals
        try:
            from core.permissions import PermissionRegistry
            PermissionRegistry.register('inventory', [
                ('view_dashboard_inventory', 'Can view inventory dashboard'),
            ])
        except ImportError:
            pass

        try:
            from core.registry import UniversalRegistry, SearchableEntity
            from inventory.models import Product
            UniversalRegistry.register(SearchableEntity(
                model=Product,
                label='inventory.product',
                icon='package',
                search_fields=('name', 'code', 'internal_code'),
                display_template='{name} · {code}',
                list_url='/inventario/productos',
                detail_url_pattern='/inventario/productos/{id}',
                permission='inventory.view_product',
            ))
        except Exception:
            pass
