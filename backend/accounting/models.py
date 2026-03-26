from django.db import models
from django.utils import timezone
from core.utils import get_current_date
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
    history = HistoricalRecords()

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
        return sum(item.debit for item in self.journal_items.filter(entry__status='POSTED'))

    @property
    def credit_total(self):
        return sum(item.credit for item in self.journal_items.filter(entry__status='POSTED'))

    def get_depth(self):
        """Returns the depth of the account in the hierarchy (1-based)."""
        if self.parent:
            return 1 + self.parent.get_depth()
        return 1

    def clean(self):
        """
        Validate business rules before saving.
        """
        if self.parent:
            # Type must match parent
            if self.account_type != self.parent.account_type:
                raise ValidationError({
                    'account_type': _("El tipo de cuenta debe coincidir con el de la cuenta padre (%s).") % self.parent.get_account_type_display()
                })
        # Max hierarchy depth validation
        from .models import AccountingSettings
        settings = AccountingSettings.objects.first()
        if settings:
            depth = self.get_depth()
            if depth > settings.hierarchy_levels:
                raise ValidationError({
                    'parent': _("No se puede crear la cuenta. Se ha alcanzado el límite de %d niveles de jerarquía.") % settings.hierarchy_levels
                })

    def save(self, *args, **kwargs):
        # Inherit type from parent before validation if not set or if forced by hierarchy
        if self.parent:
            self.account_type = self.parent.account_type

        self.full_clean() # Trigger clean() validation
        is_new = self.pk is None
        code_changed = False
        old_parent_id = None
        old_type = None

        if not is_new:
            old_instance = Account.objects.get(pk=self.pk)
            old_parent_id = old_instance.parent_id
            old_type = old_instance.account_type
            
            # If parent or type changed, we need to regenerate the code
            if self.parent_id != old_parent_id or self.account_type != old_type:
                self.code = "" # Trigger regeneration below
                code_changed = True

        if not self.code:
                from .models import AccountingSettings
                settings = AccountingSettings.get_solo()
                sep = settings.code_separator
                
                prefix = ""
                depth = self.get_depth()

                if self.parent:
                    prefix = self.parent.code + sep
                    # Ensure type matches parent
                    self.account_type = self.parent.account_type
                else:
                    if self.account_type == AccountType.ASSET: prefix = settings.asset_prefix
                    elif self.account_type == AccountType.LIABILITY: prefix = settings.liability_prefix
                    elif self.account_type == AccountType.EQUITY: prefix = settings.equity_prefix
                    elif self.account_type == AccountType.INCOME: prefix = settings.income_prefix
                    elif self.account_type == AccountType.EXPENSE: prefix = settings.expense_prefix
                    prefix += sep if prefix else ""

                # Find next sequence
                # We filter brothers and sort by code
                siblings = Account.objects.filter(code__startswith=prefix, parent=self.parent).order_by('-code')
                # Padding logic: L1/L2=1, L3/L4=2, L5+=3 (Standard X.X.XX.XX.XXX)
                if depth == 1:
                    padding = 1
                elif depth <= 3:
                    padding = 2
                else:
                    padding = 3
                
                last_seq = 0
                for sibling in siblings:
                    try:
                        # Use dynamic separator
                        last_part = sibling.code.split(sep)[-1]
                        last_seq = int(last_part)
                        # We adopt the sibling's padding only if it's larger than the structured default
                        padding = max(padding, len(last_part))
                        break 
                    except (ValueError, IndexError):
                        continue 
                
                next_seq = last_seq + 1
                self.code = prefix + str(next_seq).zfill(padding)
                
                code_changed = True
        
        # Final safety check for generated code length
        if self.code and len(self.code) > 20:
            raise ValidationError({'code': _("El código generado excede el límite de 20 caracteres.")})

        super().save(*args, **kwargs)

        # If code changed for an existing account, cascade to children
        if not is_new and code_changed:
            for child in self.children.all():
                child.code = "" # Trigger regeneration in child.save()
                child.account_type = self.account_type
                child.save()

