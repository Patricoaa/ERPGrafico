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
            from treasury.models import TreasuryMovement, TreasuryAccount
            UniversalRegistry.register(SearchableEntity(
                model=TreasuryMovement,
                label='treasury.treasurymovement',
                title_singular='Movimiento de Tesorería',
                title_plural='Movimientos de Tesorería',
                icon='landmark',
                search_fields=('transaction_number', 'contact__name', 'contact__tax_id'),
                short_display_template='{display_id}',
                display_template='{display_id} · {contact.name}',
                list_url='/treasury/movements',
                detail_url_pattern='/treasury/movements/{id}',
                permission='treasury.view_treasurymovement',
            ))
            UniversalRegistry.register(SearchableEntity(
                model=TreasuryAccount,
                label='treasury.treasuryaccount',
                title_singular='Cuenta de Tesorería',
                title_plural='Cuentas de Tesorería',
                icon='piggy-bank',
                search_fields=('name', 'account_number'),
                short_display_template='{name}',
                display_template='{name}',
                list_url='/treasury/accounts',
                detail_url_pattern='/treasury/accounts/{id}',
                permission='treasury.view_treasuryaccount',
            ))
            UniversalRegistry.register(SearchableEntity(
                model=BankStatement,
                label='treasury.bankstatement',
                title_singular='Cartola Bancaria',
                title_plural='Cartolas Bancarias',
                icon='book-open',
                search_fields=('id', 'treasury_account__name'),
                short_display_template='{display_id}',
                display_template='{display_id} · {treasury_account.name}',
                list_url='/treasury/reconciliation?tab=statements',
                detail_url_pattern='/treasury/reconciliation/statements/{id}',
                permission='treasury.view_bankstatement',
            ))
        except Exception:
            pass
