from django.db import models
from django.utils.translation import gettext_lazy as _
from accounting.models import Account, AccountType
# from sales.models import SaleOrder
# from purchasing.models import PurchaseOrder
from simple_history.models import HistoricalRecords
from django.conf import settings
from django.utils import timezone
from core.utils import get_current_date
from django.core.validators import MinValueValidator
from django.core.exceptions import ValidationError
from core.validators import validate_file_size, validate_file_extension
from core.storages import PrivateMediaStorage


def get_default_date():
    """Compatibility wrapper for migrations."""
    return get_current_date()


class ReconciliationMatch(models.Model):
    """Agrupador para conciliaciones N:M"""
    treasury_account = models.ForeignKey(
        'TreasuryAccount',
        on_delete=models.PROTECT,
        related_name='reconciliation_matches',
        verbose_name=_("Cuenta de Tesorería")
    )
    
    # Estado del match
    is_confirmed = models.BooleanField(_("Confirmado"), default=False)
    confirmed_at = models.DateTimeField(_("Confirmado el"), null=True, blank=True)
    confirmed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='confirmed_matches',
        verbose_name=_("Confirmado Por")
    )
    
    # Auditoría
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='created_matches',
        verbose_name=_("Creado Por")
    )
    
    notes = models.TextField(_("Notas"), blank=True)
    
    # Tracking for transfers generated during reconciliation (e.g. cross-account match)
    transfer_journal_entries = models.ManyToManyField(
        'accounting.JournalEntry',
        related_name='reconciliation_matches_transfers',
        blank=True,
        verbose_name=_("Asientos de Transferencia")
    )
    
    history = HistoricalRecords()
    
    class Meta:
        verbose_name = _("Grupo de Conciliación")
        verbose_name_plural = _("Grupos de Conciliación")
        ordering = ['-created_at']

    def __str__(self):
        return f"Match #{self.id} ({self.status_display})"

    @property
    def status_display(self):
        return "Confirmado" if self.is_confirmed else "Borrador"


class TreasuryMovement(models.Model):
    class Type(models.TextChoices):
        # Unified Types
        INBOUND = 'INBOUND', _('Entrante (Cobro/Venta)')
        OUTBOUND = 'OUTBOUND', _('Saliente (Pago/Gasto)')
        TRANSFER = 'TRANSFER', _('Traspaso Interno')
        ADJUSTMENT = 'ADJUSTMENT', _('Ajuste')

    class Method(models.TextChoices):
        CASH = 'CASH', _('Efectivo')
        CARD = 'CARD', _('Tarjeta')
        TRANSFER = 'TRANSFER', _('Transferencia')
        CREDIT = 'CREDIT', _('Crédito')
        WRITE_OFF = 'WRITE_OFF', _('Castigo de Deuda')
        CREDIT_BALANCE = 'CREDIT_BALANCE', _('Saldo a Favor')
        OTHER = 'OTHER', _('Otro')

    class JustifyReason(models.TextChoices):
        COUNTING_ERROR = 'COUNTING_ERROR', _('Error de Conteo')
        THEFT = 'THEFT', _('Robo/Faltante')
        ROUNDING = 'ROUNDING', _('Redondeo')
        TIP = 'TIP', _('Propina')
        CASHBACK = 'CASHBACK', _('Vuelto Incorrecto')
        SYSTEM_ERROR = 'SYSTEM_ERROR', _('Error del Sistema')
        TRANSFER = 'TRANSFER', _('Traspaso de Efectivo')
        PARTNER_WITHDRAWAL = 'PARTNER_WITHDRAWAL', _('Retiro de Socio')
        CAPITAL_CONTRIBUTION = 'CAPITAL_CONTRIBUTION', _('Aporte de Capital (Socio)')
        OTHER_IN = 'OTHER_IN', _('Otro Ingreso')
        OTHER_OUT = 'OTHER_OUT', _('Otro Egreso')
        OPENING_ADJUSTMENT = 'OPENING_ADJUSTMENT', _('Ajuste de Apertura')
        RETIREMENT = 'RETIREMENT', _('Retiro de Cierre')
        UNKNOWN = 'UNKNOWN', _('Desconocido')

    movement_type = models.CharField(_("Tipo"), max_length=10, choices=Type.choices)
    payment_method = models.CharField(
        _("Método de Pago"), 
        max_length=20, 
        choices=Method.choices,
        default=Method.CASH
    )
    
    # Unified Source/Destination for Treasury Accounts
    # If None, it implies "External" (e.g. Customer/Supplier)
    from_account = models.ForeignKey(
        'TreasuryAccount',
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name='movements_from',
        verbose_name=_("Desde Cuenta (Origen)")
    )
    to_account = models.ForeignKey(
        'TreasuryAccount',
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name='movements_to',
        verbose_name=_("Hacia Cuenta (Destino)")
    )
    payment_method_new = models.ForeignKey(
        'PaymentMethod',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='movements',
        verbose_name=_("Método de Pago (Nuevo)")
    )
    terminal_device = models.ForeignKey(
        'PaymentTerminalDevice',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='movements',
        verbose_name=_("Dispositivo de Terminal"),
        help_text=_("Hardware usado para el cobro (si corresponde)")
    )

    # Legacy/Convenience access to the "Main" financial account involved (Snapshot)
    # Usually matches from_account.account (if OUTBOUND) or to_account.account (if INBOUND)
    account = models.ForeignKey(
        Account, 
        on_delete=models.PROTECT, 
        related_name='treasury_movements',
        null=True, 
        blank=True,
        verbose_name=_("Cuenta Contable (Snapshot)")
    )

    amount = models.DecimalField(_("Monto"), max_digits=12, decimal_places=2)
    date = models.DateField(_("Fecha"), default=get_current_date) # Changed from auto_now_add to allow manual date setting
    reference = models.CharField(_("Referencia"), max_length=100, blank=True)
    notes = models.TextField(_("Notas"), blank=True) # Added from CashMovement
    
    # Transfer details
    transaction_number = models.CharField(_("N° de Transacción"), max_length=100, blank=True, null=True)
    is_pending_registration = models.BooleanField(_("Transacción Pendiente de Registro"), default=False)
    
    # Unified contact field
    contact = models.ForeignKey('contacts.Contact', on_delete=models.SET_NULL, null=True, blank=True, related_name='treasury_movements')
    
    # Allocation
    invoice = models.ForeignKey('billing.Invoice', on_delete=models.SET_NULL, null=True, blank=True, related_name='payments')
    sale_order = models.ForeignKey('sales.SaleOrder', on_delete=models.SET_NULL, null=True, blank=True, related_name='payments')
    purchase_order = models.ForeignKey('purchasing.PurchaseOrder', on_delete=models.SET_NULL, null=True, blank=True, related_name='payments')
    class PayrollPaymentType(models.TextChoices):
        SALARY = 'SALARY', _('Sueldo')
        PREVIRED = 'PREVIRED', _('Previred')
        ADVANCE = 'ADVANCE', _('Anticipo')

    payroll = models.ForeignKey('hr.Payroll', on_delete=models.SET_NULL, null=True, blank=True, related_name='treasury_movements')
    payroll_payment_type = models.CharField(
        _("Tipo de Pago RRHH"), 
        max_length=20, 
        blank=True, 
        null=True, 
        choices=PayrollPaymentType.choices
    )

    # Link to Accounting
    journal_entry = models.OneToOneField(
        'accounting.JournalEntry',
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name='treasury_movement'
    )

    # Bank Reconciliation
    bank_statement_line = models.ForeignKey(
        'BankStatementLine',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='matched_movements',
        verbose_name=_("Línea de Cartola Bancaria"),
    )
    reconciliation_match = models.ForeignKey(
        'ReconciliationMatch',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='movements',
        verbose_name=_("Grupo de Conciliación")
    )
    is_reconciled = models.BooleanField(_("Reconciliado"), default=False)
    reconciled_at = models.DateTimeField(_("Fecha de Reconciliación"), null=True, blank=True)
    reconciled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='reconciled_movements',
        verbose_name=_("Reconciliado Por")
    )
    

    
    # POS Session
    pos_session = models.ForeignKey(
        'POSSession',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='movements',
        verbose_name=_("Sesión de Caja")
    )
    
    # Justification - from CashMovement
    justify_reason = models.CharField(
        _("Justificación"),
        max_length=50,
        choices=JustifyReason.choices,
        blank=True,
        null=True,
        help_text=_("Código de justificación para movimientos manuales")
    )

    terminal_provider = models.ForeignKey(
        'PaymentTerminalProvider',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='movements',
        verbose_name=_("Proveedor Terminal")
    )

    # Terminal batch linkage (for terminal payments)
    terminal_batch = models.ForeignKey(
        'TerminalBatch',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='payments',
        verbose_name=_("Lote Terminal"),
        help_text=_("Lote al que pertenece este pago (si es terminal)")
    )

    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='created_movements',
        verbose_name=_("Creado Por")
    )
    
    history = HistoricalRecords()

    class Meta:
        verbose_name = _("Movimiento de Tesorería")
        verbose_name_plural = _("Movimientos de Tesorería")
        ordering = ['-date', '-id']
        indexes = [
            models.Index(fields=['from_account', 'date']),
            models.Index(fields=['to_account', 'date']),
            models.Index(fields=['is_reconciled']),
            models.Index(fields=['transaction_number']),
            models.Index(fields=['reference']),
            # S2.4: Índices compuestos para queries de matching batch (B10)
            models.Index(fields=['from_account', 'date', 'is_reconciled'], name='idx_movement_from_date_recon'),
            models.Index(fields=['to_account', 'date', 'is_reconciled'], name='idx_movement_to_date_recon'),
        ]

    def __str__(self):
        return self.display_id

    @property
    def display_id(self):
        if self.payment_method == self.Method.WRITE_OFF:
            return f"CAS-{str(self.id).zfill(6)}"
            
        prefix = 'MOV'
        if self.movement_type == self.Type.INBOUND: prefix = 'DEP'
        elif self.movement_type == self.Type.OUTBOUND: prefix = 'RET'
        elif self.movement_type == self.Type.TRANSFER: prefix = 'TRAS'
        elif self.movement_type == self.Type.ADJUSTMENT: prefix = 'ADJ'
        return f"{prefix}-{str(self.id).zfill(6)}"

    @property
    def treasury_account(self):
        """Backwards compatibility / Convenience: Main account"""
        if self.movement_type == self.Type.INBOUND:
            return self.to_account
        elif self.movement_type == self.Type.OUTBOUND:
            return self.from_account
        elif self.movement_type == self.Type.TRANSFER:
            # Ambiguous, return from_account by default or None
            return self.from_account
        return None

    def save(self, *args, **kwargs):
        # Validate Accounting Period is not closed
        is_new = self.pk is None
        from tax.models import AccountingPeriod
        
        try:
            period = AccountingPeriod.objects.filter(
                year=self.date.year,
                month=self.date.month
            ).first()
            
            if period and period.status == AccountingPeriod.Status.CLOSED:
                # If modifying existing, we might allow cancellation (though treasury is usually final)
                # But for now, strictly follow the rule: No movements in closed periods.
                if is_new:
                    raise ValidationError(
                        _("No se puede registrar un movimiento de tesorería en un periodo contable cerrado (%(period)s).") % {'period': str(period)}
                    )
                else:
                    # In treasury, we rarely modify movements, but if we do, check original
                    # If the period is closed, we block any modification to avoid financial drift.
                    raise ValidationError(
                        _("No se puede modificar un movimiento de tesorería en un periodo contable cerrado.")
                    )
        except ValidationError:
            raise
        except Exception:
            # Fallback if period query fails (e.g. missing period record)
            # Usually we don't want to block if periods haven't been initialized
            pass

        super().save(*args, **kwargs)
        from core.cache import invalidate_report_cache
        invalidate_report_cache('treasury')
        invalidate_report_cache('contacts')

    def delete(self, *args, **kwargs):
        from core.cache import invalidate_report_cache
        invalidate_report_cache('treasury')
        invalidate_report_cache('contacts')
        super().delete(*args, **kwargs)

