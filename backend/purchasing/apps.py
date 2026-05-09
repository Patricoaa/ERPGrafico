from django.apps import AppConfig

class PurchasingConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'purchasing'

    def ready(self):
        try:
            from core.permissions import PermissionRegistry
            PermissionRegistry.register('purchasing', [
                ('view_dashboard_purchasing', 'Can view purchasing dashboard'),
            ])
        except ImportError:
            pass

        try:
            from core.registry import UniversalRegistry, SearchableEntity
            from purchasing.models import PurchaseOrder
            UniversalRegistry.register(SearchableEntity(
                model=PurchaseOrder,
                label='purchasing.purchaseorder',
                icon='shopping-cart',
                search_fields=('number', 'supplier__name', 'supplier__tax_id'),
                display_template='OCS-{number} · {supplier.name}',
                list_url='/purchasing/orders',
                detail_url_pattern='/purchasing/orders/{id}',
                permission='purchasing.view_purchaseorder',
            ))
        except Exception:
            pass
