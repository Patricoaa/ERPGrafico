from django.db import models
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.utils import timezone
from core.utils import get_current_date
from django.utils.translation import gettext_lazy as _
from django.core.validators import MinValueValidator
from django.core.exceptions import ValidationError, ObjectDoesNotExist
from simple_history.models import HistoricalRecords
from decimal import Decimal
from core.models import AuditedModel, TimeStampedModel

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
    INVENTORY = 'INVENTORY', _('Inventario')
    NON_CURRENT_ASSET = 'NON_CURRENT_ASSET', _('Activo No Corriente')
    CURRENT_LIABILITY = 'CURRENT_LIABILITY', _('Pasivo Corriente')
    NON_CURRENT_LIABILITY = 'NON_CURRENT_LIABILITY', _('Pasivo No Corriente')
    EQUITY = 'EQUITY', _('Patrimonio')

class Account(TimeStampedModel):
    code = models.CharField(_("Código"), max_length=20, unique=True, blank=True, help_text="Ej: 1.1.01.001")
    name = models.CharField(_("Nombre"), max_length=255)
    account_type = models.CharField(_("Tipo"), max_length=20, choices=AccountType.choices)
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='children', verbose_name=_("Cuenta Padre"))
    is_reconcilable = models.BooleanField(_("Conciliable"), default=False)
    history = HistoricalRecords()
    # NOTE: created_at / updated_at heredados de TimeStampedModel (T-14).

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
        if hasattr(self, 'annotated_debit_total') and self.annotated_debit_total is not None:
            return self.annotated_debit_total
        return sum(item.debit for item in self.journal_items.filter(entry__status='POSTED'))

    @property
    def credit_total(self):
        if hasattr(self, 'annotated_credit_total') and self.annotated_credit_total is not None:
            return self.annotated_credit_total
        return sum(item.credit for item in self.journal_items.filter(entry__status='POSTED'))

    @property
    def balance(self):
        """
        Calculates the balance based on account type.
        Asset/Expense: Debit - Credit
        Liability/Equity/Income: Credit - Debit
        """
        debit = self.debit_total
        credit = self.credit_total
        if self.account_type in [AccountType.ASSET, AccountType.EXPENSE]:
            return debit - credit
        return credit - debit

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
        
        # Validation for BS / IS categories vs Account Type
        if self.is_category and self.account_type not in [AccountType.INCOME, AccountType.EXPENSE]:
            raise ValidationError({
                'is_category': _("Solo las cuentas de Ingresos y Gastos pueden tener categorías de Estado de Resultados.")
            })
            
        if self.bs_category and self.account_type not in [AccountType.ASSET, AccountType.LIABILITY, AccountType.EQUITY]:
            raise ValidationError({
                'bs_category': _("Solo las cuentas de Activo, Pasivo y Patrimonio pueden tener categorías de Balance General.")
            })
            
        if self.bs_category:
            if self.account_type == AccountType.ASSET and self.bs_category not in [BSCategory.CURRENT_ASSET, BSCategory.INVENTORY, BSCategory.NON_CURRENT_ASSET]:
                raise ValidationError({'bs_category': _("Las cuentas de Activo solo pueden ser Activo Corriente, Inventario o No Corriente.")})
            if self.account_type == AccountType.LIABILITY and self.bs_category not in [BSCategory.CURRENT_LIABILITY, BSCategory.NON_CURRENT_LIABILITY]:
                raise ValidationError({'bs_category': _("Las cuentas de Pasivo solo pueden ser Pasivo Corriente o No Corriente.")})
            if self.account_type == AccountType.EQUITY and self.bs_category != BSCategory.EQUITY:
                raise ValidationError({'bs_category': _("Las cuentas de Patrimonio solo pueden ser categoría Patrimonio.")})

        # Max hierarchy depth validation
        from .models import AccountingSettings
        settings = AccountingSettings.get_solo()
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

