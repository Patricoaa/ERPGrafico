from django.apps import AppConfig

class AccountingConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'accounting'

    def ready(self):
        try:
            from core.permissions import PermissionRegistry
            PermissionRegistry.register('accounting', [
                ('view_dashboard_accounting', 'Can view accounting dashboard'),
            ])
        except ImportError:
            pass

        try:
            from core.registry import UniversalRegistry, SearchableEntity
            from accounting.models import Account, JournalEntry
            UniversalRegistry.register(SearchableEntity(
                model=Account,
                label='accounting.account',
                icon='book-open',
                search_fields=('code', 'name'),
                display_template='{code} · {name}',
                list_url='/contabilidad/plan-cuentas',
                detail_url_pattern='/contabilidad/plan-cuentas/{id}',
                permission='accounting.view_account',
            ))
            UniversalRegistry.register(SearchableEntity(
                model=JournalEntry,
                label='accounting.journalentry',
                icon='notebook-pen',
                search_fields=('number',),
                display_template='AS-{number}',
                list_url='/contabilidad/asientos',
                detail_url_pattern='/contabilidad/asientos/{id}',
                permission='accounting.view_journalentry',
            ))
        except Exception:
            pass
