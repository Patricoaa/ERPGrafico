from django.db import models
from django.utils.translation import gettext_lazy as _
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone
from decimal import Decimal
from simple_history.models import HistoricalRecords
from accounting.models import JournalEntry
from treasury.models import TreasuryAccount
from core.models import User


class TaxPeriod(models.Model):
    """
    Represents a monthly tax period.
    Controls the state (open/under review/closed) and prevents modifications to invoices
    in closed periods.
    """
    class Status(models.TextChoices):
        OPEN = 'OPEN', _('Abierto')
        UNDER_REVIEW = 'UNDER_REVIEW', _('En Revisión')
        CLOSED = 'CLOSED', _('Cerrado')

    year = models.IntegerField(
        _("Año"),
        validators=[MinValueValidator(2000), MaxValueValidator(2100)]
    )
    month = models.IntegerField(
        _("Mes"),
        validators=[MinValueValidator(1), MaxValueValidator(12)]
    )
    status = models.CharField(
        _("Estado"),
        max_length=20,
        choices=Status.choices,
        default=Status.OPEN
    )
    closed_at = models.DateTimeField(
        _("Fecha de Cierre"),
        null=True,
        blank=True
    )
    closed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='closed_tax_periods',
        verbose_name=_("Cerrado por")
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("Período Tributario")
        verbose_name_plural = _("Períodos Tributarios")
        ordering = ['-year', '-month']
        unique_together = [['year', 'month']]
        indexes = [
            models.Index(fields=['year', 'month']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"{self.get_month_display()} {self.year}"

    def get_month_display(self):
        months = {
            1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril',
            5: 'Mayo', 6: 'Junio', 7: 'Julio', 8: 'Agosto',
            9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre'
        }
        return months.get(self.month, str(self.month))


class AccountingPeriod(models.Model):
    """
    Represents a monthly accounting period.
    Controls the state (open/under review/closed) and prevents modifications to
    journal entries and inventory movements in closed periods.
    
    This is separate from TaxPeriod to allow independent closure cycles:
    - Accounting periods can be closed before tax periods
    - Tax period closure automatically closes the accounting period
    - Accounting periods cannot be reopened if tax period is closed
    """
    class Status(models.TextChoices):
        OPEN = 'OPEN', _('Abierto')
        UNDER_REVIEW = 'UNDER_REVIEW', _('En Revisión')
        CLOSED = 'CLOSED', _('Cerrado')

    year = models.IntegerField(
        _("Año"),
        validators=[MinValueValidator(2000), MaxValueValidator(2100)]
    )
    month = models.IntegerField(
        _("Mes"),
        validators=[MinValueValidator(1), MaxValueValidator(12)]
    )
    status = models.CharField(
        _("Estado"),
        max_length=20,
        choices=Status.choices,
        default=Status.OPEN
    )
    closed_at = models.DateTimeField(
        _("Fecha de Cierre"),
        null=True,
        blank=True
    )
    closed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='closed_accounting_periods',
        verbose_name=_("Cerrado por")
    )
    
    # Relationship to tax period (optional, for synchronization)
    tax_period = models.OneToOneField(
        TaxPeriod,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='accounting_period',
        verbose_name=_("Periodo Tributario Asociado")
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("Periodo Contable")
        verbose_name_plural = _("Periodos Contables")
        ordering = ['-year', '-month']
        unique_together = [['year', 'month']]
        indexes = [
            models.Index(fields=['year', 'month']),
            models.Index(fields=['status']),
        ]
        permissions = [
            ("can_close_accounting_period", "Can close accounting periods"),
            ("can_reopen_accounting_period", "Can reopen closed accounting periods"),
        ]

    def __str__(self):
        return f"{self.get_month_display()} {self.year}"

    def get_month_display(self):
        months = {
            1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril',
            5: 'Mayo', 6: 'Junio', 7: 'Julio', 8: 'Agosto',
            9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre'
        }
        return months.get(self.month, str(self.month))


class F29Declaration(models.Model):
    """
    Chilean F29 Monthly Tax Declaration.
    Consolidates sales (debits) and purchases (credits) to calculate VAT and other taxes.
    """
    tax_period = models.ForeignKey(
        TaxPeriod,
        on_delete=models.PROTECT,
        related_name='declarations',
        verbose_name=_("Período Tributario")
    )
    declaration_date = models.DateField(
        _("Fecha de Declaración"),
        null=True,
        blank=True,
        help_text=_("Fecha en que se presentó en el SII")
    )
    folio_number = models.CharField(
        _("Folio SII"),
        max_length=50,
        blank=True,
        help_text=_("Número de folio asignado por el SII")
    )

    # --- DEBITS (Sales) ---
    sales_taxed = models.DecimalField(
        _("Ventas Afectas"),
        max_digits=15,
        decimal_places=0,
        default=Decimal('0'),
        help_text=_("Monto neto de ventas afectas a IVA")
    )
    sales_exempt = models.DecimalField(
        _("Ventas Exentas"),
        max_digits=15,
        decimal_places=0,
        default=Decimal('0'),
        help_text=_("Ventas no afectas a IVA")
    )
    debit_notes_taxed = models.DecimalField(
        _("Notas de Débito Afectas"),
        max_digits=15,
        decimal_places=0,
        default=Decimal('0')
    )
    credit_notes_taxed = models.DecimalField(
        _("Notas de Crédito Afectas"),
        max_digits=15,
        decimal_places=0,
        default=Decimal('0'),
        help_text=_("Se restan de las ventas")
    )

    # --- CREDITS (Purchases) ---
    purchases_taxed = models.DecimalField(
        _("Compras Afectas"),
        max_digits=15,
        decimal_places=0,
        default=Decimal('0'),
        help_text=_("Monto neto de compras afectas a IVA")
    )
    purchases_exempt = models.DecimalField(
        _("Compras Exentas"),
        max_digits=15,
        decimal_places=0,
        default=Decimal('0')
    )
    purchase_debit_notes = models.DecimalField(
        _("Notas de Débito Compras"),
        max_digits=15,
        decimal_places=0,
        default=Decimal('0')
    )
    purchase_credit_notes = models.DecimalField(
        _("Notas de Crédito Compras"),
        max_digits=15,
        decimal_places=0,
        default=Decimal('0'),
        help_text=_("Se restan de las compras")
    )

    # --- MANUAL FIELDS (Not automatically calculated) ---
    ppm_amount = models.DecimalField(
        _("PPM Pagado"),
        max_digits=15,
        decimal_places=0,
        default=Decimal('0'),
        help_text=_("Pagos Provisionales Mensuales")
    )
    withholding_tax = models.DecimalField(
        _("Retenciones de Honorarios"),
        max_digits=15,
        decimal_places=0,
        default=Decimal('0'),
        help_text=_("Impuesto único segunda categoría retenido")
    )
    vat_credit_carryforward = models.DecimalField(
        _("Remanente Mes Anterior"),
        max_digits=15,
        decimal_places=0,
        default=Decimal('0'),
        help_text=_("Crédito fiscal nominal del período anterior")
    )
    vat_correction_amount = models.DecimalField(
        _("Reajuste Remanente"),
        max_digits=15,
        decimal_places=0,
        default=Decimal('0'),
        help_text=_("Aumento del remanente por actualización monetaria (Art. 31)")
    )
    second_category_tax = models.DecimalField(
        _("Impuesto Única 2da Categoría"),
        max_digits=15,
        decimal_places=0,
        default=Decimal('0')
    )

    # --- CONFIGURATION ---
    tax_rate = models.DecimalField(
        _("Tasa de IVA"),
        max_digits=5,
        decimal_places=2,
        default=Decimal('19.00'),
        help_text=_("Porcentaje de IVA aplicable (ej: 19.00)")
    )

    notes = models.TextField(
        _("Observaciones"),
        blank=True
    )

    # --- ACCOUNTING INTEGRATION ---
    journal_entry = models.OneToOneField(
        JournalEntry,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='f29_declaration',
        verbose_name=_("Asiento Contable")
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    history = HistoricalRecords()

    class Meta:
        verbose_name = _("Declaración F29")
        verbose_name_plural = _("Declaraciones F29")
        ordering = ['-tax_period__year', '-tax_period__month']
        indexes = [
            models.Index(fields=['declaration_date']),
        ]

    def __str__(self):
        return f"F29 {self.tax_period} - Folio {self.folio_number or 'N/A'}"

    @property
    def net_taxed_sales(self):
        """Ventas netas afectas = Ventas + ND - NC"""
        return self.sales_taxed + self.debit_notes_taxed - self.credit_notes_taxed

    @property
    def net_taxed_purchases(self):
        """Compras netas afectas = Compras + ND - NC"""
        return self.purchases_taxed + self.purchase_debit_notes - self.purchase_credit_notes

    @property
    def vat_debit(self):
        """IVA débito fiscal = Ventas netas afectas * tasa"""
        return (self.net_taxed_sales * self.tax_rate / Decimal('100')).quantize(
            Decimal('1'), rounding='ROUND_HALF_UP'
        )

    @property
    def vat_credit(self):
        """IVA crédito fiscal = Compras netas afectas * tasa"""
        return (self.net_taxed_purchases * self.tax_rate / Decimal('100')).quantize(
            Decimal('1'), rounding='ROUND_HALF_UP'
        )

    @property
    def total_amount_due(self):
        """Total de impuestos determinados (IVA Débito + Retenciones + Impuesto Único)"""
        return self.vat_debit + self.withholding_tax + self.second_category_tax

    @property
    def total_credits_available(self):
        """Total de créditos/pagos (IVA Crédito + Remanente Anterior + Reajuste + PPM)"""
        return (
            self.vat_credit + 
            self.vat_credit_carryforward + 
            self.vat_correction_amount + 
            self.ppm_amount
        )

    @property
    def vat_to_pay(self):
        """Monto neto a pagar al SII si los impuestos superan los créditos"""
        result = self.total_amount_due - self.total_credits_available
        return result if result > 0 else Decimal('0')

    @property
    def vat_credit_balance(self):
        """Remanente a favor si los créditos superen a los impuestos del período"""
        result = self.total_amount_due - self.total_credits_available
        return abs(result) if result < 0 else Decimal('0')

    @property
    def is_registered(self):
        """Check if declaration has been officially registered"""
        return bool(self.declaration_date and self.journal_entry_id)


class F29Payment(models.Model):
    """
    Payment record for F29 tax declaration.
    Links to treasury movement and creates accounting entry.
    """
    class PaymentMethod(models.TextChoices):
        TRANSFER = 'TRANSFER', _('Transferencia')
        CHECK = 'CHECK', _('Cheque')
        CASH = 'CASH', _('Efectivo')
        OTHER = 'OTHER', _('Otro')

    declaration = models.ForeignKey(
        F29Declaration,
        on_delete=models.PROTECT,
        related_name='payments',
        verbose_name=_("Declaración F29")
    )
    payment_date = models.DateField(
        _("Fecha de Pago"),
        default=timezone.now
    )
    amount = models.DecimalField(
        _("Monto Pagado"),
        max_digits=15,
        decimal_places=0,
        validators=[MinValueValidator(0)]
    )
    payment_method = models.CharField(
        _("Método de Pago"),
        max_length=20,
        choices=PaymentMethod.choices,
        default=PaymentMethod.TRANSFER
    )
    reference = models.CharField(
        _("Referencia"),
        max_length=100,
        blank=True,
        help_text=_("Comprobante bancario u otra referencia")
    )
    treasury_account = models.ForeignKey(
        TreasuryAccount,
        on_delete=models.PROTECT,
        related_name='tax_payments',
        verbose_name=_("Cuenta de Pago")
    )
    journal_entry = models.OneToOneField(
        JournalEntry,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='f29_payment',
        verbose_name=_("Asiento Contable")
    )
    notes = models.TextField(
        _("Observaciones"),
        blank=True
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("Pago F29")
        verbose_name_plural = _("Pagos F29")
        ordering = ['-payment_date']
        indexes = [
            models.Index(fields=['payment_date']),
            models.Index(fields=['declaration']),
        ]

    def __str__(self):
        return f"Pago F29 {self.declaration.tax_period} - ${self.amount:,.0f}"
