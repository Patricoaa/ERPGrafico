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
        
        # Import signals
        import sales.signals

        try:
            from core.registry import UniversalRegistry, SearchableEntity
            from sales.models import SaleOrder, SaleDelivery, SaleReturn
            UniversalRegistry.register(SearchableEntity(
                model=SaleOrder,
                label='sales.saleorder',
                title_singular='Nota de Venta',
                title_plural='Notas de Venta',
                icon='receipt-text',
                search_fields=('number', 'customer__name', 'customer__tax_id'),
                short_display_template='NV-{number}',
                display_template='NV-{number} · {customer.name}',
                list_url='/sales/orders',
                detail_url_pattern='/sales/orders/{id}',
                permission='sales.view_saleorder',
            ))
            UniversalRegistry.register(SearchableEntity(
                model=SaleDelivery,
                label='sales.saledelivery',
                title_singular='Guía de Despacho',
                title_plural='Guías de Despacho',
                icon='truck',
                search_fields=('number', 'sale_order__customer__name'),
                short_display_template='DES-{number}',
                display_template='DES-{number} · {sale_order.customer.name}',
                list_url='/sales/deliveries',
                detail_url_pattern='/sales/deliveries/{id}',
                permission='sales.view_saledelivery',
            ))
            UniversalRegistry.register(SearchableEntity(
                model=SaleReturn,
                label='sales.salereturn',
                title_singular='Devolución',
                title_plural='Devoluciones',
                icon='undo-2',
                search_fields=('number', 'sale_order__customer__name'),
                short_display_template='DEV-{number}',
                display_template='DEV-{number} · {sale_order.customer.name}',
                list_url='/sales/returns',
                detail_url_pattern='/sales/returns/{id}',
                permission='sales.view_salereturn',
            ))
        except Exception:
            pass

