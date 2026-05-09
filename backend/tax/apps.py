from django.apps import AppConfig


class TaxConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'tax'
    verbose_name = 'Gestión Tributaria'

    def ready(self):
        import tax.signals  # noqa

        try:
            from core.registry import UniversalRegistry, SearchableEntity
            from tax.models import F29Declaration, AccountingPeriod
            UniversalRegistry.register(SearchableEntity(
                model=F29Declaration,
                label='tax.f29declaration',
                icon='file-badge',
                search_fields=('folio_number',),
                display_template='F29 Folio {folio_number}',
                list_url='/tax/f29',
                detail_url_pattern='/tax/f29/{id}',
                permission='tax.view_f29declaration',
            ))
            UniversalRegistry.register(SearchableEntity(
                model=AccountingPeriod,
                label='tax.accountingperiod',
                icon='calendar-clock',
                search_fields=('year', 'month'),
                display_template='Periodo {month}/{year}',
                list_url='/tax/periods',
                detail_url_pattern='/tax/periods/{id}',
                permission='tax.view_accountingperiod',
            ))
        except Exception:
            pass
