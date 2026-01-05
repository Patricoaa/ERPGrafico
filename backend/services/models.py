from django.db import models
from django.utils.translation import gettext_lazy as _
from accounting.models import Account, AccountType
from contacts.models import Contact
from billing.models import Invoice
from treasury.models import Payment
from accounting.models import JournalEntry

class ServiceCategory(models.Model):
    name = models.CharField(_("Nombre"), max_length=100)
    code = models.CharField(_("Código"), max_length=20, unique=True, help_text="Ej: ARR, SB, SEG")
    
    # Cuentas contables por defecto
    expense_account = models.ForeignKey(
        Account, 
        on_delete=models.PROTECT, 
        related_name='service_categories_expense',
        limit_choices_to={'account_type': AccountType.EXPENSE},
        verbose_name=_("Cuenta de Gasto por Defecto")
    )
    payable_account = models.ForeignKey(
        Account, 
        on_delete=models.PROTECT, 
        related_name='service_categories_payable',
        limit_choices_to={'account_type': AccountType.LIABILITY},
        verbose_name=_("Cuenta por Pagar por Defecto")
    )
    
    # Configuración
    requires_provision = models.BooleanField(_("Requiere Provisión Mensual"), default=False)

    class Meta:
        verbose_name = _("Categoría de Servicio")
        verbose_name_plural = _("Categorías de Servicio")
        ordering = ['name']

    def __str__(self):
        return self.name

class ServiceContract(models.Model):
    class RecurrenceType(models.TextChoices):
        MONTHLY = 'MONTHLY', _('Mensual')
        QUARTERLY = 'QUARTERLY', _('Trimestral')
        SEMIANNUAL = 'SEMIANNUAL', _('Semestral')
        ANNUAL = 'ANNUAL', _('Anual')
        BIWEEKLY = 'BIWEEKLY', _('Quincenal')
        WEEKLY = 'WEEKLY', _('Semanal')
        ONE_TIME = 'ONE_TIME', _('Único (No Recurrente)')
    
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', _('Borrador')
        ACTIVE = 'ACTIVE', _('Activo')
        SUSPENDED = 'SUSPENDED', _('Suspendido')
        EXPIRED = 'EXPIRED', _('Vencido')
        CANCELLED = 'CANCELLED', _('Cancelado')
    
    # Identificación
    contract_number = models.CharField(_("Número de Contrato"), max_length=20, unique=True, editable=False)
    name = models.CharField(_("Nombre del Servicio"), max_length=200, help_text="Ej: Arriendo Oficina Central")
    description = models.TextField(_("Descripción"), blank=True)
    
    # Relaciones
    supplier = models.ForeignKey(Contact, on_delete=models.PROTECT, related_name='service_contracts', verbose_name=_("Proveedor"))
    category = models.ForeignKey(ServiceCategory, on_delete=models.PROTECT, related_name='contracts', verbose_name=_("Categoría"))
    
    # Recurrencia
    recurrence_type = models.CharField(_("Frecuencia"), max_length=20, choices=RecurrenceType.choices, default=RecurrenceType.MONTHLY)
    payment_day = models.PositiveSmallIntegerField(_("Día de Pago"), default=1, help_text="Día del mes (1-31)")
    
    # Montos
    base_amount = models.DecimalField(_("Monto Base"), max_digits=12, decimal_places=2)
    is_amount_variable = models.BooleanField(_("Monto Variable"), default=False, help_text="Si se marca, el monto base es solo referencial")
    
    # Vigencia
    start_date = models.DateField(_("Fecha Inicio"))
    end_date = models.DateField(_("Fecha Término"), null=True, blank=True)
    auto_renew = models.BooleanField(_("Renovación Automática"), default=False)
    renewal_notice_days = models.PositiveIntegerField(_("Días Aviso Renovación"), default=30)
    
    # Estado
    status = models.CharField(_("Estado"), max_length=20, choices=Status.choices, default=Status.DRAFT)
    
    # Contabilidad
    expense_account = models.ForeignKey(
        Account, 
        on_delete=models.PROTECT, 
        related_name='service_expenses',
        limit_choices_to={'account_type': AccountType.EXPENSE},
        null=True, blank=True,
        verbose_name=_("Cuenta de Gasto")
    )
    payable_account = models.ForeignKey(
        Account, 
        on_delete=models.PROTECT, 
        related_name='service_payables',
        limit_choices_to={'account_type': AccountType.LIABILITY},
        null=True, blank=True,
        verbose_name=_("Cuenta por Pagar")
    )
    
    # Adjuntos
    contract_file = models.FileField(_("Archivo Contrato"), upload_to='contracts/', null=True, blank=True)
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("Contrato de Servicio")
        verbose_name_plural = _("Contratos de Servicio")
        ordering = ['-start_date']

    def __str__(self):
        return f"{self.contract_number} - {self.name}"

    def save(self, *args, **kwargs):
        if not self.contract_number:
            last = ServiceContract.objects.order_by('id').last()
            if last and last.contract_number.startswith('SVC-'):
                try:
                    seq = int(last.contract_number.split('-')[1]) + 1
                    self.contract_number = f"SVC-{str(seq).zfill(6)}"
                except (ValueError, IndexError):
                    self.contract_number = "SVC-000001"
            else:
                self.contract_number = "SVC-000001"
        super().save(*args, **kwargs)

class ServiceObligation(models.Model):
    class Status(models.TextChoices):
        PENDING = 'PENDING', _('Pendiente')
        INVOICED = 'INVOICED', _('Facturado')
        PAID = 'PAID', _('Pagado')
        OVERDUE = 'OVERDUE', _('Vencido')
        CANCELLED = 'CANCELLED', _('Cancelado')
    
    # Relaciones
    contract = models.ForeignKey(ServiceContract, on_delete=models.CASCADE, related_name='obligations')
    
    # Fechas
    due_date = models.DateField(_("Fecha Vencimiento"))
    period_start = models.DateField(_("Inicio Período"), null=True, blank=True)
    period_end = models.DateField(_("Fin Período"), null=True, blank=True)
    
    # Montos
    amount = models.DecimalField(_("Monto"), max_digits=12, decimal_places=2)
    paid_amount = models.DecimalField(_("Monto Pagado"), max_digits=12, decimal_places=2, default=0)
    
    # Estado
    status = models.CharField(_("Estado"), max_length=20, choices=Status.choices, default=Status.PENDING)
    
    # Links a documentos
    invoice = models.ForeignKey(Invoice, on_delete=models.SET_NULL, null=True, blank=True, related_name='service_obligations', verbose_name=_("Factura Recibida"))
    payment = models.ForeignKey(Payment, on_delete=models.SET_NULL, null=True, blank=True, related_name='service_obligations', verbose_name=_("Pago"))
    journal_entry = models.ForeignKey(JournalEntry, on_delete=models.SET_NULL, null=True, blank=True, related_name='service_obligations', verbose_name=_("Asiento Contable"))
    
    # Fechas de ejecución
    invoiced_date = models.DateField(_("Fecha Facturación"), null=True, blank=True)
    paid_date = models.DateField(_("Fecha Pago"), null=True, blank=True)
    
    # Notas
    notes = models.TextField(_("Notas"), blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("Obligación de Servicio")
        verbose_name_plural = _("Obligaciones de Servicio")
        ordering = ['due_date']
        indexes = [
            models.Index(fields=['due_date', 'status']),
            models.Index(fields=['contract', 'status']),
        ]

    def __str__(self):
        return f"{self.contract.name} - {self.due_date}"
