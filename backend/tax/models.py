from decimal import Decimal

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from simple_history.models import HistoricalRecords

from accounting.models import JournalEntry
from core.edit_policy import EditPolicy
from core.fiscal_match import FiscalMatchStatus, PartState
from core.models import User
from core.storages import PrivateMediaStorage
from core.utils import generic_upload_path
from core.validators import validate_file_extension, validate_file_size
from treasury.models import TreasuryAccount


class TaxPeriod(models.Model):
    """
    Represents a monthly tax period.
    Controls the state (open/under review/closed) and prevents modifications to invoices
    in closed periods.
    """

    class Status(models.TextChoices):
        OPEN = "OPEN", _("Abierto")
        UNDER_REVIEW = "UNDER_REVIEW", _("En Revisión")
        CLOSED = "CLOSED", _("Cerrado")

    year = models.IntegerField(
        _("Año"), validators=[MinValueValidator(2000), MaxValueValidator(2100)]
    )
    month = models.IntegerField(_("Mes"), validators=[MinValueValidator(1), MaxValueValidator(12)])
    status = models.CharField(
        _("Estado"), max_length=20, choices=Status.choices, default=Status.OPEN
    )
    closed_at = models.DateTimeField(_("Fecha de Cierre"), null=True, blank=True)
    closed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="closed_tax_periods",
        verbose_name=_("Cerrado por"),
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("Período Tributario")
        verbose_name_plural = _("Períodos Tributarios")
        ordering = ["-year", "-month"]
        unique_together = [["year", "month"]]
        indexes = [
            models.Index(fields=["year", "month"]),
            models.Index(fields=["status"]),
        ]
        permissions = [
            ("can_close_tax_period", "Puede cerrar período tributario (F29)"),
            ("can_reopen_tax_period", "Puede reabrir período tributario (F29)"),
        ]

    def __str__(self):
        return f"{self.get_month_display()} {self.year}"

    def get_month_display(self):
        months = {
            1: "Enero",
            2: "Febrero",
            3: "Marzo",
            4: "Abril",
            5: "Mayo",
            6: "Junio",
            7: "Julio",
            8: "Agosto",
            9: "Septiembre",
            10: "Octubre",
            11: "Noviembre",
            12: "Diciembre",
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
        OPEN = "OPEN", _("Abierto")
        UNDER_REVIEW = "UNDER_REVIEW", _("En Revisión")
        CLOSED = "CLOSED", _("Cerrado")

    year = models.IntegerField(
        _("Año"), validators=[MinValueValidator(2000), MaxValueValidator(2100)]
    )
    month = models.IntegerField(_("Mes"), validators=[MinValueValidator(1), MaxValueValidator(12)])
    status = models.CharField(
        _("Estado"), max_length=20, choices=Status.choices, default=Status.OPEN
    )
    closed_at = models.DateTimeField(_("Fecha de Cierre"), null=True, blank=True)
    closed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="closed_accounting_periods",
        verbose_name=_("Cerrado por"),
    )

    # Relationship to tax period (optional, for synchronization)
    tax_period = models.OneToOneField(
        TaxPeriod,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="accounting_period",
        verbose_name=_("Periodo Tributario Asociado"),
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("Periodo Contable")
        verbose_name_plural = _("Periodos Contables")
        ordering = ["-year", "-month"]
        unique_together = [["year", "month"]]
        indexes = [
            models.Index(fields=["year", "month"]),
            models.Index(fields=["status"]),
        ]
        permissions = [
            ("can_close_accounting_period", "Can close accounting periods"),
            ("can_reopen_accounting_period", "Can reopen closed accounting periods"),
        ]

    def __str__(self):
        return f"{self.get_month_display()} {self.year}"

    def get_month_display(self):
        months = {
            1: "Enero",
            2: "Febrero",
            3: "Marzo",
            4: "Abril",
            5: "Mayo",
            6: "Junio",
            7: "Julio",
            8: "Agosto",
            9: "Septiembre",
            10: "Octubre",
            11: "Noviembre",
            12: "Diciembre",
        }
        return months.get(self.month, str(self.month))

    def save(self, *args, **kwargs):
        if not self.tax_period_id:
            try:
                tax_period = TaxPeriod.objects.get(year=self.year, month=self.month)
                self.tax_period = tax_period
            except TaxPeriod.DoesNotExist:
                pass
        super().save(*args, **kwargs)


class F29Declaration(models.Model):
    """
    Chilean F29 Monthly Tax Declaration.
    Consolidates sales (debits) and purchases (credits) to calculate VAT and other taxes.
    """

    tax_period = models.ForeignKey(
        TaxPeriod,
        on_delete=models.PROTECT,
        related_name="declarations",
        verbose_name=_("Período Tributario"),
    )
    declaration_date = models.DateField(
        _("Fecha de Declaración"),
        null=True,
        blank=True,
        help_text=_("Fecha en que se presentó en el SII"),
    )
    folio_number = models.CharField(
        _("Folio SII"),
        max_length=50,
        blank=True,
        help_text=_("Número de folio asignado por el SII"),
    )

    # --- DEBITS (Sales) ---
    sales_taxed = models.DecimalField(
        _("Ventas Afectas"),
        max_digits=15,
        decimal_places=0,
        default=Decimal("0"),
        help_text=_("Monto neto de ventas afectas a IVA"),
    )
    sales_exempt = models.DecimalField(
        _("Ventas Exentas"),
        max_digits=15,
        decimal_places=0,
        default=Decimal("0"),
        help_text=_("Ventas no afectas a IVA"),
    )
    debit_notes_taxed = models.DecimalField(
        _("Notas de Débito Afectas"), max_digits=15, decimal_places=0, default=Decimal("0")
    )
    credit_notes_taxed = models.DecimalField(
        _("Notas de Crédito Afectas"),
        max_digits=15,
        decimal_places=0,
        default=Decimal("0"),
        help_text=_("Se restan de las ventas"),
    )

    # --- CREDITS (Purchases) ---
    purchases_taxed = models.DecimalField(
        _("Compras Afectas"),
        max_digits=15,
        decimal_places=0,
        default=Decimal("0"),
        help_text=_("Monto neto de compras afectas a IVA"),
    )
    purchases_exempt = models.DecimalField(
        _("Compras Exentas"), max_digits=15, decimal_places=0, default=Decimal("0")
    )
    purchase_debit_notes = models.DecimalField(
        _("Notas de Débito Compras"), max_digits=15, decimal_places=0, default=Decimal("0")
    )
    purchase_credit_notes = models.DecimalField(
        _("Notas de Crédito Compras"),
        max_digits=15,
        decimal_places=0,
        default=Decimal("0"),
        help_text=_("Se restan de las compras"),
    )

    # --- MANUAL FIELDS (Not automatically calculated) ---
    ppm_amount = models.DecimalField(
        _("PPM Pagado"),
        max_digits=15,
        decimal_places=0,
        default=Decimal("0"),
        help_text=_("Pagos Provisionales Mensuales"),
    )
    withholding_tax = models.DecimalField(
        _("Retenciones de Honorarios"),
        max_digits=15,
        decimal_places=0,
        default=Decimal("0"),
        help_text=_("Impuesto único segunda categoría retenido"),
    )
    vat_credit_carryforward = models.DecimalField(
        _("Remanente Mes Anterior"),
        max_digits=15,
        decimal_places=0,
        default=Decimal("0"),
        help_text=_("Crédito fiscal nominal del período anterior"),
    )
    vat_correction_amount = models.DecimalField(
        _("Reajuste Remanente"),
        max_digits=15,
        decimal_places=0,
        default=Decimal("0"),
        help_text=_("Aumento del remanente por actualización monetaria (Art. 31)"),
    )
    second_category_tax = models.DecimalField(
        _("Impuesto Única 2da Categoría"), max_digits=15, decimal_places=0, default=Decimal("0")
    )
    loan_retention = models.DecimalField(
        _("Retención Préstamo Solidario"),
        max_digits=15,
        decimal_places=0,
        default=Decimal("0"),
        help_text=_("Retención adicional 3% Préstamo Solidario (Código 177)"),
    )
    ila_tax = models.DecimalField(
        _("Impuesto ILA"),
        max_digits=15,
        decimal_places=0,
        default=Decimal("0"),
        help_text=_("Impuesto Adicional (Licores, Bebidas analcohólicas, etc.)"),
    )
    vat_withholding = models.DecimalField(
        _("Retención IVA"),
        max_digits=15,
        decimal_places=0,
        default=Decimal("0"),
        help_text=_("IVA retenido por compras o cambio de sujeto"),
    )

    # --- CONFIGURATION ---
    tax_rate = models.DecimalField(
        _("Tasa de IVA"),
        max_digits=5,
        decimal_places=2,
        default=Decimal("19.00"),
        help_text=_("Porcentaje de IVA aplicable (ej: 19.00)"),
    )

    notes = models.TextField(_("Observaciones"), blank=True)

    # --- ACCOUNTING INTEGRATION ---
    journal_entry = models.OneToOneField(
        JournalEntry,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="f29_declaration",
        verbose_name=_("Asiento Contable"),
    )

    document = models.FileField(
        _("Documento Declaración"),
        upload_to=generic_upload_path('tax/f29_documents/'),
        storage=PrivateMediaStorage(),
        null=True, blank=True,
        validators=[validate_file_size, validate_file_extension],
        help_text=_("Formulario F29 (PDF) u otro comprobante")
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    history = HistoricalRecords()

    # ADR-0091: registered (has journal entry) → only notes/document.
    edit_policy = EditPolicy(
        is_locked=lambda d: d.journal_entry_id is not None,
        mutable_when_locked=frozenset({"notes", "document"}),
        deletable=True,
        locked_message="La declaración F29 ya está registrada y no se puede modificar.",
    )

    class Meta:
        verbose_name = _("Declaración F29")
        verbose_name_plural = _("Declaraciones F29")
        ordering = ["-tax_period__year", "-tax_period__month"]
        indexes = [
            models.Index(fields=["declaration_date"]),
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
        return (self.net_taxed_sales * self.tax_rate / Decimal("100")).quantize(
            Decimal("1"), rounding="ROUND_HALF_UP"
        )

    @property
    def vat_credit(self):
        """IVA crédito fiscal = Compras netas afectas * tasa"""
        return (self.net_taxed_purchases * self.tax_rate / Decimal("100")).quantize(
            Decimal("1"), rounding="ROUND_HALF_UP"
        )

    @property
    def total_amount_due(self):
        """Total de impuestos determinados a pagar (Neto VAT a pagar + Retenciones + Impuesto Único + PPM a pagar + Nuevas Retenciones)"""
        return (
            self.vat_to_pay
            + self.withholding_tax
            + self.second_category_tax
            + self.loan_retention
            + self.ila_tax
            + self.vat_withholding
            + self.ppm_amount
        )

    @property
    def total_credits_available(self):
        """Total de créditos pro-IVA (IVA Crédito + Remanente Anterior + Reajuste)"""
        return self.vat_credit + self.vat_credit_carryforward + self.vat_correction_amount

    @property
    def vat_to_pay(self):
        """Monto neto a pagar al SII SÓLO POR CONCEPTO DE IVA si los débitos superan los créditos"""
        result = self.vat_debit - self.total_credits_available
        return result if result > 0 else Decimal("0")

    @property
    def vat_credit_balance(self):
        """Remanente de IVA a favor si los créditos superan a los débitos del período"""
        result = self.vat_debit - self.total_credits_available
        return abs(result) if result < 0 else Decimal("0")

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
        TRANSFER = "TRANSFER", _("Transferencia")
        CHECK = "CHECK", _("Cheque")
        CASH = "CASH", _("Efectivo")
        CARD = "CARD", _("Tarjeta (Manual)")
        DEBIT_CARD = "DEBIT_CARD", _("Tarjeta Débito Empresa")
        CREDIT_CARD = "CREDIT_CARD", _("Tarjeta Crédito Empresa")
        CARD_TERMINAL = "CARD_TERMINAL", _("Tarjeta (Terminal de cobro)")
        OTHER = "OTHER", _("Otro")

    declaration = models.ForeignKey(
        F29Declaration,
        on_delete=models.PROTECT,
        related_name="payments",
        verbose_name=_("Declaración F29"),
    )
    payment_date = models.DateField(_("Fecha de Pago"), default=timezone.now)
    amount = models.DecimalField(
        _("Monto Pagado"), max_digits=15, decimal_places=0, validators=[MinValueValidator(0)]
    )
    payment_method = models.CharField(
        _("Método de Pago"),
        max_length=20,
        choices=PaymentMethod.choices,
        default=PaymentMethod.TRANSFER,
    )
    reference = models.CharField(
        _("Referencia"),
        max_length=100,
        blank=True,
        help_text=_("Comprobante bancario u otra referencia"),
    )
    treasury_account = models.ForeignKey(
        TreasuryAccount,
        on_delete=models.PROTECT,
        related_name="tax_payments",
        verbose_name=_("Cuenta de Pago"),
    )
    journal_entry = models.OneToOneField(
        JournalEntry,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="f29_payment",
        verbose_name=_("Asiento Contable"),
    )

    class Status(models.TextChoices):
        POSTED = "POSTED", _("Contabilizado")
        CANCELLED = "CANCELLED", _("Anulado")

    status = models.CharField(
        _("Estado"), max_length=20, choices=Status.choices, default=Status.POSTED
    )
    notes = models.TextField(_("Observaciones"), blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    edit_policy = EditPolicy(
        is_locked=lambda p: p.journal_entry_id is not None,
        deletable=True,
        locked_message="El pago F29 ya está contabilizado y no se puede modificar.",
    )

    class Meta:
        verbose_name = _("Pago F29")
        verbose_name_plural = _("Pagos F29")
        ordering = ["-payment_date"]
        indexes = [
            models.Index(fields=["payment_date"]),
            models.Index(fields=["declaration"]),
        ]

    def __str__(self):
        return f"Pago F29 {self.declaration.tax_period} - ${self.amount:,.0f}"


_MATCH_AMOUNT = {"max_digits": 14, "decimal_places": 0, "null": True, "blank": True}


class FiscalMatch(models.Model):
    """Grupo de cuadre: un documento ERP con sus partes TUU y RCV."""

    class Direction(models.TextChoices):
        PURCHASE = "purchase", _("Compra")
        SALE = "sale", _("Venta")

    direction = models.CharField(_("Tipo"), max_length=10, choices=Direction.choices)
    invoice = models.ForeignKey(
        "billing.Invoice",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="fiscal_match_set",
        verbose_name=_("Documento ERP"),
    )
    rcv_linked_manually = models.BooleanField(_("RCV vinculado manualmente"), default=False)
    status = models.CharField(
        _("Estado"),
        max_length=20,
        choices=FiscalMatchStatus.choices,
        default=FiscalMatchStatus.PENDING,
        db_index=True,
    )
    erp_state = models.CharField(
        _("Estado ERP"), max_length=20, choices=PartState.choices, default=PartState.PENDING
    )
    tuu_state = models.CharField(
        _("Estado TUU"), max_length=20, choices=PartState.choices, default=PartState.PENDING
    )
    rcv_state = models.CharField(
        _("Estado RCV"), max_length=20, choices=PartState.choices, default=PartState.PENDING
    )
    dte_type = models.PositiveSmallIntegerField(_("Tipo DTE"), null=True, blank=True)
    issue_date = models.DateField(_("Fecha de emisión"), null=True, blank=True)
    fiscal_period = models.CharField(_("Período fiscal"), max_length=6, blank=True)
    counterparty_rut = models.CharField(_("RUT contraparte"), max_length=20, blank=True)
    erp_amount = models.DecimalField(_("Monto ERP"), **_MATCH_AMOUNT)
    tuu_amount = models.DecimalField(_("Monto TUU"), **_MATCH_AMOUNT)
    rcv_amount = models.DecimalField(_("Monto RCV"), **_MATCH_AMOUNT)
    issue_attempted_at = models.DateTimeField(_("Intento de emisión"), null=True, blank=True)
    issue_error = models.CharField(_("Error de emisión"), max_length=255, blank=True)
    notice = models.CharField(_("Aviso"), max_length=255, blank=True)
    closed_period_alert = models.BooleanField(_("Alerta de período cerrado"), default=False)
    evaluated_at = models.DateTimeField(_("Evaluado"), null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("Grupo de cuadre")
        verbose_name_plural = _("Grupos de cuadre")
        constraints = [
            models.UniqueConstraint(
                fields=["invoice"],
                condition=models.Q(invoice__isnull=False),
                name="fiscalmatch_invoice_uniq",
            ),
        ]
        indexes = [
            models.Index(fields=["direction", "status"], name="fiscalmatch_dir_status_idx"),
            models.Index(fields=["status", "issue_date"], name="fiscalmatch_status_date_idx"),
            models.Index(fields=["fiscal_period"], name="fiscalmatch_period_idx"),
        ]

    def __str__(self):
        return f"Cuadre {self.pk} ({self.direction}, {self.status})"


class FiscalMatchRun(models.Model):
    """Ejecución del motor de cuadre."""

    started_at = models.DateTimeField(_("Inicio"), auto_now_add=True)
    finished_at = models.DateTimeField(_("Fin"), null=True, blank=True)
    counts = models.JSONField(_("Conteos"), default=dict, blank=True)
    error = models.TextField(_("Error"), blank=True)

    class Meta:
        verbose_name = _("Ejecución de cuadre")
        verbose_name_plural = _("Ejecuciones de cuadre")
        ordering = ["-id"]

    @classmethod
    def latest_finished(cls) -> "FiscalMatchRun | None":
        return (
            cls.objects.filter(finished_at__isnull=False).order_by("-finished_at", "-id").first()
        )
