from django.apps import AppConfig


class HrConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "hr"
    verbose_name = "Recursos Humanos"

    def ready(self):
        try:
            from core.registry import SearchableEntity, UniversalRegistry
            from hr.models import Absence, Employee, Payroll, PayrollConcept, SalaryAdvance

            UniversalRegistry.register(
                SearchableEntity(
                    model=Employee,
                    label="hr.employee",
                    title_singular="Empleado",
                    title_plural="Nómina de Empleados",
                    icon="user-check",
                    search_fields=("contact__name", "contact__tax_id", "code"),
                    short_display_template="EMP-{code}",
                    display_template="{contact.name}",
                    subtitle_template="EMP-{code} · {contact.tax_id}",
                    extra_info_template="{job_title}",
                    list_url="/hr/employees",
                    detail_url_pattern="/hr/employees/{id}",
                    permission="hr.view_employee",
                )
            )
            UniversalRegistry.register(
                SearchableEntity(
                    model=Payroll,
                    label="hr.payroll",
                    title_singular="Liquidación de Sueldo",
                    title_plural="Liquidaciones de Sueldo",
                    icon="receipt",
                    search_fields=("number", "employee__contact__name"),
                    short_display_template="LIQ-{number}",
                    display_template="LIQ-{number} · {employee.contact.name}",
                    list_url="/hr/payrolls",
                    detail_url_pattern="/hr/payrolls/{id}",
                    permission="hr.view_payroll",
                )
            )
            UniversalRegistry.register(
                SearchableEntity(
                    model=Absence,
                    label="hr.absence",
                    title_singular="Inasistencia",
                    title_plural="Inasistencias",
                    icon="calendar-x-2",
                    search_fields=("employee__contact__name", "absence_type", "notes"),
                    short_display_template="AUS-{id}",
                    display_template="AUS-{id} · {employee.contact.name}",
                    subtitle_template="{absence_type}",
                    extra_info_template="{start_date} / {end_date}",
                    list_url="/hr/absences",
                    detail_url_pattern="/hr/absences/{id}",
                    permission="hr.view_absence",
                )
            )
            UniversalRegistry.register(
                SearchableEntity(
                    model=SalaryAdvance,
                    label="hr.salaryadvance",
                    title_singular="Anticipo de Sueldo",
                    title_plural="Anticipos de Sueldo",
                    icon="hand-coins",
                    search_fields=("employee__contact__name", "notes"),
                    short_display_template="ANT-{id}",
                    display_template="ANT-{id} · {employee.contact.name}",
                    subtitle_template="{date}",
                    extra_info_template="{amount}",
                    list_url="/hr/advances",
                    detail_url_pattern="/hr/advances/{id}",
                    permission="hr.view_salaryadvance",
                )
            )
            UniversalRegistry.register(
                SearchableEntity(
                    model=PayrollConcept,
                    label="hr.payrollconcept",
                    title_singular="Concepto de Liquidación",
                    title_plural="Conceptos de Liquidación",
                    icon="clipboard-list",
                    search_fields=("name", "category"),
                    short_display_template="CON-LIQ-{id}",
                    display_template="{name}",
                    subtitle_template="{category}",
                    extra_info_template="",
                    list_url="/hr/payrolls",
                    detail_url_pattern="/hr/settings/concepts",
                    permission="hr.view_payrollconcept",
                )
            )
        except Exception:
            pass
