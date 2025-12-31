from django.db import models
from django.utils.translation import gettext_lazy as _
from accounting.models import Account, AccountType
from sales.models import SaleOrder, Customer
from purchasing.models import PurchaseOrder, Supplier

class BankJournal(models.Model):
    name = models.CharField(_("Nombre"), max_length=100)
    code = models.CharField(_("Código"), max_length=20, unique=True)
    currency = models.CharField(_("Moneda"), max_length=3, default='CLP')
    
    # Linked financial account (Asset -> Bank/Cash)
    account = models.ForeignKey(
        Account, 
        on_delete=models.PROTECT, 
        limit_choices_to={'account_type': AccountType.ASSET},
        related_name='treasury_journals'
    )

    class Meta:
        verbose_name = _("Caja/Banco")
        verbose_name_plural = _("Cajas y Bancos")

    def __str__(self):
        return f"{self.name} ({self.currency})"

class Payment(models.Model):
    class Type(models.TextChoices):
        INBOUND = 'INBOUND', _('Entrante (Cobro)')
        OUTBOUND = 'OUTBOUND', _('Saliente (Pago)')

    payment_type = models.CharField(_("Tipo"), max_length=10, choices=Type.choices)
    journal = models.ForeignKey(BankJournal, on_delete=models.PROTECT, related_name='payments')
    amount = models.DecimalField(_("Monto"), max_digits=12, decimal_places=2)
    date = models.DateField(_("Fecha"), auto_now_add=True)
    reference = models.CharField(_("Referencia"), max_length=100, blank=True)
    
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
