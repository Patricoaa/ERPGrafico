from django.db import models
from django.utils.translation import gettext_lazy as _
from core.models import User
from accounting.models import Account, AccountType
from inventory.models import Product, Warehouse
from core.mixins import TotalsCalculationMixin
from core.services import SequenceService
from decimal import Decimal

class PurchaseOrder(models.Model, TotalsCalculationMixin):
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

    class PaymentMethod(models.TextChoices):
        CASH = 'CASH', _('Efectivo')
        CARD = 'CARD', _('Tarjeta')
        TRANSFER = 'TRANSFER', _('Transferencia')
        CREDIT = 'CREDIT', _('Crédito')

    number = models.CharField(_("Número Interno"), max_length=20, unique=True, editable=False)
    supplier_reference = models.CharField(_("Referencia Proveedor"), max_length=50, blank=True, help_text="Ej: Nro Factura Proveedor")
    
    supplier = models.ForeignKey('contacts.Contact', on_delete=models.PROTECT, related_name='purchase_orders')
    date = models.DateField(_("Fecha"), auto_now_add=True)
    status = models.CharField(_("Estado"), max_length=20, choices=Status.choices, default=Status.DRAFT)
    payment_method = models.CharField(_("Método de Pago"), max_length=20, choices=PaymentMethod.choices, default=PaymentMethod.CREDIT)
    
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name='purchases', help_text="Bodega de recepción", null=True, blank=True)
    notes = models.TextField(_("Notas"), blank=True)
    
    # Receiving fields
    receiving_status = models.CharField(
        _("Estado de Recepción"), 
        max_length=20, 
        choices=ReceivingStatus.choices, 
        default=ReceivingStatus.PENDING
    )
    receipt_date = models.DateField(_("Fecha de Recepción Planificada"), null=True, blank=True)

    total_net = models.DecimalField(_("Neto"), max_digits=12, decimal_places=0, default=0)
    total_tax = models.DecimalField(_("Impuesto"), max_digits=12, decimal_places=0, default=0)
    total = models.DecimalField(_("Total"), max_digits=12, decimal_places=0, default=0)

    # Links
    work_order = models.ForeignKey(
        'production.WorkOrder', 
        on_delete=models.SET_NULL, 
        null=True, blank=True, 
        related_name='purchase_orders',
        verbose_name=_("Orden de Trabajo")
    )
    
    journal_entry = models.OneToOneField(
        'accounting.JournalEntry',
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name='purchase_order'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

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
        """Returns the net value of the order considering all posted notes (ND increase, NC decrease)"""
        invoices = self.invoices.filter(status='POSTED')
        if not invoices.exists():
            return self.total
            
        from billing.models import Invoice
        net = Decimal('0')
        # If we have a finalized invoice flow, use the sum of documents.
        # Otherwise, use original total as base if no primary invoice exists.
        has_primary = invoices.filter(dte_type__in=[Invoice.DTEType.FACTURA, Invoice.DTEType.PURCHASE_INV]).exists()
        
        if not has_primary:
            base = self.total
        else:
            base = Decimal('0')
            
        for inv in invoices:
            if inv.dte_type in [Invoice.DTEType.FACTURA, Invoice.DTEType.NOTA_DEBITO, Invoice.DTEType.PURCHASE_INV]:
                base += inv.total
            elif inv.dte_type == Invoice.DTEType.NOTA_CREDITO:
                base -= inv.total
        return base

    def save(self, *args, **kwargs):
        if not self.number:
            self.number = SequenceService.get_next_number(PurchaseOrder)
        super().save(*args, **kwargs)

class PurchaseLine(models.Model):
    order = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name='lines')
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name='purchase_lines')
    quantity = models.DecimalField(_("Cantidad"), max_digits=10, decimal_places=2)
    uom = models.ForeignKey(
        'inventory.UoM', 
        on_delete=models.PROTECT, 
        null=True, blank=True, 
        related_name='purchase_lines',
        verbose_name=_("Unidad")
    )
    unit_cost = models.DecimalField(_("Costo Unitario"), max_digits=12, decimal_places=0)
    tax_rate = models.DecimalField(_("Tasa Impuesto %"), max_digits=5, decimal_places=2, default=19.00)
    
    subtotal = models.DecimalField(_("Subtotal"), max_digits=12, decimal_places=0, editable=False)
    
    # Track received quantity
    quantity_received = models.DecimalField(
        _("Cantidad Recibida"), 
        max_digits=10, 
        decimal_places=2, 
        default=0,
        help_text="Cantidad total recibida de esta línea"
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
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = _("Recepción de Compra")
        verbose_name_plural = _("Recepciones de Compra")
        ordering = ['-receipt_date', '-created_at']
    
    def __str__(self):
        return f"{self.display_id} (OCS-{self.purchase_order.number})"
    
    @property
    def display_id(self):
        return f"MOV-{self.number}"
    
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
