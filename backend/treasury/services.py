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
    def register_payment(journal: BankJournal, amount: Decimal, payment_type, date=None, reference='', partner=None, order=None):
        """
        Registers a payment and creates the corresponding Accounting Entry.
        
        INBOUND (Cobro Cliente):
            Debit: Bank/Cash (Asset)
            Credit: Accounts Receivable (Asset)
            
        OUTBOUND (Pago Proveedor):
            Debit: Accounts Payable (Liability)
            Credit: Bank/Cash (Asset)
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
            reference=reference
        )
        
        if partner:
             if payment_type == Payment.Type.INBOUND:
                 payment.customer = partner
             else:
                 payment.supplier = partner
        
        if order:
             # Logic to link order (not strictly enforced in MVP)
             pass
             
        payment.save()

        # 2. Accounting Entry
        entry = JournalEntry.objects.create(
            date=date,
            description=f"Pago {payment_type} - {reference}",
            reference=f"PAY-{payment.id}",
            state=JournalEntry.State.DRAFT
        )

        bank_account = journal.account
        
        # Determine Counterpart Account (AR or AP)
        if payment_type == Payment.Type.INBOUND:
             # Customer Payment
             # Debit Bank
             JournalItem.objects.create(entry=entry, account=bank_account, debit=amount, credit=0)
             
             # Credit AR
             # Try to find specific account from Customer or generic AR
             ar_account = None
             if payment.customer and payment.customer.account_receivable:
                 ar_account = payment.customer.account_receivable
             
             if not ar_account:
                 ar_account = Account.objects.filter(account_type=AccountType.ASSET, code__startswith='1.1.02').first() # Hacky lookup
                 
             if not ar_account:
                  # Fallback
                  ar_account = Account.objects.filter(account_type=AccountType.ASSET).first()
             
             JournalItem.objects.create(entry=entry, account=ar_account, debit=0, credit=amount, partner=payment.customer.name if payment.customer else '')

        else:
             # Supplier Payment
             # Credit Bank
             JournalItem.objects.create(entry=entry, account=bank_account, debit=0, credit=amount)
             
             # Debit AP
             ap_account = None
             if payment.supplier and payment.supplier.payable_account:
                 ap_account = payment.supplier.payable_account
                 
             if not ap_account:
                  ap_account = Account.objects.filter(account_type=AccountType.LIABILITY, code__startswith='2.1.01').first()
             
             if not ap_account:
                  ap_account = Account.objects.filter(account_type=AccountType.LIABILITY).first()

             JournalItem.objects.create(entry=entry, account=ap_account, debit=amount, credit=0, partner=payment.supplier.name if payment.supplier else '')
             
        JournalEntryService.post_entry(entry)
        
        payment.journal_entry = entry
        payment.save()
        
        return payment
