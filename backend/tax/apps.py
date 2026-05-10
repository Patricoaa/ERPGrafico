from django.apps import AppConfig


class TaxConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'tax'
    verbose_name = 'Gestión Tributaria'

    def ready(self):
        import tax.signals  # noqa

        try:
            from core.registry import UniversalRegistry, SearchableEntity
            # F29Declaration: NO se expone en búsqueda (removido a petición del usuario).
            # AccountingPeriod: modelo interno del cierre fiscal — NO se expone en búsqueda.
        except Exception:
            pass
