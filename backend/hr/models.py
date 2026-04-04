from django.db import models
from django.utils.translation import gettext_lazy as _
from django.core.validators import MinValueValidator, MaxValueValidator
from decimal import Decimal
from simple_history.models import HistoricalRecords


class GlobalHRSettings(models.Model):
    """
    Singleton de parámetros globales de RRHH (Chile).
    Valores actuales de UF, UTM, topes imponibles y porcentajes estándar.
    """
    uf_current_value = models.DecimalField(
        _("Valor UF Actual"), max_digits=10, decimal_places=2, default=Decimal('37000.00'),
        help_text=_("Valor de la Unidad de Fomento para el período de cálculo.")
    )
    utm_current_value = models.DecimalField(
        _("Valor UTM Actual"), max_digits=10, decimal_places=2, default=Decimal('65000.00'),
        help_text=_("Valor de la Unidad Tributaria Mensual.")
    )
    min_wage_value = models.DecimalField(
        _("Sueldo Mínimo Actual"), max_digits=10, decimal_places=2, default=Decimal('500000.00'),
        help_text=_("Valor del sueldo mínimo legal para el período.")
    )
    
    # Cuentas Contables Globales (Pasivos de pago)
    account_remuneraciones_por_pagar = models.ForeignKey(
        'accounting.Account', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='hr_global_rem_por_pagar',
        verbose_name=_("Cuenta Remuneraciones por Pagar"),
        help_text=_("Pasivo con el trabajador por su sueldo líquido.")
    )
    account_previred_por_pagar = models.ForeignKey(
        'accounting.Account', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='hr_global_previred_por_pagar',
        verbose_name=_("Cuenta Obligaciones Previred por Pagar"),
        help_text=_("Pasivo consolidado para pagos a instituciones previsionales.")
    )
    account_anticipos = models.ForeignKey(
        'accounting.Account', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='hr_global_anticipos',
        verbose_name=_("Cuenta Anticipos de Remuneraciones"),
        help_text=_("Cuenta de activo para registrar adelantos a trabajadores.")
    )

    class Meta:
        verbose_name = _("Parámetros Globales RRHH")
        verbose_name_plural = _("Parámetros Globales RRHH")

    def __str__(self):
        return "Configuración Global RRHH"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Invalidate Redis cache
        from core.cache import invalidate_singleton, CACHE_KEY_HR_SETTINGS
        invalidate_singleton(CACHE_KEY_HR_SETTINGS)

    @classmethod
    def get_solo(cls):
        from core.cache import cached_singleton, CACHE_KEY_HR_SETTINGS
        return cached_singleton(cls, CACHE_KEY_HR_SETTINGS)


class AFP(models.Model):
    """
    Administradoras de Fondos de Pensiones con su comisión vigente.
    """
    name = models.CharField(_("Nombre AFP"), max_length=50, unique=True)
    slug = models.SlugField(unique=True, null=True)
    percentage = models.DecimalField(
        _("% Comisión"), max_digits=5, decimal_places=2,
        help_text=_("Porcentaje total a descontar (10% + comisión de la AFP). Ej: 11.27")
    )
    account = models.ForeignKey(
        'accounting.Account', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='afps',
        verbose_name=_("Cuenta Contable Pasivo")
    )
    
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = _("AFP")
        verbose_name_plural = _("AFPs")

    def __str__(self):
        return f"{self.name} ({self.percentage}%)"


class PayrollConcept(models.Model):
    """
    Definición dinámica de Haberes o Descuentos.
    """
    class Category(models.TextChoices):
        HABER_IMPONIBLE = 'HABER_IMPONIBLE', _('Haber Imponible')
        HABER_NO_IMPONIBLE = 'HABER_NO_IMPONIBLE', _('Haber No Imponible')
        DESCUENTO_LEGAL_TRABAJADOR = 'DESCUENTO_LEGAL_TRABAJADOR', _('Descuento Legal (Cargo Trabajador)')
        DESCUENTO_LEGAL_EMPLEADOR = 'DESCUENTO_LEGAL_EMPLEADOR', _('Aporte del Empleador')
        OTRO_DESCUENTO = 'OTRO_DESCUENTO', _('Otro Descuento')

    class FormulaType(models.TextChoices):
        FIXED = 'FIXED', _('Monto Fijo (Manual)')
        PERCENTAGE = 'PERCENTAGE', _('Porcentaje de Base Imponible')
        EMPLOYEE_SPECIFIC = 'EMPLOYEE_SPECIFIC', _('Monto por Ficha Empleado')
        FORMULA = 'FORMULA', _('Fórmula Matemática')
        CHILEAN_LAW = 'CHILEAN_LAW', _('Legislación Chilena (Cálculo Automático Legacy)')

    name = models.CharField(_("Nombre del Concepto"), max_length=100)
    category = models.CharField(_("Categoría"), max_length=30, choices=Category.choices)
    account = models.ForeignKey(
        'accounting.Account', on_delete=models.PROTECT,
        related_name='payroll_concepts',
        verbose_name=_("Cuenta Contable")
    )
    
    formula_type = models.CharField(_("Tipo de Cálculo"), max_length=20, choices=FormulaType.choices, default=FormulaType.FIXED)
    formula = models.TextField(_("Fórmula / Expresión"), blank=True, help_text=_("Ej: IMPONIBLE * 0.07 o BASE + 50000"))
    default_amount = models.DecimalField(_("Monto por defecto"), max_digits=14, decimal_places=4, default=Decimal('0'))
    
    is_system = models.BooleanField(
        default=False, 
        help_text=_("Conceptos generados por el sistema para cálculos legales.")
    )

    class Meta:
        verbose_name = _("Concepto de Nómina")
        verbose_name_plural = _("Conceptos de Nómina")
        ordering = ['category', 'name']

    def __str__(self):
        return f"{self.name} ({self.get_category_display()})"


