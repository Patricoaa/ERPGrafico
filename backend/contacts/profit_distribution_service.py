"""
ProfitDistributionService: Business logic for formal profit (or loss) distribution.
Handles resolutions, percentage calculations based on history, and journal entries.
"""
from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils import timezone
from decimal import Decimal

from contacts.models import Contact
from accounting.models import AccountingSettings, JournalEntry, JournalItem
from .partner_models import (
    PartnerTransaction,
    ProfitDistributionResolution,
    ProfitDistributionLine,
)
from .partner_service import PartnerService


class ProfitDistributionService:

    @staticmethod
    @transaction.atomic
    def create_draft_resolution(
        fiscal_year: int,
        net_result: Decimal,
        resolution_date,
        acta_number: str = '',
        notes: str = '',
        created_by=None,
    ) -> ProfitDistributionResolution:
        """
        Creates a new distribution resolution in DRAFT status.
        Calculates the exact participation percentage of each partner at `resolution_date`
        and prepares the lines with their corresponding gross amounts.
        """
        if net_result == 0:
            raise ValidationError("El resultado del ejercicio no puede ser cero.")

        settings = ProfitDistributionService._get_settings()
        
        # Check if resolution for this fiscal year already exists
        existing = ProfitDistributionResolution.objects.filter(
            fiscal_year=fiscal_year,
            status__in=[
                ProfitDistributionResolution.Status.DRAFT,
                ProfitDistributionResolution.Status.APPROVED,
                ProfitDistributionResolution.Status.EXECUTED
            ]
        ).exists()
        if existing:
            raise ValidationError(f"Ya existe una resolución activa para el año fiscal {fiscal_year}.")

        resolution = ProfitDistributionResolution.objects.create(
            fiscal_year=fiscal_year,
            resolution_date=resolution_date,
            net_result=net_result,
            acta_number=acta_number,
            notes=notes,
            created_by=created_by,
            status=ProfitDistributionResolution.Status.DRAFT,
        )

        ProfitDistributionService._generate_resolution_lines(resolution)

        return resolution

    @staticmethod
    @transaction.atomic
    def recalculate_draft_resolution(resolution: ProfitDistributionResolution) -> ProfitDistributionResolution:
        """
        Refreshes a draft resolution by deleting current lines and 
        re-calculating them based on current partner data.
        """
        if resolution.status != ProfitDistributionResolution.Status.DRAFT:
            raise ValidationError("Solo se pueden recalcular resoluciones en estado borrador.")
            
        # Delete existing lines
        resolution.lines.all().delete()
        
        # Re-generate lines
        ProfitDistributionService._generate_resolution_lines(resolution)
        
        # Update timestamp
        resolution.save(update_fields=['updated_at'])
        
        return resolution

    @staticmethod
    def _generate_resolution_lines(resolution: ProfitDistributionResolution):
        """
        Helper to generate lines for a resolution.
        """
        partners = Contact.objects.filter(is_partner=True)
        
        for partner in partners:
            # 1. Get exact percentage at resolution date
            pct = PartnerService.get_equity_percentage_at_date(partner, resolution.resolution_date)
            
            if pct <= 0:
                continue

            # 2. Calculate Gross Amount
            gross_amount = (resolution.net_result * (pct / Decimal('100.0'))).quantize(Decimal('0.00'))

            # 3. Handle Losses vs Profits
            offset_amount = Decimal('0')
            if resolution.is_profit:
                # Calculate if there are unliquidated provisional withdrawals
                outstanding_withdrawals = PartnerService.get_provisional_withdrawals_balance(partner)
                
                # Offset cannot exceed the gross profit assigned to the partner
                if outstanding_withdrawals > 0:
                    offset_amount = min(outstanding_withdrawals, gross_amount)

            # Minimum net amount is 0 (can't have negative net if it's a profit)
            net_amount = gross_amount
            if resolution.is_profit:
                net_amount = max(Decimal('0'), gross_amount - offset_amount)
                
            # Default destination: Pay out (if profit), Absorb (if loss)
            default_dest = ProfitDistributionLine.Destination.DIVIDEND_PAYABLE
            if resolution.is_loss:
                default_dest = ProfitDistributionLine.Destination.LOSS_ABSORPTION

            ProfitDistributionLine.objects.create(
                resolution=resolution,
                partner=partner,
                percentage_at_date=pct,
                gross_amount=gross_amount,
                provisional_withdrawals_offset=offset_amount,
                net_amount=net_amount,
                destination=default_dest,
            )

    @staticmethod
    @transaction.atomic
    def update_draft_line_destinations(resolution: ProfitDistributionResolution, lines_data: list):
        """
        Updates the destinations (Retain, Reinvest, Pay out) for draft resolution lines.
        lines_data: [{'line_id': int, 'destination': str}]
        """
        if resolution.status != ProfitDistributionResolution.Status.DRAFT:
            raise ValidationError("Solo se pueden modificar resoluciones en borrador.")

        for item in lines_data:
            line_id = item.get('line_id')
            dest = item.get('destination')
            try:
                line = resolution.lines.get(id=line_id)
                line.destination = dest
                line.save(update_fields=['destination'])
            except ProfitDistributionLine.DoesNotExist:
                continue

    @staticmethod
    @transaction.atomic
    def approve_resolution(resolution: ProfitDistributionResolution, approved_by):
        """Transitions resolution from DRAFT to APPROVED."""
        if resolution.status != ProfitDistributionResolution.Status.DRAFT:
            raise ValidationError("La resolución debe estar en borrador para ser aprobada.")
        
        resolution.status = ProfitDistributionResolution.Status.APPROVED
        resolution.approved_by = approved_by
        resolution.approved_at = timezone.now()
        resolution.save()
        return resolution

    @staticmethod
    @transaction.atomic
    def execute_resolution(resolution: ProfitDistributionResolution, executed_by) -> ProfitDistributionResolution:
        """
        Executes an APPROVED resolution.
        Generates the complex journal entry and all partner transactions.
        """
        if resolution.status != ProfitDistributionResolution.Status.APPROVED:
            raise ValidationError("La resolución debe estar aprobada para ser ejecutada.")

        settings = ProfitDistributionService._get_settings()
        
        # We need the current year earnings account to debit (empty it out)
        if not settings.partner_current_year_earnings_account:
            raise ValidationError("Falta configurar la Cuenta de Utilidades del Ejercicio.")
        if not settings.partner_retained_earnings_account:
            raise ValidationError("Falta configurar la Cuenta de Utilidades Retenidas.")
        
        entry_desc = f"Distribución de Resultados {resolution.fiscal_year}"
        if resolution.acta_number:
            entry_desc += f" (Acta: {resolution.acta_number})"

        entry = JournalEntry.objects.create(
            description=entry_desc,
            date=resolution.resolution_date,
            status=JournalEntry.Status.POSTED,
        )
        resolution.journal_entry = entry

        # 1. Close the Current Year Earnings account
        # If profit, it has a credit balance, so we debit it
        # If loss, it has a debit balance, so we credit it
        JournalItem.objects.create(
            entry=entry,
            account=settings.partner_current_year_earnings_account,
            label="Cierre Utilidades del Ejercicio",
            debit=abs(resolution.net_result) if resolution.is_profit else 0,
            credit=0 if resolution.is_profit else abs(resolution.net_result),
        )

        for line in resolution.lines.all():
            partner = line.partner
            
            # Record Provisional Withdrawal Offsets first
            if line.provisional_withdrawals_offset > 0:
                if not partner.partner_provisional_withdrawal_account:
                    raise ValidationError(f"El socio {partner.name} no tiene cuenta de retiros provisorios.")
                
                # Offset unliquidated transactions
                unliquidated = PartnerTransaction.objects.filter(
                    partner=partner,
                    transaction_type=PartnerTransaction.Type.PROVISIONAL_WITHDRAWAL,
                    distribution_resolution__isnull=True
                ).order_by('date')
                
                remaining_offset = line.provisional_withdrawals_offset
                for tx in unliquidated:
                    if remaining_offset <= 0: break
                    tx.distribution_resolution = resolution
                    tx.save(update_fields=['distribution_resolution'])
                    remaining_offset -= tx.amount # Simplification: assuming full match or over-match for now. 
                    # Note: We link the resolution to the withdrawal transaction to mark it as liquidated.
                
                # Accounting for Offset (Credit the Provisional Withdrawal account to reduce the contra-equity)
                JournalItem.objects.create(
                    entry=entry,
                    account=partner.partner_provisional_withdrawal_account,
                    partner=partner,
                    label=f"Liquidación Retiros Prov. {partner.name}",
                    debit=0,
                    credit=line.provisional_withdrawals_offset,
                )

                # NEW: Create a Partner Transaction for the Offset (so it's visible in the Ledger)
                PartnerTransaction.objects.create(
                    partner=partner,
                    transaction_type=PartnerTransaction.Type.DIVIDEND,
                    amount=line.provisional_withdrawals_offset,
                    date=resolution.resolution_date,
                    description=f"Compensación Retiros Provisorios - Ejercicio {resolution.fiscal_year}",
                    journal_entry=entry,
                    distribution_resolution=resolution,
                    created_by=executed_by,
                )

            # Record final destination of Net Amount
            if line.net_amount > 0 or line.destination == ProfitDistributionLine.Destination.LOSS_ABSORPTION:
                abs_net = abs(line.net_amount)
                
                if line.destination == ProfitDistributionLine.Destination.RETAINED:
                    # Credit Partner's Specific Earnings Account (Equity)
                    JournalItem.objects.create(
                        entry=entry,
                        account=partner.partner_earnings_account,
                        partner=partner,
                        label=f"Utilidades Retenidas {partner.name}",
                        debit=0,
                        credit=abs_net,
                    )
                    
                    # Create Partner Transaction for History
                    ptx = PartnerTransaction.objects.create(
                        partner=partner,
                        transaction_type=PartnerTransaction.Type.RETAINED,
                        amount=abs_net,
                        date=resolution.resolution_date,
                        description=f"Utilidades Retenidas Ejercicio {resolution.fiscal_year}",
                        journal_entry=entry,
                        distribution_resolution=resolution,
                        created_by=executed_by,
                    )
                    line.partner_transaction = ptx
                    line.save(update_fields=['partner_transaction'])
                    
                elif line.destination == ProfitDistributionLine.Destination.DIVIDEND_PAYABLE:
                    if not settings.partner_dividends_payable_account:
                        raise ValidationError("Falta configurar la Cuenta de Dividendos por Pagar.")
                    
                    # Credit Dividends Payable (Liability)
                    JournalItem.objects.create(
                        entry=entry,
                        account=settings.partner_dividends_payable_account,
                        label=f"Dividendos por Pagar {partner.name}",
                        debit=0,
                        credit=abs_net,
                    )

                    # Create Partner Transaction for History (Allocation)
                    ptx = PartnerTransaction.objects.create(
                        partner=partner,
                        transaction_type=PartnerTransaction.Type.DIVIDEND,
                        amount=abs_net,
                        date=resolution.resolution_date,
                        description=f"Asignación Dividendos Ejercicio {resolution.fiscal_year}",
                        journal_entry=entry,
                        distribution_resolution=resolution,
                        created_by=executed_by,
                    )
                    line.partner_transaction = ptx
                    line.save(update_fields=['partner_transaction'])
                    
                elif line.destination == ProfitDistributionLine.Destination.REINVEST:
                    if not settings.partner_capital_social_account:
                        raise ValidationError("Falta configurar la Cuenta de Capital Social.")
                    if not partner.partner_contribution_account:
                        raise ValidationError(f"El socio {partner.name} no tiene cuenta de capital asignada.")

                    # Credit Partner's Specific Capital Account (Equity)
                    JournalItem.objects.create(
                        entry=entry,
                        account=partner.partner_contribution_account,
                        partner=partner,
                        label=f"Reinversión de Utilidades {partner.name}",
                        debit=0,
                        credit=abs_net,
                    )
                    
                    # Also create a Partner Transaction for Reinvestment (Increases Equity Stake)
                    ptx = PartnerTransaction.objects.create(
                        partner=partner,
                        transaction_type=PartnerTransaction.Type.REINVESTMENT,
                        amount=abs_net,
                        date=resolution.resolution_date,
                        description=f"Reinversión Utilidades {resolution.fiscal_year}",
                        journal_entry=entry,
                        distribution_resolution=resolution,
                        created_by=executed_by,
                    )
                    line.partner_transaction = ptx
                    line.save(update_fields=['partner_transaction'])

                elif line.destination == ProfitDistributionLine.Destination.LOSS_ABSORPTION:
                    # Debit Partner's Specific Earnings Account (Equity)
                    JournalItem.objects.create(
                        entry=entry,
                        account=partner.partner_earnings_account,
                        partner=partner,
                        label=f"Absorción de Pérdida {partner.name}",
                        debit=abs_net,
                        credit=0,
                    )
                    
                    ptx = PartnerTransaction.objects.create(
                        partner=partner,
                        transaction_type=PartnerTransaction.Type.LOSS_ABSORPTION,
                        amount=-abs_net, # Stored as negative or positive depending on convention, we use absolute amount and type defines direction
                        date=resolution.resolution_date,
                        description=f"Absorción Pérdida {resolution.fiscal_year}",
                        journal_entry=entry,
                        distribution_resolution=resolution,
                        created_by=executed_by,
                    )
                    line.partner_transaction = ptx
                    line.save(update_fields=['partner_transaction'])

        entry.check_balance()

        resolution.status = ProfitDistributionResolution.Status.EXECUTED
        resolution.executed_by = executed_by
        resolution.executed_at = timezone.now()
        resolution.save()
        
        # If any reinvestments occurred, we need to recalculate equity stakes
        has_reinvestments = resolution.lines.filter(destination=ProfitDistributionLine.Destination.REINVEST).exists()
        if has_reinvestments:
            PartnerService._recalculate_and_snapshot_stakes(
                date=resolution.resolution_date,
                source_transaction=None, # Multiple possible
                created_by=executed_by
            )

        return resolution

    @staticmethod
    @transaction.atomic
    def execute_mass_payment(resolution: ProfitDistributionResolution, treasury_account_id: int, executed_by) -> ProfitDistributionResolution:
        """
        Executes a mass payment for all lines that have DIVIDEND_PAYABLE destination.
        Generates a single Treasury Movement and a Journal Entry that credits the Bank and debits Dividends Payable.
        """
        if resolution.status != ProfitDistributionResolution.Status.EXECUTED:
            raise ValidationError("La resolución debe estar ejecutada contablemente para realizar su pago masivo.")
            
        settings = ProfitDistributionService._get_settings()
        
        # Get lines to pay
        lines_to_pay = resolution.lines.filter(
            destination=ProfitDistributionLine.Destination.DIVIDEND_PAYABLE, 
            net_amount__gt=0,
            treasury_movement__isnull=True
        )
        
        if not lines_to_pay.exists():
            raise ValidationError("No hay dividendos pendientes de pago para esta resolución.")
            
        total_payment = sum([line.net_amount for line in lines_to_pay])
        
        from treasury.models import TreasuryAccount, TreasuryMovement
        from accounting.models import Account
        
        try:
            treasury_account = TreasuryAccount.objects.get(id=treasury_account_id)
        except TreasuryAccount.DoesNotExist:
            raise ValidationError("Cuenta de tesorería no válida.")
            
        # Create Journal Entry
        entry = JournalEntry.objects.create(
            description=f"Pago Masivo de Dividendos - Ejercicio {resolution.fiscal_year} (Acta: {resolution.acta_number})",
            date=timezone.now().date(),
            status=JournalEntry.Status.POSTED,
        )
        
        # 1. Credit Treasury Account
        bank_account = treasury_account.accounting_account
        if not bank_account:
            raise ValidationError("La cuenta de tesorería seleccionada no tiene cuenta contable asociada.")
            
        JournalItem.objects.create(
            entry=entry,
            account=bank_account,
            label=f"Pago Dividendos Ej. {resolution.fiscal_year}",
            debit=0,
            credit=total_payment,
        )
        
        # 2. Debit Dividends Payable
        if not settings.partner_dividends_payable_account:
            raise ValidationError("Falta configurar la Cuenta de Dividendos por Pagar.")
            
        JournalItem.objects.create(
            entry=entry,
            account=settings.partner_dividends_payable_account,
            label=f"Cancelación Pasivo Dividendos Ej. {resolution.fiscal_year}",
            debit=total_payment,
            credit=0,
        )
        
        entry.check_balance()
        
        # 3. Create Treasury Movement
        movement = TreasuryMovement.objects.create(
            account=treasury_account,
            movement_type=TreasuryMovement.MovementType.OUTFLOW,
            amount=total_payment,
            date=timezone.now().date(),
            description=f"Pago Masivo Dividendos - Ej. {resolution.fiscal_year}",
            journal_entry=entry,
            is_reconciled=False,
            created_by=executed_by,
        )
        
        # 4. Mark lines as paid
        for line in lines_to_pay:
            line.treasury_movement = movement
            # We also create a PartnerTransaction to reflect the payment formally in the partner statement
            ptx = PartnerTransaction.objects.create(
                partner=line.partner,
                transaction_type=PartnerTransaction.Type.DIVIDEND_PAYMENT,
                amount=line.net_amount,
                date=timezone.now().date(),
                description=f"Pago Efectivo Dividendo Ej. {resolution.fiscal_year}",
                journal_entry=entry,
                treasury_movement=movement,
                distribution_resolution=resolution,
                created_by=executed_by,
            )
            line.partner_transaction = ptx # Override with the payment transaction for reference
            line.save(update_fields=['treasury_movement', 'partner_transaction'])
            
        return resolution

    @staticmethod
    def _get_settings() -> AccountingSettings:
        settings = AccountingSettings.objects.first()
        if not settings:
            raise ValidationError("No se encontró configuración contable.")
        return settings
