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
                icon='users',
                search_fields=('name', 'tax_id', 'contact_name', 'code'),
                display_template='{name} · {tax_id}',
                list_url='/contactos',
                detail_url_pattern='/contactos/{id}',
                permission='contacts.view_contact',
            ))
        except Exception:
            pass
