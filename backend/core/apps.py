from django.apps import AppConfig

class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core'

    def ready(self):
        import core.signals
        
        try:
            from core.registry import UniversalRegistry, SearchableEntity
            from core.models import User, Attachment
            UniversalRegistry.register(SearchableEntity(
                model=User,
                label='core.user',
                icon='user',
                search_fields=('first_name', 'last_name', 'email'),
                display_template='{first_name} {last_name}',
                list_url='/configuracion/usuarios',
                detail_url_pattern='/configuracion/usuarios/{id}',
                permission='core.view_user',
            ))
            UniversalRegistry.register(SearchableEntity(
                model=Attachment,
                label='core.attachment',
                icon='paperclip',
                search_fields=('title', 'file'),
                display_template='{title}',
                list_url='/archivos',
                detail_url_pattern='/archivos/{id}',
                permission='core.view_attachment',
            ))
        except Exception:
            pass