class JournalEntry(AuditedModel):
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

    source_content_type = models.ForeignKey(
        ContentType, null=True, blank=True, on_delete=models.SET_NULL
    )
    source_object_id = models.PositiveIntegerField(null=True, blank=True)
    source_document = GenericForeignKey('source_content_type', 'source_object_id')
    
    class Meta:
        ordering = ['-id']
        verbose_name = _("Asiento Contable")
        verbose_name_plural = _("Libro Diario")
        indexes = [
            models.Index(fields=['source_content_type', 'source_object_id']),
        ]

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
        is_new = self.pk is None
        
        # 1. Determine/Refresh accounting period context
        if self.date and not self.accounting_period_id:
            from tax.models import AccountingPeriod
            try:
                period, _created = AccountingPeriod.objects.get_or_create(
                    year=self.date.year,
                    month=self.date.month
                )
                self.accounting_period = period
                self.period_closed = (period.status == AccountingPeriod.Status.CLOSED)
            except Exception:
                pass
        
        if self.accounting_period_id:
            from tax.models import AccountingPeriod
            try:
                period = AccountingPeriod.objects.get(id=self.accounting_period_id)
                self.period_closed = (period.status == AccountingPeriod.Status.CLOSED)
            except AccountingPeriod.DoesNotExist:
                pass

        # 2. Hard Enforcement of Period Closure
        # EXCEPTION: System-generated opening/closing entries bypass this to allow fiscal year closure
        is_closing_entry = getattr(self, '_is_system_closing_entry', False)
        
        if self.period_closed and not is_closing_entry:
            if is_new:
                # Block Creation
                raise ValidationError(
                    _("No se puede registrar un asiento contable en un periodo cerrado. Por favor, verifique la fecha o solicite la reapertura del periodo.")
                )
            else:
                # Block Modification (except cancellation)
                original = JournalEntry.objects.get(pk=self.pk)
                # If it was already cancelled, block any further change
                if original.status == JournalEntry.Status.CANCELLED:
                     raise ValidationError(
                        _("No se puede modificar un asiento ya anulado en un periodo cerrado.")
                    )
                # If attempting to change something other than status to CANCELLED
                if self.status != JournalEntry.Status.CANCELLED:
                    raise ValidationError(
                        _("No se puede modificar un asiento de un periodo cerrado. Solo se permite la anulación.")
                    )

        # 3. Standard Field Assignments
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

    def delete(self, *args, **kwargs):
        super().delete(*args, **kwargs)

    @property
    def get_source_documents(self):
        # Mantenemos por retrocompatibilidad momentánea mientras migramos vistas.
        # Retorna una lista con la nueva información de source.
        info = self.source_info
        return [info] if info else []

    @property
    def get_source_document(self):
        return self.source_document

    @property
    def source_info(self) -> dict | None:
        if not self.source_document:
            return None
        from core.registry import UniversalRegistry
        entity = UniversalRegistry.get_for_model(type(self.source_document))
        if not entity:
             return {
                'type': self.source_content_type.model,
                'id': self.source_object_id,
                'name': str(self.source_document),
                'url': '#'
            }
        return {
            'type': entity.label,
            'id': self.source_document.pk,
            'name': str(self.source_document),
            'url': entity.detail_url_pattern.format(id=self.source_document.pk),
        }

class JournalItem(TimeStampedModel):
    # NOTE: created_at / updated_at heredados de TimeStampedModel (T-14).
    # Backfill: created_at = updated_at = entry.created_at (ver migración 0011).
    entry = models.ForeignKey(JournalEntry, on_delete=models.CASCADE, related_name='items')
    account = models.ForeignKey(Account, on_delete=models.PROTECT, related_name='journal_items')
    partner = models.ForeignKey(
        'contacts.Contact',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='journal_items',
        verbose_name=_("Socio/Contacto"),
        help_text=_("Contacto asociado a este apunte contable (socio, cliente o proveedor).")
    )
    partner_name = models.CharField(_("Nombre Socio (Legacy)"), max_length=255, blank=True, help_text=_("Campo legacy para preservar datos históricos de texto."))
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

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        super().delete(*args, **kwargs)

class InventoryValuationMethod(models.TextChoices):
    AVERAGE = 'AVERAGE', _('Promedio Ponderado')

