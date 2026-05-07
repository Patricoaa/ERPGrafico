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
                icon='receipt-text',
                search_fields=('number', 'customer__name', 'customer__tax_id'),
                display_template='NV-{number} · {customer.name}',
                list_url='/ventas/ordenes',
                detail_url_pattern='/ventas/ordenes/{id}',
                permission='sales.view_saleorder',
            ))
            UniversalRegistry.register(SearchableEntity(
                model=SaleDelivery,
                label='sales.saledelivery',
                icon='truck',
                search_fields=('number', 'sale_order__customer__name'),
                display_template='DES-{number}',
                list_url='/ventas/despachos',
                detail_url_pattern='/ventas/despachos/{id}',
                permission='sales.view_saledelivery',
            ))
            UniversalRegistry.register(SearchableEntity(
                model=SaleReturn,
                label='sales.salereturn',
                icon='undo-2',
                search_fields=('number', 'sale_order__customer__name'),
                display_template='DEV-{number}',
                list_url='/ventas/devoluciones',
                detail_url_pattern='/ventas/devoluciones/{id}',
                permission='sales.view_salereturn',
            ))
        except Exception:
            pass