class EmployeeConceptAmount(models.Model):
    """
    Montos específicos asignados a un empleado para conceptos tipo EMPLOYEE_SPECIFIC.
    Ejemplo: Colación, Movilización, Bonos fijos particulares.
    """
    employee = models.ForeignKey('Employee', on_delete=models.CASCADE, related_name='concept_amounts')
    concept = models.ForeignKey(PayrollConcept, on_delete=models.CASCADE, related_name='employee_amounts')
    amount = models.DecimalField(_("Monto Mensual"), max_digits=14, decimal_places=4, validators=[MinValueValidator(0)])

    class Meta:
        unique_together = ['employee', 'concept']
        verbose_name = _("Monto por Ficha")
        verbose_name_plural = _("Montos por Ficha")

    def __str__(self):
        return f"{self.employee} - {self.concept.name}: ${self.amount}"


class Employee(models.Model):
    """Ficha del Personal con datos previsionales."""

    class Status(models.TextChoices):
        ACTIVE = 'ACTIVE', _('Activo')
        INACTIVE = 'INACTIVE', _('Inactivo')

    class ContractType(models.TextChoices):
        INDEFINIDO = 'INDEFINIDO', _('Indefinido')
        PLAZO_FIJO = 'PLAZO_FIJO', _('Plazo Fijo / Obra')

    class SaludType(models.TextChoices):
        FONASA = 'FONASA', _('Fonasa')
        ISAPRE = 'ISAPRE', _('Isapre')

    class JornadaType(models.TextChoices):
        ORDINARIA_22 = 'ORDINARIA_22', _('Ordinaria Art. 22')
        PARCIAL_40BIS = 'PARCIAL_40BIS', _('Parcial Art 40 BIS')
        EXENTA_22 = 'EXENTA_22', _('Exenta Art. 22')
        EXTRAORDINARIA_30 = 'EXTRAORDINARIA_30', _('Extraordinaria Art. 30')

    class AsignacionFamiliarTramo(models.TextChoices):
        TRAMO_A = 'A', _('Tramo A')
        TRAMO_B = 'B', _('Tramo B')
        TRAMO_C = 'C', _('Tramo C')
        TRAMO_D = 'D', _('Sin derecho (Tramo D)')

    code = models.CharField(_("Código"), max_length=20, unique=True, editable=False, null=True)
    contact = models.ForeignKey(
        'contacts.Contact',
        on_delete=models.PROTECT,
        related_name='employees',
        verbose_name=_("Contacto")
    )
    position = models.CharField(_("Cargo"), max_length=100, blank=True)
    department = models.CharField(_("Departamento / Área"), max_length=100, blank=True)
    
    start_date = models.DateField(_("Fecha de Ingreso"), null=True, blank=True)
    end_date = models.DateField(_("Fecha de Egreso"), null=True, blank=True)
    status = models.CharField(_("Estado"), max_length=10, choices=Status.choices, default=Status.ACTIVE)
    contract_type = models.CharField(_("Tipo de Contrato"), max_length=20, choices=ContractType.choices, default=ContractType.INDEFINIDO)

    # Sueldo Base Mensual
    base_salary = models.DecimalField(
        _("Sueldo Base"), max_digits=14, decimal_places=0,
        default=Decimal('0'), validators=[MinValueValidator(0)]
    )

    # Previsión
    afp = models.ForeignKey(AFP, on_delete=models.SET_NULL, null=True, related_name='employees', verbose_name=_("AFP"))
    salud_type = models.CharField(_("Sistema Salud"), max_length=10, choices=SaludType.choices, default=SaludType.FONASA)
    isapre_amount_uf = models.DecimalField(
        _("Monto Pactado Isapre (UF)"), max_digits=6, decimal_places=4, default=Decimal('0'),
        help_text=_("Solo si usa Isapre. Cantidad de UF pactadas.")
    )

    # Jornada y Condiciones
    jornada_type = models.CharField(_("Tipo de Jornada"), max_length=20, choices=JornadaType.choices, default=JornadaType.ORDINARIA_22)
    jornada_hours = models.DecimalField(_("Horas de Jornada"), max_digits=5, decimal_places=2, default=Decimal('44.0'))
    trabajo_pesado = models.BooleanField(_("Trabajo Pesado"), default=False)
    trabajo_agricola = models.BooleanField(_("Trabajo Agrícola"), default=False)
    
    # Remuneración Adicional
    gratificacion = models.BooleanField(_("Gratificación Legal"), default=True)
    dias_pactados = models.IntegerField(_("Días Pactados"), default=30, validators=[MinValueValidator(1), MaxValueValidator(31)])
    
    # Asignación Familiar
    asignacion_familiar = models.CharField(_("Asignación Familiar"), max_length=2, choices=AsignacionFamiliarTramo.choices, default=AsignacionFamiliarTramo.TRAMO_D)
    cargas_familiares = models.IntegerField(_("Número de Cargas"), default=0, validators=[MinValueValidator(0)])

    history = HistoricalRecords()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-id']
        verbose_name = _("Empleado")
        verbose_name_plural = _("Empleados")

    def __str__(self):
        return f"EMP-{self.code} - {self.contact.name}" if self.contact else f"EMP-{self.code}"

    @property
    def display_id(self):
        return f"EMP-{self.code}" if self.code else ""

    def save(self, *args, **kwargs):
        if not self.code:
            from core.services import SequenceService
            self.code = SequenceService.get_next_number(Employee, field_name='code')
        super().save(*args, **kwargs)


