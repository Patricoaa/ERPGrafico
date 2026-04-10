from django.db import models
from django.utils.translation import gettext_lazy as _
from django.core.validators import MinValueValidator, MaxValueValidator
from simple_history.models import HistoricalRecords
from decimal import Decimal


class PartnerTransaction(models.Model):
    """
    Records individual partner/shareholder transactions: capital contributions,
    withdrawals, loans, dividends, etc. Each transaction is linked to the 
    partner Contact and optionally to its accounting journal entry and 
    originating treasury movement or stock move.
    """
    class Type(models.TextChoices):
        # Capital Operations
        CAPITAL_CONTRIBUTION_CASH = 'CAPITAL_CASH', _('Aporte de Capital (Efectivo)')
        CAPITAL_CONTRIBUTION_INVENTORY = 'CAPITAL_INVENTORY', _('Aporte de Capital (Inventario)')
        CAPITAL_RETURN = 'CAPITAL_RETURN', _('Devolución de Capital')

        # Withdrawals
        PROVISIONAL_WITHDRAWAL = 'PROV_WITHDRAWAL', _('Retiro Provisorio (Anticipo Utilidades)')
        WITHDRAWAL = 'WITHDRAWAL', _('Retiro de Utilidades')

        # Loans
        LOAN_TO_COMPANY = 'LOAN_IN', _('Préstamo del Socio a la Empresa')
        LOAN_FROM_COMPANY = 'LOAN_OUT', _('Préstamo de la Empresa al Socio')

        # Profit Distribution
        DIVIDEND = 'DIVIDEND', _('Distribución de Utilidades (Asignación)')
        DIVIDEND_PAYMENT = 'DIVIDEND_PAY', _('Pago de Dividendo')
        REINVESTMENT = 'REINVESTMENT', _('Reinversión de Utilidades')
        RETAINED = 'RETAINED', _('Utilidades Retenidas (Asignación)')
        LOSS_ABSORPTION = 'LOSS_ABSORB', _('Absorción de Pérdidas')

        # Equity Composition Movements
        EQUITY_SUBSCRIPTION = 'SUBSCRIPTION', _('Suscripción de Capital')
        EQUITY_TRANSFER_IN = 'TRANSFER_IN', _('Transferencia Recibida')
        EQUITY_TRANSFER_OUT = 'TRANSFER_OUT', _('Transferencia Entregada')
        EQUITY_REDUCTION = 'REDUCTION', _('Reducción de Capital')
        
        OTHER = 'OTHER', _('Otro')

    partner = models.ForeignKey(
        'contacts.Contact',
        on_delete=models.PROTECT,
        related_name='partner_transactions',
        limit_choices_to={'is_partner': True},
        verbose_name=_("Socio")
    )
    transaction_type = models.CharField(
        _("Tipo de Transacción"),
        max_length=20,
        choices=Type.choices
    )
    amount = models.DecimalField(
        _("Monto"),
        max_digits=14,
        decimal_places=0,
        validators=[MinValueValidator(Decimal('1'))],
        help_text=_("Monto de la transacción (siempre positivo).")
    )
    date = models.DateField(_("Fecha"))
    description = models.TextField(_("Descripción"), blank=True)

    # Optional link to profit distribution resolution
    distribution_resolution = models.ForeignKey(
        'contacts.ProfitDistributionResolution',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='partner_transactions',
        verbose_name=_("Resolución de Distribución"),
        help_text=_("Resolución de distribución de utilidades que originó esta transacción.")
    )

    # Accounting traceability
    journal_entry = models.ForeignKey(
        'accounting.JournalEntry',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='partner_transactions',
        verbose_name=_("Asiento Contable")
    )

    # Origin traceability (one of these may be set)
    treasury_movement = models.ForeignKey(
        'treasury.TreasuryMovement',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='partner_transactions',
        verbose_name=_("Movimiento de Tesorería")
    )
    stock_move = models.ForeignKey(
        'inventory.StockMove',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='partner_transactions',
        verbose_name=_("Movimiento de Stock"),
        help_text=_("Para aportes o retiros en especie (inventario).")
    )

    # Audit
    created_by = models.ForeignKey(
        'core.User',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='partner_transactions_created',
        verbose_name=_("Registrado por")
    )
    created_at = models.DateTimeField(auto_now_add=True)
    history = HistoricalRecords()

    class Meta:
        verbose_name = _("Transacción de Socio")
        verbose_name_plural = _("Transacciones de Socios")
        ordering = ['-date', '-id']

    def __str__(self):
        return f"{self.display_id} - {self.partner.name}: {self.get_transaction_type_display()} ${self.amount}"

    @property
    def display_id(self):
        return f"PT-{str(self.id).zfill(5)}"

    @property
    def is_contribution(self):
        """Returns True if this transaction adds value to the company from the partner."""
        return self.transaction_type in [
            self.Type.CAPITAL_CONTRIBUTION_CASH,
            self.Type.CAPITAL_CONTRIBUTION_INVENTORY,
            self.Type.LOAN_TO_COMPANY,
        ]

    @property
    def is_withdrawal(self):
        """Returns True if this transaction extracts value from the company to the partner."""
        return self.transaction_type in [
            self.Type.PROVISIONAL_WITHDRAWAL,
            self.Type.WITHDRAWAL,
            self.Type.LOAN_FROM_COMPANY,
            self.Type.CAPITAL_RETURN,
            self.Type.DIVIDEND_PAYMENT,
            self.Type.EQUITY_REDUCTION,
        ]

    @property
    def is_equity_composition(self):
        """Returns True if this transaction affects the formal company capital structure."""
        return self.transaction_type in [
            self.Type.EQUITY_SUBSCRIPTION,
            self.Type.EQUITY_TRANSFER_IN,
            self.Type.EQUITY_TRANSFER_OUT,
            self.Type.EQUITY_REDUCTION,
            self.Type.REINVESTMENT,
        ]

    @property
    def is_provisional_withdrawal(self):
        """Returns True if this is a provisional withdrawal (advance against future profits)."""
        return self.transaction_type == self.Type.PROVISIONAL_WITHDRAWAL

    @property
    def signed_amount(self):
        """Returns positive for contributions, negative for withdrawals."""
        if self.is_withdrawal:
            return -self.amount
        return self.amount


