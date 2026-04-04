"""
PartnerService: Centralized service layer for all partner/shareholder operations.

Handles:
- Capital contributions (cash and inventory)
- Provisional withdrawals (advances against future profits)
- Equity subscription vs payment separation
- Equity stake snapshot management
- Balance calculations and validations
"""
from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils import timezone
from decimal import Decimal

from contacts.models import Contact
from contacts.partner_models import (
    PartnerTransaction,
    PartnerEquityStake,
)
from accounting.models import (
    AccountingSettings,
    JournalEntry,
    JournalItem,
)


class PartnerService:
    """
    Centralized service for managing partner/shareholder operations.
    All operations create atomic transactions with proper accounting entries.
    """

    # ──────────────────────────────────────────────────────────────
    # CAPITAL CONTRIBUTIONS
    # ──────────────────────────────────────────────────────────────

    @staticmethod
    @transaction.atomic
    def record_capital_contribution(
        partner: Contact,
        amount: Decimal,
        date,
        description: str = '',
        treasury_account_id=None,
        created_by=None,
    ) -> PartnerTransaction:
        """
        Records a capital contribution (cash) from a partner.
        
        Accounting:
            Dr: Caja/Banco (Asset)
            Cr: Aportes de Capital → Socio X (Equity)
        
        Returns the created PartnerTransaction.
        """
        PartnerService._validate_partner(partner)
        PartnerService._validate_amount(amount)
        settings = PartnerService._get_settings()
        receivable_account = settings.partner_capital_receivable_account
        if not receivable_account:
            raise ValidationError("La cuenta de Aportes por Cobrar Socios no está configurada.")

        # Resolve accounts
        treasury_account = None
        cash_account = None
        if treasury_account_id:
            from treasury.models import TreasuryAccount
            treasury_account = TreasuryAccount.objects.get(id=treasury_account_id)
            cash_account = treasury_account.account
        else:
            cash_account = settings.default_receivable_account  # Fallback

        # Check pending capital (Asset balance)
        pending_capital = partner.partner_pending_capital
        
        # Smart Routing for Contribution
        amount_to_receivable = min(amount, pending_capital) if pending_capital > 0 else Decimal('0')
        amount_to_equity_surplus = amount - amount_to_receivable

        # 1. Journal Entry
        entry = JournalEntry.objects.create(
            description=f"Aporte de Capital: {partner.name}" + (f" - {description}" if description else ""),
            date=date,
            status=JournalEntry.Status.POSTED,
        )
        
        # Dr: Cash
        JournalItem.objects.create(
            entry=entry,
            account=cash_account,
            label=f"Aporte Capital {partner.name}",
            debit=amount,
            credit=0,
        )
        
        # Cr: Receivable (Smart Routing)
        if amount_to_receivable > 0:
            JournalItem.objects.create(
                entry=entry,
                account=receivable_account,
                partner=partner,
                label=f"Pago Capital Suscrito {partner.name}",
                debit=0,
                credit=amount_to_receivable,
            )
            
        # Cr: Equity (Excess or direct contribution)
        if amount_to_equity_surplus > 0:
            contribution_account = partner.partner_contribution_account
            if not contribution_account:
                 raise ValidationError(f"El socio {partner.name} no tiene cuenta de aportes asignada.")
            
            JournalItem.objects.create(
                entry=entry,
                account=contribution_account,
                partner=partner,
                label=f"Aporte Capital Excedente {partner.name}" if amount_to_receivable > 0 else f"Aporte Capital {partner.name}",
                debit=0,
                credit=amount_to_equity_surplus,
            )
        entry.check_balance()

        # 2. Treasury Movement (if treasury account provided)
        movement = None
        if treasury_account:
            from treasury.models import TreasuryMovement
            movement = TreasuryMovement.objects.create(
                movement_type='INBOUND',
                payment_method='TRANSFER',
                amount=amount,
                to_account=treasury_account,
                contact=partner,
                date=date,
                notes=description,
                journal_entry=entry,
                justify_reason=TreasuryMovement.JustifyReason.CAPITAL_CONTRIBUTION,
                is_pending_registration=False,
                created_by=created_by,
            )

        # 3. Partner Transaction
        ptx = PartnerTransaction.objects.create(
            partner=partner,
            transaction_type=PartnerTransaction.Type.CAPITAL_CONTRIBUTION_CASH,
            amount=amount,
            date=date,
            description=description,
            journal_entry=entry,
            treasury_movement=movement,
            created_by=created_by,
        )

        return ptx

    # ──────────────────────────────────────────────────────────────
    # PROVISIONAL WITHDRAWALS
    # ──────────────────────────────────────────────────────────────

    @staticmethod
    @transaction.atomic
    def record_provisional_withdrawal(
        partner: Contact,
        amount: Decimal,
        date,
        description: str = '',
        treasury_account_id=None,
        created_by=None,
    ) -> PartnerTransaction:
        """
        Records a provisional withdrawal (advance against future profits).
        
        This is an advance to be liquidated when profits are formally distributed.
        Does NOT require a formal distribution resolution.
        
        Accounting:
            Dr: Retiros Provisorios → Socio X (Equity contra)
            Cr: Caja/Banco (Asset)
        """
        PartnerService._validate_partner(partner)
        PartnerService._validate_amount(amount)
        settings = PartnerService._get_settings()

        withdrawal_account = partner.partner_provisional_withdrawal_account
        if not withdrawal_account:
            raise ValidationError(
                f"El socio {partner.name} no tiene cuenta de retiros provisorios asignada. "
                "Verifique la configuración de contabilidad."
            )
            
        dividends_payable_account = settings.partner_dividends_payable_account
        if not dividends_payable_account:
            raise ValidationError("La cuenta de Dividendos por Pagar no está configurada.")

        # Check outstanding dividends
        # We query the ledger of the dividends payable account for this partner
        dividend_balance = partner.partner_dividends_payable_balance

        treasury_account = None
        cash_account = None
        if treasury_account_id:
            from treasury.models import TreasuryAccount
            treasury_account = TreasuryAccount.objects.get(id=treasury_account_id)
            cash_account = treasury_account.account
        else:
            # Try POS partner withdrawal account as fallback
            cash_account = settings.pos_partner_withdrawal_account or settings.default_receivable_account

        # Smart Routing: How much to dividends vs provisional?
        amount_to_dividends = min(amount, dividend_balance)
        amount_to_provisional = amount - amount_to_dividends

        # 1. Journal Entry
        entry = JournalEntry.objects.create(
            description=f"Retiro de Socio: {partner.name}" + (f" - {description}" if description else ""),
            date=date,
            status=JournalEntry.Status.POSTED,
        )
        
        # Debits
        if amount_to_dividends > 0:
            JournalItem.objects.create(
                entry=entry,
                account=dividends_payable_account,
                partner=partner,
                label=f"Pago Dividendo {partner.name}",
                debit=amount_to_dividends,
                credit=0,
            )
        if amount_to_provisional > 0:
            JournalItem.objects.create(
                entry=entry,
                account=withdrawal_account,
                partner=partner,
                label=f"Retiro Provisorio {partner.name}",
                debit=amount_to_provisional,
                credit=0,
            )
            
        # Credit (Bank/Cash)
        JournalItem.objects.create(
            entry=entry,
            account=cash_account,
            label=f"Retiro Socio {partner.name}",
            debit=0,
            credit=amount,
        )
        entry.check_balance()

        # 2. Treasury Movement
        movement = None
        if treasury_account:
            from treasury.models import TreasuryMovement
            movement = TreasuryMovement.objects.create(
                movement_type='OUTBOUND',
                payment_method='CASH',
                amount=amount,
                from_account=treasury_account,
                contact=partner,
                date=date,
                notes=description,
                journal_entry=entry,
                justify_reason=TreasuryMovement.JustifyReason.PARTNER_WITHDRAWAL,
                is_pending_registration=False,
                created_by=created_by,
            )

        # 3. Partner Transactions
        ptx_list = []
        if amount_to_dividends > 0:
            ptx_div = PartnerTransaction.objects.create(
                partner=partner,
                transaction_type=PartnerTransaction.Type.DIVIDEND_PAYMENT,
                amount=amount_to_dividends,
                date=date,
                description=description or "Pago de Dividendos Automático",
                journal_entry=entry,
                treasury_movement=movement,
                created_by=created_by,
            )
            ptx_list.append(ptx_div)
            
        if amount_to_provisional > 0:
            ptx_prov = PartnerTransaction.objects.create(
                partner=partner,
                transaction_type=PartnerTransaction.Type.PROVISIONAL_WITHDRAWAL,
                amount=amount_to_provisional,
                date=date,
                description=description or "Retiro Provisorio",
                journal_entry=entry,
                treasury_movement=movement,
                created_by=created_by,
            )
            ptx_list.append(ptx_prov)

        return ptx_list[0] if ptx_list else None

    # ──────────────────────────────────────────────────────────────
    # EQUITY SUBSCRIPTION (separated from payment)
    # ──────────────────────────────────────────────────────────────

    @staticmethod
    @transaction.atomic
    def record_equity_subscription(
        partner: Contact,
        amount: Decimal,
        date,
        description: str = '',
        created_by=None,
    ) -> PartnerTransaction:
        """
        Records a formal capital subscription (commitment).
        This does NOT mean the capital has been paid in yet.
        
        Accounting:
            Dr: Cuenta Particular del Socio (receivable from partner, equity)
            Cr: Capital Social (Equity)
        """
        PartnerService._validate_partner(partner)
        PartnerService._validate_amount(amount)
        settings = PartnerService._get_settings()

        if not settings.partner_capital_social_account:
            raise ValidationError("No se ha configurado la cuenta de Capital Social.")

        receivable_account = settings.partner_capital_receivable_account
        if not receivable_account:
            raise ValidationError("La cuenta de Aportes por Cobrar Socios no está configurada.")

        # Journal Entry
        entry_desc = f"Suscripción de Capital: {partner.name}"
        if description:
            entry_desc += f" - {description}"

        entry = JournalEntry.objects.create(
            description=entry_desc,
            date=date,
            status=JournalEntry.Status.POSTED,
        )
        # Dr: Receivable Account (the partner now "owes" this to the company)
        JournalItem.objects.create(
            entry=entry,
            account=receivable_account,
            partner=partner,
            label=entry_desc,
            debit=amount,
            credit=0,
        )
        # Cr: Partner Specific Capital Account (Equity)
        contribution_account = partner.partner_contribution_account
        if not contribution_account:
            raise ValidationError(f"El socio {partner.name} no tiene cuenta de capital asignada.")

        JournalItem.objects.create(
            entry=entry,
            account=contribution_account,
            partner=partner,
            label=entry_desc,
            debit=0,
            credit=amount,
        )
        entry.check_balance()

        # Partner Transaction
        ptx = PartnerTransaction.objects.create(
            partner=partner,
            transaction_type=PartnerTransaction.Type.EQUITY_SUBSCRIPTION,
            amount=amount,
            date=date,
            description=description,
            journal_entry=entry,
            created_by=created_by,
        )

        # Update equity stakes
        PartnerService._recalculate_and_snapshot_stakes(
            date=date,
            source_transaction=ptx,
            created_by=created_by,
        )

        return ptx

    @staticmethod
    @transaction.atomic
    def record_equity_reduction(
        partner: Contact,
        amount: Decimal,
        date,
        description: str = '',
        created_by=None,
    ) -> PartnerTransaction:
        """
        Records a formal capital reduction.
        
        Accounting (reverse of subscription):
            Dr: Capital Social (Equity)
            Cr: Cuenta Particular del Socio (Equity)
        """
        PartnerService._validate_partner(partner)
        PartnerService._validate_amount(amount)
        settings = PartnerService._get_settings()

        if amount > partner.partner_total_contributions:
            raise ValidationError(
                f"El monto de reducción (${amount:,.0f}) excede el capital suscrito "
                f"del socio (${partner.partner_total_contributions:,.0f})."
            )

        if not settings.partner_capital_social_account:
            raise ValidationError("No se ha configurado la cuenta de Capital Social.")

        receivable_account = settings.partner_capital_receivable_account
        if not receivable_account:
            raise ValidationError("La cuenta de Aportes por Cobrar Socios no está configurada.")

        entry_desc = f"Reducción de Capital: {partner.name}"
        if description:
            entry_desc += f" - {description}"

        entry = JournalEntry.objects.create(
            description=entry_desc,
            date=date,
            status=JournalEntry.Status.POSTED,
        )
        
        # Dr: Partner Specific Capital Account (Equity)
        contribution_account = partner.partner_contribution_account
        if not contribution_account:
            raise ValidationError(f"El socio {partner.name} no tiene cuenta de capital asignada.")

        JournalItem.objects.create(
            entry=entry,
            account=contribution_account,
            partner=partner,
            label=entry_desc,
            debit=amount,
            credit=0,
        )
        # Cr: Receivable Account (Un-suscribing)
        JournalItem.objects.create(
            entry=entry,
            account=receivable_account,
            partner=partner,
            label=entry_desc,
            debit=0,
            credit=amount,
        )
        entry.check_balance()

        ptx = PartnerTransaction.objects.create(
            partner=partner,
            transaction_type=PartnerTransaction.Type.EQUITY_REDUCTION,
            amount=amount,
            date=date,
            description=description,
            journal_entry=entry,
            created_by=created_by,
        )

        PartnerService._recalculate_and_snapshot_stakes(
            date=date,
            source_transaction=ptx,
            created_by=created_by,
        )

        return ptx

    # ──────────────────────────────────────────────────────────────
    # EQUITY TRANSFER
    # ──────────────────────────────────────────────────────────────

    @staticmethod
    @transaction.atomic
    def record_equity_transfer(
        seller: Contact,
        buyer: Contact,
        amount: Decimal,
        date,
        description: str = '',
        created_by=None,
    ) -> tuple:
        """
        Records a transfer of equity participation between two partners.
        Returns a tuple (seller_tx, buyer_tx).
        """
        PartnerService._validate_partner(seller)
        PartnerService._validate_amount(amount)

        if seller.id == buyer.id:
            raise ValidationError("El socio vendedor y comprador no pueden ser el mismo.")

        if amount > seller.partner_total_contributions:
            raise ValidationError(
                f"El monto de transferencia (${amount:,.0f}) excede el capital suscrito "
                f"del socio vendedor (${seller.partner_total_contributions:,.0f})."
            )

        # Ensure buyer is a partner
        if not buyer.is_partner:
            buyer.is_partner = True
            if not buyer.partner_since:
                buyer.partner_since = date if not isinstance(date, str) else timezone.now().date()
            buyer.save()

        settings = PartnerService._get_settings()
        receivable_account = settings.partner_capital_receivable_account
        if not receivable_account:
            raise ValidationError("La cuenta de Aportes por Cobrar Socios no está configurada.")

        entry_desc = f"Transferencia de Capital: {seller.name} → {buyer.name}"
        if description:
            entry_desc += f" - {description}"

        entry = JournalEntry.objects.create(
            description=entry_desc,
            date=date,
            status=JournalEntry.Status.POSTED,
        )
        JournalItem.objects.create(
            entry=entry,
            account=receivable_account,
            partner=seller,
            label=entry_desc,
            debit=amount,
            credit=0,
        )
        JournalItem.objects.create(
            entry=entry,
            account=receivable_account,
            partner=buyer,
            label=entry_desc,
            debit=0,
            credit=amount,
        )
        entry.check_balance()

        seller_tx = PartnerTransaction.objects.create(
            partner=seller,
            transaction_type=PartnerTransaction.Type.EQUITY_TRANSFER_OUT,
            amount=amount,
            date=date,
            description=f"Transferencia a {buyer.name}: {description}",
            journal_entry=entry,
            created_by=created_by,
        )
        buyer_tx = PartnerTransaction.objects.create(
            partner=buyer,
            transaction_type=PartnerTransaction.Type.EQUITY_TRANSFER_IN,
            amount=amount,
            date=date,
            description=f"Transferencia recibida de {seller.name}: {description}",
            journal_entry=entry,
            created_by=created_by,
        )

        PartnerService._recalculate_and_snapshot_stakes(
            date=date,
            source_transaction=seller_tx,
            created_by=created_by,
        )

        return seller_tx, buyer_tx

    # ──────────────────────────────────────────────────────────────
    # INITIAL SETUP (Bulk)
    # ──────────────────────────────────────────────────────────────

    @staticmethod
    @transaction.atomic
    def initial_setup(partners_data: list, created_by=None) -> dict:
        """
        Bulk partner setup with initial capital subscription.
        
        Args:
            partners_data: List of {'contact_id': int, 'amount': Decimal}
        
        Returns:
            dict with total_capital, journal_entry, partners_updated count
        """
        settings = PartnerService._get_settings()
        if not settings.partner_capital_social_account:
            raise ValidationError("No se ha configurado la cuenta de Capital Social.")

        receivable_account = settings.partner_capital_receivable_account
        if not receivable_account:
            raise ValidationError("La cuenta de Aportes por Cobrar Socios no está configurada.")

        contacts_with_amounts = []
        total_capital = Decimal('0')

        for item in partners_data:
            contact_id = item.get('contact_id')
            amount = Decimal(str(item.get('amount', '0')))
            if amount <= 0:
                raise ValidationError(f"El monto para el contacto {contact_id} debe ser > 0.")
            
            contact = Contact.objects.get(id=contact_id)
            contacts_with_amounts.append((contact, amount))
            total_capital += amount

        # Mark all as partners and ensure accounts exist
        today = timezone.now().date()
        for contact, _ in contacts_with_amounts:
            contact.is_partner = True
            if not contact.partner_since:
                contact.partner_since = today
            contact.save()

        # Single Journal Entry for all
        entry = JournalEntry.objects.create(
            description="Asiento Inicial - Suscripción de Capital",
            status=JournalEntry.Status.POSTED,
            date=today,
        )

        # Individual partner transactions + debit items
        for contact, amount in contacts_with_amounts:

            PartnerTransaction.objects.create(
                partner=contact,
                transaction_type=PartnerTransaction.Type.EQUITY_SUBSCRIPTION,
                amount=amount,
                date=today,
                description="Suscripción inicial de capital",
                journal_entry=entry,
                created_by=created_by,
            )

            JournalItem.objects.create(
                entry=entry,
                account=receivable_account,
                partner=contact,
                partner_name=contact.name,
                label=f"Suscripción Capital: {contact.name}",
                debit=amount,
                credit=0,
            )

        # Single credit to Capital Social
        JournalItem.objects.create(
            entry=entry,
            account=settings.partner_capital_social_account,
            label="Suscripción de Capital Social Inicial",
            debit=0,
            credit=total_capital,
        )

        entry.check_balance()

        # Recalculate percentages
        PartnerService._recalculate_and_snapshot_stakes(
            date=today,
            source_transaction=None,
            created_by=created_by,
        )

        return {
            'total_capital': total_capital,
            'journal_entry': entry,
            'partners_updated': len(contacts_with_amounts),
        }

    # ──────────────────────────────────────────────────────────────
    # QUERY HELPERS
    # ──────────────────────────────────────────────────────────────

    @staticmethod
    def get_provisional_withdrawals_balance(partner: Contact) -> Decimal:
        """Returns the total UN-LIQUIDATED provisional withdrawals for a partner."""
        return partner.partner_provisional_withdrawals_balance

    @staticmethod
    def get_equity_percentage_at_date(partner: Contact, target_date) -> Decimal:
        """
        Get the partner's equity percentage at a specific date.
        Uses PartnerEquityStake temporal records.
        """
        from django.db.models import Q
        stake = PartnerEquityStake.objects.filter(
            partner=partner,
            effective_from__lte=target_date,
        ).filter(
            Q(effective_until__isnull=True) | Q(effective_until__gte=target_date)
        ).order_by('-effective_from').first()
        
        if stake:
            return stake.percentage
        return partner.partner_equity_percentage or Decimal('0')

    @staticmethod
    def get_global_summary() -> dict:
        """Calculates global metrics for the partner dashboard using aggregated contact properties."""
        partners = Contact.objects.filter(is_partner=True)
        
        # Subscribed Capital Sum
        total_subscribed = sum([p.partner_total_contributions for p in partners])
        # Paid-in Capital Sum
        total_paid_in = sum([p.partner_total_paid_in for p in partners])
        # Pending Capital (Receivable from partners)
        total_pending = sum([p.partner_pending_capital for p in partners])
        # Provisional Withdrawals (Advances)
        total_prov_withdrawals = sum([p.partner_provisional_withdrawals_balance for p in partners])
        # Accumulated Earnings (Retained)
        total_earnings = sum([p.partner_earnings_balance for p in partners])
        # Net Equity Book Value
        total_net_equity = sum([p.partner_net_equity for p in partners])

        return {
            'total_capital': total_subscribed,
            'total_paid_in': total_paid_in,
            'total_pending': total_pending,
            'total_provisional_withdrawals': total_prov_withdrawals,
            'total_earnings': total_earnings,
            'total_net_equity': total_net_equity,
            'partner_count': partners.count(),
            'last_updated': timezone.now().isoformat(),
        }

    # ──────────────────────────────────────────────────────────────
    # EQUITY STAKE MANAGEMENT
    # ──────────────────────────────────────────────────────────────

    @staticmethod
    def _recalculate_and_snapshot_stakes(date, source_transaction=None, created_by=None):
        """
        Recalculates the equity percentages for ALL partners based on
        their transaction history, then creates new PartnerEquityStake records
        closing old ones.
        
        Also updates Contact.partner_equity_percentage as a denormalized cache.
        """
        from django.db.models import Sum

        # 1. Calculate total subscribed capital
        subs = PartnerTransaction.objects.filter(
            transaction_type=PartnerTransaction.Type.EQUITY_SUBSCRIPTION
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
        
        reds = PartnerTransaction.objects.filter(
            transaction_type=PartnerTransaction.Type.EQUITY_REDUCTION
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')

        trans_in = PartnerTransaction.objects.filter(
            transaction_type=PartnerTransaction.Type.EQUITY_TRANSFER_IN
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')

        trans_out = PartnerTransaction.objects.filter(
            transaction_type=PartnerTransaction.Type.EQUITY_TRANSFER_OUT
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')

        reinvest = PartnerTransaction.objects.filter(
            transaction_type=PartnerTransaction.Type.REINVESTMENT
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')

        total_subscribed = subs - reds + trans_in - trans_out + reinvest

        partners = Contact.objects.filter(is_partner=True)

        for p in partners:
            if total_subscribed <= 0:
                new_pct = Decimal('0')
            else:
                p_total = p.partner_total_contributions
                new_pct = (p_total / total_subscribed * 100).quantize(Decimal('0.01'))

            # Close existing active stake if percentage changed
            active_stake = PartnerEquityStake.objects.filter(
                partner=p, effective_until__isnull=True
            ).first()

            if active_stake and active_stake.percentage != new_pct:
                active_stake.effective_until = date
                active_stake.save(update_fields=['effective_until'])
                active_stake = None

            # Create new stake if needed
            if not active_stake:
                PartnerEquityStake.objects.create(
                    partner=p,
                    percentage=new_pct,
                    effective_from=date,
                    effective_until=None,
                    source_transaction=source_transaction,
                    created_by=created_by,
                )

            # Update denormalized cache
            p.partner_equity_percentage = new_pct
            p.save(update_fields=['partner_equity_percentage'])

        return total_subscribed

    # ──────────────────────────────────────────────────────────────
    # PRIVATE HELPERS
    # ──────────────────────────────────────────────────────────────

    @staticmethod
    def _validate_partner(partner: Contact):
        if not partner.is_partner:
            raise ValidationError(f"El contacto {partner.name} no está marcado como socio.")

    @staticmethod
    def _validate_amount(amount: Decimal):
        if amount <= 0:
            raise ValidationError("El monto debe ser mayor a cero.")

    @staticmethod
    def _get_settings() -> AccountingSettings:
        settings = AccountingSettings.get_solo()
        if not settings:
            raise ValidationError("No se encontró configuración contable.")
        return settings