class Payroll(models.Model):
    """Liquidación de sueldo mensual."""

    class Status(models.TextChoices):
        DRAFT = 'DRAFT', _('Borrador')
        POSTED = 'POSTED', _('Contabilizado')

    number = models.CharField(_("Número"), max_length=20, unique=True, editable=False, null=True, blank=True)
    employee = models.ForeignKey(
        Employee, on_delete=models.PROTECT,
        related_name='payrolls',
        verbose_name=_("Empleado")
    )
    period_year = models.IntegerField(_("Año"))
    period_month = models.IntegerField(_("Mes"))
    status = models.CharField(_("Estado"), max_length=10, choices=Status.choices, default=Status.DRAFT)

    # Snapshots para auditoría
    base_salary = models.DecimalField(_("Sueldo Base (snapshot)"), max_digits=14, decimal_places=0, default=Decimal('0'))
    agreed_days = models.IntegerField(_("Días Pactados"), default=30)
    absent_days = models.DecimalField(_("Días Inasistencia"), max_digits=5, decimal_places=2, default=Decimal('0'))
    worked_days = models.DecimalField(_("Días Trabajados"), max_digits=5, decimal_places=2, default=Decimal('30'))
    
    # Totales Finales
    total_haberes = models.DecimalField(_("Total Haberes"), max_digits=14, decimal_places=0, default=Decimal('0'))
    total_descuentos = models.DecimalField(_("Total Descuentos"), max_digits=14, decimal_places=0, default=Decimal('0'))
    net_salary = models.DecimalField(_("Sueldo Líquido"), max_digits=14, decimal_places=0, default=Decimal('0'))

    # Relaciones Contables
    journal_entry = models.OneToOneField(
        'accounting.JournalEntry', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='payroll',
        verbose_name=_("Asiento Contable Nómina")
    )
    previred_journal_entry = models.OneToOneField(
        'accounting.JournalEntry', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='payroll_previred',
        verbose_name=_("Asiento Contable Previred")
    )

    notes = models.TextField(_("Notas"), blank=True)
    history = HistoricalRecords()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-period_year', '-period_month', '-id']
        unique_together = ['employee', 'period_year', 'period_month']
        verbose_name = _("Liquidación de Sueldo")
        verbose_name_plural = _("Liquidaciones de Sueldo")

    def __str__(self):
        return f"LIQ-{self.number} | {self.employee} | {self.period_year}/{str(self.period_month).zfill(2)}"

    @property
    def display_id(self):
        return f"LIQ-{self.number}" if self.number else ""

    @property
    def period_label(self):
        months_es = [
            '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ]
        return f"{months_es[self.period_month]} {self.period_year}"

    def recalculate_totals(self):
        from hr.services import PayrollService
        PayrollService.update_payroll_totals(self)

    def save(self, *args, **kwargs):
        if not self.number:
            from core.services import SequenceService
            self.number = SequenceService.get_next_number(Payroll, field_name='number')
        super().save(*args, **kwargs)


class PayrollItem(models.Model):
    """Línea de la liquidación vinculada a un concepto dinámico."""

    payroll = models.ForeignKey(Payroll, on_delete=models.CASCADE, related_name='items')
    concept = models.ForeignKey(PayrollConcept, on_delete=models.PROTECT, related_name='items', verbose_name=_("Concepto"))
    
    description = models.CharField(_("Descripción"), max_length=255, blank=True)
    amount = models.DecimalField(
        _("Monto"), max_digits=14, decimal_places=0,
        validators=[MinValueValidator(0)]
    )

    class Meta:
        verbose_name = _("Línea de Liquidación")
        verbose_name_plural = _("Líneas de Liquidación")

    def __str__(self):
        return f"{self.concept.name} - ${self.amount}"

    @property
    def is_previred(self):
        # Determinamos si es Previred basado en la categoría o flags del concepto
        return self.concept.category in [
            PayrollConcept.Category.DESCUENTO_LEGAL_TRABAJADOR,
            PayrollConcept.Category.DESCUENTO_LEGAL_EMPLEADOR
        ]


class Absence(models.Model):
    """
    Registro de inasistencias del empleado.
    """
    class AbsenceType(models.TextChoices):
        AUSENTISMO = 'AUSENTISMO', _('Ausentismo')
        LICENCIA = 'LICENCIA', _('Licencia Médica')
        PERMISO_SIN_GOCE = 'PERMISO_SIN_GOCE', _('Permiso sin goce de sueldo')
        AUSENCIA_HORAS = 'AUSENCIA_HORAS', _('Ausencia de horas')

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='absences', verbose_name=_("Empleado"))
    absence_type = models.CharField(_("Tipo de Inasistencia"), max_length=20, choices=AbsenceType.choices)
    start_date = models.DateField(_("Fecha de Inicio"))
    end_date = models.DateField(_("Fecha de Fin"))
    days = models.DecimalField(
        _("Días de Ausencia"), max_digits=5, decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))],
        help_text=_("Cantidad de días o fracción (ej: 0.5 para medio día).")
    )
    notes = models.TextField(_("Notas"), blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-start_date']
        verbose_name = _("Inasistencia")
        verbose_name_plural = _("Inasistencias")

    def __str__(self):
        return f"{self.get_absence_type_display()} - {self.employee} ({self.days} días)"


class SalaryAdvance(models.Model):
    """
    Anticipo de sueldo entregado al trabajador.
    """
    employee = models.ForeignKey(Employee, on_delete=models.PROTECT, related_name='advances', verbose_name=_("Empleado"))
    payroll = models.ForeignKey(
        'Payroll', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='advances', verbose_name=_("Liquidación Asociada"),
        help_text=_("Si ya fue descontado de una liquidación, se vincula aquí.")
    )
    amount = models.DecimalField(_("Monto"), max_digits=14, decimal_places=0, validators=[MinValueValidator(Decimal('0.01'))])
    date = models.DateField(_("Fecha del Anticipo"))
    notes = models.TextField(_("Notas"), blank=True)
    is_discounted = models.BooleanField(_("Descontado en Liquidación"), default=False)
    journal_entry = models.ForeignKey(
        'accounting.JournalEntry', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='salary_advances', verbose_name=_("Asiento Contable")
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date']
        verbose_name = _("Anticipo de Sueldo")
        verbose_name_plural = _("Anticipos de Sueldo")

    def __str__(self):
        return f"Anticipo {self.employee} - ${self.amount} ({self.date})"


class PayrollPayment(models.Model):
    """
    Registro del pago efectivo de remuneraciones o previred.
    """
    class PaymentType(models.TextChoices):
        SALARIO = 'SALARIO', _('Pago de Remuneración')
        PREVIRED = 'PREVIRED', _('Pago de Previred')

    payroll = models.ForeignKey(
        'Payroll', on_delete=models.CASCADE, related_name='payments',
        verbose_name=_("Liquidación")
    )
    payment_type = models.CharField(_("Tipo"), max_length=10, choices=PaymentType.choices, default=PaymentType.SALARIO)
    amount = models.DecimalField(_("Monto Pagado"), max_digits=14, decimal_places=0, validators=[MinValueValidator(Decimal('0.01'))])
    date = models.DateField(_("Fecha de Pago"))
    notes = models.TextField(_("Notas"), blank=True)
    journal_entry = models.ForeignKey(
        'accounting.JournalEntry', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='payroll_payments', verbose_name=_("Asiento Contable")
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date']
        verbose_name = _("Pago de Remuneración")
        verbose_name_plural = _("Pagos de Remuneración")

    def __str__(self):
        return f"{self.get_payment_type_display()} - {self.payroll.display_id} (${self.amount})"
