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
            from accounting.models import Account, JournalEntry, FiscalYear, Budget
            UniversalRegistry.register(SearchableEntity(
                model=Account,
                label='accounting.account',
                icon='book-open',
                search_fields=('code', 'name'),
                display_template='{code} · {name}',
                list_url='/accounting/ledger',  # T-103: AccountsClientView vive en /accounting/ledger (era /accounting/accounts)
                detail_url_pattern='/accounting/accounts/{id}',
                permission='accounting.view_account',
            ))
            UniversalRegistry.register(SearchableEntity(
                model=JournalEntry,
                label='accounting.journalentry',
                icon='notebook-pen',
                search_fields=('number',),
                display_template='AS-{number}',
                list_url='/accounting/entries',
                detail_url_pattern='/accounting/entries/{id}',
                permission='accounting.view_journalentry',
            ))
            UniversalRegistry.register(SearchableEntity(
                model=FiscalYear,
                label='accounting.fiscalyear',
                icon='calendar',
                search_fields=('year',),
                display_template='Año Fiscal {year}',
                list_url='/accounting/closures',
                detail_url_pattern='/accounting/closures/{id}',
                permission='accounting.view_fiscalyear',
            ))
            UniversalRegistry.register(SearchableEntity(
                model=Budget,
                label='accounting.budget',
                icon='wallet',
                search_fields=('name',),
                display_template='Presupuesto {name}',
                list_url='/finances/budgets',
                detail_url_pattern='/finances/budgets/{id}',
                permission='accounting.view_budget',
            ))
        except Exception:
            pass

        try:
            import accounting.signals
        except ImportError:
            pass
