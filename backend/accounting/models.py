from django.db import models
from django.utils.translation import gettext_lazy as _
from django.core.exceptions import ValidationError, ObjectDoesNotExist
from decimal import Decimal

class AccountType(models.TextChoices):
    ASSET = 'ASSET', _('Activo')
    LIABILITY = 'LIABILITY', _('Pasivo')
    EQUITY = 'EQUITY', _('Patrimonio')
    INCOME = 'INCOME', _('Ingresos')
    EXPENSE = 'EXPENSE', _('Gastos')

class Account(models.Model):
    code = models.CharField(_("Código"), max_length=20, unique=True, blank=True, help_text="Ej: 1.1.01.001")
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

    @property
    def debit_total(self):
        return sum(item.debit for item in self.journal_items.filter(entry__state='POSTED'))

    @property
    def credit_total(self):
        return sum(item.credit for item in self.journal_items.filter(entry__state='POSTED'))

    @property
    def balance(self):
        # Assets and Expenses increase with Debit
        if self.account_type in [AccountType.ASSET, AccountType.EXPENSE]:
            return self.debit_total - self.credit_total
        # Liabilities, Equity and Income increase with Credit
        return self.credit_total - self.debit_total

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

    number = models.CharField(_("Número"), max_length=20, unique=True, editable=False, null=True, blank=True)
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

    def save(self, *args, **kwargs):
        if not self.number:
            # Simple auto-numbering
            last_entry = JournalEntry.objects.all().order_by('id').last()
            if last_entry and last_entry.number:
                try:
                    self.number = str(int(last_entry.number) + 1).zfill(6)
                except ValueError:
                    self.number = '000001'
            else:
                self.number = '000001'
        super().save(*args, **kwargs)

    @property
    def get_source_documents(self):
        docs = []
        try:
            if hasattr(self, 'invoice'):
                docs.append({
                    'type': 'invoice',
                    'id': self.invoice.id,
                    'name': str(self.invoice),
                    'url': f'/billing/{"sales" if self.invoice.sale_order else "purchases"}'
                })
        except ObjectDoesNotExist:
            pass

        try:
            if hasattr(self, 'payment'):
                docs.append({
                    'type': 'payment',
                    'id': self.payment.id,
                    'name': f"Pago {self.payment.id}",
                    'url': '/treasury/payments'
                })
        except ObjectDoesNotExist:
            pass

        try:
            if hasattr(self, 'sale_order'):
                docs.append({
                    'type': 'sale_order',
                    'id': self.sale_order.id,
                    'name': str(self.sale_order),
                    'url': '/sales/orders'
                })
        except ObjectDoesNotExist:
            pass

        try:
            if hasattr(self, 'purchase_order'):
                docs.append({
                    'type': 'purchase_order',
                    'id': self.purchase_order.id,
                    'name': str(self.purchase_order),
                    'url': '/purchasing/orders'
                })
        except ObjectDoesNotExist:
            pass

        if self.stock_moves.exists():
            for move in self.stock_moves.all():
                docs.append({
                    'type': 'inventory',
                    'id': move.id,
                    'name': f"Mov. Stock {move.id}",
                    'url': '/inventory/movements'
                })
        return docs

    @property
    def get_source_document(self):
        try:
            if hasattr(self, 'invoice'):
                return {
                    'type': 'invoice',
                    'id': self.invoice.id,
                    'name': str(self.invoice),
                    'url': f'/billing/{"sales" if self.invoice.sale_order else "purchases"}' # Simplified URL
                }
        except ObjectDoesNotExist:
            pass

        try:
            if hasattr(self, 'payment'):
                return {
                    'type': 'payment',
                    'id': self.payment.id,
                    'name': f"Pago {self.payment.id}",
                    'url': '/treasury/payments'
                }
        except ObjectDoesNotExist:
            pass

        if self.stock_moves.exists():
            move = self.stock_moves.first()
            return {
                'type': 'inventory',
                'id': move.id,
                'name': f"Mov. Stock {move.id}",
                'url': '/inventory/movements'
            }
        return None

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

class InventoryValuationMethod(models.TextChoices):
    AVERAGE = 'AVERAGE', _('Promedio Ponderado')
    FIFO = 'FIFO', _('FIFO (Primero en entrar, primero en salir)')
    LIFO = 'LIFO', _('LIFO (Último en entrar, primero en salir)')

class AccountingSettings(models.Model):
    # Default Accounts
    default_receivable_account = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, blank=True, related_name='settings_receivable')
    default_payable_account = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, blank=True, related_name='settings_payable')
    default_revenue_account = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, blank=True, related_name='settings_revenue')
    default_expense_account = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, blank=True, related_name='settings_expense')
    default_tax_receivable_account = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, blank=True, related_name='settings_tax_receivable')
    default_tax_payable_account = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, blank=True, related_name='settings_tax_payable')
    default_inventory_account = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, blank=True, related_name='settings_inventory')


    # Inventory Config
    inventory_valuation_method = models.CharField(
        _("Método de Valoración de Inventario"), 
        max_length=20, 
        choices=InventoryValuationMethod.choices, 
        default=InventoryValuationMethod.AVERAGE
    )

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
