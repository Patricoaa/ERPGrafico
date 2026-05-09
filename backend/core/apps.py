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
                list_url='/settings/users',
                detail_url_pattern='/settings/users/{id}',
                permission='core.view_user',
            ))
            UniversalRegistry.register(SearchableEntity(
                model=Attachment,
                label='core.attachment',
                icon='paperclip',
                search_fields=('original_filename', 'file'),
                display_template='{original_filename}',
                list_url='/files',
                detail_url_pattern='/files/{id}',
                permission='core.view_attachment',
            ))
        except Exception:
            pass
