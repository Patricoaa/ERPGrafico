from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils import timezone
from .models import Payment, BankJournal
from accounting.models import JournalEntry, JournalItem, Account, AccountType
from accounting.services import JournalEntryService
from decimal import Decimal

class TreasuryService:
    @staticmethod
    @transaction.atomic
    def register_payment(journal: BankJournal, amount: Decimal, payment_type, date=None, reference='', partner=None, invoice=None, account=None):
        """
        Registers a payment and creates the corresponding Accounting Entry.
        """
        if amount <= 0:
            raise ValidationError("El monto debe ser mayor a 0.")
            
        if not date:
            date = timezone.now().date()

        # 1. Create Payment Record
        payment = Payment.objects.create(
            journal=journal,
            payment_type=payment_type,
            amount=amount,
            date=date,
            reference=reference,
            invoice=invoice
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
                    invoice.purchase_order.status = PurchaseOrder.Status.PAID
                    invoice.purchase_order.save()
            else:
                # Still pending or partial? We could add a PARTIAL status
                # For now let's just not mark as PAID
                pass

        # 3. Accounting Entry
        from accounting.models import AccountingSettings
        settings = AccountingSettings.objects.first()

        entry = JournalEntry.objects.create(
            date=date,
            description=f"Pago {payment.get_payment_type_display()} - {reference}",
            reference=f"PAY-{payment.id}",
            state=JournalEntry.State.DRAFT
        )

        bank_account = account or journal.account
        
        if payment_type == Payment.Type.INBOUND:
             # Customer Payment: Debit Bank, Credit AR
             ar_account = (payment.customer.account_receivable if payment.customer else None) or \
                          (settings.default_receivable_account if settings else None)

             if not ar_account:
                 raise ValidationError("No se encontró cuenta para Cobro (AR).")

             # Debit Bank
             JournalItem.objects.create(entry=entry, account=bank_account, debit=amount, credit=0)
             # Credit AR
             JournalItem.objects.create(entry=entry, account=ar_account, debit=0, credit=amount, partner=payment.customer.name if payment.customer else '')

        else:
             # Supplier Payment: Debit AP, Credit Bank
             ap_account = (payment.supplier.payable_account if payment.supplier else None) or \
                          (settings.default_payable_account if settings else None)

             if not ap_account:
                 raise ValidationError("No se encontró cuenta para Pago (AP).")

             # Credit Bank
             JournalItem.objects.create(entry=entry, account=bank_account, debit=0, credit=amount)
             # Debit AP
             JournalItem.objects.create(entry=entry, account=ap_account, debit=amount, credit=0, partner=payment.supplier.name if payment.supplier else '')
             
        JournalEntryService.post_entry(entry)
        
        payment.journal_entry = entry
        payment.save()
        
        return payment
