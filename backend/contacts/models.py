from django.db import models
from django.utils.translation import gettext_lazy as _
from accounting.models import Account, AccountType


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
        ordering = ['name']

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
        - 'NONE': has no orders yet
        """
        has_sales = self.is_customer
        has_purchases = self.is_supplier
        
        if has_sales and has_purchases:
            return 'BOTH'
        elif has_sales:
            return 'CUSTOMER'
        elif has_purchases:
            return 'SUPPLIER'
        else:
            return 'NONE'
