from django.db import models
from django.utils.translation import gettext_lazy as _
from django.core.validators import MinValueValidator
from django.core.exceptions import ValidationError, ObjectDoesNotExist
from simple_history.models import HistoricalRecords
from decimal import Decimal

class AccountType(models.TextChoices):
    ASSET = 'ASSET', _('Activo')
    LIABILITY = 'LIABILITY', _('Pasivo')
    EQUITY = 'EQUITY', _('Patrimonio')
    INCOME = 'INCOME', _('Ingresos')
    EXPENSE = 'EXPENSE', _('Gastos')

class ISCategory(models.TextChoices):
    REVENUE = 'REVENUE', _('Ingresos Operacionales')
    COST_OF_SALES = 'COST_OF_SALES', _('Costo de Ventas')
    OPERATING_EXPENSE = 'OPERATING_EXPENSE', _('Gastos Operacionales')
    NON_OPERATING_REVENUE = 'NON_OPERATING_REVENUE', _('Ingresos No Operacionales')
    NON_OPERATING_EXPENSE = 'NON_OPERATING_EXPENSE', _('Gastos No Operacionales')
    TAX_EXPENSE = 'TAX_EXPENSE', _('Impuesto a la Renta')

class CFCategory(models.TextChoices):
    OPERATING = 'OPERATING', _('Actividades de Operación')
    INVESTING = 'INVESTING', _('Actividades de Inversión')
    FINANCING = 'FINANCING', _('Actividades de Financiación')
    DEP_AMORT = 'DEP_AMORT', _('Depreciación y Amortización (No Efectivo)')

class BSCategory(models.TextChoices):
    CURRENT_ASSET = 'CURRENT_ASSET', _('Activo Corriente')
    NON_CURRENT_ASSET = 'NON_CURRENT_ASSET', _('Activo No Corriente')
    CURRENT_LIABILITY = 'CURRENT_LIABILITY', _('Pasivo Corriente')
    NON_CURRENT_LIABILITY = 'NON_CURRENT_LIABILITY', _('Pasivo No Corriente')
    EQUITY = 'EQUITY', _('Patrimonio')

class Account(models.Model):
    code = models.CharField(_("Código"), max_length=20, unique=True, blank=True, help_text="Ej: 1.1.01.001")
    name = models.CharField(_("Nombre"), max_length=255)
    account_type = models.CharField(_("Tipo"), max_length=20, choices=AccountType.choices)
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='children', verbose_name=_("Cuenta Padre"))
    is_reconcilable = models.BooleanField(_("Conciliable"), default=False)

    @property
    def is_selectable(self):
        """
        An account is selectable for postings if it has no children.
        """
        return not self.children.exists()
    
    # Reporting Mapping
    is_category = models.CharField(_("Categoría Estado Resultados"), max_length=30, choices=ISCategory.choices, null=True, blank=True)
    cf_category = models.CharField(_("Categoría Flujo de Caja"), max_length=30, choices=CFCategory.choices, null=True, blank=True)
    bs_category = models.CharField(_("Categoría Balance"), max_length=30, choices=BSCategory.choices, null=True, blank=True)
    
    @property
    def effective_is_category(self):
        """Returns the assigned IS category or inherits from parent."""
        if self.is_category:
            return self.is_category
        if self.parent:
            return self.parent.effective_is_category
        return None

    @property
    def effective_cf_category(self):
        """Returns the assigned CF category or inherits from parent."""
        if self.cf_category:
            return self.cf_category
        if self.parent:
            return self.parent.effective_cf_category
        return None
    
    @property
    def effective_bs_category(self):
        """Returns the assigned BS category or inherits from parent."""
        if self.bs_category:
            return self.bs_category
        if self.parent:
            return self.parent.effective_bs_category
        return None
    
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
    history = HistoricalRecords()

    class Meta:
        ordering = ['-id']
        verbose_name = _("Asiento Contable")
        verbose_name_plural = _("Libro Diario")

    def __str__(self):
        return self.display_id

    @property
    def display_id(self):
        return f"AS-{self.number}"

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
        # Invoice
        try:
            if hasattr(self, 'invoice') and self.invoice:
                docs.append({
                    'type': 'invoice',
                    'id': self.invoice.id,
                    'name': str(self.invoice),
                    'url': f'/billing/{"sales" if self.invoice.sale_order_id else "purchases"}'
                })
        except (ObjectDoesNotExist, AttributeError):
            pass

        # Payment
        try:
            if hasattr(self, 'payment') and self.payment:
                docs.append({
                    'type': 'payment',
                    'id': self.payment.id,
                    'name': str(self.payment),
                    'url': '/treasury/payments'
                })
        except (ObjectDoesNotExist, AttributeError):
            pass

        # Sale Order
        try:
            if hasattr(self, 'sale_order') and self.sale_order:
                docs.append({
                    'type': 'sale_order',
                    'id': self.sale_order.id,
                    'name': str(self.sale_order),
                    'url': '/sales/orders'
                })
        except (ObjectDoesNotExist, AttributeError):
            pass

        # Purchase Order
        try:
            if hasattr(self, 'purchase_order') and self.purchase_order:
                docs.append({
                    'type': 'purchase_order',
                    'id': self.purchase_order.id,
                    'name': str(self.purchase_order),
                    'url': '/purchasing/orders'
                })
        except (ObjectDoesNotExist, AttributeError):
            pass

        # Stock Moves
        try:
            moves = self.stock_moves.all()
            if moves.exists():
                for move in moves:
                    docs.append({
                        'type': 'inventory',
                        'id': move.id,
                        'name': f"MOV-{str(move.id).zfill(6)}",
                        'url': '/inventory/movements'
                    })
        except (ObjectDoesNotExist, AttributeError):
            pass
            
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
    debit = models.DecimalField(_("Debe"), max_digits=20, decimal_places=0, default=Decimal('0'), validators=[MinValueValidator(0)])
    credit = models.DecimalField(_("Haber"), max_digits=20, decimal_places=0, default=Decimal('0'), validators=[MinValueValidator(0)])

    class Meta:
        verbose_name = _("Apunte Contable")
        verbose_name_plural = _("Apuntes Contables")

    def clean(self):
        if self.debit > 0 and self.credit > 0:
            raise ValidationError(_("Un apunte no puede tener montos en Debe y Haber simultáneamente."))
        if self.account and not self.account.is_selectable:
            raise ValidationError(_("La cuenta %(account)s tiene subcuentas y no es seleccionable para asientos contables."),
                                params={'account': self.account},)

