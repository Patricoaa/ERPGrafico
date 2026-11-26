from django.apps import AppConfig


class HrConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "hr"
    verbose_name = "Recursos Humanos"

    def ready(self):
        from . import movement_services  # noqa: F401  (registra señales de cuotas, ADR-0156)

        try:
            from core.permissions import PermissionRegistry

            PermissionRegistry.register(
                "hr",
                [
                    ("view_dashboard_hr", "Can view HR dashboard"),
                    ("post_payroll", "Puede contabilizar nómina"),
                    ("pay_payroll", "Puede pagar nómina/previred"),
                    ("annul_employeemovement", "Puede anular movimientos con el empleado"),
                    ("annul_payrollpayment", "Puede anular pago de nómina"),
                ],
            )
        except ImportError:
            pass

        try:
            from core.prefix_registry import EntityPrefix
            from core.registry import SearchableEntity, UniversalRegistry
            from hr.models import Absence, Employee, EmployeeMovement, Payroll, PayrollConcept

            UniversalRegistry.register(
                SearchableEntity(
                    model=Employee,
                    label="hr.employee",
                    title_singular="Empleado",
                    title_plural="Nómina de Empleados",
                    icon="user-check",
                    search_fields=("contact__name", "contact__tax_id", "code"),
                    short_display_template=f"{EntityPrefix.EMPLOYEE}-{{code}}",
                    display_template="{contact.name}",
                    subtitle_template=f"{EntityPrefix.EMPLOYEE}-{{code}} · {{contact.tax_id}}",
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
                    short_display_template=f"{EntityPrefix.PAYROLL}-{{number}}",
                    display_template=f"{EntityPrefix.PAYROLL}-{{number}} · {{employee.contact.name}}",
                    list_url="/hr/payrolls",
                    detail_url_pattern="/hr/payrolls?selected={id}",
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
                    short_display_template=f"{EntityPrefix.ABSENCE}-{{id}}",
                    display_template=f"{EntityPrefix.ABSENCE}-{{id}} · {{employee.contact.name}}",
                    subtitle_template="{absence_type}",
                    extra_info_template="{start_date} / {end_date}",
                    list_url="/hr/absences",
                    detail_url_pattern="/hr/absences/{id}",
                    permission="hr.view_absence",
                )
            )
            UniversalRegistry.register(
                SearchableEntity(
                    model=EmployeeMovement,
                    label="hr.employeemovement",
                    title_singular="Movimiento con Empleado",
                    title_plural="Movimientos con Empleados",
                    icon="hand-coins",
                    search_fields=("employee__contact__name", "notes"),
                    short_display_template=f"{EntityPrefix.EMPLOYEE_MOVEMENT}-{{id}}",
                    display_template=f"{EntityPrefix.EMPLOYEE_MOVEMENT}-{{id}} · {{employee.contact.name}}",
                    subtitle_template="{kind} · {date}",
                    extra_info_template="{amount}",
                    list_url="/hr/movements",
                    detail_url_pattern="/hr/movements/{id}",
                    permission="hr.view_employeemovement",
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
                    short_display_template=f"{EntityPrefix.PAYROLL_CONCEPT}-{{id}}",
                    display_template="{name}",
                    subtitle_template="{category}",
                    extra_info_template="",
                    list_url="/hr/settings/concepts",
                    detail_url_pattern="/hr/settings/concepts",
                    permission="hr.view_payrollconcept",
                )
            )
        except Exception:
            pass