class JournalEntry(models.Model):
    # NOTE: This class uses "Status" and field name "status" to match the convention of all
    # other transactional models (SaleOrder, Invoice, PurchaseOrder, etc.).
    # The inner class is named both Status AND State (alias) for backwards compatibility.
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', _('Borrador')
        POSTED = 'POSTED', _('Publicado')
        CANCELLED = 'CANCELLED', _('Anulado')

    # Alias for backwards compatibility with existing code that references JournalEntry.State
    State = Status

    number = models.CharField(_("Número"), max_length=20, unique=True, editable=False, null=True, blank=True)
    date = models.DateField(_("Fecha"), default=get_current_date)
    description = models.CharField(_("Descripción"), max_length=255)
    reference = models.CharField(_("Referencia"), max_length=100, blank=True)
    status = models.CharField(_("Estado"), max_length=20, choices=Status.choices, default=Status.DRAFT)
    
    # Accounting Period Control
    accounting_period = models.ForeignKey(
        'tax.AccountingPeriod',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='journal_entries',
        verbose_name=_("Periodo Contable")
    )
    period_closed = models.BooleanField(
        _("Periodo Cerrado"),
        default=False,
        help_text=_("Indica si el asiento pertenece a un periodo cerrado")
    )
    
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
        # Validate period is not closed (only for existing entries being modified)
        if self.pk and self.period_closed:
            raise ValidationError(
                _("No se puede modificar un asiento de un periodo cerrado.")
            )
        
        # Auto-assign accounting period based on date
        if self.date and not self.accounting_period_id:
            from tax.models import AccountingPeriod
            try:
                period, _ = AccountingPeriod.objects.get_or_create(
                    year=self.date.year,
                    month=self.date.month
                )
                self.accounting_period = period
                self.period_closed = (period.status == AccountingPeriod.Status.CLOSED)
            except Exception:
                # If period creation fails, continue without it
                pass
        
        # Update period_closed flag if period exists
        if self.accounting_period_id:
            from tax.models import AccountingPeriod
            try:
                period = AccountingPeriod.objects.get(id=self.accounting_period_id)
                self.period_closed = (period.status == AccountingPeriod.Status.CLOSED)
            except AccountingPeriod.DoesNotExist:
                pass
        
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
    default_uncollectible_expense_account = models.ForeignKey(
        Account, 
        on_delete=models.SET_NULL, 
        null=True, blank=True, 
        related_name='settings_uncollectible',
        verbose_name=_("Cuenta de Gasto por Incobrabilidad"),
        help_text=_("Cuenta de gasto para castigar deudas incobrables.")
    )
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
    terminal_commission_bridge_account = models.ForeignKey(
        Account, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='settings_terminal_comm_bridge',
        verbose_name=_("Cuenta Puente Comisión Terminales"),
        help_text=_("Cuenta de activo/puente para retenciones de comisión sin factura.")
    )
    terminal_iva_bridge_account = models.ForeignKey(
        Account, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='settings_terminal_iva_bridge',
        verbose_name=_("Cuenta Puente IVA Terminales"),
        help_text=_("Cuenta de activo/puente para el IVA de comisiones sin factura.")
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

    # POS Cash Control Accounts
    pos_cash_difference_gain_account = models.ForeignKey(
        Account, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='settings_pos_diff_gain',
        verbose_name=_("Cuenta Ganancia Diferencia Caja POS"),
        help_text=_("Cuenta de ingreso para registrar sobrantes de caja.")
    )
    pos_cash_difference_loss_account = models.ForeignKey(
        Account, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='settings_pos_diff_loss',
        verbose_name=_("Cuenta Pérdida Diferencia Caja POS"),
        help_text=_("Cuenta de gasto para registrar faltantes de caja.")
    )
    
    # Manual POS Cash Movements
    pos_partner_withdrawal_account = models.ForeignKey(
        Account, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='settings_pos_withdrawal',
        verbose_name=_("Cuenta Retiro Socio POS"),
        help_text=_("Cuenta para registrar retiros de socios desde el POS.")
    )
    pos_theft_account = models.ForeignKey(
        Account, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='settings_pos_theft',
        verbose_name=_("Cuenta Faltante por Robo POS"),
        help_text=_("Cuenta para registrar faltantes por robo detectados en el POS.")
    )
    pos_other_inflow_account = models.ForeignKey(
        Account, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='settings_pos_other_inflow',
        verbose_name=_("Cuenta Otros Ingresos POS"),
        help_text=_("Cuenta para otros ingresos de efectivo en el POS.")
    )
    pos_other_outflow_account = models.ForeignKey(
        Account, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='settings_pos_other_outflow',
        verbose_name=_("Cuenta Otros Egresos POS"),
        help_text=_("Cuenta para otros egresos de efectivo en el POS.")
    )

    pos_tip_account = models.ForeignKey(
        Account, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='settings_pos_tip',
        verbose_name=_("Cuenta Propinas POS"),
        help_text=_("Cuenta para registrar propinas recibidas en el POS.")
    )
    pos_cashback_error_account = models.ForeignKey(
        Account, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='settings_pos_cashback',
        verbose_name=_("Cuenta Vuelto Incorrecto POS"),
        help_text=_("Cuenta para registrar diferencias por vueltos incorrectos.")
    )
    pos_counting_error_account = models.ForeignKey(
        Account, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='settings_pos_counting',
        verbose_name=_("Cuenta Error de Conteo POS"),
        help_text=_("Cuenta para registrar diferencias por errores de conteo.")
    )
    pos_system_error_account = models.ForeignKey(
        Account, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='settings_pos_system_error',
        verbose_name=_("Cuenta Error de Sistema POS"),
        help_text=_("Cuenta para registrar diferencias por errores del sistema.")
    )
    pos_rounding_adjustment_account = models.ForeignKey(
        Account, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='settings_pos_rounding',
        verbose_name=_("Cuenta Redondeo POS"),
        help_text=_("Cuenta para registrar diferencias por redondeo en el POS.")
    )
    
    pos_default_credit_percentage = models.DecimalField(
        _("Crédito Preaprobado POS (%)"), 
        max_digits=5, 
        decimal_places=2, 
        default=0,
        help_text=_("Porcentaje de la venta que se puede asignar como crédito por defecto si el cliente no tiene línea de crédito.")
    )

    # Credit Automation Settings
    credit_auto_block_days = models.IntegerField(
        _("Días de Mora para Auto-Bloqueo"),
        null=True, blank=True,
        default=60,
        help_text=_("Días máximos de mora antes de bloquear automáticamente la capacidad de crédito. Dejar en blanco para desactivar el auto-bloqueo.")
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

    # DTE Configuration
    allowed_dte_types_emit = models.JSONField(
        _("DTEs Permitidos a Emitir (Ventas/POS)"), 
        default=list, 
        blank=True,
        help_text=_("Tipos de documentos electrónicos seleccionables en el flujo de venta y POS.")
    )
    allowed_dte_types_receive = models.JSONField(
        _("DTEs Permitidos a Recibir (Compras)"), 
        default=list, 
        blank=True,
        help_text=_("Tipos de documentos electrónicos seleccionables en el flujo de compras.")
    )

    # Code Format & Hierarchy
    hierarchy_levels = models.PositiveSmallIntegerField(_("Niveles de Jerarquía"), default=4, help_text=_("Cantidad total de niveles (2-5)."))
    code_separator = models.CharField(_("Separador"), max_length=1, default=".", help_text=_("Símbolo usado para separar niveles."))
    
    # Starting digits for each type
    asset_prefix = models.CharField(_("Prefijo Activos"), max_length=5, default="1")
    liability_prefix = models.CharField(_("Prefijo Pasivos"), max_length=5, default="2")
    equity_prefix = models.CharField(_("Prefijo Patrimonio"), max_length=5, default="3")
    income_prefix = models.CharField(_("Prefijo Ingresos"), max_length=5, default="4")
    expense_prefix = models.CharField(_("Prefijo Gastos"), max_length=5, default="5")

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        old_prefixes = {}
        old_sep = "."

        if not is_new:
            old_obj = AccountingSettings.objects.get(pk=self.pk)
            old_prefixes = {
                'ASSET': old_obj.asset_prefix,
                'LIABILITY': old_obj.liability_prefix,
                'EQUITY': old_obj.equity_prefix,
                'INCOME': old_obj.income_prefix,
                'EXPENSE': old_obj.expense_prefix,
            }
            old_sep = old_obj.code_separator

        super().save(*args, **kwargs)

        # Trigger mass update if prefixes or separator changed
        new_prefixes = {
            'ASSET': self.asset_prefix,
            'LIABILITY': self.liability_prefix,
            'EQUITY': self.equity_prefix,
            'INCOME': self.income_prefix,
            'EXPENSE': self.expense_prefix,
        }

        prefix_changed = any(old_prefixes.get(t) != new_prefixes.get(t) for t in new_prefixes)
        sep_changed = old_sep != self.code_separator

        if not is_new and (prefix_changed or sep_changed):
            from .models import Account
            # This can be slow, but for a standard COA it's manageable. 
            # We trigger mass update by saving root accounts. Their Account.save() 
            # handles the recursive update to children.
            roots = Account.objects.filter(parent__isnull=True)
            for root in roots:
                root.code = ""
                root.save()

    @classmethod
    def get_solo(cls):
        obj = cls.objects.first()
        if not obj:
            obj = cls.objects.create()
        return obj

    class Meta:
        verbose_name = _("Configuración Contable")
        verbose_name_plural = _("Configuración Contable")

    # Tax Accounts (F29 Module)
    vat_payable_account = models.ForeignKey(
        Account, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='settings_vat_payable',
        verbose_name=_("Cuenta IVA por Pagar"),
        help_text=_("Cuenta 2.1.02.02 - IVA resultante a pagar al SII")
    )
    vat_carryforward_account = models.ForeignKey(
        Account, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='settings_vat_carryforward',
        verbose_name=_("Cuenta IVA Remanente"),
        help_text=_("Cuenta 1.1.04.02 - Crédito fiscal a favor para próximo período")
    )
    withholding_tax_account = models.ForeignKey(
        Account, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='settings_withholding_tax',
        verbose_name=_("Cuenta Retenciones de Impuestos"),
        help_text=_("Cuenta 1.1.04.03 - Retenciones de honorarios (2da categoría)")
    )
    ppm_account = models.ForeignKey(
        Account, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='settings_ppm',
        verbose_name=_("Cuenta PPM por Recuperar"),
        help_text=_("Cuenta 1.1.04.04 - Pagos Provisionales Mensuales")
    )
    second_category_tax_account = models.ForeignKey(
        Account, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='settings_second_category_tax',
        verbose_name=_("Cuenta Impuesto Único 2da Categoría"),
        help_text=_("Cuenta 2.1.02.04 - Impuesto único a los trabajadores por pagar")
    )
    loan_retention_account = models.ForeignKey(
        Account, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='settings_loan_retention',
        verbose_name=_("Cuenta Retención Préstamo Solidario"),
        help_text=_("Cuenta 2.1.02.05 - Retención adicional 3% Préstamo Solidario")
    )
    ila_tax_account = models.ForeignKey(
        Account, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='settings_ila_tax',
        verbose_name=_("Cuenta ILA por Pagar"),
        help_text=_("Cuenta 2.1.02.06 - Impuesto Adicional (Licores, Bebidas, etc.)")
    )
    vat_withholding_account = models.ForeignKey(
        Account, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='settings_vat_withholding',
        verbose_name=_("Cuenta Retención IVA por Pagar"),
        help_text=_("Cuenta 2.1.02.07 - IVA retenido a terceros (Factura de Compra)")
    )
    default_vat_rate = models.DecimalField(
        _("Tasa de IVA por Defecto"),
        max_digits=5,
        decimal_places=2,
        default=Decimal('19.00'),
        help_text=_("Porcentaje de IVA usado en cálculos generales.")
    )
    correction_income_account = models.ForeignKey(
        Account, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='settings_correction_income',
        verbose_name=_("Cuenta Ingreso por Corrección Monetaria"),
        help_text=_("Cuenta para registrar aumentos de remanente por reajuste")
    )

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
