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
            UniversalRegistry.register(SearchableEntity(
                model=F29Declaration,
                label='tax.f29declaration',
                icon='file-badge',
                search_fields=('folio_number',),
                display_template='F29 Folio {folio_number}',
                list_url='/tributario/f29',
                detail_url_pattern='/tributario/f29/{id}',
                permission='tax.view_f29declaration',
            ))
        except Exception:
            pass
