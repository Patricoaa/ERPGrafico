import re
from django.db import models
from django.utils import timezone
from core.utils import get_current_date
from django.utils.translation import gettext_lazy as _
from django.core.validators import MinValueValidator
from core.models import User, TransactionalDocument
from accounting.models import Account, AccountType
from inventory.models import Product, Warehouse
from core.mixins import TotalsCalculationMixin
from core.strategies.totals import NetFirstTotals
from simple_history.models import HistoricalRecords
from core.services import SequenceService
from decimal import Decimal

class PurchaseOrder(TransactionalDocument, TotalsCalculationMixin):
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', _('Borrador')
        CONFIRMED = 'CONFIRMED', _('Confirmado')
        RECEIVED = 'RECEIVED', _('Recibido')
        INVOICED = 'INVOICED', _('Facturado')
        PAID = 'PAID', _('Pagado')
        CANCELLED = 'CANCELLED', _('Anulado')

    class ReceivingStatus(models.TextChoices):
        PENDING = 'PENDING', _('Pendiente')
        PARTIAL = 'PARTIAL', _('Parcial')
        RECEIVED = 'RECEIVED', _('Recibido')

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._initial_status = self.status

    class PaymentMethod(models.TextChoices):
        CASH = 'CASH', _('Efectivo')
        CARD = 'CARD', _('Tarjeta')
        TRANSFER = 'TRANSFER', _('Transferencia')
        CREDIT = 'CREDIT', _('Crédito')

    # T-17 — Strategy Pattern (P-02.A): reemplaza el antipatrón __class__.__name__
    totals_strategy = NetFirstTotals

    # status: redeclarado con choices y default concretos
    status = models.CharField(_("Estado"), max_length=20, choices=Status.choices, default=Status.DRAFT)
    # journal_entry: redeclarado para exponer reverso 'purchase_order' (el abstracto usa '+')
    journal_entry = models.OneToOneField(
        'accounting.JournalEntry',
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name='purchase_order',
    )

    supplier_reference = models.CharField(_("Referencia Proveedor"), max_length=50, blank=True, help_text="Ej: Nro Factura Proveedor")
    supplier = models.ForeignKey('contacts.Contact', on_delete=models.PROTECT, related_name='purchase_orders')
    date = models.DateField(_("Fecha"), default=get_current_date)
    payment_method = models.CharField(_("Método de Pago"), max_length=20, choices=PaymentMethod.choices, default=PaymentMethod.CREDIT)
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name='purchases', help_text="Bodega de recepción", null=True, blank=True)

    # Receiving fields
    receiving_status = models.CharField(
        _("Estado de Recepción"),
        max_length=20,
        choices=ReceivingStatus.choices,
        default=ReceivingStatus.PENDING
    )
    receipt_date = models.DateField(_("Fecha de Recepción Planificada"), null=True, blank=True)

    # Links
    work_order = models.ForeignKey(
        'production.WorkOrder',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='purchase_orders',
        verbose_name=_("Orden de Trabajo")
    )

    class Meta:
        verbose_name = _("Orden de compras y servicios")
        verbose_name_plural = _("Ordenes de compras y servicios")

    def __str__(self):
        return f"{self.display_id} {self.supplier.name}"
    
    @property
    def display_id(self):
        return f"OCS-{self.number}"
    
    @property
    def effective_total(self):
        """Returns the net value of the order considering all posted notes (ND increase, NC decrease).
        
        Convention: both POSTED (published) and PAID (settled) invoices count as active documents.
        DRAFT and CANCELLED invoices are excluded from this calculation.
        """
        from billing.models import Invoice
        ACTIVE_STATUSES = [Invoice.Status.POSTED, Invoice.Status.PAID]
        invoices = self.invoices.filter(status__in=ACTIVE_STATUSES)
        if not invoices.exists():
            return self.total

        net = Decimal('0')
        # If we have a finalized invoice flow, use the sum of documents.
        # Otherwise, use original total as base if no primary invoice exists.
        primary_types = [
            Invoice.DTEType.FACTURA, 
            Invoice.DTEType.FACTURA_EXENTA,
            Invoice.DTEType.BOLETA,
            Invoice.DTEType.BOLETA_EXENTA,
            Invoice.DTEType.PURCHASE_INV
        ]
        has_primary = invoices.filter(dte_type__in=primary_types).exists()
        
        if not has_primary:
            base: Decimal = self.total
        else:
            base: Decimal = Decimal('0')
            
        for inv in invoices:
            if inv.dte_type in primary_types or inv.dte_type == Invoice.DTEType.NOTA_DEBITO:
                base += Decimal(str(inv.total))
            elif inv.dte_type == Invoice.DTEType.NOTA_CREDITO:
                base -= Decimal(str(inv.total))
        return base

    @property
    def total_paid(self):
        """Calculates the total amount paid for this order (excluding Note-specific payments)"""
        # Exclude payments specific to Notes (NC/ND) to keep PO Hub status pure
        payments = self.payments.all()
        valid_payments = [
            p for p in payments 
            if not (p.invoice and p.invoice.dte_type in ['NOTA_CREDITO', 'NOTA_DEBITO'])
        ]
        return sum(p.amount for p in valid_payments)

    @property
    def pending_amount(self):
        """Calculates the remaining amount to be paid based on Primary Invoices or Total"""
        primary_invoices = self.invoices.filter(
            dte_type__in=['FACTURA', 'BOLETA', 'PURCHASE_INV']
        ).exclude(status='CANCELLED')
        
        if primary_invoices.exists():
            base_total = sum(inv.total for inv in primary_invoices)
        else:
            base_total = self.total
            
        return base_total - self.total_paid

    def save(self, *args, **kwargs):
        is_new = not self.pk
        if is_new:
            self.number = SequenceService.get_next_number(PurchaseOrder)
        
        # Check for transition to PAID to advance subscriptions
        # Transition happens if it was NOT paid and now IS paid, or if it's NEW and paid
        is_paying = (self.status == self.Status.PAID and (is_new or self._initial_status != self.Status.PAID))
        
        super().save(*args, **kwargs)
        
        if is_paying:
            self._handle_subscription_advancement()
        
        self._initial_status = self.status

    def _handle_subscription_advancement(self):
        """
        Check if this PO is associated with a subscription and advance its payment date.
        """
        if not self.notes:
            return
            
        # Look for subscription_id and period_date in notes
        # Format: [METADATA] subscription_id=X, period_date=YYYY-MM-DD
        sub_id_match = re.search(r'subscription_id=(\d+)', self.notes)
        period_match = re.search(r'period_date=(\d{4}-\d{2}-\d{2})', self.notes)
        
        if sub_id_match:
            try:
                subscription_id = int(sub_id_match.group(1))
                from inventory.models import Subscription
                from inventory.subscription_service import SubscriptionService
                
                sub = Subscription.objects.filter(id=subscription_id).first()
                if sub:
                    # Determine current next_payment_date from metadata in note to ensure we don't double advance
                    # if for some reason multiple POs were paid.
                    # Actually, SubscriptionService.calculate_next_payment_date uses sub.next_payment_date by default.
                    
                    old_date = sub.next_payment_date
                    new_date = SubscriptionService.calculate_next_payment_date(sub)
                    
                    sub.next_payment_date = new_date
                    sub.save()
                    print(f"Subscription {sub.id} advanced from {old_date} to {new_date} due to PO {self.number} payment.")
            except Exception as e:
                print(f"Error advancing subscription for PO {self.number}: {str(e)}")

