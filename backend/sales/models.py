from django.db import models
from django.utils.translation import gettext_lazy as _
from core.models import User
from accounting.models import Account

class SaleOrder(models.Model):
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
    status = models.CharField(_("Estado"), max_length=20, choices=Status.choices, default=Status.CONFIRMED)
    payment_method = models.CharField(_("Método de Pago"), max_length=20, choices=PaymentMethod.choices, default=PaymentMethod.CREDIT)
    channel = models.CharField(_("Canal"), max_length=20, choices=Channel.choices, default=Channel.SYSTEM)
    
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
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='sale_order'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("Nota de Venta")
        verbose_name_plural = _("Notas de Venta")

    def __str__(self):
        return f"NV-{self.number} {self.customer.name}"
    
    def save(self, *args, **kwargs):
        if not self.number:
            # Simple auto-numbering
            last_order = SaleOrder.objects.all().order_by('id').last()
            if last_order:
                self.number = str(int(last_order.number) + 1).zfill(6)
            else:
                self.number = '000001'
        super().save(*args, **kwargs)

class SaleLine(models.Model):
    order = models.ForeignKey(SaleOrder, on_delete=models.CASCADE, related_name='lines')
    product = models.ForeignKey('inventory.Product', on_delete=models.PROTECT, related_name='sale_lines', null=True, blank=True)
    description = models.CharField(_("Descripción"), max_length=255)
    quantity = models.DecimalField(_("Cantidad"), max_digits=10, decimal_places=2, default=1)
    unit_price = models.DecimalField(_("Precio Unitario"), max_digits=12, decimal_places=2)
    tax_rate = models.DecimalField(_("Tasa Impuesto %"), max_digits=5, decimal_places=2, default=19.00) # Chile default
    
    subtotal = models.DecimalField(_("Subtotal"), max_digits=12, decimal_places=2, editable=False)
    
    # Track delivered quantity
    quantity_delivered = models.DecimalField(
        _("Cantidad Despachada"), 
        max_digits=10, 
        decimal_places=2, 
        default=0,
        help_text="Cantidad total despachada de esta línea"
    )

    def save(self, *args, **kwargs):
        self.subtotal = self.quantity * self.unit_price
        # Auto-fill description from product if not provided
        if self.product and not self.description:
            self.description = self.product.name
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

class SaleDelivery(models.Model):
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
    
    # Link to Accounting (for COGS entry)
    journal_entry = models.OneToOneField(
        'accounting.JournalEntry',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='sale_delivery'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = _("Despacho de Venta")
        verbose_name_plural = _("Despachos de Venta")
        ordering = ['-delivery_date', '-created_at']
    
    def __str__(self):
        return f"Despacho-{self.number} (NV-{self.sale_order.number})"
    
    def save(self, *args, **kwargs):
        if not self.number:
            last_delivery = SaleDelivery.objects.all().order_by('id').last()
            if last_delivery and last_delivery.number.isdigit():
                self.number = str(int(last_delivery.number) + 1).zfill(6)
            else:
                self.number = '000001'
        super().save(*args, **kwargs)

class SaleDeliveryLine(models.Model):
    """
    Individual line of a delivery.
    Links to the original sale line and tracks quantity delivered.
    """
    delivery = models.ForeignKey(SaleDelivery, on_delete=models.CASCADE, related_name='lines')
    sale_line = models.ForeignKey(SaleLine, on_delete=models.PROTECT, related_name='delivery_lines')
    product = models.ForeignKey('inventory.Product', on_delete=models.PROTECT, related_name='delivery_lines')
    
    quantity_delivered = models.DecimalField(
        _("Cantidad Despachada"), 
        max_digits=10, 
        decimal_places=2,
        help_text="Cantidad despachada en este despacho"
    )
    
    # Link to Stock Move
    stock_move = models.OneToOneField(
        'inventory.StockMove',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='sale_delivery_line'
    )
    
    # Cost tracking for COGS
    unit_cost = models.DecimalField(
        _("Costo Unitario"), 
        max_digits=12, 
        decimal_places=2,
        help_text="Costo unitario del producto al momento del despacho"
    )
    total_cost = models.DecimalField(
        _("Costo Total"), 
        max_digits=12, 
        decimal_places=2,
        editable=False
    )
    
    class Meta:
        verbose_name = _("Línea de Despacho")
        verbose_name_plural = _("Líneas de Despacho")
    
    def __str__(self):
        return f"{self.product.code} x {self.quantity_delivered}"
    
    def save(self, *args, **kwargs):
        self.total_cost = self.quantity_delivered * self.unit_cost
        super().save(*args, **kwargs)
