from django.apps import AppConfig

class BillingConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'billing'

    def ready(self):
        try:
            from core.permissions import PermissionRegistry
            PermissionRegistry.register('billing', [
                ('view_dashboard_billing', 'Can view billing dashboard'),
            ])
        except ImportError:
            pass

        try:
            from core.registry import UniversalRegistry, SearchableEntity
            from billing.models import Invoice
            UniversalRegistry.register(SearchableEntity(
                model=Invoice,
                label='billing.invoice',
                icon='file-text',
                search_fields=('number', 'contact__name', 'contact__tax_id'),
                display_template='{dte_type} {number} · {contact.name}',
                list_url='/billing/sales',
                detail_url_pattern='/billing/invoices/{id}',
                permission='billing.view_invoice',
            ))
        except Exception:
            pass
