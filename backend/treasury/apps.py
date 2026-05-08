from django.apps import AppConfig

class TreasuryConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'treasury'

    def ready(self):
        try:
            from core.permissions import PermissionRegistry
            PermissionRegistry.register('treasury', [
                ('view_dashboard_treasury', 'Can view treasury dashboard'),
            ])
        except ImportError:
            pass

        import treasury.signals  # noqa: F401 — register signal handlers

        try:
            from core.registry import UniversalRegistry, SearchableEntity
            from treasury.models import TreasuryMovement, TreasuryAccount, POSSession, BankStatement
            UniversalRegistry.register(SearchableEntity(
                model=TreasuryMovement,
                label='treasury.treasurymovement',
                icon='landmark',
                search_fields=('transaction_number', 'contact__name', 'contact__tax_id'),
                display_template='{transaction_number} · {contact.name}',
                list_url='/tesoreria',
                detail_url_pattern='/tesoreria/{id}',
                permission='treasury.view_treasurymovement',
            ))
            UniversalRegistry.register(SearchableEntity(
                model=TreasuryAccount,
                label='treasury.treasuryaccount',
                icon='piggy-bank',
                search_fields=('name', 'account_number'),
                display_template='{name}',
                list_url='/tesoreria/cuentas',
                detail_url_pattern='/tesoreria/cuentas/{id}',
                permission='treasury.view_treasuryaccount',
            ))
            UniversalRegistry.register(SearchableEntity(
                model=POSSession,
                label='treasury.possession',
                icon='calculator',
                search_fields=('terminal__name',),
                display_template='Sesión POS {id}',
                list_url='/tesoreria/cajas',
                detail_url_pattern='/tesoreria/cajas/{id}',
                permission='treasury.view_possession',
            ))
            UniversalRegistry.register(SearchableEntity(
                model=BankStatement,
                label='treasury.bankstatement',
                icon='file-spreadsheet',
                search_fields=('treasury_account__name', 'statement_date'),
                display_template='Cartola {treasury_account.name} {statement_date}',
                list_url='/tesoreria/cartolas',
                detail_url_pattern='/tesoreria/cartolas/{id}',
                permission='treasury.view_bankstatement',
            ))
        except Exception:
            pass