class AccountingSettings(TimeStampedModel):
    # NOTE: created_at / updated_at heredados de TimeStampedModel (T-14).
    # Default Accounts
    default_receivable_account = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, blank=True, related_name='settings_receivable')
    default_payable_account = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, blank=True, related_name='settings_payable')
    default_revenue_account = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, blank=True, related_name='settings_revenue')
    default_expense_account = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, blank=True, related_name='settings_expense')
    default_tax_receivable_account = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, blank=True, related_name='settings_tax_receivable')
    default_tax_payable_account = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, blank=True, related_name='settings_tax_payable')
    default_tax_rate = models.DecimalField(
        _("Tasa de IVA por Defecto (%)"), max_digits=5, decimal_places=2, default=Decimal('19.00'),
        help_text=_("Tasa porcentual a aplicar (ej. 19.00) para desglosar el neto del IVA.")
    )
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
    # initial_inventory_account REMOVED — Inventario Inicial adjustment type was deprecated
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
    auto_post_reconciliation_adjustments = models.BooleanField(
        _("Auto-Publicar Ajustes de Conciliación"),
        default=False,
        help_text=_("Si se activa, los ajustes contables generados desde la conciliación bancaria se crearán en estado PUBLICADO (POSTED) en lugar de BORRADOR (DRAFT).")
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
    tax_withholding_account = models.ForeignKey(
        Account, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='settings_tax_withholding',
        verbose_name=_("Cuenta de Retenciones / Impuestos"),
        help_text=_("Cuenta para ajustes de conciliación por retenciones de impuestos.")
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

    # Partner / Equity Accounts
    partner_capital_contribution_account = models.ForeignKey(
        Account, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='settings_partner_contribution',
        verbose_name=_("Cuenta Aportes de Capital"),
        help_text=_("Cuenta padre de patrimonio para aportes de capital de socios (ej: 3.1.02).")
    )
    partner_withdrawal_account = models.ForeignKey(
        Account, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='settings_partner_withdrawal',
        verbose_name=_("Cuenta Retiros de Socios"),
        help_text=_("Cuenta padre de patrimonio para retiros de socios (ej: 3.1.03).")
    )
    partner_capital_receivable_account = models.ForeignKey(
        Account, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='settings_partner_receivable',
        verbose_name=_("Cuenta por Cobrar Aportes Socios"),
        help_text=_("Cuenta de activo donde se registran las deudas de los socios por capital suscrito no pagado (ej: 1.1.04).")
    )
    partner_capital_social_account = models.ForeignKey(
        Account, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='settings_partner_capital_social',
        verbose_name=_("Cuenta de Capital Social"),
        help_text=_("Cuenta global de patrimonio para el capital social de la empresa (ej: 3.1.01).")
    )
    partner_provisional_withdrawal_account = models.ForeignKey(
        Account, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='settings_partner_prov_withdrawal',
        verbose_name=_("Cuenta Retiros Provisorios"),
        help_text=_("Cuenta padre de patrimonio (contra) para retiros provisorios de socios (ej: 3.1.05).")
    )
    partner_retained_earnings_account = models.ForeignKey(
        Account, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='settings_partner_retained',
        verbose_name=_("Cuenta Utilidades Retenidas"),
        help_text=_("Cuenta de patrimonio para utilidades retenidas (ej: 3.2.01).")
    )
    partner_current_year_earnings_account = models.ForeignKey(
        Account, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='settings_partner_current_earnings',
        verbose_name=_("Cuenta Utilidades del Ejercicio"),
        help_text=_("Cuenta de patrimonio para las utilidades del ejercicio vigente (ej: 3.2.02).")
    )
    partner_dividends_payable_account = models.ForeignKey(
        Account, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='settings_partner_dividends',
        verbose_name=_("Cuenta Dividendos por Pagar"),
        help_text=_("Cuenta de pasivo corriente para dividendos declarados pendientes de pago (ej: 2.1.07).")
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

    # Billing Compliance Model
    class BillingModel(models.TextChoices):
        ALWAYS_BOLETA = 'ALWAYS_BOLETA', _('Modelo A: Siempre emitir boleta (Incluso con pago electrónico)')
        TERMINAL_AS_BOLETA = 'TERMINAL_AS_BOLETA', _('Modelo B: Terminal reemplaza boleta (No emitir DTE 39/41 si hay comprobante DTE 48)')

    billing_model = models.CharField(
        _("Modelo de Emisión POS"),
        max_length=20,
        choices=BillingModel.choices,
        default=BillingModel.ALWAYS_BOLETA,
        help_text=_("Determina si se debe emitir boleta cuando se recibe un comprobante de pago electrónico de máquina en el POS.")
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
            try:
                old_obj = AccountingSettings.objects.get(pk=self.pk)
                old_prefixes = {
                    'ASSET': old_obj.asset_prefix,
                    'LIABILITY': old_obj.liability_prefix,
                    'EQUITY': old_obj.equity_prefix,
                    'INCOME': old_obj.income_prefix,
                    'EXPENSE': old_obj.expense_prefix,
                }
                old_sep = old_obj.code_separator
            except AccountingSettings.DoesNotExist:
                # If get_solo created it but it wasn't saved, it might not exist yet
                pass

        super().save(*args, **kwargs)

        # Invalidate Redis cache on every save
        from core.cache import invalidate_singleton, CACHE_KEY_ACCOUNTING_SETTINGS
        invalidate_singleton(CACHE_KEY_ACCOUNTING_SETTINGS)

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
        from core.cache import cached_singleton, CACHE_KEY_ACCOUNTING_SETTINGS
        return cached_singleton(cls, CACHE_KEY_ACCOUNTING_SETTINGS)

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

    class FormMeta:
        exclude_fields = []

    def __str__(self):
        return "Configuración Contable Global"

# --- Fiscal Year Closing ---

class FiscalYear(models.Model):
    """
    Represents a fiscal year (ejercicio contable).
    Tracks the annual closing process: closing P&L accounts and
    transferring the result to equity.
    """
    class Status(models.TextChoices):
        OPEN = 'OPEN', _('Abierto')
        CLOSING = 'CLOSING', _('En Proceso de Cierre')
        CLOSED = 'CLOSED', _('Cerrado')

    year = models.IntegerField(_("Año Fiscal"), unique=True)
    start_date = models.DateField(_("Fecha Inicio"))
    end_date = models.DateField(_("Fecha Fin"))
    status = models.CharField(
        _("Estado"), max_length=20,
        choices=Status.choices, default=Status.OPEN
    )

    # Closing metadata
    closing_entry = models.OneToOneField(
        'JournalEntry',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='fiscal_year_closing',
        verbose_name=_("Asiento de Cierre")
    )
    opening_entry = models.OneToOneField(
        'JournalEntry',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='fiscal_year_opening',
        verbose_name=_("Asiento de Apertura")
    )
    net_result = models.DecimalField(
        _("Resultado Neto"), max_digits=20, decimal_places=0,
        null=True, blank=True,
        help_text=_("Utilidad (+) o Pérdida (-) del ejercicio al momento del cierre.")
    )

    closed_at = models.DateTimeField(_("Cerrado el"), null=True, blank=True)
    closed_by = models.ForeignKey(
        'core.User',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='closed_fiscal_years',
        verbose_name=_("Cerrado por")
    )
    notes = models.TextField(_("Notas"), blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    history = HistoricalRecords()

    class Meta:
        ordering = ['-year']
        verbose_name = _("Ejercicio Fiscal")
        verbose_name_plural = _("Ejercicios Fiscales")
        permissions = [
            ('can_close_fiscal_year', 'Puede cerrar ejercicio fiscal'),
            ('can_reopen_fiscal_year', 'Puede reabrir ejercicio fiscal'),
        ]

    def __str__(self):
        return f"Ejercicio {self.year} ({self.get_status_display()})"

    @property
    def is_profit(self):
        return self.net_result is not None and self.net_result > 0

    @property
    def is_loss(self):
        return self.net_result is not None and self.net_result < 0


# --- Budgeting Models ---

class Budget(TimeStampedModel):
    # NOTE: created_at / updated_at heredados de TimeStampedModel (T-14).
    # Budget ya tenía created_at manual — migrado a TimeStampedModel; se añade updated_at.
    name = models.CharField(_("Nombre del Presupuesto"), max_length=255)
    start_date = models.DateField(_("Fecha Inicio"))
    end_date = models.DateField(_("Fecha Fin"))
    description = models.TextField(_("Descripción"), blank=True)

    class FormMeta:
        ui_layout = {
            'tabs': [
                {'id': 'main', 'label': 'General', 'fields': ['name', 'start_date', 'end_date', 'description']}
            ]
        }

    class Meta:
        ordering = ['-id']
        verbose_name = _("Presupuesto")
        verbose_name_plural = _("Presupuestos")

    def __str__(self):
        return f"{self.name} ({self.start_date} - {self.end_date})"

class BudgetItem(TimeStampedModel):
    # NOTE: created_at / updated_at heredados de TimeStampedModel (T-14).
    budget = models.ForeignKey(Budget, on_delete=models.CASCADE, related_name='items')
    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name='budget_items')
    year = models.IntegerField(_("Año"), default=2024)
    month = models.IntegerField(_("Mes"), default=1, help_text="Mes del presupuesto (1-12)")
    amount = models.DecimalField(_("Monto Presupuestado"), max_digits=20, decimal_places=0, validators=[MinValueValidator(0)])
    
    class FormMeta:
        ui_layout = {
            'tabs': [
                {'id': 'main', 'label': 'General', 'fields': ['budget', 'account', 'year', 'month', 'amount']}
            ]
        }

    class Meta:
        unique_together = ['budget', 'account', 'year', 'month']
        verbose_name = _("Item de Presupuesto")
        verbose_name_plural = _("Items de Presupuesto")

    def __str__(self):
        return f"{self.budget.name} - {self.account.name} ({self.year}/{self.month}): {self.amount}"
