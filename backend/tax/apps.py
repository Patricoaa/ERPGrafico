from django.apps import AppConfig


class TaxConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'tax'
    verbose_name = 'Gestión Tributaria'

    def ready(self):
        import tax.signals  # noqa
