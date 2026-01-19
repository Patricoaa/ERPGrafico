from django.db import models
from django.utils.translation import gettext_lazy as _
from django.utils import timezone
from accounting.models import JournalEntry
from sales.models import SaleOrder
from purchasing.models import PurchaseOrder

class Invoice(models.Model):
    class DTEType(models.TextChoices):
        FACTURA = 'FACTURA', _('Factura Electrónica')
        BOLETA = 'BOLETA', _('Boleta Electrónica')
        PURCHASE_INV = 'PURCHASE_INV', _('Factura de Compra')
        NOTA_CREDITO = 'NOTA_CREDITO', _('Nota de Crédito')
        NOTA_DEBITO = 'NOTA_DEBITO', _('Nota de Débito')

    class Status(models.TextChoices):
        DRAFT = 'DRAFT', _('Borrador')
        POSTED = 'POSTED', _('Publicado')
        PAID = 'PAID', _('Pagado')
        CANCELLED = 'CANCELLED', _('Anulado')

    class PaymentMethod(models.TextChoices):
        CASH = 'CASH', _('Efectivo')
        CARD = 'CARD', _('Tarjeta')
        TRANSFER = 'TRANSFER', _('Transferencia')
        CREDIT = 'CREDIT', _('Crédito')

    dte_type = models.CharField(_("Tipo DTE"), max_length=20, choices=DTEType.choices)
    number = models.CharField(_("Folio"), max_length=20, blank=True)
    document_attachment = models.FileField(_("Adjunto de Documento"), upload_to='invoices/', null=True, blank=True)
    date = models.DateField(_("Fecha"), default=timezone.now)
    
    # Links
    sale_order = models.ForeignKey(SaleOrder, on_delete=models.SET_NULL, null=True, blank=True, related_name='invoices')
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.SET_NULL, null=True, blank=True, related_name='invoices')
    contact = models.ForeignKey('contacts.Contact', on_delete=models.SET_NULL, null=True, blank=True, related_name='invoices', verbose_name=_("Contacto"))
    
    status = models.CharField(_("Estado"), max_length=20, choices=Status.choices, default=Status.DRAFT)
    payment_method = models.CharField(_("Método de Pago"), max_length=20, choices=PaymentMethod.choices, default=PaymentMethod.CREDIT)

    # Totals
    total_net = models.DecimalField(_("Neto"), max_digits=12, decimal_places=0, default=0)
    total_tax = models.DecimalField(_("Impuesto"), max_digits=12, decimal_places=0, default=0)
    total = models.DecimalField(_("Total"), max_digits=12, decimal_places=0, default=0)

    # Accounting
    journal_entry = models.OneToOneField(
        JournalEntry,
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name='invoice'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("Factura/Boleta")
        verbose_name_plural = _("Facturas y Boletas")
        ordering = ['-id']

    def __str__(self):
        return self.display_id

    @property
    def display_id(self):
        prefix = 'FACT'
        if self.dte_type == 'NOTA_CREDITO': prefix = 'NC'
        elif self.dte_type == 'NOTA_DEBITO': prefix = 'NB'
        elif self.dte_type == 'BOLETA': prefix = 'BOL'
        return f"{prefix}-{self.number or 'Draft'}"