class TreasuryAccountManager(models.Manager):
    """Custom manager with query helpers for filtering by payment methods."""
    
    def with_payment_methods(self):
        """
        Retorna solo cuentas que tengan al menos un método de pago habilitado.
        Útil para flujos generales (HUB, Compras) donde se filtran todas las cuentas.
        
        Returns:
            QuerySet: Cuentas con al menos un método habilitado
        """
        return self.filter(
            models.Q(allows_cash=True) |
            models.Q(allows_card=True) |
            models.Q(allows_transfer=True)
        )
    
    def for_payment_method(self, payment_method):
        """
        Retorna cuentas compatibles con un método específico.
        
        Args:
            payment_method (str): Método de pago ('CASH', 'CARD', 'TRANSFER')
            
        Returns:
            QuerySet: Cuentas que soportan el método especificado
        """
        lookup = {
            'CASH': 'allows_cash',
            'CARD': 'allows_card',
            'TRANSFER': 'allows_transfer',
        }
        filter_key = lookup.get(payment_method)
        if not filter_key:
            return self.none()
        
        return self.filter(**{filter_key: True})


class TreasuryAccount(models.Model):
    class Type(models.TextChoices):
        CHECKING = 'CHECKING', _('Cuenta Bancaria (Corriente/Vista)')
        CREDIT_CARD = 'CREDIT_CARD', _('Tarjeta de Crédito (Cta. Propia)')
        DEBIT_CARD = 'DEBIT_CARD', _('Tarjeta de Débito (Cta. Propia)')
        CHECKBOOK = 'CHECKBOOK', _('Chequera / Instrumentos')
        CASH = 'CASH', _('Caja Física (Efectivo)')
        BRIDGE = 'BRIDGE', _('Puente')
        MERCHANT = 'MERCHANT', _('Cuenta Recaudadora')

    # Types que NO son efectivo/banco directo — usan prefijos contables distintos.
    _NON_CASH_EQUIVALENT_TYPES = frozenset({'BRIDGE', 'MERCHANT'})

    name = models.CharField(_("Nombre"), max_length=100)
    code = models.CharField(_("Código"), max_length=20, blank=True, null=True)
    currency = models.CharField(_("Moneda"), max_length=3, default='CLP')

    # Linked financial account (Asset -> Bank/Cash/Bridge)
    account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        limit_choices_to={'account_type': AccountType.ASSET},
        related_name='treasury_accounts',
        verbose_name=_("Cuenta Contable")
    )
    
    account_type = models.CharField(
        _("Tipo"), 
        max_length=20,  # Increased from 10 to accommodate new types
        choices=Type.choices,
        default=Type.CASH
    )
    bank = models.ForeignKey(
        'Bank',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='treasury_accounts',
        verbose_name=_("Banco")
    )
    account_number = models.CharField(
        _("N° de Cuenta Bancaria"),
        max_length=50,
        blank=True,
        null=True,
        help_text=_("Número de cuenta bancaria (solo para cuentas corrientes)")
    )
    default_bank_format = models.CharField(
        _("Formato Bancario por Defecto"),
        max_length=50,
        blank=True,
        null=True,
        help_text=_("Formato sugerido para esta cuenta al importar cartolas (ej: BANCO_CHILE_CSV)")
    )
    allows_cash = models.BooleanField(_("Permite Efectivo"), default=False)
    allows_card = models.BooleanField(_("Permite Tarjeta"), default=False)
    allows_transfer = models.BooleanField(_("Permite Traspaso"), default=False)
    allows_check = models.BooleanField(_("Permite Cheque"), default=False)

    # Custom manager
    objects = TreasuryAccountManager()

    class Meta:
        verbose_name = _("Cuenta de Tesorería")
        verbose_name_plural = _("Cuentas de Tesorería")
        ordering = ['-id']

    def __str__(self):
        return f"{self.name} ({self.currency})"

    def clean(self):
        """
        Validation Logic:
        1. Ensure Cash accounts have a unique accounting account.
        2. Validate account_number only for BANK type accounts.
        3. CHECKING accounts require bank and account_number.
        4. Credit/Debit cards require bank.
        5. CASH accounts cannot have bank.
        """
        from django.core.exceptions import ValidationError
        
        if self.account:
            # 1. Leaf account validation
            if not self.account.is_selectable:
                raise ValidationError({
                    'account': _("La cuenta contable debe ser una cuenta auxiliar (hoja) sin subcuentas.")
                })
            
            # 2. Account prefix validation: 1.1.01 for cash-equivalent; BRIDGE/MERCHANT use other AR/clearing prefixes.
            if self.account_type not in self._NON_CASH_EQUIVALENT_TYPES:
                if not self.account.code.startswith('1.1.01'):
                    raise ValidationError({
                        'account': _("La cuenta contable debe pertenecer al grupo de 'Efectivo y Equivalentes' (Prefijo 1.1.01).")
                    })

            # 3. Duplicate usage validation (already exists but refined)
            duplicates = TreasuryAccount.objects.filter(account=self.account).exclude(id=self.id)
            if duplicates.exists():
                dup_names = ", ".join([t.name for t in duplicates])
                raise ValidationError({
                    'account': _(f"La cuenta contable '{self.account.code}' ya está en uso por: {dup_names}. "
                                 "Cada cuenta de tesorería debe tener una cuenta contable exclusiva.")
                })
        
        # Validate CHECKING accounts
        if self.account_type == self.Type.CHECKING:
            if not self.bank:
                raise ValidationError({
                    'bank': _("Las cuentas corrientes requieren un banco asociado")
                })
            if not self.account_number:
                raise ValidationError({
                    'account_number': _("Las cuentas corrientes requieren número de cuenta")
                })
        
        # Validate Credit/Debit cards
        if self.account_type in [self.Type.CREDIT_CARD, self.Type.DEBIT_CARD]:
            if not self.bank:
                raise ValidationError({
                    'bank': _("Las tarjetas requieren un banco asociado")
                })
        
        # Validate CASH accounts
        if self.account_type == self.Type.CASH and self.bank:
            raise ValidationError({
                'bank': _("Las cajas de efectivo no deben tener banco asociado")
            })
        
        # Validate account_number only for bank-related accounts
        if self.account_number and self.account_type not in [self.Type.CHECKING, self.Type.CREDIT_CARD, self.Type.DEBIT_CARD]:
            raise ValidationError({
                'account_number': _("Solo las cuentas bancarias y tarjetas pueden tener número de cuenta")
            })
                
    def save(self, *args, **kwargs):
        self.clean()
        is_new = self.pk is None
        super().save(*args, **kwargs)

    @property
    def current_balance(self):
        """
        Returns the accounting balance of the linked account.
        If no account is linked, returns 0.
        """
        if self.account:
            return self.account.balance
        return 0
    
    history = HistoricalRecords()


