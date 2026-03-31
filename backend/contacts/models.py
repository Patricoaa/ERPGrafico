from django.db import models
from django.utils.translation import gettext_lazy as _
from accounting.models import Account, AccountType
from simple_history.models import HistoricalRecords
from decimal import Decimal
from django.db.models import Sum
from django.utils import timezone
from django.core.validators import MinValueValidator, MaxValueValidator


class RiskLevel(models.TextChoices):
    LOW = 'LOW', _('Bajo Riesgo')
    MEDIUM = 'MEDIUM', _('Riesgo Medio')
    HIGH = 'HIGH', _('Alto Riesgo')
    CRITICAL = 'CRITICAL', _('Riesgo Crítico / Incobrable')

class Contact(models.Model):
    """
    Unified contact entity that can represent customers, suppliers, or both.
    Classification is determined dynamically based on associated documents.
    """
    name = models.CharField(_("Nombre / Razón Social"), max_length=255)
    tax_id = models.CharField(_("RUT/Tax ID"), max_length=20, unique=True)
    contact_name = models.CharField(_("Nombre Contacto"), max_length=100, blank=True)
    email = models.EmailField(_("Email"), blank=True)
    phone = models.CharField(_("Teléfono"), max_length=20, blank=True)
    address = models.TextField(_("Dirección"), blank=True)
    code = models.CharField(_("Código"), max_length=20, unique=True, editable=False, null=True)
    
    history = HistoricalRecords()
    
    # Accounting links
    account_receivable = models.ForeignKey(
        Account, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='contact_receivables',
        limit_choices_to={'account_type': AccountType.ASSET},
        verbose_name=_("Cuenta por Cobrar")
    )
    
    account_payable = models.ForeignKey(
        Account, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='contact_payables',
        limit_choices_to={'account_type': AccountType.LIABILITY},
        verbose_name=_("Cuenta por Pagar")
    )

    is_default_customer = models.BooleanField(_("Cliente por Defecto"), default=False)
    is_default_vendor = models.BooleanField(_("Proveedor por Defecto"), default=False)

    # Credit Rules
    credit_enabled = models.BooleanField(_("Crédito Habilitado"), default=False)
    credit_limit = models.DecimalField(_("Límite de Crédito"), max_digits=14, decimal_places=0, null=True, blank=True)
    credit_days = models.IntegerField(_("Días Plazo"), default=30, null=True, blank=True)
    credit_blocked = models.BooleanField(_("Crédito Bloqueado"), default=False, help_text=_("Si se marca, el contacto no podrá usar crédito bajo ninguna circunstancia."))
    
    # Credit Automation Fields
    credit_auto_blocked = models.BooleanField(_("Auto-Bloqueado por Mora"), default=False, help_text=_("El sistema bloquea temporalmente al cliente si excede los días de mora configurados."))
    credit_risk_level = models.CharField(_("Nivel de Riesgo"), max_length=20, choices=RiskLevel.choices, default=RiskLevel.LOW)
    credit_last_evaluated = models.DateTimeField(_("Última Evaluación Automática"), null=True, blank=True)

    # Partner / Shareholder Fields
    is_partner = models.BooleanField(_("Es Socio"), default=False, help_text=_("Marcar si este contacto es socio/accionista de la empresa."))
    partner_equity_percentage = models.DecimalField(
        _("Participación (%)"), 
        max_digits=5, decimal_places=2, 
        null=True, blank=True,
        validators=[MinValueValidator(Decimal('0')), MaxValueValidator(Decimal('100'))],
        help_text=_("Cache desnormalizado del % vigente. Fuente de verdad: PartnerEquityStake.")
    )
    partner_since = models.DateField(_("Socio Desde"), null=True, blank=True)
    partner_contribution_account = models.ForeignKey(
        Account,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='partner_contribution_contacts',
        limit_choices_to={'account_type': AccountType.EQUITY},
        verbose_name=_("Cuenta de Aportes del Socio"),
        help_text=_("Subcuenta para aportes de capital de este socio (3.1.02.XX).")
    )
    partner_provisional_withdrawal_account = models.ForeignKey(
        Account,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='partner_prov_withdrawal_contacts',
        limit_choices_to={'account_type': AccountType.EQUITY},
        verbose_name=_("Cuenta Retiros Provisorios del Socio"),
        help_text=_("Subcuenta (contra patrimonio) para retiros provisorios de este socio (3.1.05.XX).")
    )
    partner_earnings_account = models.ForeignKey(
        Account,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='partner_earnings_contacts',
        limit_choices_to={'account_type': AccountType.EQUITY},
        verbose_name=_("Cuenta Utilidades del Socio"),
        help_text=_("Subcuenta para utilidades del ejercicio asignadas a este socio (3.1.06.XX).")
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def clean(self):
        # Validation for uniqueness is now handled automatically in save()
        pass

    def save(self, *args, **kwargs):
        from core.services import SequenceService
        if not self.code:
            self.code = SequenceService.get_next_number(Contact, field_name='code')

        # We handle the 'one default' rule here to act as a switch instead of a blocker
        if self.is_default_customer:
            Contact.objects.filter(is_default_customer=True).exclude(pk=self.pk).update(is_default_customer=False)
        
        if self.is_default_vendor:
            Contact.objects.filter(is_default_vendor=True).exclude(pk=self.pk).update(is_default_vendor=False)

        # Partner Multi-Account Auto-Creation
        if self.is_partner:
            from accounting.models import AccountingSettings, Account
            settings = AccountingSettings.objects.first()
            if settings:
                # Map: (contact field, settings parent field, prefix)
                account_specs = [
                    ('partner_contribution_account', 'partner_capital_contribution_account', 'C.A.'),
                    ('partner_provisional_withdrawal_account', 'partner_provisional_withdrawal_account', 'R.P.'),
                    ('partner_earnings_account', 'partner_current_year_earnings_account', 'Ut.'),
                ]
                for contact_field, settings_field, prefix in account_specs:
                    if not getattr(self, f'{contact_field}_id') and getattr(settings, settings_field, None):
                        parent = getattr(settings, settings_field)
                        new_acc = Account.objects.create(
                            name=f"{prefix} {self.name}",
                            parent=parent,
                            account_type=parent.account_type
                        )
                        setattr(self, contact_field, new_acc)

        self.full_clean()
        super().save(*args, **kwargs)

    class Meta:
        verbose_name = _("Contacto")
        verbose_name_plural = _("Contactos")
        ordering = ['-id']

    def __str__(self):
        return f"{self.display_id} - {self.name} ({self.tax_id})"
    
    @property
    def display_id(self):
        if not self.code:
            return ""
        return f"C-{self.code}"
    
    @property
    def is_customer(self):
        """Returns True if this contact has any sale orders"""
        return self.sale_orders.exists()
    
    @property
    def is_supplier(self):
        """Returns True if this contact has any purchase orders"""
        return self.purchase_orders.exists()
    
    @property
    def contact_type(self):
        """
        Returns the contact type based on associated documents:
        - 'CUSTOMER': has sale orders only
        - 'SUPPLIER': has purchase orders only
        - 'BOTH': has both sale and purchase orders
        - 'RELATED': has related work orders but no sales/purchases
        - 'NONE': has no orders yet
        """
        has_sales = self.is_customer
        has_purchases = self.is_supplier
        has_related_work_orders = self.related_work_orders.exists()
        
        if has_sales and has_purchases:
            return 'BOTH'
        elif has_sales:
            return 'CUSTOMER'
        elif has_purchases:
            return 'SUPPLIER'
        elif has_related_work_orders:
            return 'RELATED'
        else:
            return 'NONE'

    @property
    def credit_balance_used(self) -> Decimal:
        """
        Calculates the amount of credit currently used by the contact.
        This includes all sale orders where the payment method is 'CREDIT', 
        excluding DRAFT and CANCELLED orders.
        The calculation is: sum of (order.effective_total - order.payments_net)
        """
        orders = self.sale_orders.exclude(status__in=['DRAFT', 'CANCELLED'])
        
        balance = Decimal('0')
        for order in orders:
            # Calculate net payments manually to avoid complex annotations here
            payments = order.payments.filter(is_pending_registration=False)
            paid_in = sum((p.amount for p in payments if p.movement_type in ['INBOUND', 'ADJUSTMENT']), Decimal('0'))
            paid_out = sum((p.amount for p in payments if p.movement_type == 'OUTBOUND'), Decimal('0'))
            payments_net = paid_in - paid_out
            
            order_balance = order.effective_total - payments_net
            if order_balance > Decimal('0'):
                balance += order_balance
                
        return balance

    @property
    def credit_available(self) -> Decimal:
        if not self.credit_limit:
            return Decimal('0')
        balance = self.credit_balance_used
        available = self.credit_limit - balance
        return available if available > 0 else Decimal('0')

    @property
    def credit_balance(self) -> Decimal:
        """
        Saldo a favor del cliente.
        Calculado como el Fondo Virtual Neto: 
        (Suma de registros OUTBOUND de NC) - (Suma de consumos INBOUND en ventas)
        usando el método de pago CREDIT_BALANCE.
        """
        from treasury.models import TreasuryMovement
        from django.db.models import Sum
        
        # Todas las adiciones al saldo virtual (NCs registradas como Saldo a Favor)
        additions = TreasuryMovement.objects.filter(
            contact=self,
            payment_method='CREDIT_BALANCE',
            movement_type='OUTBOUND',
            is_pending_registration=False
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
        
        # Todas las sustracciones del saldo virtual (Consumos en ventas posteriores)
        consumptions = TreasuryMovement.objects.filter(
            contact=self,
            payment_method='CREDIT_BALANCE',
            movement_type='INBOUND',
            is_pending_registration=False
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
        
        return additions - consumptions

    @property
    def credit_aging(self) -> dict:
        """
        Classifies the contact's unpaid credit balance into aging buckets.
        Uses credit_days as the payment term (default 30 if not set).
        Returns amounts per bucket: current, overdue_30, overdue_60, overdue_90, overdue_90plus.
        """
        today = timezone.now().date()
        payment_term = self.credit_days or 30

        buckets = {
            'current': Decimal('0'),
            'overdue_30': Decimal('0'),
            'overdue_60': Decimal('0'),
            'overdue_90': Decimal('0'),
            'overdue_90plus': Decimal('0'),
        }

        orders = self.sale_orders.exclude(status__in=['DRAFT', 'CANCELLED'])
        for order in orders:
            payments = order.payments.filter(is_pending_registration=False)
            paid_in = sum((p.amount for p in payments if p.movement_type in ['INBOUND', 'ADJUSTMENT']), Decimal('0'))
            paid_out = sum((p.amount for p in payments if p.movement_type == 'OUTBOUND'), Decimal('0'))
            balance = order.effective_total - (paid_in - paid_out)

            if balance <= Decimal('0'):
                continue

            # Calculate due date based on order date + credit_days
            order_date = order.date if hasattr(order.date, 'date') else order.date
            if hasattr(order_date, 'date'):
                order_date = order_date.date()
            from datetime import timedelta
            due_date = order_date + timedelta(days=payment_term)
            days_overdue = (today - due_date).days

            if days_overdue <= 0:
                buckets['current'] += balance
            elif days_overdue <= 30:
                buckets['overdue_30'] += balance
            elif days_overdue <= 60:
                buckets['overdue_60'] += balance
            elif days_overdue <= 90:
                buckets['overdue_90'] += balance
            else:
                buckets['overdue_90plus'] += balance

        return buckets

    @property
    def partner_balance(self) -> Decimal:
        """
        Calculates the net partner account balance.
        Positive = socio tiene saldo a favor (empresa le debe)
        Negative = socio debe a la empresa
        Sum of contributions (positive) minus withdrawals (negative).
        """
        if not self.is_partner:
            return Decimal('0')
        
        from contacts.partner_models import PartnerTransaction
        from django.db.models import Sum
        
        contributions = self.partner_transactions.filter(
            transaction_type__in=[
                PartnerTransaction.Type.CAPITAL_CONTRIBUTION_CASH,
                PartnerTransaction.Type.CAPITAL_CONTRIBUTION_INVENTORY,
                PartnerTransaction.Type.LOAN_TO_COMPANY,
            ]
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
        
        withdrawals = self.partner_transactions.filter(
            transaction_type__in=[
                PartnerTransaction.Type.PROVISIONAL_WITHDRAWAL,
                PartnerTransaction.Type.WITHDRAWAL,
                PartnerTransaction.Type.LOAN_FROM_COMPANY,
                PartnerTransaction.Type.CAPITAL_RETURN,
                PartnerTransaction.Type.DIVIDEND_PAYMENT,
            ]
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
        
        return contributions - withdrawals

    @property
    def partner_total_contributions(self) -> Decimal:
        """
        Calculates the total SUBSCRIBED equity for the partner.
        Based on SUBSCRIPTION and TRANSFER movements.
        """
        if not self.is_partner:
            return Decimal('0')
        
        from contacts.partner_models import PartnerTransaction
        from django.db.models import Sum
        
        # Subscriptions (+)
        subs = self.partner_transactions.filter(
            transaction_type=PartnerTransaction.Type.EQUITY_SUBSCRIPTION
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
        
        # Reductions (-)
        reds = self.partner_transactions.filter(
            transaction_type=PartnerTransaction.Type.EQUITY_REDUCTION
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')

        # Transferred OUT (-)
        trans_out = self.partner_transactions.filter(
            transaction_type=PartnerTransaction.Type.EQUITY_TRANSFER_OUT
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')

        # Transferred IN (+)
        trans_in = self.partner_transactions.filter(
            transaction_type=PartnerTransaction.Type.EQUITY_TRANSFER_IN
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')

        # Reinvestments (+)
        reinvest = self.partner_transactions.filter(
            transaction_type=PartnerTransaction.Type.REINVESTMENT
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')

        return subs - reds - trans_out + trans_in + reinvest

    @property
    def partner_pending_capital(self) -> Decimal:
        """
        Subscribed (-) Paid In.
        Positive = partner owes capital to the company.
        """
        return self.partner_total_contributions - self.partner_total_paid_in

    @property
    def partner_total_paid_in(self) -> Decimal:
        """Total accumulated assets/cash actually delivered to company."""
        if not self.is_partner:
            return Decimal('0')
        from contacts.partner_models import PartnerTransaction
        from django.db.models import Sum
        return self.partner_transactions.filter(
            transaction_type__in=[
                PartnerTransaction.Type.CAPITAL_CONTRIBUTION_CASH,
                PartnerTransaction.Type.CAPITAL_CONTRIBUTION_INVENTORY,
            ]
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')

    @property
    def partner_total_withdrawals(self) -> Decimal:
        """Total accumulated formal withdrawals by this partner (excludes provisional)."""
        if not self.is_partner:
            return Decimal('0')
        from contacts.partner_models import PartnerTransaction
        return self.partner_transactions.filter(
            transaction_type__in=[
                PartnerTransaction.Type.WITHDRAWAL,
                PartnerTransaction.Type.CAPITAL_RETURN,
                PartnerTransaction.Type.DIVIDEND_PAYMENT,
            ]
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')

    @property
    def partner_provisional_withdrawals_balance(self) -> Decimal:
        """
        Total accumulated provisional withdrawals that have NOT yet been 
        liquidated against a formal profit distribution.
        Positive = partner has outstanding advances.
        """
        if not self.is_partner:
            return Decimal('0')
        from contacts.partner_models import PartnerTransaction
        from django.db.models import Sum
        return self.partner_transactions.filter(
            transaction_type=PartnerTransaction.Type.PROVISIONAL_WITHDRAWAL,
            distribution_resolution__isnull=True,  # Not yet liquidated
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')