class InventoryValuationMethod(models.TextChoices):
    AVERAGE = 'AVERAGE', _('Promedio Ponderado')

class AccountingSettings(models.Model):
    # Default Accounts
    default_receivable_account = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, blank=True, related_name='settings_receivable')
    default_payable_account = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, blank=True, related_name='settings_payable')
    default_revenue_account = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, blank=True, related_name='settings_revenue')
    default_expense_account = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, blank=True, related_name='settings_expense')
    default_tax_receivable_account = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, blank=True, related_name='settings_tax_receivable')
    default_tax_payable_account = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, blank=True, related_name='settings_tax_payable')
    default_inventory_account = models.ForeignKey(
        Account, 
        on_delete=models.SET_NULL, 
        null=True, blank=True, 
        related_name='settings_inventory',
        verbose_name=_("Cuenta Inventario General (Deprecated)"),
        help_text=_("⚠️ DEPRECATED: Use cuentas específicas por tipo de producto. Se mantiene como fallback.")
    )
    
    # Stock Interim Accounts
    stock_input_account = models.ForeignKey(
        Account, 
        on_delete=models.SET_NULL, 
        null=True, blank=True, 
        related_name='settings_stock_input',
        verbose_name=_("Cuenta de Entrada de Stock (Puente)"),
        help_text=_("Cuenta de Pasivo (ej: Proveedores por Facturar) usada como contrapartida en recepciones.")
    )
    stock_output_account = models.ForeignKey(
        Account, 
        on_delete=models.SET_NULL, 
        null=True, blank=True, 
        related_name='settings_stock_output',
        verbose_name=_("Cuenta de Salida de Stock (Puente)"),
        help_text=_("Cuenta usada como contrapartida en salidas no facturadas (si aplica).")
    )
    
    # Type-Based Inventory Accounts
    storable_inventory_account = models.ForeignKey(
        Account,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='settings_storable_inventory',
        verbose_name=_("Cuenta Inventario Almacenables"),
        help_text=_("Cuenta para productos STORABLE (ej: 1.1.03.01)")
    )
    
    manufacturable_inventory_account = models.ForeignKey(
        Account,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='settings_manufacturable_inventory',
        verbose_name=_("Cuenta Inventario Fabricables"),
        help_text=_("Cuenta para productos MANUFACTURABLE (ej: 1.1.03.01)")
    )
    
    # Consumable Products Account
    default_consumable_account = models.ForeignKey(
        Account,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='settings_consumable',
        verbose_name=_("Cuenta de Gastos Consumibles"),
        help_text=_("Cuenta de gasto usada por defecto para productos consumibles (tintas, papel, etc.)")
    )

    # COGS (Cost of Goods Sold) Accounts
    merchandise_cogs_account = models.ForeignKey(
        Account,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='settings_merchandise_cogs',
        verbose_name=_("Cuenta Costo de Mercaderías"),
        help_text=_("Cuenta 5.1.01 - Para productos STORABLE comprados para reventa")
    )

    manufactured_cogs_account = models.ForeignKey(
        Account,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='settings_manufactured_cogs',
        verbose_name=_("Cuenta Costo de Producción"),
        help_text=_("Cuenta 5.1.02 - Para productos MANUFACTURABLE fabricados internamente")
    )

    # Service Products Account
    default_service_expense_account = models.ForeignKey(
        Account,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='settings_service_expense',
        verbose_name=_("Cuenta de Gastos por Servicios"),
        help_text=_("Cuenta de gasto usada por defecto para productos de tipo servicio.")
    )

    default_service_revenue_account = models.ForeignKey(
        Account,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='settings_service_revenue',
        verbose_name=_("Cuenta de Ingresos por Servicios"),
        help_text=_("Cuenta de ingreso usada por defecto para productos de tipo servicio.")
    )

    # Subscription Products Accounts
    default_subscription_expense_account = models.ForeignKey(
        Account,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='settings_subscription_expense',
        verbose_name=_("Cuenta de Gastos por Suscripciones"),
        help_text=_("Cuenta de gasto usada por defecto para productos de tipo suscripción.")
    )

    default_subscription_revenue_account = models.ForeignKey(
        Account,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='settings_subscription_revenue',
        verbose_name=_("Cuenta de Ingresos por Suscripciones"),
        help_text=_("Cuenta de ingreso usada por defecto para productos de tipo suscripción.")
    )

    # Adjustment Accounts
    adjustment_income_account = models.ForeignKey(
        Account, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='settings_adjustment_income',
        verbose_name=_("Cuenta de Ingreso por Ajuste (Sobrantes)"),
        help_text=_("Cuenta de ingreso para registrar ganancias de inventario (ej: Otros Ingresos).")
    )
    adjustment_expense_account = models.ForeignKey(
        Account, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='settings_adjustment_expense',
        verbose_name=_("Cuenta de Gasto por Ajuste (Mermas)"),
        help_text=_("Cuenta de gasto para registrar mermas o pérdidas de inventario.")
    )
    initial_inventory_account = models.ForeignKey(
        Account, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='settings_initial_inventory',
        verbose_name=_("Cuenta de Inventario Inicial (Patrimonio/Contrapartida)"),
        help_text=_("Cuenta usada como contrapartida al cargar el stock por primera vez.")
    )
    revaluation_account = models.ForeignKey(
        Account, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='settings_revaluation',
        verbose_name=_("Cuenta de Revalorización"),
        help_text=_("Cuenta usada para ajustes de costo sin cambio físico en stock.")
    )

    # Reconciliation Difference Accounts
    bank_commission_account = models.ForeignKey(
        Account, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='settings_bank_commission',
        verbose_name=_("Cuenta de Comisiones Bancarias"),
        help_text=_("Para justificar diferencias por comisiones")
    )
    interest_income_account = models.ForeignKey(
        Account, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='settings_interest_income',
        verbose_name=_("Cuenta de Intereses Ganados"),
        help_text=_("Para justificar diferencias por intereses")
    )
    exchange_difference_account = models.ForeignKey(
        Account, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='settings_exchange_diff',
        verbose_name=_("Cuenta de Diferencia de Cambio"),
        help_text=_("Para justificar diferencias por tipo de cambio")
    )
    rounding_adjustment_account = models.ForeignKey(
        Account, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='settings_rounding',
        verbose_name=_("Cuenta de Ajuste por Redondeo"),
        help_text=_("Para justificar diferencias de redondeo")
    )
    error_adjustment_account = models.ForeignKey(
        Account, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='settings_error_adj',
        verbose_name=_("Cuenta de Ajuste por Error"),
        help_text=_("Para justificar errores de registro")
    )
    miscellaneous_adjustment_account = models.ForeignKey(
        Account, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='settings_misc_adj',
        verbose_name=_("Cuenta de Ajustes Varios"),
        help_text=_("Cuenta por defecto para otros ajustes")
    )



    # Advanced Accounting
    default_prepayment_account = models.ForeignKey(
        Account, on_delete=models.SET_NULL, null=True, blank=True, 
        related_name='settings_prepayments',
        verbose_name=_("Cuenta de Anticipos a Proveedores (Activo)")
    )
    default_advance_payment_account = models.ForeignKey(
        Account, on_delete=models.SET_NULL, null=True, blank=True, 
        related_name='settings_advances',
        verbose_name=_("Cuenta de Anticipos de Clientes (Pasivo)")
    )
    
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

# --- Budgeting Models ---

class Budget(models.Model):
    name = models.CharField(_("Nombre del Presupuesto"), max_length=255)
    start_date = models.DateField(_("Fecha Inicio"))
    end_date = models.DateField(_("Fecha Fin"))
    description = models.TextField(_("Descripción"), blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-id']
        verbose_name = _("Presupuesto")
        verbose_name_plural = _("Presupuestos")

    def __str__(self):
        return f"{self.name} ({self.start_date} - {self.end_date})"

class BudgetItem(models.Model):
    budget = models.ForeignKey(Budget, on_delete=models.CASCADE, related_name='items')
    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name='budget_items')
    year = models.IntegerField(_("Año"), default=2024)
    month = models.IntegerField(_("Mes"), default=1, help_text="Mes del presupuesto (1-12)")
    amount = models.DecimalField(_("Monto Presupuestado"), max_digits=20, decimal_places=0, validators=[MinValueValidator(0)])
    
    class Meta:
        unique_together = ['budget', 'account', 'year', 'month']
        verbose_name = _("Item de Presupuesto")
        verbose_name_plural = _("Items de Presupuesto")

    def __str__(self):
        return f"{self.budget.name} - {self.account.name} ({self.year}/{self.month}): {self.amount}"
