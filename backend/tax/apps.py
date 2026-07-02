from django.apps import AppConfig


class TaxConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "tax"
    verbose_name = "Gestión Tributaria"

    def ready(self):
        import tax.signals  # noqa

        try:
            from core.permissions import PermissionRegistry

            PermissionRegistry.register(
                "tax",
                [
                    ("view_taxperiod", "Can view tax period"),
                    ("add_taxperiod", "Can add tax period"),
                    ("change_taxperiod", "Can change tax period"),
                    ("delete_taxperiod", "Can delete tax period"),
                    ("can_close_tax_period", "Puede cerrar período tributario (F29)"),
                    ("can_reopen_tax_period", "Puede reabrir período tributario (F29)"),
                    ("view_accountingperiod", "Can view accounting period"),
                    ("add_accountingperiod", "Can add accounting period"),
                    ("change_accountingperiod", "Can change accounting period"),
                    ("delete_accountingperiod", "Can delete accounting period"),
                    ("can_close_accounting_period", "Can close accounting period"),
                    ("can_reopen_accounting_period", "Can reopen accounting period"),
                ],
            )
        except ImportError:
            pass

        try:
            from core.registry import SearchableEntity, UniversalRegistry
            from tax.models import TaxPeriod

            UniversalRegistry.register(
                SearchableEntity(
                    model=TaxPeriod,
                    label="tax.taxperiod",
                    title_singular="Período Tributario",
                    title_plural="Períodos Tributarios",
                    icon="calendar",
                    search_fields=("year", "month"),
                    short_display_template="{month_display}-{year}",
                    display_template="{month}/{year}",
                    subtitle_template="{status}",
                    extra_info_template="",
                    list_url="/tax/declarations",
                    detail_url_pattern="/tax/periods/{id}",
                    permission="tax.view_taxperiod",
                )
            )
            # F29Declaration: NO se expone en búsqueda (removido a petición del usuario).
            # AccountingPeriod: modelo interno del cierre fiscal — NO se expone en búsqueda.
        except Exception:
            pass
