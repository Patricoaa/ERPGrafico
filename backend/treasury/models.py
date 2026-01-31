from django.db import models
from django.utils.translation import gettext_lazy as _
from accounting.models import Account, AccountType
from sales.models import SaleOrder
from purchasing.models import PurchaseOrder
from simple_history.models import HistoricalRecords
from django.conf import settings


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
        verbose_name=_("Línea de Extracto Bancario")
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

    created_at = models.DateTimeField(auto_now_add=True)
    
    history = HistoricalRecords()

    class Meta:
        verbose_name = _("Pago")
        verbose_name_plural = _("Pagos")
        ordering = ['-id']

    def __str__(self):
        return self.display_id

    @property
    def display_id(self):
        prefix = 'ING' if self.payment_type == 'INBOUND' else 'EGR'
        return f"{prefix}-{str(self.id).zfill(6)}"


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
    allows_transfer = models.BooleanField(_("Permite Transferencia"), default=False)

    class Meta:
        verbose_name = _("Cuenta de Tesorería")
        verbose_name_plural = _("Cuentas de Tesorería")
        ordering = ['-id']

    def __str__(self):
        return f"{self.name} ({self.currency})"


class BankStatement(models.Model):
    """Extracto bancario importado"""
    
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
    statement_date = models.DateField(_("Fecha del Extracto"))
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
        verbose_name = _("Extracto Bancario")
        verbose_name_plural = _("Extractos Bancarios")
        ordering = ['-statement_date', '-id']
    
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
    """Línea individual del extracto bancario"""
    
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
        verbose_name=_("Extracto")
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
        _("Débito"), 
        max_digits=20, 
        decimal_places=2, 
        default=0
    )
    credit = models.DecimalField(
        _("Crédito"), 
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
        verbose_name=_("Pago Matched")
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
        verbose_name = _("Línea de Extracto")
        verbose_name_plural = _("Líneas de Extracto")
        ordering = ['statement', 'line_number']
        unique_together = [['statement', 'line_number']]
    
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