class PurchaseLine(models.Model):
    order = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name='lines')
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name='purchase_lines')
    quantity = models.DecimalField(_("Cantidad"), max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])
    uom = models.ForeignKey(
        'inventory.UoM', 
        on_delete=models.PROTECT, 
        null=True, blank=True, 
        related_name='purchase_lines',
        verbose_name=_("Unidad")
    )
    unit_cost = models.DecimalField(_("Costo Unitario"), max_digits=12, decimal_places=0, validators=[MinValueValidator(0)])
    tax_rate = models.DecimalField(_("Tasa Impuesto %"), max_digits=5, decimal_places=2, default=19.00, validators=[MinValueValidator(0)])
    
    subtotal = models.DecimalField(_("Subtotal"), max_digits=12, decimal_places=0, editable=False)
    
    # Track received quantity
    quantity_received = models.DecimalField(
        _("Cantidad Recibida"), 
        max_digits=10, 
        decimal_places=2, 
        default=0,
        validators=[MinValueValidator(0)],
        help_text="Cantidad total recibida de esta línea"
    )

    related_note = models.ForeignKey(
        'billing.Invoice',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='note_purchase_lines',
        help_text="Nota que originó esta línea adicional"
    )

    def calculate_subtotal(self):
        self.subtotal = self.quantity * self.unit_cost

    def save(self, *args, **kwargs):
        self.calculate_subtotal()
        
        # Validation: UoM Category must match product category
        if self.product and self.uom and self.product.uom:
            if self.product.uom.category_id != self.uom.category_id:
                from django.core.exceptions import ValidationError
                raise ValidationError(f"La unidad {self.uom.name} no pertenece a la categoría {self.product.uom.category.name}")

        super().save(*args, **kwargs)
    
    @property
    def quantity_pending(self):
        """Returns the quantity still pending receipt"""
        return self.quantity - self.quantity_received