class POSTerminal(models.Model):
    """
    Represents a physical POS terminal (point of sale hardware/software).
    Terminals can use multiple treasury accounts for payment processing.
    """
    name = models.CharField(
        _("Nombre del Terminal"),
        max_length=100,
        help_text=_("Ej: 'Caja 1', 'Mostrador Principal', 'Terminal Móvil'")
    )
    code = models.CharField(
        _("Código"),
        max_length=20,
        unique=True,
        help_text=_("Identificador único del terminal")
    )
    location = models.CharField(
        _("Ubicación"),
        max_length=200,
        blank=True,
        help_text=_("Ubicación física del terminal")
    )
    is_active = models.BooleanField(_("Activo"), default=True)
    
    # ManyToMany: Cuentas de tesorería permitidas para este terminal
    allowed_payment_methods = models.ManyToManyField(
        'PaymentMethod',
        related_name='pos_terminals',
        verbose_name=_("Métodos de Pago Permitidos"),
        help_text=_("Métodos de pago específicos permitidos en este terminal"),
        blank=True
    )

    # ManyToMany: Cuentas de tesorería permitidas para este terminal (Legacy/Optional)
    allowed_treasury_accounts = models.ManyToManyField(
        'TreasuryAccount',
        related_name='pos_terminals',
        verbose_name=_("Cuentas de Tesorería (Legacy)"),
        help_text=_("DEPRECATED: Use allowed_payment_methods instead"),
        blank=True
    )
    
    # Cuenta predeterminada (para sugerencias en UI)
    default_treasury_account = models.ForeignKey(
        'TreasuryAccount',
        on_delete=models.PROTECT,
        related_name='default_for_terminals',
        null=True,
        blank=True,
        verbose_name=_("Cuenta de Tesorería por Defecto"),
        help_text=_("Cuenta predeterminada al iniciar sesión")
    )
    
    payment_terminal_device = models.ForeignKey(
        'PaymentTerminalDevice',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='pos_terminals',
        verbose_name=_("Dispositivo de Terminal"),
        help_text=_("Dispositivo físico vinculado a esta caja para cobros integrados")
    )
    
    # Hardware information (optional)
    serial_number = models.CharField(
        _("Número de Serie"),
        max_length=100,
        blank=True
    )
    ip_address = models.GenericIPAddressField(
        _("Dirección IP"),
        null=True,
        blank=True
    )
    
    @property
    def payment_terminal_device_name(self):
        return self.payment_terminal_device.name if self.payment_terminal_device else None
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    history = HistoricalRecords()
    
    class Meta:
        verbose_name = _("Terminal POS")
        verbose_name_plural = _("Terminales POS")
        ordering = ['code']
    
    def __str__(self):
        return f"{self.name} ({self.code})"
    
    @property
    def allowed_payment_method_types(self):
        """
        Tipos de métodos de pago permitidos en este terminal.
        Sustituye DEBIT_CARD y CREDIT_CARD por 'CARD' para agrupar en la UI.
        """
        types = set()
        for mt in self.allowed_payment_methods.values_list('method_type', flat=True):
            if mt in ['DEBIT_CARD', 'CREDIT_CARD']:
                types.add('CARD')
            else:
                types.add(mt)
        return sorted(list(types))
    
    def get_accounts_for_method(self, payment_method):
        """
        Retorna cuentas de tesorería permitidas que soporten el método dado.
        
        Args:
            payment_method (str): Método de pago ('CASH', 'CARD', 'TRANSFER')
            
        Returns:
            QuerySet[TreasuryAccount]: Cuentas compatibles con el método
        """
        # Mapping from generic payment buttons to specific backend types
        method_types = {
            'CASH': ['CASH'],
            'CARD': ['DEBIT_CARD', 'CREDIT_CARD'],
            'CARD_TERMINAL': ['CARD_TERMINAL'],
            'TRANSFER': ['TRANSFER'],
            'CHECK': ['CHECK'],
        }.get(payment_method, [payment_method])

        # Get accounts and their IDs from allowed payment methods
        account_ids = self.allowed_payment_methods.filter(
            method_type__in=method_types,
            is_active=True
        ).values_list('treasury_account_id', flat=True)

        return TreasuryAccount.objects.filter(id__in=account_ids)


