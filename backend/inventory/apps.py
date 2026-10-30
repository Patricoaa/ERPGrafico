from django.apps import AppConfig


class InventoryConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "inventory"

    def ready(self):
        # Register signals
        try:
            import inventory.signals
        except ImportError:
            pass

        try:
            from core.permissions import PermissionRegistry

            PermissionRegistry.register(
                "inventory",
                [
                    ("view_dashboard_inventory", "Can view inventory dashboard"),
                    ("confirm_inventorydocument", "Puede confirmar documento de inventario"),
                    ("annul_inventorydocument", "Puede anular documento de inventario"),
                    ("post_inventorycount", "Puede aplicar conteo de inventario"),
                    ("cancel_subscription", "Puede cancelar suscripción"),
                ],
            )
        except ImportError:
            pass

        try:
            from core.prefix_registry import EntityPrefix
            from core.registry import SearchableEntity, UniversalRegistry
            from inventory.models import (
                InventoryDocument,
                Product,
                StockMove,
                Subscription,
                Warehouse,
            )

            UniversalRegistry.register(
                SearchableEntity(
                    model=Product,
                    label="inventory.product",
                    title_singular="Producto",
                    title_plural="Productos",
                    icon="package",
                    search_fields=("name", "code", "internal_code"),
                    short_display_template=f"{EntityPrefix.PRODUCT}-{{id}}",
                    display_template="{name}",
                    subtitle_template="SKU: {code}",
                    extra_info_template="{category.name}",
                    list_url="/inventory/products",
                    detail_url_pattern="/inventory/products/{id}",
                    permission="inventory.view_product",
                )
            )
            UniversalRegistry.register(
                SearchableEntity(
                    model=StockMove,
                    label="inventory.stockmove",
                    title_singular="Movimiento de Stock",
                    title_plural="Kardex",
                    icon="arrow-right-left",
                    search_fields=("id", "description", "adjustment_reason"),
                    short_display_template=f"{EntityPrefix.STOCK_MOVE}-{{id}}",
                    display_template=f"{EntityPrefix.STOCK_MOVE}-{{id}}",
                    # No list of its own: moves are read from the stock report (kardex
                    # drill-down); the detail is the drawer behind /d/ (ADR-0080).
                    list_url="/inventory/operations/stock",
                    detail_url_pattern="/d/inventory.stockmove/{id}",
                    permission="inventory.view_stockmove",
                )
            )
            UniversalRegistry.register(
                SearchableEntity(
                    model=Subscription,
                    label="inventory.subscription",
                    title_singular="Suscripción",
                    title_plural="Suscripciones",
                    icon="repeat",
                    search_fields=("product__name", "supplier__name"),
                    short_display_template=f"{EntityPrefix.SUBSCRIPTION}-{{id}}",
                    display_template=f"{EntityPrefix.SUBSCRIPTION}-{{id}} · {{product.name}}",
                    subtitle_template="{supplier.name}",
                    extra_info_template="{status}",
                    list_url="/purchasing/subscriptions",
                    detail_url_pattern="/inventory/products/{id}",
                    permission="inventory.view_subscription",
                )
            )
            UniversalRegistry.register(
                SearchableEntity(
                    model=Warehouse,
                    label="inventory.warehouse",
                    title_singular="Bodega",
                    title_plural="Bodegas",
                    icon="building-2",
                    search_fields=("name", "code"),
                    short_display_template="{code}",
                    display_template="{name}",
                    subtitle_template="Código: {code}",
                    extra_info_template="",
                    list_url="/inventory/operations/warehouses",
                    detail_url_pattern="/inventory/warehouses/{id}",
                    permission="inventory.view_warehouse",
                )
            )
            UniversalRegistry.register(
                SearchableEntity(
                    model=InventoryDocument,
                    label="inventory.inventorydocument",
                    title_singular="Documento de Inventario",
                    title_plural="Documentos de Inventario",
                    icon="file-text",
                    search_fields=("id", "reference", "notes"),
                    short_display_template=f"{EntityPrefix.INVENTORY_DOCUMENT}-{{id}}",
                    display_template="{document_type_display} #{id}",
                    subtitle_template="{partner_name}",
                    extra_info_template="{status_display}",
                    list_url="/inventory/operations/manual-operations",
                    detail_url_pattern="/d/inventory.inventorydocument/{id}",
                    permission="inventory.view_inventorydocument",
                )
            )
        except Exception:
            pass
