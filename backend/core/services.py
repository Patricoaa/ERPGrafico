from django.db import models
from django.utils import timezone
from decimal import Decimal

class SequenceService:
    """
    Centralized service to handle sequential numbering for different entities.
    Example: NV-000001, OC-000001, etc.
    """
    @staticmethod
    def get_next_number(model_class, field_name='number', padding=6, filter_kwargs=None):
        """
        Calculates the next numeric value for a given model and field.
        """
        queryset = model_class.objects.all()
        if filter_kwargs:
            queryset = queryset.filter(**filter_kwargs)
            
        last_instance = queryset.order_by('id').last()
        if last_instance:
            curr_number = getattr(last_instance, field_name)
            # Try to extract numbers from common patterns (e.g., BOL-123 -> 123)
            # if curr_number is not purely digits
            if curr_number:
                import re
                nums = re.findall(r'\d+', str(curr_number))
                if nums:
                    try:
                        next_val = int(nums[-1]) + 1
                        return str(next_val).zfill(padding)
                    except (ValueError, IndexError) as e:
                        import logging
                        logging.getLogger(__name__).warning(f"Error extracting sequence number: {e}")
        
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
        
class ActionLoggingService:
    @staticmethod
    def log_action(user, action_type, description, request=None, metadata=None):
        """
        Creates an ActionLog entry.
        """
        from .models import ActionLog
        
        ip_address = None
        if request:
            x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
            if x_forwarded_for:
                ip_address = x_forwarded_for.split(',')[0]
            else:
                ip_address = request.META.get('REMOTE_ADDR')

        return ActionLog.objects.create(
            user=user,
            action_type=action_type,
            description=description,
            ip_address=ip_address,
            metadata=metadata or {}
        )