class BankStatement(models.Model):
    """Cartola bancaria importada"""
    
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', _('Borrador')
        CONFIRMED = 'CONFIRMED', _('Confirmado')
        CANCELLED = 'CANCELLED', _('Cancelado')
    
    State = Status # Alias for backward compatibility
    
    treasury_account = models.ForeignKey(
        'TreasuryAccount',
        on_delete=models.PROTECT,
        related_name='bank_statements',
        verbose_name=_("Cuenta de Tesorería")
    )
    statement_date = models.DateField(_("Fecha de la Cartola"))
    period_start = models.DateField(
        _("Inicio del Periodo"),
        null=True,
        help_text=_("Fecha de la transacción más antigua incluida")
    )
    period_end = models.DateField(
        _("Fin del Periodo"),
        null=True,
        help_text=_("Fecha de la transacción más reciente incluida")
    )
    opening_balance = models.DecimalField(
        _("Balance de Apertura"), 
        max_digits=20, 
        decimal_places=2
    )
    closing_balance = models.DecimalField(
        _("Balance de Cierre"), 
        max_digits=20, 
        decimal_places=2
    )
    file = models.FileField(
        _("Archivo"), 
        upload_to='bank_statements/', 
        storage=PrivateMediaStorage(),
        null=True, 
        blank=True,
        validators=[validate_file_size, validate_file_extension]
    )
    imported_at = models.DateTimeField(_("Importado el"), auto_now_add=True)
    imported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='imported_statements',
        verbose_name=_("Importado Por")
    )
    status = models.CharField(
        _("Estado"), 
        max_length=20, 
        choices=Status.choices, 
        default=Status.DRAFT
    )
    
    @property
    def state(self):
        return self.status
    
    # Metadatos
    bank_format = models.CharField(
        _("Formato Bancario"), 
        max_length=50, 
        default='GENERIC_CSV',
        help_text=_("Formato usado para parsear el archivo (ej: BANCO_CHILE_CSV, GENERIC_CSV)")
    )
    total_lines = models.IntegerField(_("Total de Líneas"), default=0)

    @property
    def reconciled_lines(self):
        return self.lines.filter(reconciliation_status='RECONCILED').count()
    
    file_hash = models.CharField(
        _("Hash del Archivo"), 
        max_length=64, 
        unique=True, 
        null=True, 
        blank=True,
        help_text=_("Hash SHA-256 para evitar duplicidad de archivos")
    )
    
    notes = models.TextField(_("Notas"), blank=True)
    
    history = HistoricalRecords()
    
    class Meta:
        verbose_name = _("Cartola Bancaria")
        verbose_name_plural = _("Cartolas Bancarias")
        ordering = ['-statement_date', '-id']
        indexes = [
            models.Index(fields=['statement_date', 'treasury_account']),
        ]
    
    def __str__(self):
        return f"{self.treasury_account.name} - {self.statement_date}"
    
    @property
    def display_id(self):
        return f"EXT-{str(self.id).zfill(6)}"
    
    @property
    def reconciliation_progress(self):
        """Retorna porcentaje de reconciliación"""
        if self.total_lines == 0:
            return 0
        return round((self.reconciled_lines / self.total_lines) * 100, 1)


class BankStatementLine(models.Model):
    """Línea individual de la cartola bancaria"""
    
    class ReconciliationStatus(models.TextChoices):
        UNRECONCILED = 'UNRECONCILED', _('No Reconciliado')
        MATCHED = 'MATCHED', _('Matched (Pendiente Confirmar)')
        RECONCILED = 'RECONCILED', _('Reconciliado')
        DISPUTED = 'DISPUTED', _('En Disputa')
        EXCLUDED = 'EXCLUDED', _('Excluido')
    
    ReconciliationState = ReconciliationStatus # Alias
    
    statement = models.ForeignKey(
        'BankStatement',
        on_delete=models.CASCADE,
        related_name='lines',
        verbose_name=_("Cartola")
    )
    line_number = models.IntegerField(_("N° de Línea"))
    
    # Datos bancarios
    transaction_date = models.DateField(_("Fecha de Transacción"))
    value_date = models.DateField(_("Fecha Valor"), null=True, blank=True)
    description = models.TextField(_("Descripción"))
    reference = models.CharField(_("Referencia"), max_length=200, blank=True)
    transaction_id = models.CharField(
        _("ID de Transacción"), 
        max_length=100, 
        blank=True,
        help_text=_("ID único del banco para esta transacción")
    )
    
    # Montos
    debit = models.DecimalField(
        _("Cargo"), 
        max_digits=20, 
        decimal_places=2, 
        default=0
    )
    credit = models.DecimalField(
        _("Abono"), 
        max_digits=20, 
        decimal_places=2, 
        default=0
    )
    balance = models.DecimalField(
        _("Balance Resultante"), 
        max_digits=20, 
        decimal_places=2
    )
    
    # Conciliación
    reconciliation_status = models.CharField(
        _("Estado de Reconciliación"),
        max_length=20,
        choices=ReconciliationStatus.choices,
        default=ReconciliationStatus.UNRECONCILED
    )
    
    @property
    def reconciliation_state(self):
        return self.reconciliation_status
    reconciliation_match = models.ForeignKey(
        'ReconciliationMatch',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='lines',
        verbose_name=_("Grupo de Conciliación")
    )
    reconciled_at = models.DateTimeField(_("Reconciliado el"), null=True, blank=True)
    reconciled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='reconciled_lines',
        verbose_name=_("Reconciliado Por")
    )
    
    # Diferencias (para fase 2)
    difference_amount = models.DecimalField(
        _("Diferencia"), 
        max_digits=20, 
        decimal_places=2, 
        default=0
    )
    difference_reason = models.CharField(
        _("Razón de Diferencia"), 
        max_length=50, 
        blank=True,
        help_text=_("COMMISSION, INTEREST, ERROR, etc.")
    )
    difference_journal_entry = models.ForeignKey(
        'accounting.JournalEntry',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='reconciliation_adjustments',
        verbose_name=_("Asiento de Ajuste")
    )
    
    # Advertencias de importación
    has_warning = models.BooleanField(_("Tiene Advertencia"), default=False)
    warning_message = models.TextField(_("Mensaje de Advertencia"), blank=True, null=True)
    
    # Notas
    notes = models.TextField(_("Notas"), blank=True)
    
    # Exclusión
    class ExclusionReason(models.TextChoices):
        DUPLICATE = 'DUPLICATE', _('Transacción Duplicada')
        INTERNAL = 'INTERNAL', _('Traspaso Interno no Conciliable')
        ADJUSTMENT = 'ADJUSTMENT', _('Ajuste de Saldo')
        ERROR = 'ERROR', _('Error de Importación / Datos Corruptos')
        OTHER = 'OTHER', _('Otro (Especificar en notas)')

    exclusion_reason = models.CharField(
        _("Razón de Exclusión"),
        max_length=50,
        choices=ExclusionReason.choices,
        blank=True,
        null=True
    )
    exclusion_notes = models.TextField(
        _("Notas de Exclusión"),
        blank=True,
        null=True
    )
    
    history = HistoricalRecords()
    
    class Meta:
        verbose_name = _("Línea de Cartola")
        verbose_name_plural = _("Líneas de Cartola")
        ordering = ['statement', 'line_number']
        unique_together = [['statement', 'line_number']]
        indexes = [
            models.Index(fields=['reconciliation_status']),
            models.Index(fields=['transaction_date']),
            models.Index(fields=['statement', 'reconciliation_status']),
            models.Index(fields=['transaction_id']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['statement', 'transaction_id'],
                condition=~models.Q(transaction_id=''),
                name='uniq_stmt_txnid'
            )
        ]

    def __str__(self):
        return f"{self.statement.display_id} - Línea {self.line_number}"
    
    @property
    def amount(self):
        """Retorna el monto neto (credit - debit)"""
        return self.credit - self.debit


