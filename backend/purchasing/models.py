from django.db import models
from django.utils.translation import gettext_lazy as _
from core.models import User
from accounting.models import Account, AccountType
from inventory.models import Product, Warehouse

class Supplier(models.Model):
    name = models.CharField(_("Nombre / Razón Social"), max_length=255)
    tax_id = models.CharField(_("RUT/Tax ID"), max_length=20, unique=True)
    contact_name = models.CharField(_("Nombre Contacto"), max_length=100, blank=True)
    email = models.EmailField(_("Email"), blank=True)
    phone = models.CharField(_("Teléfono"), max_length=20, blank=True)
    address = models.TextField(_("Dirección"), blank=True)
    
    # Financials
    payable_account = models.ForeignKey(
        Account, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='supplier_payables',
        limit_choices_to={'account_type': AccountType.LIABILITY}
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("Proveedor")
        verbose_name_plural = _("Proveedores")

    def __str__(self):
        return self.name

class PurchaseOrder(models.Model):
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', _('Borrador')
        CONFIRMED = 'CONFIRMED', _('Confirmado')
        RECEIVED = 'RECEIVED', _('Recibido')
        INVOICED = 'INVOICED', _('Facturado')
        PAID = 'PAID', _('Pagado')
        CANCELLED = 'CANCELLED', _('Anulado')

    number = models.CharField(_("Número Interno"), max_length=20, unique=True, editable=False)
    supplier_reference = models.CharField(_("Referencia Proveedor"), max_length=50, blank=True, help_text="Ej: Nro Factura Proveedor")
    
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name='orders')
    date = models.DateField(_("Fecha"), auto_now_add=True)
    status = models.CharField(_("Estado"), max_length=20, choices=Status.choices, default=Status.DRAFT)
    
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name='purchases', help_text="Bodega de recepción")
    notes = models.TextField(_("Notas"), blank=True)

    total_net = models.DecimalField(_("Neto"), max_digits=12, decimal_places=2, default=0)
    total_tax = models.DecimalField(_("Impuesto"), max_digits=12, decimal_places=2, default=0)
    total = models.DecimalField(_("Total"), max_digits=12, decimal_places=2, default=0)

    # Links
    journal_entry = models.OneToOneField(
        'accounting.JournalEntry',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='purchase_order'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("Orden de Compra")
        verbose_name_plural = _("Ordenes de Compra")

    def __str__(self):
        return f"OC-{self.number} {self.supplier.name}"
    
    def save(self, *args, **kwargs):
        if not self.number:
            last_order = PurchaseOrder.objects.all().order_by('id').last()
            if last_order and last_order.number.isdigit():
                self.number = str(int(last_order.number) + 1).zfill(6)
            else:
                self.number = '000001'
        super().save(*args, **kwargs)

class PurchaseLine(models.Model):
    order = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name='lines')
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name='purchase_lines')
    quantity = models.DecimalField(_("Cantidad"), max_digits=10, decimal_places=2)
    unit_cost = models.DecimalField(_("Costo Unitario"), max_digits=12, decimal_places=2)
    tax_rate = models.DecimalField(_("Tasa Impuesto %"), max_digits=5, decimal_places=2, default=19.00)
    
    subtotal = models.DecimalField(_("Subtotal"), max_digits=12, decimal_places=2, editable=False)

    def save(self, *args, **kwargs):
        self.subtotal = self.quantity * self.unit_cost
        super().save(*args, **kwargs)