class PartnerEquityStake(models.Model):
    """
    Records the historical evolution of each partner's equity participation percentage.
    Each record represents a period of validity for a given percentage.
    The current active stake has effective_until = NULL.
    
    This model is DECOUPLED from Contact.partner_equity_percentage, which now
    serves only as a denormalized cache of the current active percentage.
    """
    partner = models.ForeignKey(
        'contacts.Contact',
        on_delete=models.PROTECT,
        related_name='equity_stakes',
        limit_choices_to={'is_partner': True},
        verbose_name=_("Socio")
    )
    percentage = models.DecimalField(
        _("Participación (%)"),
        max_digits=5,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0')), MaxValueValidator(Decimal('100'))],
    )
    effective_from = models.DateField(
        _("Vigente Desde"),
        help_text=_("Fecha desde la que rige este porcentaje de participación.")
    )
    effective_until = models.DateField(
        _("Vigente Hasta"),
        null=True, blank=True,
        help_text=_("Null = vigente actualmente. Se cierra cuando se registra un nuevo stake.")
    )

    # Traceability: what caused this change
    source_transaction = models.ForeignKey(
        'contacts.PartnerTransaction',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='resulting_stakes',
        verbose_name=_("Transacción Origen"),
        help_text=_("Transacción que originó este cambio de participación.")
    )

    notes = models.TextField(_("Notas"), blank=True)
    created_by = models.ForeignKey(
        'core.User',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='equity_stakes_created',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    history = HistoricalRecords()

    class Meta:
        verbose_name = _("Registro de Participación")
        verbose_name_plural = _("Registros de Participación")
        ordering = ['-effective_from', '-id']
        indexes = [
            models.Index(fields=['partner', 'effective_from']),
            models.Index(fields=['effective_until']),
        ]

    def __str__(self):
        status = "vigente" if self.effective_until is None else f"hasta {self.effective_until}"
        return f"{self.partner.name}: {self.percentage}% desde {self.effective_from} ({status})"

    @property
    def is_active(self):
        return self.effective_until is None


class ProfitDistributionResolution(models.Model):
    """
    Formal resolution for distributing (or absorbing) the net result of a fiscal year.
    Follows the lifecycle: DRAFT → APPROVED → EXECUTED → CANCELLED.
    
    A single resolution covers the entire company for one fiscal year.
    Individual partner allocations are in ProfitDistributionLine.
    """
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', _('Borrador')
        APPROVED = 'APPROVED', _('Aprobada')
        EXECUTED = 'EXECUTED', _('Ejecutada')
        CANCELLED = 'CANCELLED', _('Anulada')

    fiscal_year_obj = models.OneToOneField(
        'accounting.FiscalYear',
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name='profit_distribution',
        verbose_name=_("Ejercicio Fiscal Relacionado"),
        help_text=_("El ejercicio contable cerrado del cual proviene esta distribución.")
    )
    fiscal_year = models.IntegerField(
        _("Año Fiscal"),
        help_text=_("Año del ejercicio (campo denormalizado para búsquedas rápidas).")
    )
    resolution_date = models.DateField(
        _("Fecha de Resolución"),
        help_text=_("Fecha del acta o resolución de distribución.")
    )
    net_result = models.DecimalField(
        _("Resultado Neto del Ejercicio"),
        max_digits=16,
        decimal_places=0,
        help_text=_("Positivo = utilidad. Negativo = pérdida.")
    )
    status = models.CharField(
        _("Estado"),
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT
    )

    # Approval
    approved_by = models.ForeignKey(
        'core.User',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='approved_distributions',
        verbose_name=_("Aprobada por")
    )
    approved_at = models.DateTimeField(null=True, blank=True)

    # Execution
    executed_by = models.ForeignKey(
        'core.User',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='executed_distributions',
        verbose_name=_("Ejecutada por")
    )
    executed_at = models.DateTimeField(null=True, blank=True)

    # Accounting
    journal_entry = models.ForeignKey(
        'accounting.JournalEntry',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='profit_distributions',
        verbose_name=_("Asiento Contable")
    )

    acta_number = models.CharField(
        _("Número de Acta"),
        max_length=50,
        blank=True,
        help_text=_("Referencia al acta o documento societario.")
    )
    notes = models.TextField(_("Notas"), blank=True)

    created_by = models.ForeignKey(
        'core.User',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='created_distributions',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    history = HistoricalRecords()

    class Meta:
        verbose_name = _("Resolución de Distribución de Utilidades")
        verbose_name_plural = _("Resoluciones de Distribución")
        ordering = ['-fiscal_year', '-resolution_date']
        constraints = [
            models.UniqueConstraint(
                fields=['fiscal_year'],
                condition=models.Q(status__in=['DRAFT', 'APPROVED', 'EXECUTED']),
                name='unique_active_distribution_per_year',
            )
        ]

    def __str__(self):
        return f"Distribución {self.fiscal_year} - {self.get_status_display()}"

    @property
    def display_id(self):
        return f"DIST-{self.fiscal_year}-{str(self.id).zfill(3)}"

    @property
    def is_profit(self):
        return self.net_result > 0

    @property
    def is_loss(self):
        return self.net_result < 0


class ProfitDistributionLine(models.Model):
    """
    Individual allocation for one partner within a ProfitDistributionResolution.
    Each line specifies the partner's share and what happens with it.
    """
    class Destination(models.TextChoices):
        DIVIDEND_PAYABLE = 'DIVIDEND', _('Dividendo a Pagar')
        REINVEST = 'REINVEST', _('Reinversión en Capital')
        RETAINED = 'RETAINED', _('Utilidades Retenidas')
        LOSS_ABSORPTION = 'LOSS', _('Absorción de Pérdidas')

    resolution = models.ForeignKey(
        ProfitDistributionResolution,
        on_delete=models.CASCADE,
        related_name='lines',
        verbose_name=_("Resolución")
    )
    partner = models.ForeignKey(
        'contacts.Contact',
        on_delete=models.PROTECT,
        related_name='distribution_lines',
        verbose_name=_("Socio")
    )

    # Snapshot of % at resolution date
    percentage_at_date = models.DecimalField(
        _("Participación a la Fecha (%)"),
        max_digits=5,
        decimal_places=2,
        help_text=_("Porcentaje de participación vigente a la fecha de corte.")
    )

    # Amounts
    gross_amount = models.DecimalField(
        _("Monto Bruto"),
        max_digits=16,
        decimal_places=0,
        help_text=_("Monto que corresponde según el % de participación.")
    )
    provisional_withdrawals_offset = models.DecimalField(
        _("Retiros Provisorios a Descontar"),
        max_digits=14,
        decimal_places=0,
        default=0,
        help_text=_("Total de retiros provisorios realizados durante el ejercicio a liquidar.")
    )
    net_amount = models.DecimalField(
        _("Monto Neto"),
        max_digits=16,
        decimal_places=0,
        help_text=_("gross - provisional_withdrawals_offset = neto a pagar/reinvertir.")
    )

    destination = models.CharField(
        _("Destino"),
        max_length=20,
        choices=Destination.choices,
        default=Destination.DIVIDEND_PAYABLE
    )

    # Generated records
    partner_transaction = models.ForeignKey(
        PartnerTransaction,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='distribution_line',
        verbose_name=_("Transacción Generada")
    )
    treasury_movement = models.ForeignKey(
        'treasury.TreasuryMovement',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='distribution_lines',
        verbose_name=_("Pago Generado")
    )

    class Meta:
        verbose_name = _("Línea de Distribución")
        verbose_name_plural = _("Líneas de Distribución")
        ordering = ['resolution', 'partner__name']

    def __str__(self):
        return f"{self.partner.name}: {self.percentage_at_date}% → {self.get_destination_display()} (${self.net_amount})"
