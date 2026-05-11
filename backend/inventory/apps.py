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
            from inventory.models import Product, StockMove
            UniversalRegistry.register(SearchableEntity(
                model=Product,
                label='inventory.product',
                title_singular='Producto',
                title_plural='Productos',
                icon='package',
                search_fields=('name', 'code', 'internal_code'),
                short_display_template='{code}',
                display_template='{name}',
                subtitle_template='SKU: {code}',
                extra_info_template='{category.name}',
                list_url='/inventory/products',
                detail_url_pattern='/inventory/products/{id}',
                permission='inventory.view_product',
            ))
            UniversalRegistry.register(SearchableEntity(
                model=StockMove,
                label='inventory.stockmove',
                title_singular='Movimiento de Stock',
                title_plural='Kardex',
                icon='arrow-right-left',
                search_fields=('id', 'description', 'adjustment_reason'),
                short_display_template='MOV-{id}',
                display_template='MOV-{id}',
                list_url='/inventory/stock?tab=movements',
                detail_url_pattern='/inventory/stock-moves/{id}',
                permission='inventory.view_stockmove',
            ))
        except Exception:
            pass
