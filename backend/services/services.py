from django.utils import timezone
from django.db import transaction
from .models import ServiceContract, ServiceObligation, ServiceCategory
from dateutil.relativedelta import relativedelta
import datetime

class ServiceContractService:
    @staticmethod
    @transaction.atomic
    def activate_contract(contract):
        """
        Activates a contract and generates the first obligation if applicable.
        """
        if contract.status != ServiceContract.Status.DRAFT:
            raise ValueError("Solo contratos en borrador pueden activarse.")
        
        contract.status = ServiceContract.Status.ACTIVE
        contract.save()
        
        # Generate initial obligation
        # Logic: If start_date is in future, first obligation is on start_date (or payment_day of that month?)
        # Simplification: First obligation is generated based on start_date and payment_day
        
        ServiceContractService.generate_next_obligation(contract)
        return contract

    @staticmethod
    def generate_next_obligation(contract, reference_date=None):
        """
        Calculates and creates the next obligation for the contract.
        """
        if not reference_date:
            reference_date = timezone.now().date()
            
        # Determine the target date for the next obligation
        # This is complex depending on recurrence. 
        # Simplified approach: Look at last obligation, add recurrence.
        # If no obligation, start from start_date.
        
        last_obligation = contract.obligations.order_by('-due_date').first()
        
        if last_obligation:
            start_calculating_from = last_obligation.due_date
        else:
            # First obligation logic
            # If start_date is 2024-01-01 and payment_day is 5.
            # First payment is 2024-01-05? Or 2024-02-05?
            # Assuming payment in advance (mes adelantado) usually implies paying at start of period.
            # Let's align with payment_day of the start_date month.
            
            year = contract.start_date.year
            month = contract.start_date.month
            day = min(contract.payment_day, 28) # Simple protection against Feb 30
            
            first_due_date = datetime.date(year, month, day)
            if first_due_date < contract.start_date:
                # If payment day passed in start month, move to next month? 
                # Or maybe it was due immediately? Let's move to next month to be safe or keep same month if "mes vencido".
                # Standard renting: Pay within first 5 days. If contract starts 15th, usually pay pro-rated or next month.
                # Let's assume next month for simplicity if day passed.
                # Actually, let's just stick to "next occurrence of payment_day after or equal start_date"
                 
                if first_due_date < contract.start_date:
                     first_due_date = first_due_date + relativedelta(months=1)
            
            start_calculating_from = first_due_date - relativedelta(months=1) # Hack to make the add logic work below
            if not last_obligation:
                 # If it's the very first one, we don't want to add recurrence yet, we want the first date.
                 # So we set target directly.
                 target_date = first_due_date
        
        if last_obligation:
            target_date = ServiceContractService._get_next_date(start_calculating_from, contract.recurrence_type)

        # Check if contract ended
        if contract.end_date and target_date > contract.end_date:
            return None # Contract expired
            
        # Create Obligation
        period_start = target_date # Approximate
        period_end = ServiceContractService._get_next_date(target_date, contract.recurrence_type) - datetime.timedelta(days=1)
        
        obligation = ServiceObligation.objects.create(
            contract=contract,
            due_date=target_date,
            period_start=period_start,
            period_end=period_end,
            amount=contract.base_amount,
            status=ServiceObligation.Status.PENDING
        )
        return obligation

    @staticmethod
    def _get_next_date(date, recurrence):
        if recurrence == ServiceContract.RecurrenceType.MONTHLY:
            return date + relativedelta(months=1)
        elif recurrence == ServiceContract.RecurrenceType.QUARTERLY:
            return date + relativedelta(months=3)
        elif recurrence == ServiceContract.RecurrenceType.SEMIANNUAL:
            return date + relativedelta(months=6)
        elif recurrence == ServiceContract.RecurrenceType.ANNUAL:
            return date + relativedelta(years=1)
        elif recurrence == ServiceContract.RecurrenceType.BIWEEKLY:
            return date + datetime.timedelta(weeks=2)
        elif recurrence == ServiceContract.RecurrenceType.WEEKLY:
            return date + datetime.timedelta(weeks=1)
        elif recurrence == ServiceContract.RecurrenceType.ONE_TIME:
            return date # Should not happen loop
        return date

class ServiceObligationService:
    @staticmethod
    @transaction.atomic
    def link_invoice(obligation, invoice):
        if obligation.status == ServiceObligation.Status.PAID:
             # Already paid, just linking document
             pass
        else:
             obligation.status = ServiceObligation.Status.INVOICED
             obligation.invoiced_date = invoice.date
        
        obligation.invoice = invoice
        obligation.save()
        return obligation

    @staticmethod
    @transaction.atomic
    def link_payment(obligation, payment):
        obligation.payment = payment
        obligation.paid_amount = payment.amount # Assume full allocation for now
        
        if obligation.paid_amount >= obligation.amount:
            obligation.status = ServiceObligation.Status.PAID
            obligation.paid_date = payment.date
        
        obligation.save()
        return obligation
    
    def check_overdue():
        """
        Marks overdue obligations
        """
        today = timezone.now().date()
        overdue = ServiceObligation.objects.filter(
            status__in=[ServiceObligation.Status.PENDING, ServiceObligation.Status.INVOICED],
            due_date__lt=today
        )
        count = overdue.update(status=ServiceObligation.Status.OVERDUE)
        return count

    @staticmethod
    @transaction.atomic
    def register_invoice(obligation, data):
        from billing.models import Invoice
        
        # Create the invoice
        invoice = Invoice.objects.create(
            date=data['invoice_date'],
            number=data['invoice_number'],
            total=data['amount'],
            dte_type=data.get('dte_type', 'FACTURA'),
            contact=obligation.contract.supplier, # Use 'contact' instead of 'partner'
            status='POSTED',
            purchase_order=None
        )
        
        # Link it
        return ServiceObligationService.link_invoice(obligation, invoice)

    @staticmethod
    @transaction.atomic
    def register_payment(obligation, data):
        from treasury.models import Payment, TreasuryAccount
        
        treasury_account_obj = TreasuryAccount.objects.get(id=data['treasury_account_id'])
        
        # Create the payment
        payment = Payment.objects.create(
            date=data.get('transaction_date', timezone.now().date()),
            amount=data['amount'],
            payment_type='OUTBOUND',
            payment_method=data['payment_method'],
            reference=data.get('reference', ''),
            treasury_account=treasury_account_obj, # Link to TreasuryAccount
            account=treasury_account_obj.account,  # Link to the underlying financial Account
            contact=obligation.contract.supplier # Add contact info
        )
        
        # Link it
        return ServiceObligationService.link_payment(obligation, payment)
