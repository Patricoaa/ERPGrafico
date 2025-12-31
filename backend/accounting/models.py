from django.db import models
from django.utils.translation import gettext_lazy as _
from django.core.exceptions import ValidationError
from decimal import Decimal

class AccountType(models.TextChoices):
    ASSET = 'ASSET', _('Activo')
    LIABILITY = 'LIABILITY', _('Pasivo')
    EQUITY = 'EQUITY', _('Patrimonio')
    INCOME = 'INCOME', _('Ingresos')
    EXPENSE = 'EXPENSE', _('Gastos')

class Account(models.Model):
    code = models.CharField(_("Código"), max_length=20, unique=True, help_text="Ej: 1.1.01.001")
    name = models.CharField(_("Nombre"), max_length=255)
    account_type = models.CharField(_("Tipo"), max_length=20, choices=AccountType.choices)
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='children', verbose_name=_("Cuenta Padre"))
    is_reconcilable = models.BooleanField(_("Conciliable"), default=False)
    
    class Meta:
        ordering = ['code']
        verbose_name = _("Cuenta Contable")
        verbose_name_plural = _("Plan de Cuentas")

    def __str__(self):
        return f"{self.code} - {self.name}"

    def save(self, *args, **kwargs):
        if not self.code:
            from .models import AccountingSettings
            settings = AccountingSettings.objects.first()
            if settings:
                prefix = ""
                if self.parent:
                    prefix = self.parent.code + "."
                else:
                    if self.account_type == AccountType.ASSET: prefix = settings.asset_prefix
                    elif self.account_type == AccountType.LIABILITY: prefix = settings.liability_prefix
                    elif self.account_type == AccountType.EQUITY: prefix = settings.equity_prefix
                    elif self.account_type == AccountType.INCOME: prefix = settings.income_prefix
                    elif self.account_type == AccountType.EXPENSE: prefix = settings.expense_prefix
                    prefix += "." if prefix else ""

                # Find next sequence
                last_account = Account.objects.filter(code__startswith=prefix, parent=self.parent).order_by('-code').first()
                if last_account:
                    try:
                        last_part = last_account.code.split('.')[-1]
                        next_seq = int(last_part) + 1
                        self.code = prefix + str(next_seq).zfill(len(last_part))
                    except (ValueError, IndexError):
                        self.code = prefix + "1"
                else:
                    self.code = prefix + "1"
        
        super().save(*args, **kwargs)

class JournalEntry(models.Model):
    class State(models.TextChoices):
        DRAFT = 'DRAFT', _('Borrador')
        POSTED = 'POSTED', _('Publicado')
        CANCELLED = 'CANCELLED', _('Anulado')

    date = models.DateField(_("Fecha"))
    description = models.CharField(_("Descripción"), max_length=255)
    reference = models.CharField(_("Referencia"), max_length=100, blank=True)
    state = models.CharField(_("Estado"), max_length=20, choices=State.choices, default=State.DRAFT)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date', '-id']
        verbose_name = _("Asiento Contable")
        verbose_name_plural = _("Libro Diario")

    def __str__(self):
        return f"{self.date} - {self.description}"

    def check_balance(self):
        debit = sum(item.debit for item in self.items.all())
        credit = sum(item.credit for item in self.items.all())
        if debit != credit:
            raise ValidationError(_("El asiento no está cuadrado. Debe: %(debit)s, Haber: %(credit)s") % {'debit': debit, 'credit': credit})
        return True

class JournalItem(models.Model):
    entry = models.ForeignKey(JournalEntry, on_delete=models.CASCADE, related_name='items')
    account = models.ForeignKey(Account, on_delete=models.PROTECT, related_name='journal_items')
    partner = models.CharField(_("Socio/Empresa"), max_length=255, blank=True, help_text="Cliente o Proveedor asociado") # Placeholder for Partner model
    label = models.CharField(_("Etiqueta"), max_length=255, blank=True)
    debit = models.DecimalField(_("Debe"), max_digits=20, decimal_places=2, default=Decimal('0.00'))
    credit = models.DecimalField(_("Haber"), max_digits=20, decimal_places=2, default=Decimal('0.00'))

    class Meta:
        verbose_name = _("Apunte Contable")
        verbose_name_plural = _("Apuntes Contables")

    def clean(self):
        if self.debit > 0 and self.credit > 0:
            raise ValidationError(_("Un apunte no puede tener montos en Debe y Haber simultáneamente."))

class AccountingSettings(models.Model):
    # Default Accounts
    default_receivable_account = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, blank=True, related_name='settings_receivable')
    default_payable_account = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, blank=True, related_name='settings_payable')
    default_revenue_account = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, blank=True, related_name='settings_revenue')
    default_expense_account = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, blank=True, related_name='settings_expense')
    default_tax_receivable_account = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, blank=True, related_name='settings_tax_receivable')
    default_tax_payable_account = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, blank=True, related_name='settings_tax_payable')
    default_inventory_account = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, blank=True, related_name='settings_inventory')

    # Code Format & Hierarchy
    # Example: "X.X.XX.XXX"
    code_format = models.CharField(_("Formato de Código"), max_length=50, default="X.X.XX.XXX")
    
    # Starting digits for each type
    asset_prefix = models.CharField(_("Prefijo Activos"), max_length=5, default="1")
    liability_prefix = models.CharField(_("Prefijo Pasivos"), max_length=5, default="2")
    equity_prefix = models.CharField(_("Prefijo Patrimonio"), max_length=5, default="3")
    income_prefix = models.CharField(_("Prefijo Ingresos"), max_length=5, default="4")
    expense_prefix = models.CharField(_("Prefijo Gastos"), max_length=5, default="5")

    class Meta:
        verbose_name = _("Configuración Contable")
        verbose_name_plural = _("Configuración Contable")

    def __str__(self):
        return "Configuración Contable Global"