class PurchaseReceipt(models.Model, TotalsCalculationMixin):
    """
    Represents a receipt of a purchase order.
    Can be partial or complete.
    """
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', _('Borrador')
        CONFIRMED = 'CONFIRMED', _('Confirmado')
        CANCELLED = 'CANCELLED', _('Anulado')
    
    number = models.CharField(_("Número"), max_length=20, unique=True, editable=False)
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.PROTECT, related_name='receipts')
    warehouse = models.ForeignKey(
        Warehouse, 
        on_delete=models.PROTECT, 
        related_name='purchase_receipts',
        help_text="Bodega de recepción"
    )
    
    receipt_date = models.DateField(_("Fecha de Recepción"))
    delivery_reference = models.CharField(_("Referencia de Despacho/Guía"), max_length=100, blank=True)
    status = models.CharField(_("Estado"), max_length=20, choices=Status.choices, default=Status.DRAFT)
    notes = models.TextField(_("Notas"), blank=True)
    
    # Link to Accounting (if needed for cost adjustments or accruals)
    journal_entry = models.OneToOneField(
        'accounting.JournalEntry',
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name='purchase_receipt'
    )

    # Optional link to the Credit/Debit Note if issued
    related_note = models.ForeignKey(
        'billing.Invoice',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='purchase_receipts'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    history = HistoricalRecords()
    
    class Meta:
        verbose_name = _("Recepción de Compra")
        verbose_name_plural = _("Recepciones de Compra")
        ordering = ['-id']
    
    def __str__(self):
        return f"{self.display_id} (OCS-{self.purchase_order.number})"
    
    @property
    def display_id(self):
        return f"REC-{self.number}"
    
    def save(self, *args, **kwargs):
        if not self.number:
            self.number = SequenceService.get_next_number(PurchaseReceipt)
        super().save(*args, **kwargs)

class PurchaseReceiptLine(models.Model):
    """
    Individual line of a receipt.
    Links to the original purchase line and tracks quantity received and cost.
    """
    receipt = models.ForeignKey(PurchaseReceipt, on_delete=models.CASCADE, related_name='lines')
    purchase_line = models.ForeignKey(PurchaseLine, on_delete=models.PROTECT, related_name='receipt_lines')
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name='receipt_lines')
    
    quantity_received = models.DecimalField(
        _("Cantidad Recibida"), 
        max_digits=10, 
        decimal_places=2,
        validators=[MinValueValidator(0)],
        help_text="Cantidad recibida en esta recepción"
    )

    uom = models.ForeignKey(
        'inventory.UoM',
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name='receipt_lines',
        verbose_name=_("Unidad")
    )
    
    # Link to Stock Move
    stock_move = models.OneToOneField(
        'inventory.StockMove',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='purchase_receipt_line'
    )
    
    # Cost tracking (allows updating cost price upon receipt)
    unit_cost = models.DecimalField(
        _("Costo Unitario Real"), 
        max_digits=12, 
        decimal_places=0,
        validators=[MinValueValidator(0)],
        help_text="Costo unitario real al momento de la recepción"
    )
    total_cost = models.DecimalField(
        _("Costo Total"), 
        max_digits=12, 
        decimal_places=0,
        editable=False
    )
    
    class Meta:
        verbose_name = _("Línea de Recepción")
        verbose_name_plural = _("Líneas de Recepción")
    
    def __str__(self):
        return f"{self.product.code} x {self.quantity_received}"
    
    def calculate_total_cost(self):
        self.total_cost = self.quantity_received * self.unit_cost

    def save(self, *args, **kwargs):
        self.calculate_total_cost()
        super().save(*args, **kwargs)