class ReconciliationSettings(models.Model):
    """Configuración global de conciliación por cuenta de tesorería"""
    treasury_account = models.OneToOneField(
        'TreasuryAccount',
        on_delete=models.CASCADE,
        related_name='reconciliation_settings',
        verbose_name=_("Cuenta de Tesorería"),
        null=True,
        blank=True
    )
    
    # Pesos de scoring (Importancia)
    amount_weight = models.IntegerField(_("Peso del Monto"), default=40)
    date_weight = models.IntegerField(_("Peso de la Fecha"), default=30)
    reference_weight = models.IntegerField(_("Peso de la Referencia"), default=20)
    contact_weight = models.IntegerField(_("Peso del Contacto"), default=10)
    
    # Umbrales
    confidence_threshold = models.IntegerField(
        _("Umbral de Confianza"), 
        default=90,
        help_text=_("Puntaje mínimo para sugerir o auto-conciliar (0-100)")
    )
    
    # Filtros
    date_range_days = models.IntegerField(
        _("Rango de Búsqueda (Días)"), 
        default=30,
        help_text=_("Días hacia atrás/adelante para buscar candidatos")
    )
    
    auto_confirm = models.BooleanField(
        _("Auto-confirmar"),
        default=False,
        help_text=_("Si es True, el sistema concilia automáticamente sobre el umbral de confianza")
    )

    updated_at = models.DateTimeField(auto_now=True)
    history = HistoricalRecords()

    class Meta:
        verbose_name = _("Inteligencia de Conciliación")
        verbose_name_plural = _("Inteligencia de Conciliación")
    
    @classmethod
    def get_for_account(cls, account=None):
        """
        Obtiene la configuración de inteligencia global.
        (Configuración unificada para todas las cuentas).
        """
        settings = cls.objects.filter(treasury_account__isnull=True).first()
        
        if not settings:
            # Fallback a valores default si no hay nada en DB
            return cls(
                amount_weight=40,
                date_weight=30,
                reference_weight=20,
                contact_weight=10,
                confidence_threshold=90,
                date_range_days=30
            )
        return settings

    def __str__(self):
        return "Inteligencia de Conciliación Global"




class Bank(models.Model):
    """Bancos institucionales"""
    name = models.CharField(_("Nombre"), max_length=100)
    code = models.CharField(_("Código"), max_length=20, blank=True, null=True)
    swift_code = models.CharField(
        _("Código SWIFT/BIC"),
        max_length=11,
        blank=True,
        null=True,
        help_text=_("Código internacional para transferencias")
    )
    is_active = models.BooleanField(_("Activo"), default=True)
    
    # Ejecutivos de cuenta
    account_executives = models.ManyToManyField(
        'contacts.Contact',
        blank=True,
        related_name='managed_banks',
        verbose_name=_("Ejecutivos de Cuenta"),
        help_text=_("Contactos que son ejecutivos de este banco")
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    history = HistoricalRecords()

    class Meta:
        verbose_name = _("Banco")
        verbose_name_plural = _("Bancos")
        ordering = ['name']

    def __str__(self):
        return self.name




class PaymentTerminalProvider(models.Model):
    """
    Proveedor de terminal de cobro (Transbank, TUU, etc.).
    Encapsula la configuración contable, comisiones y gateway.
    """
    class ProviderType(models.TextChoices):
        TRANSBANK = 'TRANSBANK', _('Transbank')
        TUU = 'TUU', _('TUU / Haulmer')
        MERCADOPAGO = 'MERCADOPAGO', _('MercadoPago')
        FINTOC = 'FINTOC', _('Fintoc')
        FLOW = 'FLOW', _('Flow')
        MANUAL = 'MANUAL', _('Manual en Máquina (Genérico)')

    name = models.CharField(_("Nombre"), max_length=100)
    provider_type = models.CharField(
        _("Tipo de Proveedor"), max_length=20,
        choices=ProviderType.choices, default=ProviderType.MANUAL
    )
    supplier = models.ForeignKey(
        'contacts.Contact', on_delete=models.PROTECT,
        related_name='terminal_providers',
        verbose_name=_("Proveedor (Contacto)")
    )
    is_active = models.BooleanField(_("Activo"), default=True)
    notes = models.TextField(_("Notas"), blank=True)

    # Configuración Contable
    receivable_account = models.ForeignKey(
        'accounting.Account', on_delete=models.PROTECT,
        related_name='terminal_provider_receivable',
        verbose_name=_("Cuenta Por Cobrar Terminal")
    )
    commission_expense_account = models.ForeignKey(
        'accounting.Account', on_delete=models.PROTECT,
        related_name='terminal_provider_commission',
        verbose_name=_("Cuenta Gasto Comisión")
    )
    commission_iva_account = models.ForeignKey(
        'accounting.Account', on_delete=models.PROTECT,
        related_name='terminal_provider_iva',
        verbose_name=_("Cuenta IVA Comisión")
    )
    commission_product = models.ForeignKey(
        'inventory.Product', on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='terminal_commission_providers',
        verbose_name=_("Producto Servicio Comisión")
    )
    bank_treasury_account = models.ForeignKey(
        'TreasuryAccount', on_delete=models.PROTECT,
        related_name='terminal_providers',
        verbose_name=_("Cuenta Destino Liquidación")
    )

    gateway_config = models.JSONField(
        _("Configuración de Gateway"), default=dict, blank=True
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    history = HistoricalRecords()

    class Meta:
        verbose_name = _("Proveedor de Terminal")
        verbose_name_plural = _("Proveedores de Terminal")
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.get_provider_type_display()})"

    # Clave para el secreto cifrado dentro de gateway_config
    _API_KEY_FIELD = "api_key_encrypted"

    def get_api_key(self) -> str:
        """Retorna la API key en claro. Vacío si no hay credencial configurada."""
        from core.crypto import decrypt_secret
        token = (self.gateway_config or {}).get(self._API_KEY_FIELD, "")
        return decrypt_secret(token) if token else ""

    def set_api_key(self, plaintext: str) -> None:
        """Cifra y persiste la API key en gateway_config. Llamar save() aparte."""
        from core.crypto import encrypt_secret
        cfg = dict(self.gateway_config or {})
        if plaintext:
            cfg[self._API_KEY_FIELD] = encrypt_secret(plaintext)
        else:
            cfg.pop(self._API_KEY_FIELD, None)
        self.gateway_config = cfg


