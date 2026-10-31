from django.apps import AppConfig


class BillingConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "billing"

    def ready(self):
        # ADR-0089: el módulo Facturación se fusionó en Ventas/Compras; el permiso
        # de dashboard `view_dashboard_billing` se retira del registro. Los permisos
        # de objeto (view/add/change/delete sobre Invoice) no cambian.

        try:
            from core.permissions import PermissionRegistry

            PermissionRegistry.register(
                "billing",
                [
                    ("confirm_invoice", "Puede confirmar factura/DTE"),
                    ("annul_invoice", "Puede anular factura/DTE"),
                    ("cancel_invoice", "Puede cancelar factura/DTE"),
                ],
            )
        except ImportError:
            pass

        try:
            from billing.models import Invoice
            from core.prefix_registry import EntityPrefix
            from core.registry import SearchableEntity, UniversalRegistry

            UniversalRegistry.register(
                SearchableEntity(
                    model=Invoice,
                    label="billing.invoice",
                    title_singular="Factura/DTE",
                    title_plural="Facturas/DTEs",
                    icon="file-text",
                    search_fields=("number", "contact__name", "contact__tax_id"),
                    short_display_template=f"{EntityPrefix.INVOICE_FACTURA}-{{number}}",
                    display_template="{dte_type} {number}",
                    subtitle_template="{partner_name}",
                    extra_info_template="{status}",
                    # ADR-0089: módulo Facturación fusionado en Ventas/Compras
                    list_url="/sales/dtes",
                    detail_url_pattern="/d/billing.invoice/{id}",
                    permission="billing.view_invoice",
                )
            )
        except Exception:
            pass
