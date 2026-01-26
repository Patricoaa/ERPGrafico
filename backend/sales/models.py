from django.db import models
from django.utils.translation import gettext_lazy as _
from django.core.validators import MinValueValidator
from core.models import User
from accounting.models import Account
from core.mixins import TotalsCalculationMixin
from core.services import SequenceService
from simple_history.models import HistoricalRecords

class SaleOrder(models.Model, TotalsCalculationMixin):
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', _('Borrador')
        CONFIRMED = 'CONFIRMED', _('Confirmado')
        INVOICED = 'INVOICED', _('Facturado')
        PAID = 'PAID', _('Pagado')
        CANCELLED = 'CANCELLED', _('Anulado')
    
    class DeliveryStatus(models.TextChoices):
        PENDING = 'PENDING', _('Pendiente')
        PARTIAL = 'PARTIAL', _('Parcial')
        DELIVERED = 'DELIVERED', _('Entregado')

    class Channel(models.TextChoices):
        SYSTEM = 'SYSTEM', _('Sistema')
        POS = 'POS', _('Punto de Venta (POS)')

    class PaymentMethod(models.TextChoices):
        CASH = 'CASH', _('Efectivo')
        CARD = 'CARD', _('Tarjeta')
        TRANSFER = 'TRANSFER', _('Transferencia')
        CREDIT = 'CREDIT', _('Crédito')

    number = models.CharField(_("Número"), max_length=20, unique=True, editable=False)
    customer = models.ForeignKey('contacts.Contact', on_delete=models.PROTECT, related_name='sale_orders')
    date = models.DateField(_("Fecha"), auto_now_add=True)
    status = models.CharField(_("Estado"), max_length=20, choices=Status.choices, default=Status.DRAFT)
    payment_method = models.CharField(_("Método de Pago"), max_length=20, choices=PaymentMethod.choices, default=PaymentMethod.CREDIT)
    channel = models.CharField(_("Canal"), max_length=20, choices=Channel.choices, default=Channel.SYSTEM)
    
    history = HistoricalRecords()
    
    # Delivery fields
    delivery_status = models.CharField(
        _("Estado de Despacho"), 
        max_length=20, 
        choices=DeliveryStatus.choices, 
        default=DeliveryStatus.PENDING
    )
    delivery_date = models.DateField(_("Fecha de Entrega Planificada"), null=True, blank=True)
    immediate_dispatch = models.BooleanField(_("Despacho Inmediato"), default=False)
    
    salesperson = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    notes = models.TextField(_("Notas"), blank=True)
    
    total_net = models.DecimalField(_("Neto"), max_digits=12, decimal_places=2, default=0)
    total_tax = models.DecimalField(_("Impuesto"), max_digits=12, decimal_places=2, default=0)
    total = models.DecimalField(_("Total"), max_digits=12, decimal_places=2, default=0)

    # Link to Accounting
    journal_entry = models.OneToOneField(
        'accounting.JournalEntry',
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name='sale_order'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("Nota de Venta")
        verbose_name_plural = _("Notas de Venta")
        ordering = ['-id']

    def __str__(self):
        return f"{self.display_id} {self.customer.name}"
    
    @property
    def display_id(self):
        return f"NV-{self.number}"
    
    def save(self, *args, **kwargs):
        if not self.number:
            self.number = SequenceService.get_next_number(SaleOrder)
        super().save(*args, **kwargs)

class SaleLine(models.Model):
    order = models.ForeignKey(SaleOrder, on_delete=models.CASCADE, related_name='lines')
    first_name = models.CharField(_("Nombre"), max_length=100, blank=True) # Not relevant for context but matching context lines
    product = models.ForeignKey('inventory.Product', on_delete=models.PROTECT, related_name='sale_lines', null=True, blank=True)
    description = models.CharField(_("Descripción"), max_length=255)
    quantity = models.DecimalField(_("Cantidad"), max_digits=10, decimal_places=2, default=1, validators=[MinValueValidator(0)])
    uom = models.ForeignKey(
        'inventory.UoM', 
        on_delete=models.PROTECT, 
        null=True, blank=True,
        related_name='sale_lines',
        verbose_name=_("Unidad")
    )
    unit_price = models.DecimalField(_("Precio Unitario"), max_digits=12, decimal_places=0, validators=[MinValueValidator(0)])
    unit_price_gross = models.DecimalField(_("Precio Unitario Bruto"), max_digits=12, decimal_places=0, null=True, blank=True, validators=[MinValueValidator(0)])
    tax_rate = models.DecimalField(_("Tasa Impuesto %"), max_digits=5, decimal_places=2, default=19.00, validators=[MinValueValidator(0)]) # Chile default
    
    subtotal = models.DecimalField(_("Subtotal"), max_digits=12, decimal_places=0, editable=False)
    
    # Track delivered quantity
    quantity_delivered = models.DecimalField(
        _("Cantidad Despachada"), 
        max_digits=10, 
        decimal_places=2, 
        default=0,
        validators=[MinValueValidator(0)],
        help_text="Cantidad total despachada de esta línea"
    )

    manufacturing_data = models.JSONField(
        _("Datos de Fabricación"),
        null=True, blank=True,
        help_text=_("Metadatos capturados para fabricación avanzada (diseño, fechas, contactos, etc.)")
    )


    def calculate_subtotal(self):
        if self.unit_price_gross:
            self.subtotal = self.quantity * self.unit_price_gross
        else:
            self.subtotal = self.quantity * self.unit_price

    def save(self, *args, **kwargs):
        self.calculate_subtotal()
        # Auto-fill description from product if not provided
        if self.product and not self.description:
            self.description = self.product.name
        
        # Validation: UoM Category must match product category
        if self.product and self.uom and self.product.uom:
            if self.product.uom.category_id != self.uom.category_id:
                from django.core.exceptions import ValidationError
                raise ValidationError(f"La unidad {self.uom.name} no pertenece a la categoría {self.product.uom.category.name}")
        
        super().save(*args, **kwargs)
        # Trigger total update on parent would be good here
    
    @property
    def quantity_pending(self):
        """Returns the quantity still pending delivery"""
        return self.quantity - self.quantity_delivered

class SalesSettings(models.Model):
    restrict_stock_sales = models.BooleanField(
        _("Restringir Ventas Sin Stock"), 
        default=False,
        help_text=_("Si está activo, impide vender productos almacenables si no hay stock suficiente.")
    )

    class Meta:
        verbose_name = _("Configuración de Ventas")
        verbose_name_plural = _("Configuración de Ventas")

    def __str__(self):
        return "Configuración de Ventas"
# Append to sales/models.py - SaleDelivery and SaleDeliveryLine models

class SaleDelivery(models.Model, TotalsCalculationMixin):
    """
    Represents a delivery/dispatch of a sale order.
    Can be partial or complete.
    """
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', _('Borrador')
        CONFIRMED = 'CONFIRMED', _('Confirmado')
        CANCELLED = 'CANCELLED', _('Anulado')
    
    number = models.CharField(_("Número"), max_length=20, unique=True, editable=False)
    sale_order = models.ForeignKey(SaleOrder, on_delete=models.PROTECT, related_name='deliveries')
    warehouse = models.ForeignKey(
        'inventory.Warehouse', 
        on_delete=models.PROTECT, 
        related_name='sale_deliveries',
        help_text="Bodega desde donde se despacha"
    )
    
    delivery_date = models.DateField(_("Fecha de Despacho"))
    status = models.CharField(_("Estado"), max_length=20, choices=Status.choices, default=Status.DRAFT)
    notes = models.TextField(_("Notas"), blank=True)
    
    total_net = models.DecimalField(_("Neto"), max_digits=12, decimal_places=0, default=0)
    total_tax = models.DecimalField(_("Impuesto"), max_digits=12, decimal_places=0, default=0)
    total = models.DecimalField(_("Total"), max_digits=12, decimal_places=0, default=0)
    total_cost = models.DecimalField(_("Costo Total (COGS)"), max_digits=12, decimal_places=0, default=0)

    # Link to Accounting (for COGS entry)
    journal_entry = models.OneToOneField(
        'accounting.JournalEntry',
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name='sale_delivery'
    )

    # Optional link to the Credit/Debit Note if issued
    related_note = models.ForeignKey(
        'billing.Invoice',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='sale_deliveries'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    history = HistoricalRecords()
    
    class Meta:
        verbose_name = _("Despacho de Venta")
        verbose_name_plural = _("Despachos de Venta")
        ordering = ['-id']
    
    def __str__(self):
        return f"{self.display_id} (NV-{self.sale_order.number})"
    
    @property
    def display_id(self):
        return f"DES-{self.number}"
    
    def save(self, *args, **kwargs):
        if not self.number:
            self.number = SequenceService.get_next_number(SaleDelivery)
        super().save(*args, **kwargs)

class SaleDeliveryLine(models.Model):
    """
    Individual line of a delivery.
    Links to the original sale line and tracks quantity delivered.
    """
    delivery = models.ForeignKey(SaleDelivery, on_delete=models.CASCADE, related_name='lines')
    sale_line = models.ForeignKey(SaleLine, on_delete=models.PROTECT, related_name='delivery_lines')
    product = models.ForeignKey('inventory.Product', on_delete=models.PROTECT, related_name='delivery_lines')
    uom = models.ForeignKey('inventory.UoM', on_delete=models.PROTECT, related_name='delivery_lines', null=True, blank=True)
    
    quantity = models.DecimalField(
        _("Cantidad"), 
        max_digits=10, 
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
        help_text="Cantidad despachada en este despacho"
    )
    unit_price = models.DecimalField(_("Precio Unitario"), max_digits=12, decimal_places=0, default=0, validators=[MinValueValidator(0)])
    unit_price_gross = models.DecimalField(_("Precio Unitario Bruto"), max_digits=12, decimal_places=0, null=True, blank=True, validators=[MinValueValidator(0)])
    unit_cost = models.DecimalField(_("Costo Unitario"), max_digits=12, decimal_places=0, default=0, validators=[MinValueValidator(0)])
    subtotal = models.DecimalField(_("Subtotal"), max_digits=12, decimal_places=0, editable=False, default=0)
    total_cost = models.DecimalField(_("Costo Total"), max_digits=12, decimal_places=0, editable=False, default=0)
    
    # Link to Stock Move
    stock_move = models.OneToOneField(
        'inventory.StockMove',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='sale_delivery_line'
    )
    
    class Meta:
        verbose_name = _("Línea de Despacho")
        verbose_name_plural = _("Líneas de Despacho")
    
    def __str__(self):
        return f"{self.product.code} x {self.quantity}"
    
    def calculate_subtotal(self):
        if self.unit_price_gross:
            self.subtotal = self.quantity * self.unit_price_gross
        else:
            self.subtotal = self.quantity * self.unit_price
        self.total_cost = self.quantity * self.unit_cost

    def save(self, *args, **kwargs):
        self.calculate_subtotal()
        super().save(*args, **kwargs)

class SaleReturn(models.Model, TotalsCalculationMixin):
    """
    Represents a return of goods from a customer (linked to a Sale Order).
    Used to process logistics before or after a Credit Note.
    """
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', _('Borrador')
        CONFIRMED = 'CONFIRMED', _('Confirmado') # Stock moves created
        CANCELLED = 'CANCELLED', _('Anulado')
    
    number = models.CharField(_("Número"), max_length=20, unique=True, editable=False)
    sale_order = models.ForeignKey(SaleOrder, on_delete=models.PROTECT, related_name='returns')
    warehouse = models.ForeignKey(
        'inventory.Warehouse', 
        on_delete=models.PROTECT, 
        related_name='sale_returns',
        help_text="Bodega de recepción"
    )
    
    date = models.DateField(_("Fecha de Devolución"))
    status = models.CharField(_("Estado"), max_length=20, choices=Status.choices, default=Status.DRAFT)
    notes = models.TextField(_("Notas"), blank=True)
    
    # Financial Totals (Reference value of returned goods)
    total_net = models.DecimalField(_("Neto"), max_digits=12, decimal_places=0, default=0)
    total_tax = models.DecimalField(_("Impuesto"), max_digits=12, decimal_places=0, default=0)
    total = models.DecimalField(_("Total"), max_digits=12, decimal_places=0, default=0)
    total_cost = models.DecimalField(_("Costo Total (COGS Reverso)"), max_digits=12, decimal_places=0, default=0)

    # Link to Accounting (for COGS reversal entry)
    journal_entry = models.OneToOneField(
        'accounting.JournalEntry',
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name='sale_return'
    )
    
    # Optional link to the Credit Note if issued
    credit_note = models.ForeignKey(
        'billing.Invoice',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='sale_returns'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    history = HistoricalRecords()
    
    class Meta:
        verbose_name = _("Devolución de Venta")
        verbose_name_plural = _("Devoluciones de Venta")
        ordering = ['-id']
    
    def __str__(self):
        return f"{self.display_id} (NV-{self.sale_order.number})"
    
    @property
    def display_id(self):
        return f"DEV-{self.number}"
    
    def save(self, *args, **kwargs):
        if not self.number:
            self.number = SequenceService.get_next_number(SaleReturn)
        super().save(*args, **kwargs)

class SaleReturnLine(models.Model):
    return_doc = models.ForeignKey(SaleReturn, on_delete=models.CASCADE, related_name='lines')
    product = models.ForeignKey('inventory.Product', on_delete=models.PROTECT, related_name='return_lines')
    uom = models.ForeignKey('inventory.UoM', on_delete=models.PROTECT, related_name='return_lines', null=True, blank=True)
    
    quantity = models.DecimalField(
        _("Cantidad"), 
        max_digits=10, 
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)]
    )
    
    # Value reference
    unit_price = models.DecimalField(_("Precio Unitario"), max_digits=12, decimal_places=0, default=0)
    subtotal = models.DecimalField(_("Subtotal"), max_digits=12, decimal_places=0, editable=False, default=0)
    
    # Cost reference for COGS reversal
    unit_cost = models.DecimalField(_("Costo Unitario"), max_digits=12, decimal_places=0, default=0)
    total_cost = models.DecimalField(_("Costo Total"), max_digits=12, decimal_places=0, editable=False, default=0)
    
    # Link to Stock Move
    stock_move = models.OneToOneField(
        'inventory.StockMove',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='sale_return_line'
    )
    
    class Meta:
        verbose_name = _("Línea de Devolución")
        verbose_name_plural = _("Líneas de Devolución")
    
    def calculate_subtotal(self):
        self.subtotal = self.quantity * self.unit_price
        self.total_cost = self.quantity * self.unit_cost

    def save(self, *args, **kwargs):
        self.calculate_subtotal()
        super().save(*args, **kwargs)
