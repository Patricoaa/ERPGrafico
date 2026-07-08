from django.apps import AppConfig


class AccountingConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "accounting"

    def ready(self):
        try:
            from core.permissions import PermissionRegistry

            PermissionRegistry.register(
                "accounting",
                [
                    ("view_dashboard_accounting", "Can view accounting dashboard"),
                ],
            )
        except ImportError:
            pass

        try:
            from accounting.models import Account, Budget, FiscalYear, JournalEntry
            from core.prefix_registry import EntityPrefix
            from core.registry import SearchableEntity, UniversalRegistry

            UniversalRegistry.register(
                SearchableEntity(
                    model=Account,
                    label="accounting.account",
                    title_singular="Cuenta Contable",
                    title_plural="Plan de Cuentas",
                    icon="book",
                    search_fields=("code", "name"),
                    short_display_template="{code}",
                    display_template="{name}",
                    subtitle_template="Código: {code}",
                    extra_info_template="{type}",
                    list_url="/accounting/ledger",
                    detail_url_pattern="/accounting/accounts/{id}/ledger",
                    permission="accounting.view_account",
                )
            )
            UniversalRegistry.register(
                SearchableEntity(
                    model=JournalEntry,
                    label="accounting.journalentry",
                    title_singular="Asiento Contable",
                    title_plural="Libro Diario",
                    icon="hash",
                    search_fields=("number", "description"),
                    short_display_template=f"{EntityPrefix.JOURNAL_ENTRY}-{{number}}",
                    display_template=f"{EntityPrefix.JOURNAL_ENTRY}-{{number}}",
                    subtitle_template="{description}",
                    extra_info_template="{date}",
                    list_url="/accounting/entries",
                    detail_url_pattern="/accounting/entries/{id}",
                    permission="accounting.view_journalentry",
                )
            )
            UniversalRegistry.register(
                SearchableEntity(
                    model=FiscalYear,
                    label="accounting.fiscalyear",
                    title_singular="Ejercicio Contable",
                    title_plural="Ejercicios Contables",
                    icon="calendar",
                    search_fields=("year",),
                    short_display_template=f"{EntityPrefix.FISCAL_YEAR}-{{year}}",
                    display_template="Ejercicio {year}",
                    subtitle_template="{status}",
                    extra_info_template="{start_date} / {end_date}",
                    list_url="/accounting/closures",
                    detail_url_pattern="/accounting/closures/{id}",
                    permission="accounting.view_fiscalyear",
                )
            )
            UniversalRegistry.register(
                SearchableEntity(
                    model=Budget,
                    label="accounting.budget",
                    title_singular="Presupuesto",
                    title_plural="Presupuestos",
                    icon="pie-chart",
                    search_fields=("name", "description"),
                    short_display_template=f"{EntityPrefix.BUDGET}-{{id}}",
                    display_template="{name}",
                    subtitle_template="{start_date} / {end_date}",
                    extra_info_template="{description}",
                    list_url="/finance/budgets",
                    detail_url_pattern="/finance/budgets/{id}",
                    permission="accounting.view_budget",
                )
            )
        except Exception:
            pass

