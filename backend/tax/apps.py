from django.apps import AppConfig


class TaxConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'tax'
    verbose_name = 'Gestión Tributaria'

    def ready(self):
        import tax.signals  # noqa

        try:
            from core.registry import UniversalRegistry, SearchableEntity
            from tax.models import F29Declaration
            # F29Declaration: visible en búsqueda universal, vive en /accounting/tax
            # AccountingPeriod: modelo interno del cierre fiscal — NO se expone en búsqueda.
            # Su URL (/tax/periods) colisiona con TaxPeriod (modelo distinto); los IDs
            # de ambas tablas no son comparables. Decisión F9/T-100: eliminar del registry.
            UniversalRegistry.register(SearchableEntity(
                model=F29Declaration,
                label='tax.f29declaration',
                icon='file-badge',
                search_fields=('folio_number',),
                display_template='F29 Folio {folio_number}',
                list_url='/accounting/tax',          # ruta real (T-99)
                detail_url_pattern='/tax/f29/{id}',
                permission='tax.view_f29declaration',
            ))
        except Exception:
            pass
