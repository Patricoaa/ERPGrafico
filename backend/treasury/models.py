from django.db import models
from django.utils.translation import gettext_lazy as _
from accounting.models import Account, AccountType
from sales.models import SaleOrder
from purchasing.models import PurchaseOrder


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
        choices=Method.choices,
        default=Method.CASH
    )
    
    # Account chosen by user (Bank/Cash Box)
    treasury_account = models.ForeignKey(
        'TreasuryAccount',
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name='pay_treasury',
        verbose_name=_("Cuenta de Tesorería")
    )

    # Resolved Financial Account (Snapshot or direct link)
    account = models.ForeignKey(
        Account, 
        on_delete=models.PROTECT, 
        related_name='pay_account',
        null=True, 
        blank=True,
        verbose_name=_("Cuenta Contable (Snapshot)")
    )

    amount = models.DecimalField(_("Monto"), max_digits=12, decimal_places=2)
    date = models.DateField(_("Fecha"), auto_now_add=True)
    reference = models.CharField(_("Referencia"), max_length=100, blank=True)
    
    # Transfer details
    transaction_number = models.CharField(_("N° de Transacción"), max_length=100, blank=True, null=True)
    is_pending_registration = models.BooleanField(_("Transacción Pendiente de Registro"), default=False)
    
    # Unified contact field (replaces separate customer/supplier fields)
    contact = models.ForeignKey('contacts.Contact', on_delete=models.SET_NULL, null=True, blank=True, related_name='payments')
    
    # Allocation
    invoice = models.ForeignKey('billing.Invoice', on_delete=models.SET_NULL, null=True, blank=True, related_name='payments')
    sale_order = models.ForeignKey(SaleOrder, on_delete=models.SET_NULL, null=True, blank=True, related_name='payments')
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.SET_NULL, null=True, blank=True, related_name='payments')

    # Link to Accounting
    journal_entry = models.OneToOneField(
        'accounting.JournalEntry',
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name='payment'
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("Pago")
        verbose_name_plural = _("Pagos")

    def __str__(self):
        prefix = 'ING' if self.payment_type == 'INBOUND' else 'EGR'
        return f"{prefix}-{str(self.id).zfill(5)}"


class TreasuryAccount(models.Model):
    class Type(models.TextChoices):
        BANK = 'BANK', _('Banco')
        CASH = 'CASH', _('Caja')

    name = models.CharField(_("Nombre"), max_length=100)
    code = models.CharField(_("Código"), max_length=20, blank=True, null=True)
    currency = models.CharField(_("Moneda"), max_length=3, default='CLP')
    
    # Linked financial account (Asset -> Bank/Cash)
    account = models.ForeignKey(
        Account, 
        on_delete=models.PROTECT, 
        limit_choices_to={'account_type': AccountType.ASSET},
        related_name='treasury_accounts',
        verbose_name=_("Cuenta Contable")
    )
    
    account_type = models.CharField(
        _("Tipo"), 
        max_length=10, 
        choices=Type.choices,
        default=Type.CASH
    )

    allows_cash = models.BooleanField(_("Permite Efectivo"), default=False)
    allows_card = models.BooleanField(_("Permite Tarjeta"), default=False)
    allows_transfer = models.BooleanField(_("Permite Transferencia"), default=False)

    class Meta:
        verbose_name = _("Cuenta de Tesorería")
        verbose_name_plural = _("Cuentas de Tesorería")

    def __str__(self):
        return f"{self.name} ({self.currency})"
