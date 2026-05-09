from django.apps import AppConfig


class HrConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'hr'
    verbose_name = 'Recursos Humanos'

    def ready(self):
        try:
            from core.registry import UniversalRegistry, SearchableEntity
            from hr.models import Employee, Payroll
            UniversalRegistry.register(SearchableEntity(
                model=Employee,
                label='hr.employee',
                icon='user-check',
                search_fields=('contact__name', 'contact__tax_id', 'code'),
                display_template='{contact.name} ({code})',
                list_url='/hr/employees',
                detail_url_pattern='/hr/employees/{id}',
                permission='hr.view_employee',
            ))
            UniversalRegistry.register(SearchableEntity(
                model=Payroll,
                label='hr.payroll',
                icon='wallet',
                search_fields=('number', 'employee__contact__name'),
                display_template='LIQ-{number} · {employee.contact.name}',
                list_url='/hr/payrolls',
                detail_url_pattern='/hr/payrolls/{id}',
                permission='hr.view_payroll',
            ))
        except Exception:
            pass
