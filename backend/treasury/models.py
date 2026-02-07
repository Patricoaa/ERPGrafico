from django.db import models
from django.utils.translation import gettext_lazy as _
from accounting.models import Account, AccountType
from sales.models import SaleOrder
from purchasing.models import PurchaseOrder
from simple_history.models import HistoricalRecords
from django.conf import settings
from django.utils import timezone
from django.core.validators import MinValueValidator


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
        on_delete=models.PROTECT,
        related_name='created_matches',
        verbose_name=_("Creado Por")
    )
    
    notes = models.TextField(_("Notas"), blank=True)
    
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

    # Bank Reconciliation
    bank_statement_line = models.ForeignKey(
        'BankStatementLine',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='payments',
        verbose_name=_("Línea de Cartola Bancaria"),
    )
    reconciliation_match = models.ForeignKey(
        'ReconciliationMatch',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='payments',
        verbose_name=_("Grupo de Conciliación")
    )
    is_reconciled = models.BooleanField(_("Reconciliado"), default=False)
    reconciled_at = models.DateTimeField(_("Fecha de Reconciliación"), null=True, blank=True)
    reconciled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='reconciled_payments',
        verbose_name=_("Reconciliado Por")
    )
    
    # Card Payment Provider (for specific card reconciliation flow)
    card_provider = models.ForeignKey(
        'CardPaymentProvider',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='payments',
        verbose_name=_("Proveedor de Tarjeta")
    )
    
    # POS Session (for cash control)
    pos_session = models.ForeignKey(
        'POSSession',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='payments',
        verbose_name=_("Sesión de Caja")
    )
    
    # Optional link to physical cash movement
    cash_movement = models.OneToOneField(
        'CashMovement',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='linked_payment',
        verbose_name=_("Movimiento de Efectivo Asociado"),
        help_text=_("Vincula este pago a un movimiento físico de efectivo")
    )

    created_at = models.DateTimeField(auto_now_add=True)
    
    history = HistoricalRecords()

    class Meta:
        verbose_name = _("Pago")
        verbose_name_plural = _("Pagos")
        ordering = ['-id']
        indexes = [
            models.Index(fields=['treasury_account', 'is_reconciled']),
            models.Index(fields=['amount', 'date']),
            models.Index(fields=['is_reconciled']),
            models.Index(fields=['transaction_number']),
            models.Index(fields=['reference']),
        ]

    def __str__(self):
        return self.display_id

    @property
    def display_id(self):
        prefix = 'ING' if self.payment_type == 'INBOUND' else 'EGR'
        return f"{prefix}-{str(self.id).zfill(6)}"


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
    allows_transfer = models.BooleanField(_("Permite Traspaso"), default=False)

    # Physical Location Fields (Refactor from CashContainer)
    location = models.CharField(
        _("Ubicación"),
        max_length=200,
        blank=True,
        help_text=_("Ubicación física (ej: Caja Fuerte Principal, Gaveta 1)")
    )
    custodian = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='custodian_of_accounts',
        verbose_name=_("Responsable / Custodio")
    )
    is_physical = models.BooleanField(
        _("Es Contenedor Físico"),
        default=False,
        help_text=_("Marcar si esta cuenta representa un lugar físico de almacenamiento de dinero")
    )
    
    # Configuration for Card Payments
    card_receivable_account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name='treasury_card_receivables',
        verbose_name=_("Cuenta Puente Tarjetas (Bruto)"),
        help_text=_("Cuenta donde se registran las ventas bruto (ej: Transbank por Cobrar)")
    )
    
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
           No other TreasuryAccount (Cash or Bank) should share the same ledger account if it's a Cash box.
        """
        from django.core.exceptions import ValidationError
        
        if self.account_type == self.Type.CASH and self.account:
            # Check if any other TreasuryAccount uses this same account
            duplicates = TreasuryAccount.objects.filter(account=self.account).exclude(id=self.id)
            if duplicates.exists():
                dup_names = ", ".join([t.name for t in duplicates])
                raise ValidationError({
                    'account': _(f"La cuenta contable '{self.account.code}' ya está en uso por: {dup_names}. "
                                 "Las cuentas de tipo Efectivo deben tener una cuenta contable exclusiva.")
                })
                
    def save(self, *args, **kwargs):
        self.clean()
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
    allowed_treasury_accounts = models.ManyToManyField(
        'TreasuryAccount',
        related_name='pos_terminals',
        verbose_name=_("Cuentas de Tesorería Permitidas"),
        help_text=_("Cuentas que este terminal puede utilizar para registrar pagos")
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
    def allowed_payment_methods(self):
        """
        Métodos de pago permitidos en este terminal, derivados de las
        cuentas de tesorería asociadas.
        
        Returns:
            list[str]: Lista de métodos permitidos ('CASH', 'CARD', 'TRANSFER')
        """
        methods = set()
        for account in self.allowed_treasury_accounts.all():
            if account.allows_cash:
                methods.add('CASH')
            if account.allows_card:
                methods.add('CARD')
            if account.allows_transfer:
                methods.add('TRANSFER')
        return sorted(list(methods))
    
    def get_accounts_for_method(self, payment_method):
        """
        Retorna cuentas de tesorería permitidas que soporten el método dado.
        
        Args:
            payment_method (str): Método de pago ('CASH', 'CARD', 'TRANSFER')
            
        Returns:
            QuerySet[TreasuryAccount]: Cuentas compatibles con el método
        """
        lookup = {
            'CASH': 'allows_cash',
            'CARD': 'allows_card',
            'TRANSFER': 'allows_transfer',
        }
        filter_key = lookup.get(payment_method)
        if not filter_key:
            return self.allowed_treasury_accounts.none()
        
        return self.allowed_treasury_accounts.filter(**{filter_key: True})


class BankStatement(models.Model):
    """Cartola bancaria importada"""
    
    class State(models.TextChoices):
        DRAFT = 'DRAFT', _('Borrador')
        CONFIRMED = 'CONFIRMED', _('Confirmado')
        CANCELLED = 'CANCELLED', _('Cancelado')
    
    treasury_account = models.ForeignKey(
        'TreasuryAccount',
        on_delete=models.PROTECT,
        related_name='bank_statements',
        verbose_name=_("Cuenta de Tesorería")
    )
    statement_date = models.DateField(_("Fecha de la Cartola"))
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
        null=True, 
        blank=True
    )
    imported_at = models.DateTimeField(_("Importado el"), auto_now_add=True)
    imported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='imported_statements',
        verbose_name=_("Importado Por")
    )
    state = models.CharField(
        _("Estado"), 
        max_length=20, 
        choices=State.choices, 
        default=State.DRAFT
    )
    
    # Metadatos
    bank_format = models.CharField(
        _("Formato Bancario"), 
        max_length=50, 
        default='GENERIC_CSV',
        help_text=_("Formato usado para parsear el archivo (ej: BANCO_CHILE_CSV, GENERIC_CSV)")
    )
    total_lines = models.IntegerField(_("Total de Líneas"), default=0)
    reconciled_lines = models.IntegerField(_("Líneas Reconciliadas"), default=0)
    
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
    
    class ReconciliationState(models.TextChoices):
        UNRECONCILED = 'UNRECONCILED', _('No Reconciliado')
        MATCHED = 'MATCHED', _('Matched (Pendiente Confirmar)')
        RECONCILED = 'RECONCILED', _('Reconciliado')
        DISPUTED = 'DISPUTED', _('En Disputa')
        EXCLUDED = 'EXCLUDED', _('Excluido')
    
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
    reconciliation_state = models.CharField(
        _("Estado de Reconciliación"),
        max_length=20,
        choices=ReconciliationState.choices,
        default=ReconciliationState.UNRECONCILED
    )
    matched_payment = models.ForeignKey(
        'Payment',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='matched_lines',
        verbose_name=_("Pago Matched"),
        help_text=_("DEPRECATED: Use reconciliation_match instead")
    )
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
    
    # Notas
    notes = models.TextField(_("Notas"), blank=True)
    
    history = HistoricalRecords()
    
    class Meta:
        verbose_name = _("Línea de Cartola")
        verbose_name_plural = _("Líneas de Cartola")
        ordering = ['statement', 'line_number']
        unique_together = [['statement', 'line_number']]
        indexes = [
            models.Index(fields=['reconciliation_state']),
            models.Index(fields=['transaction_date']),
            models.Index(fields=['statement', 'reconciliation_state']),
            models.Index(fields=['transaction_id']),
        ]
    
    def __str__(self):
        return f"{self.statement.display_id} - Línea {self.line_number}"
    
    @property
    def amount(self):
        """Retorna el monto neto (credit - debit)"""
        return self.credit - self.debit


class ReconciliationRule(models.Model):
    """Reglas de matching automático configurables (para fase 3)"""
    
    name = models.CharField(_("Nombre"), max_length=100)
    description = models.TextField(
        _("Descripción"),
        blank=True,
        help_text=_("Descripción del propósito de esta regla")
    )
    treasury_account = models.ForeignKey(
        'TreasuryAccount',
        on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='reconciliation_rules',
        verbose_name=_("Cuenta de Tesorería"),
        help_text=_("Dejar vacío para aplicar a todas las cuentas")
    )
    priority = models.IntegerField(
        _("Prioridad"), 
        default=10,
        help_text=_("Menor número = mayor prioridad")
    )
    is_active = models.BooleanField(_("Activa"), default=True)
    
    # Configuración de matching (JSONField para flexibilidad)
    match_config = models.JSONField(
        _("Configuración de Matching"),
        default=dict,
        help_text=_("Configuración en JSON con criterios de matching")
    )
    # Ejemplo de match_config:
    # {
    #   'criteria': ['amount_exact', 'date_range'],
    #   'amount_tolerance': 0,
    #   'date_range_days': 3,
    #   'min_score': 85,
    #   'reference_keywords': ['TRANSFERENCIA'],
    #   'weights': {'amount': 40, 'date': 30, 'reference': 20, 'contact': 10}
    # }
    
    # Acciones automáticas
    auto_confirm = models.BooleanField(
        _("Auto-confirmar"),
        default=False,
        help_text=_("Si es True, confirma reconciliación automáticamente sin revisión")
    )
    create_payment_if_not_found = models.BooleanField(
        _("Crear Pago si no existe"),
        default=False,
        help_text=_("Crear pago automático si no se encuentra match (casos especiales)")
    )
    
    # Estadísticas de uso
    times_applied = models.IntegerField(
        _("Veces Aplicada"),
        default=0,
        help_text=_("Contador de veces que esta regla ha generado un match")
    )
    success_rate = models.DecimalField(
        _("Tasa de Éxito"),
        max_digits=5,
        decimal_places=2,
        default=0,
        help_text=_("Porcentaje de matches confirmados vs sugeridos")
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='created_reconciliation_rules',
        verbose_name=_("Creado Por")
    )
    
    history = HistoricalRecords()
    
    class Meta:
        verbose_name = _("Regla de Reconciliación")
        verbose_name_plural = _("Reglas de Reconciliación")
        ordering = ['priority', '-id']
    
    def __str__(self):
        scope = self.treasury_account.name if self.treasury_account else "Global"
        return f"{self.name} ({scope})"


class CardPaymentProvider(models.Model):
    """Proveedor de procesamiento de pagos con tarjeta (Transbank, Webpay, etc.)"""
    
    name = models.CharField(_("Nombre"), max_length=100)
    code = models.CharField(_("Código"), max_length=20, unique=True)
    
    # Proveedor que factura (debe existir en contacts.Contact)
    supplier = models.ForeignKey(
        'contacts.Contact',
        on_delete=models.PROTECT,
        related_name='card_providers',
        limit_choices_to={'is_supplier': True},
        verbose_name=_("Proveedor (Contacto)")
    )
    
    # Configuración de Comisiones
    commission_rate = models.DecimalField(
        _("Tasa de Comisión (%)"),
        max_digits=5,
        decimal_places=2,
        default=2.95
    )
    fixed_amount = models.DecimalField(
        _("Monto Fijo"),
        max_digits=10,
        decimal_places=2,
        default=0
    )
    vat_rate = models.DecimalField(
        _("Tasa de IVA (%)"),
        max_digits=5,
        decimal_places=2,
        default=19
    )
    
    settlement_delay_days = models.IntegerField(
        _("Días de Retraso de Abono"),
        default=1
    )
    
    # Cuentas Contables
    receivable_account = models.ForeignKey(
        'accounting.Account',
        on_delete=models.PROTECT,
        related_name='card_provider_receivables',
        verbose_name=_("Cuenta Tarjetas por Cobrar")
    )
    commission_bridge_account = models.ForeignKey(
        'accounting.Account',
        on_delete=models.PROTECT,
        related_name='card_commission_bridges',
        verbose_name=_("Cuenta Puente Comisiones Pendientes"),
        help_text=_("Pasivo transitorio: Comisiones retenidas pendientes de facturar")
    )
    
    is_active = models.BooleanField(_("Activo"), default=True)

    class Meta:
        verbose_name = _("Proveedor de Pagos con Tarjeta")
        verbose_name_plural = _("Proveedores de Pagos con Tarjeta")

    def __str__(self):
        return self.name


class DailySettlement(models.Model):
    """Abono diario del proveedor de tarjetas"""
    
    provider = models.ForeignKey(
        'CardPaymentProvider',
        on_delete=models.PROTECT,
        related_name='settlements'
    )
    
    settlement_date = models.DateField(_("Fecha de Abono"))
    
    # Montos totales
    total_gross = models.DecimalField(
        _("Total Bruto"),
        max_digits=12,
        decimal_places=2
    )
    total_commission = models.DecimalField(
        _("Total Comisiones"),
        max_digits=12,
        decimal_places=2
    )
    total_vat = models.DecimalField(
        _("Total IVA"),
        max_digits=12,
        decimal_places=2
    )
    total_net = models.DecimalField(
        _("Total Neto Abonado"),
        max_digits=12,
        decimal_places=2
    )
    
    # Reconciliación
    bank_statement_line = models.ForeignKey(
        'BankStatementLine',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='card_settlements'
    )
    is_reconciled = models.BooleanField(_("Reconciliado"), default=False)
    reconciled_at = models.DateTimeField(null=True, blank=True)
    
    # Facturación mensual
    monthly_invoice = models.ForeignKey(
        'billing.Invoice',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='card_settlements'
    )
    
    notes = models.TextField(_("Notas"), blank=True)

    class Meta:
        verbose_name = _("Abono Diario Tarjetas")
        verbose_name_plural = _("Abonos Diarios Tarjetas")

    def __str__(self):
        return f"{self.provider.code} - {self.settlement_date}"


class CardTransaction(models.Model):
    """Transacción individual de tarjeta vinculada a un pago del sistema"""
    
    provider = models.ForeignKey(
        'CardPaymentProvider',
        on_delete=models.PROTECT,
        related_name='transactions'
    )
    payment = models.OneToOneField(
        'Payment',
        on_delete=models.PROTECT,
        related_name='card_transaction'
    )
    
    transaction_date = models.DateField(_("Fecha de Transacción"))
    authorization_code = models.CharField(max_length=50, blank=True)
    
    # Montos calculados
    gross_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text=_("Monto total de la venta")
    )
    commission_amount = models.DecimalField(max_digits=12, decimal_places=2)
    commission_vat = models.DecimalField(max_digits=12, decimal_places=2)
    net_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text=_("Monto neto a recibir = bruto - comisión - IVA")
    )
    
    expected_settlement_date = models.DateField(null=True, blank=True)
    
    # Link to Daily Settlement
    daily_settlement = models.ForeignKey(
        DailySettlement,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='transactions'
    )

    # Reconciliación
    bank_statement_line = models.ForeignKey(
        'BankStatementLine',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='card_transactions'
    )
    is_reconciled = models.BooleanField(default=False)
    reconciled_at = models.DateTimeField(null=True, blank=True)
    
    # Comisión procesada
    commission_journal_entry = models.ForeignKey(
        'accounting.JournalEntry',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='card_daily_commissions'
    )
    
    # Factura mensual (se asigna al final del mes)
    monthly_invoice = models.ForeignKey(
        'billing.Invoice',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='card_transactions'
    )

    class Meta:
        verbose_name = _("Transacción de Tarjeta")
        verbose_name_plural = _("Transacciones de Tarjeta")

    def __str__(self):
        return f"{self.provider.code} - {self.gross_amount}"


class POSSession(models.Model):
    """
    Represents a cashier's session (shift) in the POS.
    Each session has an opening and closing time, with cash control.
    """
    class Status(models.TextChoices):
        OPEN = 'OPEN', _('Abierta')
        CLOSING = 'CLOSING', _('En Cierre')
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
    
    # New: Tracking if this audit requires manual approval due to threshold
    requires_approval = models.BooleanField(
        _("Requiere Aprobación"),
        default=False,
        help_text=_("True si la diferencia excede el umbral de aprobación")
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





class CashMovement(models.Model):
    """
    Records internal cash movements between containers or between container and POS Session.
    Provides full traceability of cash flow.
    """
    class Type(models.TextChoices):
        DEPOSIT = 'DEPOSIT', _('Depósito')              # POS → Safe / Petty Cash
        WITHDRAWAL = 'WITHDRAWAL', _('Retiro')          # Safe → POS (Open fund)
        TRANSFER = 'TRANSFER', _('Traspaso de Efectivo')       # Safe ↔ Petty Cash
        BANK_DEPOSIT = 'BANK_DEPOSIT', _('Depósito Bancario')  # Safe → Bank
        ADJUSTMENT = 'ADJUSTMENT', _('Ajuste')          # Manual correction
        SALE = 'SALE', _('Venta')                       # Cash In from Sales
        EXPENSE = 'EXPENSE', _('Gasto/Compra')          # Cash Out for Purchases/Expenses

    class Status(models.TextChoices):
        DRAFT = 'DRAFT', _('Borrador')
        CONFIRMED = 'CONFIRMED', _('Confirmado')
        CANCELLED = 'CANCELLED', _('Cancelado')

    class JustifyReason(models.TextChoices):
        # Deposits
        CAPITAL_CONTRIBUTION = 'CAPITAL_CONTRIBUTION', _('Aporte de Capital')
        PURCHASE_REFUND = 'PURCHASE_REFUND', _('Devolución de Compra')
        TIP = 'TIP', _('Propina')
        
        # Withdrawals
        EXPENSE = 'EXPENSE', _('Gasto / Caja Chica')
        PARTNER_WITHDRAWAL = 'PARTNER_WITHDRAWAL', _('Retiro de Socio')
        SUPPLIER_PAYMENT = 'SUPPLIER_PAYMENT', _('Pago a Proveedor')
        THEFT = 'THEFT', _('Robo / Faltante')
        
        # Mixed / Adjustments
        ROUNDING = 'ROUNDING', _('Redondeo')
        CASHBACK = 'CASHBACK', _('Vuelto Incorrecto')
        COUNTING_ERROR = 'COUNTING_ERROR', _('Error de Conteo')
        SYSTEM_ERROR = 'SYSTEM_ERROR', _('Error de Sistema')
        OTHER_IN = 'OTHER_IN', _('Otro Ingreso')
        OTHER_OUT = 'OTHER_OUT', _('Otro Egreso')
        UNKNOWN = 'UNKNOWN', _('Desconocido')

    movement_type = models.CharField(
        _("Tipo"),
        max_length=20,
        choices=Type.choices
    )
    date = models.DateTimeField(_("Fecha"), default=timezone.now)
    amount = models.DecimalField(
        _("Monto"),
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(0)]
    )
    status = models.CharField(
        _("Estado"),
        max_length=20,
        choices=Status.choices,
        default=Status.CONFIRMED
    )

    justify_reason = models.CharField(
        _("Razón / Motivo"),
        max_length=30,
        choices=JustifyReason.choices,
        default=JustifyReason.UNKNOWN
    )

    # Origin and Destination (Now TreasuryAccount)
    from_account = models.ForeignKey(
        'TreasuryAccount',
        on_delete=models.PROTECT,
        related_name='outgoing_movements',
        null=True,
        blank=True,
        verbose_name=_("Desde Cuenta")
    )
    to_account = models.ForeignKey(
        'TreasuryAccount',
        on_delete=models.PROTECT,
        related_name='incoming_movements',
        null=True,
        blank=True,
        verbose_name=_("Hacia Cuenta")
    )

    # Link to POS Session if applicable
    pos_session = models.ForeignKey(
        'POSSession',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cash_movements',
        verbose_name=_("Sesión POS Relacionada")
    )

    # Accounting (optional for purely physical movements, required for bank deposits)
    journal_entry = models.OneToOneField(
        'accounting.JournalEntry',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cash_movement',
        verbose_name=_("Asiento Contable")
    )
    
    # Optional link to payment transaction
    payment = models.OneToOneField(
        'Payment',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='linked_cash_movement',
        verbose_name=_("Pago Asociado"),
        help_text=_("Vincula este movimiento a un pago a terceros")
    )

    # Audit
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='created_cash_movements',
        verbose_name=_("Creado Por")
    )
    notes = models.TextField(_("Notas"), blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    history = HistoricalRecords()

    class Meta:
        verbose_name = _("Movimiento de Efectivo")
        verbose_name_plural = _("Movimientos de Efectivo")
        ordering = ['-date']

    def __str__(self):
        from_desc = self.from_account.name if self.from_account else "Exterior/POS"
        to_desc = self.to_account.name if self.to_account else "Exterior/POS"
        return f"{from_desc} → {to_desc}: ${self.amount}"


class CashDifference(models.Model):
    """
    Detailed record of cash differences requiring approval.
    Replaces simple gain/loss dichotomy with categorized tracking.
    """
    class Reason(models.TextChoices):
        COUNTING_ERROR = 'COUNTING_ERROR', _('Error de Conteo')
        THEFT = 'THEFT', _('Robo/Faltante')
        ROUNDING = 'ROUNDING', _('Redondeo')
        TIP = 'TIP', _('Propina')
        CASHBACK = 'CASHBACK', _('Vuelto Incorrecto')
        SYSTEM_ERROR = 'SYSTEM_ERROR', _('Error del Sistema')
        TRANSFER = 'TRANSFER', _('Traspaso de Efectivo')
        PARTNER_WITHDRAWAL = 'PARTNER_WITHDRAWAL', _('Retiro de Socio')
        OTHER_IN = 'OTHER_IN', _('Otro Ingreso')
        OTHER_OUT = 'OTHER_OUT', _('Otro Egreso')
        UNKNOWN = 'UNKNOWN', _('Desconocido')

    class Status(models.TextChoices):
        PENDING = 'PENDING', _('Pendiente Revisión')
        APPROVED = 'APPROVED', _('Aprobada')
        DISPUTED = 'DISPUTED', _('En Disputa')
        CANCELLED = 'CANCELLED', _('Cancelada')

    # Link to audit
    pos_session_audit = models.ForeignKey(
        'POSSessionAudit',
        on_delete=models.CASCADE,
        related_name='differences',
        verbose_name=_("Arqueo Asociado")
    )

    amount = models.DecimalField(
        _("Monto"),
        max_digits=12,
        decimal_places=2,
        help_text=_("+ para sobrante, - para faltante")
    )

    reason = models.CharField(
        _("Razón"),
        max_length=20,
        choices=Reason.choices,
        default=Reason.UNKNOWN
    )

    transfer_target = models.ForeignKey(
        'TreasuryAccount',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name=_("Cuenta de Destino (Traspaso)")
    )

    status = models.CharField(
        _("Estado"),
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING
    )

    # Workflow
    reported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='reported_differences',
        verbose_name=_("Reportado Por")
    )
    reported_at = models.DateTimeField(_("Reportado el"), auto_now_add=True)

    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_differences',
        verbose_name=_("Aprobado Por")
    )
    approved_at = models.DateTimeField(_("Aprobado el"), null=True, blank=True)

    approval_notes = models.TextField(_("Notas de Aprobación"), blank=True)
    reporter_notes = models.TextField(_("Notas del Reportante"), blank=True)

    # Accounting entry (created after approval if applicable)
    journal_entry = models.OneToOneField(
        'accounting.JournalEntry',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cash_difference',
        verbose_name=_("Asiento Contable")
    )

    history = HistoricalRecords()

    class Meta:
        verbose_name = _("Diferencia de Efectivo")
        verbose_name_plural = _("Diferencias de Efectivo")
        ordering = ['-reported_at']

    def __str__(self):
        sign = "+" if self.amount >= 0 else "-"
        return f"{sign}${abs(self.amount)} - {self.get_reason_display()} ({self.get_status_display()})"

