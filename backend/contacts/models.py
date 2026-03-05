from django.db import models
from django.utils.translation import gettext_lazy as _
from accounting.models import Account, AccountType
from simple_history.models import HistoricalRecords
from decimal import Decimal
from django.db.models import Sum


class Contact(models.Model):
    """
    Unified contact entity that can represent customers, suppliers, or both.
    Classification is determined dynamically based on associated documents.
    """
    name = models.CharField(_("Nombre / Razón Social"), max_length=255)
    tax_id = models.CharField(_("RUT/Tax ID"), max_length=20, unique=True)
    contact_name = models.CharField(_("Nombre Contacto"), max_length=100, blank=True)
    email = models.EmailField(_("Email"), blank=True)
    phone = models.CharField(_("Teléfono"), max_length=20, blank=True)
    address = models.TextField(_("Dirección"), blank=True)
    code = models.CharField(_("Código"), max_length=20, unique=True, editable=False, null=True)
    
    history = HistoricalRecords()
    
    # Accounting links
    account_receivable = models.ForeignKey(
        Account, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='contact_receivables',
        limit_choices_to={'account_type': AccountType.ASSET},
        verbose_name=_("Cuenta por Cobrar")
    )
    
    account_payable = models.ForeignKey(
        Account, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='contact_payables',
        limit_choices_to={'account_type': AccountType.LIABILITY},
        verbose_name=_("Cuenta por Pagar")
    )

    is_default_customer = models.BooleanField(_("Cliente por Defecto"), default=False)
    is_default_vendor = models.BooleanField(_("Proveedor por Defecto"), default=False)

    # Credit Rules
    credit_enabled = models.BooleanField(_("Crédito Habilitado"), default=False)
    credit_limit = models.DecimalField(_("Límite de Crédito"), max_digits=14, decimal_places=0, null=True, blank=True)
    credit_days = models.IntegerField(_("Días Plazo"), default=30, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def clean(self):
        # Validation for uniqueness is now handled automatically in save()
        pass

    def save(self, *args, **kwargs):
        from core.services import SequenceService
        if not self.code:
            self.code = SequenceService.get_next_number(Contact, field_name='code')

        # We handle the 'one default' rule here to act as a switch instead of a blocker
        if self.is_default_customer:
            Contact.objects.filter(is_default_customer=True).exclude(pk=self.pk).update(is_default_customer=False)
        
        if self.is_default_vendor:
            Contact.objects.filter(is_default_vendor=True).exclude(pk=self.pk).update(is_default_vendor=False)

        self.full_clean()
        super().save(*args, **kwargs)

    class Meta:
        verbose_name = _("Contacto")
        verbose_name_plural = _("Contactos")
        ordering = ['-id']

    def __str__(self):
        return f"{self.display_id} - {self.name} ({self.tax_id})"
    
    @property
    def display_id(self):
        if not self.code:
            return ""
        return f"C-{self.code}"
    
    @property
    def is_customer(self):
        """Returns True if this contact has any sale orders"""
        return self.sale_orders.exists()
    
    @property
    def is_supplier(self):
        """Returns True if this contact has any purchase orders"""
        return self.purchase_orders.exists()
    
    @property
    def contact_type(self):
        """
        Returns the contact type based on associated documents:
        - 'CUSTOMER': has sale orders only
        - 'SUPPLIER': has purchase orders only
        - 'BOTH': has both sale and purchase orders
        - 'RELATED': has related work orders but no sales/purchases
        - 'NONE': has no orders yet
        """
        has_sales = self.is_customer
        has_purchases = self.is_supplier
        has_related_work_orders = self.related_work_orders.exists()
        
        if has_sales and has_purchases:
            return 'BOTH'
        elif has_sales:
            return 'CUSTOMER'
        elif has_purchases:
            return 'SUPPLIER'
        elif has_related_work_orders:
            return 'RELATED'
        else:
            return 'NONE'

    @property
    def credit_balance_used(self) -> Decimal:
        """
        Calculates the amount of credit currently used by the contact.
        This includes all sale orders where the payment method is 'CREDIT', 
        excluding DRAFT and CANCELLED orders.
        The calculation is: sum of (order.effective_total - order.payments_net)
        """
        orders = self.sale_orders.exclude(status__in=['DRAFT', 'CANCELLED'])
        
        balance = Decimal('0')
        for order in orders:
            # Calculate net payments manually to avoid complex annotations here
            payments = order.payments.filter(is_pending_registration=False)
            paid_in = sum((p.amount for p in payments if p.movement_type == 'INBOUND'), Decimal('0'))
            paid_out = sum((p.amount for p in payments if p.movement_type == 'OUTBOUND'), Decimal('0'))
            payments_net = paid_in - paid_out
            
            order_balance = order.effective_total - payments_net
            if order_balance > Decimal('0'):
                balance += order_balance
                
        return balance

    @property
    def credit_available(self) -> Decimal:
        if not self.credit_limit:
            return Decimal('0')
        balance = self.credit_balance_used
        available = self.credit_limit - balance
        return available if available > 0 else Decimal('0')

