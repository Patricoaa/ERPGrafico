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
            from inventory.models import Product, ProductCategory, Warehouse, StockMove
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
            UniversalRegistry.register(SearchableEntity(
                model=ProductCategory,
                label='inventory.productcategory',
                icon='folder-tree',
                search_fields=('name', 'code'),
                display_template='{code} · {name}',
                list_url='/inventario/categorias',
                detail_url_pattern='/inventario/categorias/{id}',
                permission='inventory.view_productcategory',
            ))
            UniversalRegistry.register(SearchableEntity(
                model=Warehouse,
                label='inventory.warehouse',
                icon='warehouse',
                search_fields=('name', 'code'),
                display_template='{code} · {name}',
                list_url='/inventario/bodegas',
                detail_url_pattern='/inventario/bodegas/{id}',
                permission='inventory.view_warehouse',
            ))
            UniversalRegistry.register(SearchableEntity(
                model=StockMove,
                label='inventory.stockmove',
                icon='arrow-right-left',
                search_fields=('number', 'reference'),
                display_template='MOV-{number}',
                list_url='/inventario/movimientos',
                detail_url_pattern='/inventario/movimientos/{id}',
                permission='inventory.view_stockmove',
            ))
        except Exception:
            pass
