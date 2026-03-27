from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils import timezone
from treasury.models import TreasuryMovement
from accounting.models import JournalEntry, JournalItem, AccountingSettings
from accounting.services import JournalEntryService
from decimal import Decimal
from datetime import date


class TreasuryReturnService:
    """
    Service for handling payment returns.
    Only available for payments linked to DRAFT invoices.
    """
    
    @staticmethod
    @transaction.atomic
    def register_payment_return(
        payment: TreasuryMovement,
        amount: Decimal,
        return_date: date = None,
        reason: str = "",
        treasury_account_id: int = None
    ):
        """
        Registers payment return (partial or total).
        Only for payments linked to DRAFT invoices.
        
        Args:
            payment: Original TreasuryMovement to return
            amount: Amount being returned (Positive)
            return_date: Date of return (defaults to today)
            reason: Reason for return
            treasury_account_id: Account receiving/sending the returned funds
        
        Returns:
            TreasuryMovement: Return movement record
        
        Raises:
            ValidationError: If invoice is not DRAFT or amount invalid
        """
        # 1. Validate invoice status (must be DRAFT)
        if payment.invoice and payment.invoice.status != 'DRAFT':
            raise ValidationError(
                "❌ Solo se pueden devolver pagos de facturas en borrador.\n"
                "📋 Para facturas publicadas, use una Nota de Crédito."
            )
        
        # 2. Validate amount
        if amount > payment.amount:
            raise ValidationError(
                f"❌ Monto a devolver ({amount}) excede monto del pago ({payment.amount})."
            )
        
        if amount <= 0:
            raise ValidationError("❌ El monto a devolver debe ser mayor a cero.")
        
        # Determine movement type/account logic
        movement_type = 'OUTBOUND'
        from_account = None
        to_account = None
        
        current_treasury = treasury_account_id or (payment.to_account.id if payment.to_account else (payment.from_account.id if payment.from_account else None))
        resolved_account = None
        if current_treasury:
            # We need the object instance for TreasuryMovement
            # We'll resolve it simply by ID
            resolved_account = payment.to_account if payment.to_account and payment.to_account.id == current_treasury else (payment.from_account if payment.from_account and payment.from_account.id == current_treasury else None)
            if not resolved_account:
                # Fallback query if ID changed
                from treasury.models import TreasuryAccount
                resolved_account = TreasuryAccount.objects.get(pk=current_treasury)

        if payment.sale_order:
             # Customer Return: Us -> Customer (OUTBOUND)
             movement_type = 'OUTBOUND'
             from_account = resolved_account
        elif payment.purchase_order:
             # Supplier Return: Supplier -> Us (INBOUND)
             movement_type = 'INBOUND'
             to_account = resolved_account
        else:
             # Fallback/Manual logic? Assume OUTBOUND if original was INBOUND, vice versa.
             if payment.movement_type == 'INBOUND':
                 movement_type = 'OUTBOUND'
                 from_account = resolved_account
             else:
                 movement_type = 'INBOUND'
                 to_account = resolved_account

        # 3. Create return movement
        return_movement = TreasuryMovement.objects.create(
            movement_type=movement_type,
            payment_method=payment.payment_method,
            amount=amount, 
            reference=f"DEVOLUCIÓN {payment.reference}",
            contact=payment.contact,
            invoice=payment.invoice,
            sale_order=payment.sale_order,
            purchase_order=payment.purchase_order,
            from_account=from_account,
            to_account=to_account,
            transaction_number=f"DEV-{payment.transaction_number}" if payment.transaction_number else None,
            notes=f"Devolución de pago: {reason}",
            date=return_date or timezone.now().date(),
            created_by=payment.created_by # Or current user? we lack request.user here. Keep original or None?
                                         # The original service didn't set created_by explicitly on Payment but Payment might not have had it.
                                         # TreasuryMovement requires created_by? Not in arguments I edited. But nice to have.
                                         # Let's leave it blank or same as payment for now if nullable.
        )
        
        # 4. Create accounting entry (separate reversal entry)
        settings = AccountingSettings.objects.first()
        
        # Determine accounts based on payment type
        if payment.sale_order:
            # Sale payment return
            partner_account = payment.contact.account_receivable or settings.default_receivable_account
            # Treasury Account to adjust
            treasury_acc = from_account
            
            entry = JournalEntry.objects.create(
                date=return_movement.date,
                description=f"Devolución Pago Cliente - {payment.contact.name if payment.contact else 'Cliente'}",
                reference=f"DEV-MOV-{payment.id}",
                status=JournalEntry.State.DRAFT
            )
            
            # Debit: Receivable (Customer owes us again)
            JournalItem.objects.create(
                entry=entry,
                account=partner_account,
                debit=amount,
                credit=0,
                partner=payment.contact,
                partner_name=payment.contact.name if payment.contact else None,
                label=f"Devolución pago - {reason}"
            )
            
            # Credit: Cash/Bank (Money leaves our account)
            JournalItem.objects.create(
                entry=entry,
                account=treasury_acc.account if hasattr(treasury_acc, 'account') else treasury_acc,
                debit=0,
                credit=amount,
                label=f"Salida efectivo - Devolución"
            )
            
        elif payment.purchase_order:
            # Purchase payment return
            partner_account = payment.contact.account_payable or settings.default_payable_account
            treasury_acc = to_account
            
            entry = JournalEntry.objects.create(
                date=return_movement.date,
                description=f"Devolución Pago Proveedor - {payment.contact.name if payment.contact else 'Proveedor'}",
                reference=f"DEV-MOV-{payment.id}",
                status=JournalEntry.State.DRAFT
            )
            
            # Debit: Cash/Bank (Money comes back)
            JournalItem.objects.create(
                entry=entry,
                account=treasury_acc.account if hasattr(treasury_acc, 'account') else treasury_acc,
                debit=amount,
                credit=0,
                label=f"Entrada efectivo - Devolución"
            )
            
            # Credit: Payable (We owe them again)
            JournalItem.objects.create(
                entry=entry,
                account=partner_account,
                debit=0,
                credit=amount,
                partner=payment.contact,
                partner_name=payment.contact.name if payment.contact else None,
                label=f"Devolución pago - {reason}"
            )
        
        JournalEntryService.post_entry(entry)
        return_movement.journal_entry = entry
        return_movement.save()
        
        # 5. Update order pending amount
        if payment.sale_order:
            payment.sale_order.pending_amount = (payment.sale_order.pending_amount or 0) + amount
            payment.sale_order.save()
        elif payment.purchase_order:
            payment.purchase_order.pending_amount = (payment.purchase_order.pending_amount or 0) + amount
            payment.purchase_order.save()
        
        return return_movement
