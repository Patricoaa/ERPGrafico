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
    default_receivable_account = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, blank=True, related_name='settings_receivable')
    default_payable_account = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, blank=True, related_name='settings_payable')
    default_revenue_account = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, blank=True, related_name='settings_revenue')
    default_expense_account = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, blank=True, related_name='settings_expense')
    default_tax_account = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, blank=True, related_name='settings_tax')
    default_inventory_account = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, blank=True, related_name='settings_inventory')

    class Meta:
        verbose_name = _("Configuración Contable")
        verbose_name_plural = _("Configuración Contable")

    def __str__(self):
        return "Configuración Contable Global"