class PaymentTerminalDevice(models.Model):
    """
    Representa el hardware/dispositivo físico de cobro (la 'maquinita').
    Distingue la máquina de transbank/TUU separada del POS del ERP.
    """
    class Status(models.TextChoices):
        ACTIVE = 'ACTIVE', _('Activo')
        INACTIVE = 'INACTIVE', _('Inactivo')
        MAINTENANCE = 'MAINTENANCE', _('En Mantención')

    name = models.CharField(_("Nombre / Alias"), max_length=100, help_text=_("Ej: Terminal Barra 1"))
    provider = models.ForeignKey(
        PaymentTerminalProvider, on_delete=models.CASCADE,
        related_name='devices',
        verbose_name=_("Proveedor")
    )
    serial_number = models.CharField(
        _("Número de Serie Interno / ID Dispositivo"), 
        max_length=100, 
        help_text=_("ID único que el proveedor asigna a este dispositivo físico (ej: TU1245)")
    )
    status = models.CharField(_("Estado"), max_length=20, choices=Status.choices, default=Status.ACTIVE)
    notes = models.TextField(_("Notas"), blank=True)
    
    supported_payment_methods = models.JSONField(
        _("Métodos Soportados"), 
        default=list, 
        blank=True,
        help_text=_("Lista de códigos soportados. 1: Crédito, 2: Débito. Ej: [1, 2]")
    )
    device_config = models.JSONField(_("Configuración del Dispositivo"), default=dict, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    history = HistoricalRecords()

    class Meta:
        verbose_name = _("Dispositivo de Terminal")
        verbose_name_plural = _("Dispositivos de Terminal")
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.serial_number})"

class PaymentMethod(models.Model):
    """Métodos de pago específicos asociados a una cuenta de tesorería"""
    class Type(models.TextChoices):
        CASH = 'CASH', _('Efectivo Directo')
        CARD = 'CARD', _('Tarjeta (Manual)')
        DEBIT_CARD = 'DEBIT_CARD', _('Tarjeta Débito Empresa')
        CREDIT_CARD = 'CREDIT_CARD', _('Tarjeta Crédito Empresa')
        CARD_TERMINAL = 'CARD_TERMINAL', _('Tarjeta (Terminal POS Integrado)')
        TRANSFER = 'TRANSFER', _('Transferencia Bancaria')
        CHECK = 'CHECK', _('Cheque')

    name = models.CharField(_("Nombre"), max_length=100)
    method_type = models.CharField(_("Tipo de Método"), max_length=20, choices=Type.choices)
    treasury_account = models.ForeignKey(
        'TreasuryAccount',
        on_delete=models.CASCADE,
        related_name='payment_methods',
        verbose_name=_("Cuenta de Tesorería Visible"),
        help_text=_("Cuenta mostrada al operador. Para contabilidad usar effective_settlement_account.")
    )
    settlement_account = models.ForeignKey(
        'TreasuryAccount',
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name='payment_methods_as_settlement',
        verbose_name=_("Cuenta de Liquidación"),
        help_text=_("Cuenta destino contable real. Para CARD_TERMINAL: cuenta puente del proveedor.")
    )
    is_active = models.BooleanField(_("Activo"), default=True)
    linked_terminal_device = models.ForeignKey(
        'PaymentTerminalDevice',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='card_terminal_methods',
        verbose_name=_("Dispositivo Terminal Vinculado"),
        help_text=_("Solo para CARD_TERMINAL — el device TUU que automatiza este método.")
    )
    allow_for_sales = models.BooleanField(_("Permitir en Ventas"), default=True)
    allow_for_purchases = models.BooleanField(_("Permitir en Compras"), default=True)
    
    # Optional settings per method
    requires_reference = models.BooleanField(_("Requiere Referencia"), default=False)
    notes = models.TextField(_("Notas"), blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    history = HistoricalRecords()

    class Meta:
        verbose_name = _("Método de Pago")
        verbose_name_plural = _("Métodos de Pago")
        ordering = ['name']

    # Mapeo de compatibilidad tipo cuenta ↔ método de pago
    TYPE_COMPATIBILITY = {
        Type.CASH: [TreasuryAccount.Type.CASH],
        Type.DEBIT_CARD: [TreasuryAccount.Type.DEBIT_CARD, TreasuryAccount.Type.CREDIT_CARD, TreasuryAccount.Type.CHECKING],
        Type.CREDIT_CARD: [TreasuryAccount.Type.DEBIT_CARD, TreasuryAccount.Type.CREDIT_CARD, TreasuryAccount.Type.CHECKING],
        Type.CARD_TERMINAL: [TreasuryAccount.Type.DEBIT_CARD, TreasuryAccount.Type.CREDIT_CARD, TreasuryAccount.Type.CHECKING],
        Type.TRANSFER: [TreasuryAccount.Type.CHECKING],
        Type.CHECK: [TreasuryAccount.Type.CHECKING, TreasuryAccount.Type.CHECKBOOK],
    }

    def __str__(self):
        return f"{self.name} ({self.treasury_account.name})"

    @property
    def is_integrated(self):
        """True si el método tiene integración remota con un terminal físico."""
        return self.method_type == self.Type.CARD_TERMINAL and self.linked_terminal_device_id is not None

    @property
    def effective_settlement_account(self):
        """
        Cuenta destino real del cobro.
        Precedencia: settlement_account explícito → provider.bank_treasury_account (CARD_TERMINAL) → treasury_account.
        """
        if self.settlement_account_id:
            return self.settlement_account
        if self.is_integrated and self.linked_terminal_device.provider.bank_treasury_account_id:
            return self.linked_terminal_device.provider.bank_treasury_account
        return self.treasury_account

    def clean(self):
        """Validar compatibilidad entre método y tipo de cuenta"""
        from django.core.exceptions import ValidationError
        super().clean()

        # DEBIT_CARD / CREDIT_CARD → solo compras
        if self.method_type in (self.Type.DEBIT_CARD, self.Type.CREDIT_CARD):
            self.allow_for_sales = False

        # CARD_TERMINAL → solo ventas, requiere device vinculado
        if self.method_type == self.Type.CARD_TERMINAL:
            self.allow_for_purchases = False
            if not self.linked_terminal_device_id:
                raise ValidationError(
                    {'linked_terminal_device': _("CARD_TERMINAL requiere un dispositivo terminal vinculado.")}
                )

            # Auto-asignar y bloquear settlement_account desde provider.bank_treasury_account.
            # El operador no puede sobrescribir esta cuenta — la define el proveedor.
            provider_bridge = self.linked_terminal_device.provider.bank_treasury_account
            if provider_bridge is None:
                raise ValidationError(
                    {'linked_terminal_device': _(
                        "El proveedor del dispositivo no tiene cuenta destino de liquidación configurada. "
                        "Configure 'Cuenta Destino Liquidación' en el Proveedor de Terminal antes de crear este método."
                    )}
                )
            if self.settlement_account_id and self.settlement_account_id != provider_bridge.pk:
                raise ValidationError(
                    {'settlement_account': _(
                        "La cuenta de liquidación de métodos CARD_TERMINAL está gestionada por el sistema "
                        "y se asigna automáticamente desde el proveedor del dispositivo. "
                        f"Cuenta asignada: {provider_bridge.name}."
                    )}
                )
            # Forzar siempre la cuenta del proveedor (auto-sync)
            self.settlement_account = provider_bridge

        if not self.treasury_account_id:
            return

        # CARD_TERMINAL: cuenta resuelta arriba, no aplicar TYPE_COMPATIBILITY.
        if self.method_type == self.Type.CARD_TERMINAL:
            return

        allowed_account_types = self.TYPE_COMPATIBILITY.get(self.method_type, [])
        if allowed_account_types and self.treasury_account.account_type not in allowed_account_types:
            account_type_display = dict(TreasuryAccount.Type.choices).get(
                self.treasury_account.account_type,
                self.treasury_account.account_type
            )
            method_type_display = dict(self.Type.choices).get(self.method_type, self.method_type)

            raise ValidationError({
                'treasury_account': _(
                    f"El método '{method_type_display}' no es compatible "
                    f"con cuentas de tipo '{account_type_display}'. "
                    f"Tipos permitidos: {', '.join(allowed_account_types)}"
                )
            })

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)


