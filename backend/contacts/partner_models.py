from django.db import models
from django.utils.translation import gettext_lazy as _
from django.core.validators import MinValueValidator
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
        CAPITAL_CONTRIBUTION_CASH = 'CAPITAL_CASH', _('Aporte de Capital (Efectivo)')
        CAPITAL_CONTRIBUTION_INVENTORY = 'CAPITAL_INVENTORY', _('Aporte de Capital (Inventario)')
        WITHDRAWAL = 'WITHDRAWAL', _('Retiro de Utilidades')
        LOAN_TO_COMPANY = 'LOAN_IN', _('Préstamo del Socio a la Empresa')
        LOAN_FROM_COMPANY = 'LOAN_OUT', _('Préstamo de la Empresa al Socio')
        CAPITAL_RETURN = 'CAPITAL_RETURN', _('Devolución de Capital')
        DIVIDEND = 'DIVIDEND', _('Distribución de Utilidades')
        
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
            self.Type.WITHDRAWAL,
            self.Type.LOAN_FROM_COMPANY,
            self.Type.CAPITAL_RETURN,
            self.Type.DIVIDEND,
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
        ]

    @property
    def signed_amount(self):
        """Returns positive for contributions, negative for withdrawals."""
        if self.is_withdrawal:
            return -self.amount
        return self.amount
