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
                title_singular='Cuenta Contable',
                title_plural='Plan de Cuentas',
                icon='book',
                search_fields=('code', 'name'),
                short_display_template='{code}',
                display_template='{code} · {name}',
                list_url='/accounting/ledger',
                detail_url_pattern='/accounting/accounts/{id}/ledger',
                permission='accounting.view_account',
            ))
            UniversalRegistry.register(SearchableEntity(
                model=JournalEntry,
                label='accounting.journalentry',
                title_singular='Asiento Contable',
                title_plural='Libro Diario',
                icon='hash',
                search_fields=('number', 'description'),
                short_display_template='AS-{number}',
                display_template='AS-{number} · {description}',
                list_url='/accounting/entries',
                detail_url_pattern='/accounting/entries/{id}',
                permission='accounting.view_journalentry',
            ))
        except Exception:
            pass

        try:
            import accounting.signals
        except ImportError:
            pass
