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
            from treasury.models import TreasuryMovement
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
        except Exception:
            pass
