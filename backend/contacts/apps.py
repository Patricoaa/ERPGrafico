from django.apps import AppConfig


class ContactsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'contacts'

    def ready(self):
        try:
            from core.permissions import PermissionRegistry
            PermissionRegistry.register('contacts', [
                ('view_dashboard_contacts', 'Can view contacts dashboard'),
            ])
        except ImportError:
            pass

        try:
            from core.registry import UniversalRegistry, SearchableEntity
            from contacts.models import Contact
            UniversalRegistry.register(SearchableEntity(
                model=Contact,
                label='contacts.contact',
                title_singular='Contacto',
                title_plural='Contactos',
                icon='users',
                search_fields=('name', 'tax_id', 'contact_name', 'code'),
                short_display_template='CON-{id}',
                display_template='{name}',
                subtitle_template='{tax_id} · {email}',
                extra_info_template='',
                list_url='/contacts',
                detail_url_pattern='/contacts/{id}',
                permission='contacts.view_contact',
            ))
        except Exception:
            pass
            
        import contacts.signals
