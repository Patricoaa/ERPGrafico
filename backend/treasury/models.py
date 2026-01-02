from django.db import models
from django.utils.translation import gettext_lazy as _
from accounting.models import Account, AccountType
from sales.models import SaleOrder, Customer
from purchasing.models import PurchaseOrder, Supplier


class Payment(models.Model):
    class Type(models.TextChoices):
        INBOUND = 'INBOUND', _('Entrante (Cobro)')
        OUTBOUND = 'OUTBOUND', _('Saliente (Pago)')

    class Method(models.TextChoices):
        CASH = 'CASH', _('Efectivo')
        CARD = 'CARD', _('Tarjeta')
        TRANSFER = 'TRANSFER', _('Transferencia')
        CREDIT = 'CREDIT', _('Crédito')
        OTHER = 'OTHER', _('Otro')

    payment_type = models.CharField(_("Tipo"), max_length=10, choices=Type.choices)
    payment_method = models.CharField(
        _("Método de Pago"), 
        max_length=20, 
        choices=Method.choices, # Changed to Method.choices to match the class name
        default=Method.CASH # Changed to Method.CASH to match the class name
    )
    
    # Financial Account (Replacing BankJournal)
    account = models.ForeignKey(
        Account, 
        on_delete=models.PROTECT, 
        related_name='payments',
        null=True, # Added null=True
        blank=True, # Added blank=True as null=True is present
        limit_choices_to={'account_type': AccountType.ASSET},
        verbose_name=_("Cuenta de Tesorería")
    )

    amount = models.DecimalField(_("Monto"), max_digits=12, decimal_places=2)
    date = models.DateField(_("Fecha"), auto_now_add=True)
    reference = models.CharField(_("Referencia"), max_length=100, blank=True)
    
    # Transfer details
    transaction_number = models.CharField(_("N° de Transacción"), max_length=100, blank=True, null=True)
    is_pending_registration = models.BooleanField(_("Transacción Pendiente de Registro"), default=False)
    
    # Partners (Optional generic link, simplified with direct FKs for now)
    customer = models.ForeignKey(Customer, on_delete=models.SET_NULL, null=True, blank=True, related_name='payments')
    supplier = models.ForeignKey(Supplier, on_delete=models.SET_NULL, null=True, blank=True, related_name='payments')
    
    # Allocation
    invoice = models.ForeignKey('billing.Invoice', on_delete=models.SET_NULL, null=True, blank=True, related_name='payments')
    sale_order = models.ForeignKey(SaleOrder, on_delete=models.SET_NULL, null=True, blank=True, related_name='payments')
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.SET_NULL, null=True, blank=True, related_name='payments')

    # Link to Accounting
    journal_entry = models.OneToOneField(
        'accounting.JournalEntry',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='payment'
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("Pago")
        verbose_name_plural = _("Pagos")

    def __str__(self):
        return f"{self.payment_type} - {self.amount} ({self.date})"
