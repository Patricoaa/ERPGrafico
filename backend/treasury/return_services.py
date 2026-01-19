from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils import timezone
from treasury.models import Payment
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
        payment: Payment,
        amount: Decimal,
        return_date: date = None,
        reason: str = "",
        treasury_account_id: int = None
    ):
        """
        Registers payment return (partial or total).
        Only for payments linked to DRAFT invoices.
        
        Args:
            payment: Original payment to return
            amount: Amount being returned
            return_date: Date of return (defaults to today)
            reason: Reason for return
            treasury_account_id: Account receiving the returned funds
        
        Returns:
            Payment: Return payment record (negative amount)
        
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
        
        # 3. Create return payment (negative amount)
        return_payment = Payment.objects.create(
            payment_type='OUTBOUND',  # Money going out
            payment_method=payment.payment_method,
            amount=-amount,  # Negative for return
            reference=f"DEVOLUCIÓN {payment.reference}",
            partner=payment.partner,
            invoice=payment.invoice,
            sale_order=payment.sale_order,
            purchase_order=payment.purchase_order,
            treasury_account_id=treasury_account_id or payment.treasury_account_id,
            transaction_number=f"DEV-{payment.transaction_number}" if payment.transaction_number else None,
            notes=f"Devolución de pago: {reason}",
            date=return_date or timezone.now().date()
        )
        
        # 4. Create accounting entry (separate reversal entry)
        settings = AccountingSettings.objects.first()
        
        # Determine accounts based on payment type
        if payment.sale_order:
            # Sale payment return
            partner_account = payment.partner.account_receivable or settings.default_receivable_account
            treasury_account = payment.treasury_account or settings.default_cash_account
            
            entry = JournalEntry.objects.create(
                date=return_payment.date,
                description=f"Devolución Pago Cliente - {payment.partner.name}",
                reference=f"DEV-PAG-{payment.id}",
                state=JournalEntry.State.DRAFT
            )
            
            # Debit: Receivable (Customer owes us again)
            JournalItem.objects.create(
                entry=entry,
                account=partner_account,
                debit=amount,
                credit=0,
                partner=payment.partner.name,
                label=f"Devolución pago - {reason}"
            )
            
            # Credit: Cash/Bank (Money leaves our account)
            JournalItem.objects.create(
                entry=entry,
                account=treasury_account,
                debit=0,
                credit=amount,
                label=f"Salida efectivo - Devolución"
            )
            
        elif payment.purchase_order:
            # Purchase payment return
            partner_account = payment.partner.account_payable or settings.default_payable_account
            treasury_account = payment.treasury_account or settings.default_cash_account
            
            entry = JournalEntry.objects.create(
                date=return_payment.date,
                description=f"Devolución Pago Proveedor - {payment.partner.name}",
                reference=f"DEV-PAG-{payment.id}",
                state=JournalEntry.State.DRAFT
            )
            
            # Debit: Cash/Bank (Money comes back)
            JournalItem.objects.create(
                entry=entry,
                account=treasury_account,
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
                partner=payment.partner.name,
                label=f"Devolución pago - {reason}"
            )
        
        JournalEntryService.post_entry(entry)
        return_payment.journal_entry = entry
        return_payment.save()
        
        # 5. Update order pending amount
        if payment.sale_order:
            payment.sale_order.pending_amount = (payment.sale_order.pending_amount or 0) + amount
            payment.sale_order.save()
        elif payment.purchase_order:
            payment.purchase_order.pending_amount = (payment.purchase_order.pending_amount or 0) + amount
            payment.purchase_order.save()
        
        return return_payment
