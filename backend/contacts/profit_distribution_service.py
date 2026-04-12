"""
ProfitDistributionService: Business logic for formal profit (or loss) distribution.
Handles resolutions, percentage calculations based on history, and journal entries.
"""
from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils import timezone
from decimal import Decimal, ROUND_HALF_UP

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
        fiscal_year_id: int,
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
        from accounting.models import FiscalYear
        try:
            fy_obj = FiscalYear.objects.get(id=fiscal_year_id)
        except FiscalYear.DoesNotExist:
            raise ValidationError(f"El año fiscal con ID {fiscal_year_id} no existe.")

        fiscal_year = fy_obj.year

        if net_result == 0:
            raise ValidationError("El resultado del ejercicio no puede ser cero.")

        settings = ProfitDistributionService._get_settings()
        
        # Check if resolution for this fiscal year already exists
        # We check both the integer year and the specific object to be safe
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
            fiscal_year_obj=fy_obj,
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
        Accumulates all partner allocations first, then applies a rounding
        adjustment to the largest share so the sum matches net_result exactly.
        """
        partners = Contact.objects.filter(is_partner=True)
        
        # --- Phase 1: Calculate gross amounts ---
        lines_data = []
        for partner in partners:
            pct = PartnerService.get_equity_percentage_at_date(partner, resolution.resolution_date)
            if pct <= 0:
                continue

            gross_amount = (abs(resolution.net_result) * (pct / Decimal('100'))).quantize(
                Decimal('1'), rounding=ROUND_HALF_UP
            )
            lines_data.append({'partner': partner, 'pct': pct, 'gross': gross_amount})

        # --- Phase 2: Rounding adjustment ---
        # Ensure sum(gross_amounts) == abs(net_result) to prevent unbalanced entries
        if lines_data:
            total_gross = sum(d['gross'] for d in lines_data)
            diff = abs(resolution.net_result) - total_gross
            if diff != 0:
                # Apply the cent adjustment to the partner with the largest share
                lines_data.sort(key=lambda x: x['gross'], reverse=True)
                lines_data[0]['gross'] += diff

        # --- Phase 3: Create DB records ---
        for item in lines_data:
            partner = item['partner']
            pct = item['pct']
            # Restore sign: negative for losses, positive for profits
            gross_amount = item['gross'] if resolution.is_profit else -item['gross']

            # Handle provisional withdrawal offsets (only on profits)
            offset_amount = Decimal('0')
            if resolution.is_profit:
                outstanding_withdrawals = PartnerService.get_provisional_withdrawals_balance(partner)
                if outstanding_withdrawals > 0:
                    offset_amount = min(outstanding_withdrawals, gross_amount)

            net_amount = gross_amount
            if resolution.is_profit:
                net_amount = max(Decimal('0'), gross_amount - offset_amount)
                
            ProfitDistributionLine.objects.create(
                resolution=resolution,
                partner=partner,
                percentage_at_date=pct,
                gross_amount=gross_amount,
                provisional_withdrawals_offset=offset_amount,
                net_amount=net_amount,
            )

    @staticmethod
    @transaction.atomic
    def update_draft_line_destinations(resolution: ProfitDistributionResolution, lines_data: list):
        """
        Updates the destinations for draft resolution lines.
        lines_data: [{'line_id': int, 'destinations': [{'destination': str, 'amount': float}] }]
        """
        from .partner_models import ProfitDistributionLineDestination

        if resolution.status != ProfitDistributionResolution.Status.DRAFT:
            raise ValidationError("Solo se pueden modificar resoluciones en borrador.")

        for item in lines_data:
            line_id = item.get('line_id')
            dests_list = item.get('destinations', [])
            try:
                line = resolution.lines.get(id=line_id)
                # clear old
                line.destinations.all().delete()
                
                total_assigned = Decimal('0')
                for d in dests_list:
                    amount = Decimal(str(d.get('amount', 0)))
                    dest_type = d.get('destination')
                    if amount > 0:
                        ProfitDistributionLineDestination.objects.create(
                            line=line,
                            destination=dest_type,
                            amount=amount
                        )
                        total_assigned += amount
                        
                if total_assigned > line.net_amount:
                   raise ValidationError(f"La suma de destinos ({total_assigned}) para {line.partner.name} excede su monto neto ({line.net_amount}).")
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

        # 0. Immediate Configuration Check
        if not settings.partner_current_year_earnings_account:
            raise ValidationError("Falta configurar la Cuenta de Utilidades del Ejercicio.")
        if not settings.partner_retained_earnings_account:
            raise ValidationError("Falta configurar la Cuenta de Utilidades Retenidas.")
        
        # Check destinations to ensure all target accounts are configred before doing any damage
        from .partner_models import ProfitDistributionLineDestination
        destinations = ProfitDistributionLineDestination.objects.filter(line__resolution=resolution).values_list('destination', flat=True).distinct()
        if ProfitDistributionLineDestination.Destination.DIVIDEND_PAYABLE in destinations:
            if not settings.partner_dividends_payable_account:
                raise ValidationError("Falta configurar la Cuenta de Dividendos por Pagar.")
        
        if ProfitDistributionLineDestination.Destination.REINVEST in destinations:
            if not settings.partner_capital_social_account:
                raise ValidationError("Falta configurar la Cuenta de Capital Social.")

        entry_desc = f"Distribución de Resultados {resolution.fiscal_year}"
        if resolution.acta_number:
            entry_desc += f" (Acta: {resolution.acta_number})"

        entry = JournalEntry(
            description=entry_desc,
            date=resolution.resolution_date,
            status=JournalEntry.Status.POSTED,
        )
        # Bypasses closure validation for closed periods as this is a system closing logic
        entry._is_system_closing_entry = True
        entry.save()
        
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

            # Record final destination of Net Amount by iterating over the specified destinations
            for dest in line.destinations.all():
                if dest.amount <= 0:
                    continue

                abs_net = dest.amount
                
                if dest.destination == ProfitDistributionLineDestination.Destination.RETAINED:
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
                    dest.partner_transaction = ptx
                    dest.save(update_fields=['partner_transaction'])
                    
                elif dest.destination == ProfitDistributionLineDestination.Destination.DIVIDEND_PAYABLE:
                    
                    # Credit Dividends Payable (Liability)
                    div_account = partner.partner_dividends_payable_account or settings.partner_dividends_payable_account
                    if not div_account:
                        raise ValidationError(f"No hay cuenta de dividendos configurada para {partner.name} ni global.")

                    JournalItem.objects.create(
                        entry=entry,
                        account=div_account,
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
                    dest.partner_transaction = ptx
                    dest.save(update_fields=['partner_transaction'])
                    
                elif dest.destination == ProfitDistributionLineDestination.Destination.REINVEST:
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
                    dest.partner_transaction = ptx
                    dest.save(update_fields=['partner_transaction'])

                elif dest.destination == ProfitDistributionLineDestination.Destination.LOSS_ABSORPTION:
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
                        amount=-abs_net,
                        date=resolution.resolution_date,
                        description=f"Absorción Pérdida {resolution.fiscal_year}",
                        journal_entry=entry,
                        distribution_resolution=resolution,
                        created_by=executed_by,
                    )
                    dest.partner_transaction = ptx
                    dest.save(update_fields=['partner_transaction'])

        entry.check_balance()

        resolution.status = ProfitDistributionResolution.Status.EXECUTED
        resolution.executed_by = executed_by
        resolution.executed_at = timezone.now()
        resolution.save()
        
        # If any reinvestments occurred, we need to recalculate equity stakes
        has_reinvestments = ProfitDistributionLineDestination.objects.filter(
            line__resolution=resolution,
            destination=ProfitDistributionLineDestination.Destination.REINVEST
        ).exists()
        if has_reinvestments:
            PartnerService._recalculate_and_snapshot_stakes(
                date=resolution.resolution_date,
                source_transaction=None, # Multiple possible
                created_by=executed_by
            )

        return resolution

    @staticmethod
    @transaction.atomic
    def execute_mass_payment(resolution: ProfitDistributionResolution, treasury_account_id: int, payments_data: list, executed_by) -> ProfitDistributionResolution:
        """
        Executes payments for DIVIDEND_PAYABLE destinations.
        payments_data: [{'partner_id': int, 'amount': float}]
        """
        if resolution.status != ProfitDistributionResolution.Status.EXECUTED:
            raise ValidationError("La resolución debe estar ejecutada contablemente para realizar pagos.")
            
        settings = ProfitDistributionService._get_settings()
        from .partner_models import ProfitDistributionPayment, ProfitDistributionLineDestination
        
        # Verify and Aggregate total payment
        total_payment = Decimal('0')
        valid_payments = []
        for p_data in payments_data:
            partner_id = p_data.get('partner_id')
            amount = Decimal(str(p_data.get('amount', 0)))
            if amount <= 0:
                continue
                
            # Find the total dividend payable for this partner
            destinations = ProfitDistributionLineDestination.objects.filter(
                line__resolution=resolution,
                line__partner_id=partner_id,
                destination=ProfitDistributionLineDestination.Destination.DIVIDEND_PAYABLE
            )
            total_payable = sum(d.amount for d in destinations)
            
            # Find already paid
            already_paid = ProfitDistributionPayment.objects.filter(
                resolution=resolution,
                partner_id=partner_id
            ).aggregate(models.Sum('amount'))['amount__sum'] or Decimal('0')
            
            remaining = total_payable - already_paid
            if amount > remaining:
                raise ValidationError(f"El monto a pagar ({amount}) supera el dividendo pendiente ({remaining}).")
                
            total_payment += amount
            valid_payments.append({
                'partner_id': partner_id,
                'amount': amount
            })
            
        if total_payment <= 0:
            raise ValidationError("Debe especificar al menos un monto de pago mayor a 0.")
        
        from treasury.models import TreasuryAccount, TreasuryMovement
        from accounting.models import Account
        
        try:
            treasury_account = TreasuryAccount.objects.get(id=treasury_account_id)
        except TreasuryAccount.DoesNotExist:
            raise ValidationError("Cuenta de tesorería no válida.")
            
        # Create Journal Entry
        entry = JournalEntry.objects.create(
            description=f"Pago Dividendos - Ejercicio {resolution.fiscal_year} (Acta: {resolution.acta_number})",
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
        # In mass payment, we iterate over the valid_payments and debit each partner's specific account
        for vp in valid_payments:
            p_id = vp['partner_id']
            p_amount = vp['amount']
            p_obj = Contact.objects.get(id=p_id)
            p_div_account = p_obj.partner_dividends_payable_account or settings.partner_dividends_payable_account
            
            if not p_div_account:
                raise ValidationError(f"Falta configurar la Cuenta de Dividendos para {p_obj.name}.")
                
            JournalItem.objects.create(
                entry=entry,
                account=p_div_account,
                label=f"Cancelación Pasivo Dividendos {p_obj.name}",
                debit=p_amount,
                credit=0,
            )
        
        entry.check_balance()
        
        # 3. Create Treasury Movement
        movement = TreasuryMovement.objects.create(
            account=treasury_account,
            movement_type=TreasuryMovement.MovementType.OUTFLOW,
            amount=total_payment,
            date=timezone.now().date(),
            description=f"Pago Dividendos - Ej. {resolution.fiscal_year}",
            journal_entry=entry,
            is_reconciled=False,
            created_by=executed_by,
        )
        
        # 4. Create ProfitDistributionPayment records and PartnerTransactions
        for vp in valid_payments:
            partner_id = vp['partner_id']
            amount = vp['amount']
            
            # Record formal transaction on partner account
            ptx = PartnerTransaction.objects.create(
                partner_id=partner_id,
                transaction_type=PartnerTransaction.Type.DIVIDEND_PAYMENT,
                amount=amount,
                date=timezone.now().date(),
                description=f"Pago Efectivo Dividendo Ej. {resolution.fiscal_year}",
                journal_entry=entry,
                treasury_movement=movement,
                distribution_resolution=resolution,
                created_by=executed_by,
            )
            
            # Bind the payment
            ProfitDistributionPayment.objects.create(
                resolution=resolution,
                partner_id=partner_id,
                amount=amount,
                treasury_movement=movement,
                partner_transaction=ptx,
                created_by=executed_by
            )
            
        return resolution

    @staticmethod
    def _get_settings() -> AccountingSettings:
        settings = AccountingSettings.get_solo()
        if not settings:
            raise ValidationError("No se encontró configuración contable.")
        return settings
