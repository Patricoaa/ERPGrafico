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
            from contacts.partner_models import PartnerTransaction, ProfitDistributionResolution
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
            UniversalRegistry.register(SearchableEntity(
                model=PartnerTransaction,
                label='contacts.partnertransaction',
                title_singular='Transacción de Socio',
                title_plural='Transacciones de Socios',
                icon='arrow-left-right',
                search_fields=('partner__name', 'description', 'display_id'),
                short_display_template='PT-{display_id}',
                display_template='{display_id} · {partner.name}',
                subtitle_template='{get_transaction_type_display}',
                extra_info_template='{amount}',
                list_url='/contacts/partners',
                detail_url_pattern='/contacts/partner-transactions/{id}',
                permission='contacts.view_partnertransaction',
            ))
            UniversalRegistry.register(SearchableEntity(
                model=ProfitDistributionResolution,
                label='contacts.profitdistributionresolution',
                title_singular='Distribución de Utilidades',
                title_plural='Distribuciones de Utilidades',
                icon='pie-chart',
                search_fields=('id', 'fiscal_year', 'acta_number'),
                short_display_template='DIST-{display_id}',
                display_template='DIST-{display_id}',
                subtitle_template='Año {fiscal_year}',
                extra_info_template='{status}',
                list_url='/contacts/profit-distribution',
                detail_url_pattern='/contacts/profit-distribution/{id}',
                permission='contacts.view_profitdistributionresolution',
            ))
        except Exception:
            pass
            
        import contacts.signals