class PurchaseReturn(models.Model, TotalsCalculationMixin):
    """
    Represents a return of goods to a supplier (linked to a Purchase Order).
    Used to process logistics before or after a Credit Note.
    """
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', _('Borrador')
        CONFIRMED = 'CONFIRMED', _('Confirmado') # Stock moves created
        CANCELLED = 'CANCELLED', _('Anulado')
    
    number = models.CharField(_("Número"), max_length=20, unique=True, editable=False)
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.PROTECT, related_name='returns')
    warehouse = models.ForeignKey(
        Warehouse, 
        on_delete=models.PROTECT, 
        related_name='purchase_returns',
        help_text="Bodega de origen"
    )
    
    date = models.DateField(_("Fecha de Devolución"))
    status = models.CharField(_("Estado"), max_length=20, choices=Status.choices, default=Status.DRAFT)
    notes = models.TextField(_("Notas"), blank=True)
    
    # Financial Totals (Reference value of returned goods)
    total_net = models.DecimalField(_("Neto"), max_digits=12, decimal_places=0, default=0)
    total_tax = models.DecimalField(_("Impuesto"), max_digits=12, decimal_places=0, default=0)
    total = models.DecimalField(_("Total"), max_digits=12, decimal_places=0, default=0)
    total_cost = models.DecimalField(_("Costo Total (COGS Reverso)"), max_digits=12, decimal_places=0, default=0)

    # Link to Accounting (for COGS reversal entry if purchase was expensed)
    journal_entry = models.OneToOneField(
        'accounting.JournalEntry',
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name='purchase_return'
    )
    
    # Optional link to the Credit Note if issued
    credit_note = models.ForeignKey(
        'billing.Invoice',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='purchase_returns'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    history = HistoricalRecords()
    
    class Meta:
        verbose_name = _("Devolución de Compra")
        verbose_name_plural = _("Devoluciones de Compra")
        ordering = ['-id']
    
    def __str__(self):
        return f"{self.display_id} (OCS-{self.purchase_order.number})"
    
    @property
    def display_id(self):
        return f"DEV-{self.number}"
    
    def save(self, *args, **kwargs):
        if not self.number:
            self.number = SequenceService.get_next_number(PurchaseReturn)
        super().save(*args, **kwargs)

class PurchaseReturnLine(models.Model):
    return_doc = models.ForeignKey(PurchaseReturn, on_delete=models.CASCADE, related_name='lines')
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name='purchase_return_lines')
    uom = models.ForeignKey('inventory.UoM', on_delete=models.PROTECT, related_name='purchase_return_lines', null=True, blank=True)
    
    quantity = models.DecimalField(
        _("Cantidad"), 
        max_digits=10, 
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)]
    )
    
    # Value reference
    unit_cost = models.DecimalField(_("Costo Unitario"), max_digits=12, decimal_places=0, default=0)
    total_cost = models.DecimalField(_("Costo Total"), max_digits=12, decimal_places=0, editable=False, default=0)
    
    # Link to Stock Move
    stock_move = models.OneToOneField(
        'inventory.StockMove',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='purchase_return_line'
    )
    
    class Meta:
        verbose_name = _("Línea de Devolución de Compra")
        verbose_name_plural = _("Líneas de Devolución de Compra")
    
    def calculate_total_cost(self):
        self.total_cost = self.quantity * self.unit_cost

    def save(self, *args, **kwargs):
        self.calculate_total_cost()
        super().save(*args, **kwargs)
