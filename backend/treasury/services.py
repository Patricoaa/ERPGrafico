from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils import timezone
from .models import Payment
from accounting.models import JournalEntry, JournalItem, Account, AccountType
from accounting.services import JournalEntryService
from decimal import Decimal

class TreasuryService:
    @staticmethod
    @transaction.atomic
    def register_payment(amount: Decimal, payment_type, payment_method=Payment.Method.CASH, date=None, reference='', partner=None, invoice=None, treasury_account_id=None, sale_order=None, purchase_order=None, transaction_number=None, is_pending_registration=False):
        """
        Registers a payment and creates the corresponding Accounting Entry.
        """
        if amount <= 0:
            raise ValidationError("El monto debe ser mayor a 0.")
            
        if not date:
            date = timezone.now().date()

        # 1. Resolve Treasury Account
        from .models import TreasuryAccount
        treasury_account = None

        if treasury_account_id:
             try:
                 treasury_account = TreasuryAccount.objects.get(pk=treasury_account_id)
             except TreasuryAccount.DoesNotExist:
                 pass
        
        if not treasury_account:
            from accounting.models import AccountingSettings
            settings = AccountingSettings.objects.first()
            if settings:
                if payment_method == Payment.Method.CASH:
                    treasury_account = settings.default_cash_treasury_account
                elif payment_method == Payment.Method.CARD:
                    treasury_account = settings.default_card_treasury_account
                elif payment_method == Payment.Method.TRANSFER:
                    treasury_account = settings.default_transfer_treasury_account
        
        if not treasury_account:
             raise ValidationError(f"No se ha configurado una cuenta de tesorería para el método {payment_method} y no se especificó una manualmente.")
             
        # Resolve Financial Account from Treasury Account
        financial_account = treasury_account.account
        if not financial_account:
             raise ValidationError(f"La cuenta de tesorería '{treasury_account.name}' no tiene una cuenta contable asociada.")

        # 2. Create Payment Record
        payment = Payment.objects.create(
            treasury_account=treasury_account,
            account=financial_account, # Snapshot
            payment_type=payment_type,
            payment_method=payment_method,
            amount=amount,
            date=date,
            reference=reference,
            invoice=invoice,
            sale_order=sale_order,
            purchase_order=purchase_order,
            transaction_number=transaction_number,
            is_pending_registration=is_pending_registration
        )
        
        if partner:
             if payment_type == Payment.Type.INBOUND:
                 payment.customer = partner
             else:
                 payment.supplier = partner
        
        payment.save()

        # 2. Update Invoice and Order Status
        if invoice:
            from billing.models import Invoice
            # Calculate total paid for this invoice
            total_paid = sum(p.amount for p in invoice.payments.all())
            
            if total_paid >= invoice.total:
                invoice.status = Invoice.Status.PAID
                invoice.save()
                
                if invoice.sale_order:
                    from sales.models import SaleOrder
                    invoice.sale_order.status = SaleOrder.Status.PAID
                    invoice.sale_order.save()
                elif invoice.purchase_order:
                    from purchasing.models import PurchaseOrder
                    # Only mark as PAID if already RECEIVED or INVOICED to allow reception flow
                    if invoice.purchase_order.status in [PurchaseOrder.Status.RECEIVED, PurchaseOrder.Status.INVOICED]:
                        invoice.purchase_order.status = PurchaseOrder.Status.PAID
                        invoice.purchase_order.save()
        
        # If no invoice but associated with order directly (Partial payments without invoice yet)
        target_order = sale_order or purchase_order
        if target_order and not invoice:
            total_paid = sum(p.amount for p in target_order.payments.all())
            if total_paid >= target_order.total:
                from sales.models import SaleOrder
                from purchasing.models import PurchaseOrder
                if isinstance(target_order, SaleOrder):
                    target_order.status = SaleOrder.Status.PAID
                    target_order.save()
                else:
                    # For Purchase Orders, only mark as PAID if already RECEIVED or INVOICED
                    if target_order.status in [PurchaseOrder.Status.RECEIVED, PurchaseOrder.Status.INVOICED]:
                        target_order.status = PurchaseOrder.Status.PAID
                        target_order.save()

        # 3. Accounting Entry
        # Account is already set in payment.account

        entry = JournalEntry.objects.create(
            date=date,
            description=f"Pago {payment.get_payment_type_display()} ({payment.get_payment_method_display()}) - {reference} {partner.name if partner else ''}",
            reference=f"PAY-{payment.id}",
            state=JournalEntry.State.DRAFT
        )

        
        if payment_type == Payment.Type.INBOUND:
             # Customer Payment: Debit Treasury, Credit AR
             ar_account = (payment.customer.account_receivable if payment.customer else None) or \
                          (settings.default_receivable_account if settings else None)

             if not ar_account:
                 raise ValidationError("No se encontró cuenta para Cobro (AR).")

             # Debit Treasury
             JournalItem.objects.create(entry=entry, account=payment.account, debit=amount, credit=0)
             # Credit AR
             JournalItem.objects.create(entry=entry, account=ar_account, debit=0, credit=amount, partner=payment.customer.name if payment.customer else '')

        else:
             # Supplier Payment: Debit AP, Credit Treasury
             ap_account = (payment.supplier.payable_account if payment.supplier else None) or \
                          (settings.default_payable_account if settings else None)

             if not ap_account:
                 raise ValidationError("No se encontró cuenta para Pago (AP).")

              # Credit Treasury
             JournalItem.objects.create(entry=entry, account=payment.account, debit=0, credit=amount)
             # Debit AP
             JournalItem.objects.create(entry=entry, account=ap_account, debit=amount, credit=0, partner=payment.supplier.name if payment.supplier else '')
             
        JournalEntryService.post_entry(entry)
        
        payment.journal_entry = entry
        payment.save()
        
        return payment

    @staticmethod
    @transaction.atomic
    def delete_payment(payment: Payment):
        """
        Deletes a payment and its associated Journal Entry.
        """
        if payment.journal_entry:
            payment.journal_entry.delete()
        payment.delete()