class TerminalBatch(models.Model):
    """
    Lote diario de ventas con terminal que se liquida en conjunto.
    Representa la información que el terminal entrega 1-2 días después.
    """
    
    class Status(models.TextChoices):
        PENDING = 'PENDING', _('Pendiente Liquidación')
        SETTLED = 'SETTLED', _('Liquidado')
        RECONCILED = 'RECONCILED', _('Reconciliado')
        INVOICED = 'INVOICED', _('Facturado')
    
    # Identificación
    provider = models.ForeignKey(
        'PaymentTerminalProvider',
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name='batches',
        verbose_name=_("Proveedor de Terminal")
    )
    
    payment_method = models.ForeignKey(
        'PaymentMethod',
        on_delete=models.PROTECT,
        related_name='batches',
        verbose_name=_("Método de Pago (Terminal)")
    )
    
    # Fechas
    sales_date = models.DateField(
        _("Fecha de Ventas (Desde)"),
        help_text=_("Día en que se realizaron las ventas (o inicio del rango)")
    )
    sales_date_end = models.DateField(
        _("Fecha de Ventas (Hasta)"),
        null=True, blank=True,
        help_text=_("Fin del rango de ventas (si abarca varios días)")
    )
    settlement_date = models.DateField(
        _("Fecha de Liquidación"),
        help_text=_("Día en que el terminal informó la comisión")
    )
    deposit_date = models.DateField(
        _("Fecha de Depósito"),
        null=True, blank=True,
        help_text=_("Día en que llegó el dinero al banco")
    )
    
    # Montos (informados por el terminal)
    gross_amount = models.DecimalField(
        _("Monto Bruto"),
        max_digits=12, decimal_places=2,
        help_text=_("Total de ventas del día")
    )
    
    commission_base = models.DecimalField(
        _("Comisión Neta"),
        max_digits=12, decimal_places=2,
        help_text=_("Comisión sin IVA")
    )
    
    commission_tax = models.DecimalField(
        _("IVA Comisión"),
        max_digits=12, decimal_places=2,
        help_text=_("IVA sobre la comisión")
    )
    
    commission_total = models.DecimalField(
        _("Comisión Total"),
        max_digits=12, decimal_places=2,
        help_text=_("Comisión + IVA")
    )
    
    net_amount = models.DecimalField(
        _("Monto Neto Depositado"),
        max_digits=12, decimal_places=2,
        help_text=_("Monto que llegó al banco")
    )
    
    # Referencia del terminal
    terminal_reference = models.CharField(
        _("Referencia Terminal"),
        max_length=100,
        blank=True,
        help_text=_("Número de lote o referencia del terminal")
    )
    
    # Estado
    status = models.CharField(
        _("Estado"),
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING
    )
    
    # Asiento contable de ajuste (Etapa 2)
    settlement_journal_entry = models.ForeignKey(
        'accounting.JournalEntry',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='terminal_batch_settlements',
        verbose_name=_("Asiento de Liquidación")
    )
    
    # Conciliación bancaria
    bank_statement_line = models.ForeignKey(
        'BankStatementLine',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='terminal_batches',
        verbose_name=_("Línea de Cartola")
    )
    
    reconciliation_match = models.ForeignKey(
        'ReconciliationMatch',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='terminal_batches',
        verbose_name=_("Grupo de Conciliación")
    )
    
    # Movimiento de liquidación (creado automáticamente al liquidar)
    settlement_movement = models.OneToOneField(
        'TreasuryMovement',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='settlement_batch',
        verbose_name=_("Movimiento de Liquidación"),
        help_text=_("Movimiento INBOUND creado automáticamente al liquidar el lote")
    )
    
    # Facturación
    supplier_invoice = models.ForeignKey(
        'billing.Invoice',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='terminal_batches',
        verbose_name=_("Factura Proveedor")
    )
    
    # Auditoría
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='created_terminal_batches'
    )
    
    notes = models.TextField(_("Notas"), blank=True)
    
    history = HistoricalRecords()
    
    class Meta:
        verbose_name = _("Lote Terminal")
        verbose_name_plural = _("Lotes Terminal")
        ordering = ['-sales_date', '-id']
        unique_together = [['provider', 'sales_date', 'terminal_reference']]
        indexes = [
            models.Index(fields=['provider', 'sales_date']),
            models.Index(fields=['status']),
        ]
    
    def __str__(self):
        return f"{self.provider.name} - {self.sales_date} (${self.gross_amount})"
    
    @property
    def payment_count(self):
        """Número de pagos individuales en este lote"""
        return self.payments.count()
    
    @property
    def display_id(self):
        return f"LOTE-{str(self.id).zfill(6)}"
    
    def clean(self):
        """Validar que net_amount = gross_amount - commission_total"""
        from django.core.exceptions import ValidationError
        from decimal import Decimal
        super().clean()
        
        expected_net = self.gross_amount - self.commission_total
        if abs(self.net_amount - expected_net) > Decimal('0.01'):
            raise ValidationError({
                'net_amount': _(
                    f"El monto neto debe ser bruto - comisión. "
                    f"Esperado: ${expected_net}, Recibido: ${self.net_amount}"
                )
            })
    
    def save(self, *args, **kwargs):
        # Auto-calculate commission_total if not set
        if not self.commission_total:
            self.commission_total = self.commission_base + self.commission_tax
        
        self.clean()
        super().save(*args, **kwargs)





