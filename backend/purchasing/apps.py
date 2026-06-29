from django.apps import AppConfig


class PurchasingConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "purchasing"

    def ready(self):
        try:
            from core.permissions import PermissionRegistry

            PermissionRegistry.register(
                "purchasing",
                [
                    ("view_dashboard_purchasing", "Can view purchasing dashboard"),
                ],
            )
        except ImportError:
            pass

        try:
            from core.registry import SearchableEntity, UniversalRegistry
            from purchasing.models import PurchaseOrder, PurchaseReceipt, PurchaseReturn

            UniversalRegistry.register(
                SearchableEntity(
                    model=PurchaseOrder,
                    label="purchasing.purchaseorder",
                    title_singular="Orden de Compra",
                    title_plural="Ordenes de Compra",
                    icon="shopping-cart",
                    search_fields=("number", "supplier__name", "supplier__tax_id"),
                    short_display_template="OCS-{number}",
                    display_template="OCS-{number}",
                    subtitle_template="{supplier.name} · {supplier.tax_id}",
                    extra_info_template="{total}",
                    list_url="/purchasing/orders",
                    detail_url_pattern="/purchasing/orders/{id}",
                    permission="purchasing.view_purchaseorder",
                )
            )
            UniversalRegistry.register(
                SearchableEntity(
                    model=PurchaseReturn,
                    label="purchasing.purchasereturn",
                    title_singular="Devolución de Compra",
                    title_plural="Devoluciones de Compra",
                    icon="rotate-3d",
                    search_fields=("id", "purchase_order__number"),
                    short_display_template="DEV-{number}",
                    display_template="DEV-{number} · {purchase_order.number}",
                    subtitle_template="{purchase_order.supplier.name}",
                    extra_info_template="{status}",
                    list_url="/purchasing/returns",
                    detail_url_pattern="/purchasing/returns/{id}",
                    permission="purchasing.view_purchasereturn",
                )
            )
            UniversalRegistry.register(
                SearchableEntity(
                    model=PurchaseReceipt,
                    label="purchasing.purchasereceipt",
                    title_singular="Recepción de Compra",
                    title_plural="Recepciones de Compra",
                    icon="file-check",
                    search_fields=(
                        "number",
                        "purchase_order__number",
                        "purchase_order__supplier__name",
                    ),
                    short_display_template="REC-{number}",
                    display_template="REC-{number} · {purchase_order.number}",
                    subtitle_template="{purchase_order.supplier.name}",
                    extra_info_template="{status}",
                    list_url="/purchasing/receipts",
                    detail_url_pattern="/purchasing/receipts/{id}",
                    permission="purchasing.view_purchasereceipt",
                )
            )
        except Exception:
            pass
