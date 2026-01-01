from django.db import models
from django.utils.translation import gettext_lazy as _
from core.models import User
from accounting.models import Account

class Customer(models.Model):
    name = models.CharField(_("Nombre / Razón Social"), max_length=255)
    tax_id = models.CharField(_("RUT/Tax ID"), max_length=20, unique=True)
    email = models.EmailField(_("Email"), blank=True)
    phone = models.CharField(_("Teléfono"), max_length=20, blank=True)
    address = models.TextField(_("Dirección"), blank=True)
    
    # Accounting link (optional, for specific AR accounts)
    account_receivable = models.ForeignKey(
        Account, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='customer_receivables',
        limit_choices_to={'account_type': 'ASSET'}
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("Cliente")
        verbose_name_plural = _("Clientes")

    def __str__(self):
        return f"{self.name} ({self.tax_id})"

class SaleOrder(models.Model):
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', _('Borrador')
        CONFIRMED = 'CONFIRMED', _('Confirmado')
        INVOICED = 'INVOICED', _('Facturado')
        PAID = 'PAID', _('Pagado')
        CANCELLED = 'CANCELLED', _('Anulado')

    class Channel(models.TextChoices):
        SYSTEM = 'SYSTEM', _('Sistema')
        POS = 'POS', _('Punto de Venta (POS)')

    class PaymentMethod(models.TextChoices):
        CASH = 'CASH', _('Efectivo')
        CARD = 'CARD', _('Tarjeta')
        TRANSFER = 'TRANSFER', _('Transferencia')
        CREDIT = 'CREDIT', _('Crédito')

    number = models.CharField(_("Número"), max_length=20, unique=True, editable=False)
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name='orders')
    date = models.DateField(_("Fecha"), auto_now_add=True)
    status = models.CharField(_("Estado"), max_length=20, choices=Status.choices, default=Status.CONFIRMED)
    payment_method = models.CharField(_("Método de Pago"), max_length=20, choices=PaymentMethod.choices, default=PaymentMethod.CREDIT)
    channel = models.CharField(_("Canal"), max_length=20, choices=Channel.choices, default=Channel.SYSTEM)
    
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

    def save(self, *args, **kwargs):
        self.subtotal = self.quantity * self.unit_price
        # Auto-fill description from product if not provided
        if self.product and not self.description:
            self.description = self.product.name
        super().save(*args, **kwargs)
        # Trigger total update on parent would be good here