class POSSession(models.Model):
    """
    Represents a cashier's session (shift) in the POS.
    Each session has an opening and closing time, with cash control.
    """
    class Status(models.TextChoices):
        OPEN = 'OPEN', _('Abierta')
        CLOSED = 'CLOSED', _('Cerrada')
    
    # New: Terminal reference (replaces direct treasury_account)
    terminal = models.ForeignKey(
        'POSTerminal',
        on_delete=models.PROTECT,
        null=True,  # Allow null during migration
        blank=True,
        related_name='sessions',
        verbose_name=_("Terminal POS"),
        help_text=_("Terminal donde se realizó esta sesión")
    )
    
    # Legacy: Keep for retrocompatibility during migration
    treasury_account = models.ForeignKey(
        'TreasuryAccount',
        on_delete=models.PROTECT,
        null=True,  # Now nullable
        blank=True,
        related_name='pos_sessions',
        verbose_name=_("Caja (Legacy)"),
        help_text=_("DEPRECATED: Use terminal.default_treasury_account")
    )
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='pos_sessions',
        verbose_name=_("Cajero")
    )
    
    status = models.CharField(
        _("Estado"),
        max_length=10,
        choices=Status.choices,
        default=Status.OPEN
    )
    
    # Opening
    opened_at = models.DateTimeField(_("Abierta el"), auto_now_add=True)
    opening_balance = models.DecimalField(
        _("Fondo de Caja Inicial"),
        max_digits=12,
        decimal_places=2,
        default=0,
        help_text=_("Monto de efectivo declarado al abrir la caja")
    )
    
    # Closing
    closed_at = models.DateTimeField(_("Cerrada el"), null=True, blank=True)
    closed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='closed_pos_sessions',
        verbose_name=_("Cerrada Por")
    )
    
    # Totals (calculated at close)
    total_cash_sales = models.DecimalField(
        _("Total Ventas Efectivo"),
        max_digits=12,
        decimal_places=2,
        default=0
    )
    total_card_sales = models.DecimalField(
        _("Total Ventas Tarjeta"),
        max_digits=12,
        decimal_places=2,
        default=0
    )
    total_transfer_sales = models.DecimalField(
        _("Total Ventas Transferencia"),
        max_digits=12,
        decimal_places=2,
        default=0
    )
    total_credit_sales = models.DecimalField(
        _("Total Ventas Crédito"),
        max_digits=12,
        decimal_places=2,
        default=0
    )
    
    total_other_cash_inflow = models.DecimalField(
        _("Otros Ingresos Efectivo"),
        max_digits=12,
        decimal_places=2,
        default=0
    )
    total_other_cash_outflow = models.DecimalField(
        _("Egresos Efectivo"),
        max_digits=12,
        decimal_places=2,
        default=0
    )
    
    notes = models.TextField(_("Notas"), blank=True)
    
    history = HistoricalRecords()
    
    class Meta:
        verbose_name = _("Sesión de Caja")
        verbose_name_plural = _("Sesiones de Caja")
        ordering = ['-opened_at']
    
    def __str__(self):
        return f"Sesión #{self.id} - {self.user.get_full_name() or self.user.username} ({self.get_status_display()})"
    
    @property
    def expected_cash(self):
        """Calculate expected cash: opening balance + cash sales + other inflows - outflows"""
        return self.opening_balance + self.total_cash_sales + self.total_other_cash_inflow - self.total_other_cash_outflow


class POSSessionAudit(models.Model):
    """
    Records the cash counting (arqueo) when closing a POS session.
    """
    session = models.OneToOneField(
        POSSession,
        on_delete=models.CASCADE,
        related_name='audit',
        verbose_name=_("Sesión")
    )
    
    expected_amount = models.DecimalField(
        _("Monto Esperado"),
        max_digits=12,
        decimal_places=2,
        help_text=_("Monto calculado por el sistema (fondo + ventas efectivo)")
    )
    actual_amount = models.DecimalField(
        _("Monto Contado"),
        max_digits=12,
        decimal_places=2,
        help_text=_("Monto físico contado por el cajero")
    )
    difference = models.DecimalField(
        _("Diferencia"),
        max_digits=12,
        decimal_places=2,
        help_text=_("Diferencia: actual - esperado (+ sobrante, - faltante)")
    )
    
    # Accounting adjustment for difference
    journal_entry = models.OneToOneField(
        'accounting.JournalEntry',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='pos_session_audit',
        verbose_name=_("Asiento de Ajuste")
    )
    
    notes = models.TextField(_("Notas del Arqueo"), blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = _("Arqueo de Caja")
        verbose_name_plural = _("Arqueos de Caja")
    
    def __str__(self):
        return f"Arqueo Sesión #{self.session.id} - Diff: {self.difference}"


# ---------------------------------------------------------------------------
# S5.1 — Split Allocation (Gap B13)
# ---------------------------------------------------------------------------

class PaymentAllocation(models.Model):
    """
    Distribución de un movimiento de tesorería entre múltiples documentos.
    Permite split: 1 pago → N facturas/órdenes/líneas de cartola.

    Constraint de suma (permisivo):
        sum(allocations.amount) puede ser menor al movement.amount mientras
        la allocation esté en construcción. AllocationService.validate_sum()
        se invoca explícitamente al confirmar la conciliación.

    Exactamente 1 FK destino debe estar definida por registro (validado en clean()).
    """

    from decimal import Decimal as _Decimal

    treasury_movement = models.ForeignKey(
        'TreasuryMovement',
        on_delete=models.CASCADE,
        related_name='allocations',
        verbose_name=_("Movimiento de Tesorería")
    )

    # — Destino (exactamente 1 debe ser non-null) —
    invoice = models.ForeignKey(
        'billing.Invoice',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='payment_allocations',
        verbose_name=_("Factura")
    )
    sale_order = models.ForeignKey(
        'sales.SaleOrder',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='payment_allocations',
        verbose_name=_("Orden de Venta")
    )
    purchase_order = models.ForeignKey(
        'purchasing.PurchaseOrder',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='payment_allocations',
        verbose_name=_("Orden de Compra")
    )
    bank_statement_line = models.ForeignKey(
        'BankStatementLine',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='payment_allocations',
        verbose_name=_("Línea de Cartola")
    )

    amount = models.DecimalField(
        _("Monto Asignado"),
        max_digits=14,
        decimal_places=2,
        validators=[MinValueValidator(_Decimal('0.01'))]
    )
    notes = models.TextField(_("Notas"), blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='created_allocations',
        verbose_name=_("Creado Por")
    )

    history = HistoricalRecords()

    class Meta:
        verbose_name = _("Distribución de Pago")
        verbose_name_plural = _("Distribuciones de Pago")
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['treasury_movement'], name='idx_palloc_movement'),
            models.Index(fields=['invoice'], name='idx_palloc_invoice'),
        ]

    def __str__(self) -> str:
        return f"Alloc #{self.id} — {self.treasury_movement_id} → ${self.amount}"

    def clean(self) -> None:
        """Valida que exactamente 1 FK destino esté definida."""
        targets = [self.invoice_id, self.sale_order_id,
                   self.purchase_order_id, self.bank_statement_line_id]
        defined = sum(1 for t in targets if t is not None)
        if defined == 0:
            raise ValidationError(
                _("Debe especificar al menos un documento destino "
                  "(factura, orden de venta, orden de compra o línea de cartola).")
            )
        if defined > 1:
            raise ValidationError(
                _("Solo puede asignar a un documento por fila de distribución.")
            )

    def save(self, *args, **kwargs) -> None:
        self.clean()
        super().save(*args, **kwargs)




