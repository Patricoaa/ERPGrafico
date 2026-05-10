from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core'

    def ready(self):
        import core.signals

        try:
            from core.registry import UniversalRegistry, SearchableEntity
            from core.models import User
            UniversalRegistry.register(SearchableEntity(
                model=User,
                label='core.user',
                title_singular='Usuario',
                title_plural='Usuarios',
                icon='user',
                search_fields=('first_name', 'last_name', 'email'),
                short_display_template='{first_name} {last_name}',
                display_template='{first_name} {last_name}',
                list_url='/settings/users',
                detail_url_pattern='/settings/users/{id}',
                permission='core.view_user',
            ))
            # core.Attachment NO se registra (T-101):
            # - No existe viewset en core/urls.py
            # - No existe /files/page.tsx ni /files/[id]/page.tsx funcional
            # Registrar cuando se implemente el explorador de archivos.
        except Exception:
            pass
