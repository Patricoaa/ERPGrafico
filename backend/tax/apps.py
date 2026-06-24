from django.apps import AppConfig


class TaxConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "tax"
    verbose_name = "Gestión Tributaria"

    def ready(self):
        import tax.signals  # noqa

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
