from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils import timezone
from .models import SaleOrder
from accounting.models import JournalEntry, JournalItem, Account, AccountType
from accounting.services import JournalEntryService
from decimal import Decimal

class SalesService:
    @staticmethod
    @transaction.atomic
    def confirm_sale(order: SaleOrder):
        """
        Confirms a sale order and creates the corresponding Journal Entry.
        Debit: Accounts Receivable (or Cash)
        Credit: Sales Revenue
        Credit: Tax Payable
        """
        if order.status != SaleOrder.Status.DRAFT:
            return order

        # 1. Update Order Status
        order.status = SaleOrder.Status.CONFIRMED
        order.save()

        # NOTE: Accounting entry moved to BillingService.create_sale_invoice
        
        return order

        return order

    @staticmethod
    @transaction.atomic
    def delete_sale_order(order: SaleOrder):
        """
        Deletes a sale order, its invoices, and associated journal entries.
        """
        from billing.services import BillingService
        from treasury.services import TreasuryService
        
        # 1. Delete associated invoices (and their payments/JEs)
        for invoice in order.invoices.all():
            if invoice.status != 'CANCELLED': # Safety check if needed
                 BillingService.delete_invoice(invoice)
        
        # 2. Delete stand-alone payments linked to order
        for payment in order.payments.all():
            TreasuryService.delete_payment(payment)

        # 3. Delete order's own journal entry
        if order.journal_entry:
            order.journal_entry.delete()
            
        # 4. Delete Order
        order.delete()
