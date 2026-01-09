from django.db import models
from django.utils import timezone
from decimal import Decimal

class SequenceService:
    """
    Centralized service to handle sequential numbering for different entities.
    Example: NV-000001, OC-000001, etc.
    """
    @staticmethod
    def get_next_number(model_class, field_name='number', padding=6):
        """
        Calculates the next numeric value for a given model and field.
        """
        last_instance = model_class.objects.all().order_by('id').last()
        if last_instance:
            curr_number = getattr(last_instance, field_name)
            if curr_number and curr_number.isdigit():
                try:
                    next_val = int(curr_number) + 1
                    return str(next_val).zfill(padding)
                except ValueError:
                    pass
        
        return '1'.zfill(padding)

    @staticmethod
    def format_number(prefix, number):
        """Helper to format a number with a prefix if needed"""
        return f"{prefix}{number}"

class BaseNoteService:
    @staticmethod
    def create_document_note(order, note_type, amount_net, amount_tax, document_number, 
                             document_attachment=None, partner_name=None, 
                             receivable_account=None, payable_account=None,
                             revenue_account=None, tax_account=None, inventory_account=None):
        """
        Base logic for creating Credit/Debit Notes and their corresponding Accounting Entries.
        """
        from billing.models import Invoice
        from accounting.models import JournalEntry, JournalItem
        from accounting.services import JournalEntryService
        
        total_amount = amount_net + amount_tax
        
        # 1. Create Invoice Record
        invoice_data = {
            'dte_type': note_type,
            'number': document_number,
            'document_attachment': document_attachment,
            'date': timezone.now().date(),
            'total_net': amount_net,
            'total_tax': amount_tax,
            'total': total_amount,
            'status': Invoice.Status.POSTED
        }
        
        from sales.models import SaleOrder
        from purchasing.models import PurchaseOrder
        if isinstance(order, SaleOrder):
            invoice_data['sale_order'] = order
        elif isinstance(order, PurchaseOrder):
            invoice_data['purchase_order'] = order
            
        invoice = Invoice.objects.create(**invoice_data)
        
        # 2. Accounting Entry
        description = f"{invoice.get_dte_type_display()} {document_number} (Ref {order.number})"
        entry = JournalEntry.objects.create(
            date=timezone.now().date(),
            description=description,
            reference=f"NOTE-{invoice.id}",
            state=JournalEntry.State.DRAFT
        )
        
        return invoice, entry
