from django.utils import timezone
from django.db import transaction
from .models import ServiceContract, ServiceObligation, ServiceCategory
from dateutil.relativedelta import relativedelta
import datetime
from decimal import Decimal
from accounting.models import JournalEntry, JournalItem, AccountingSettings, Account
from accounting.services import JournalEntryService

class ServiceContractService:
    @staticmethod
    @transaction.atomic
    def activate_contract(contract):
        """
        Activates a contract and generates the first obligation if applicable.
        """
        if contract.status not in [ServiceContract.Status.DRAFT, ServiceContract.Status.SUSPENDED]:
            raise ValueError("Solo contratos en borrador o suspendidos pueden activarse.")
        
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
    def reverse_provision(obligation, reversal_date=None):
        """
        Creates a reversal entry for an existing provision.
        Entry: Dr Provision Payable / Cr Expense
        """
        if not obligation.journal_entry:
            return None
        
        provision_entry = obligation.journal_entry
        if provision_entry.state != JournalEntry.State.POSTED:
            # If not posted, we can just delete it? 
            # Better to cancel/reverse if we want audit trail.
            # But let's assume we reverse the effects.
            pass

        reversal_date = reversal_date or timezone.now().date()
        
        # Identify lines to reverse
        # Original: Dr Expense / Cr Provision Payable
        # Reversal: Dr Provision Payable / Cr Expense
        
        reverse_entry = JournalEntry.objects.create(
            date=reversal_date,
            description=f"Reversa Provisión - {obligation.contract.name} - Período {obligation.period_start}",
            reference=f"REV-PROV-{obligation.id}",
            state=JournalEntry.State.DRAFT
        )
        
        for item in provision_entry.items.all():
            # Invert debit and credit
            JournalItem.objects.create(
                entry=reverse_entry,
                account=item.account,
                debit=item.credit,
                credit=item.debit,
                partner=item.partner,
                label=f"REVERSA: {item.label or ''}"
            )
        
        JournalEntryService.post_entry(reverse_entry)
        
        # We don't clear obligation.journal_entry because we might want to keep the trail.
        # Or maybe we link the reversal to the obligation too? ServiceObligation only has one journal_entry field.
        # Let's just return it for now.
        return reverse_entry

    @staticmethod
    @transaction.atomic
    def create_provision(obligation, provision_date=None, amount=None):
        """
        Creates a provision for the service obligation.
        Entry: Dr Expense / Cr Provision Payable
        """
        if obligation.journal_entry or obligation.status != ServiceObligation.Status.PENDING:
            return None
            
        provision_date = provision_date or obligation.period_end or timezone.now().date()
        amount = amount or obligation.amount
        
        expense_account = obligation.contract.expense_account or obligation.contract.category.expense_account
        payable_account = obligation.contract.payable_account or obligation.contract.category.payable_account # This should be the Provision Liability
        
        if not expense_account or not payable_account:
            raise ValueError("Las cuentas contables no están configuradas en el contrato ni en la categoría.")

        entry = JournalEntry.objects.create(
            date=provision_date,
            description=f"Provisión Gasto - {obligation.contract.name} - Período {obligation.period_start}",
            reference=f"PROV-{obligation.id}",
            state=JournalEntry.State.DRAFT
        )
        
        # Debit: Expense
        JournalItem.objects.create(
            entry=entry,
            account=expense_account,
            debit=amount,
            credit=0,
            partner=obligation.contract.supplier.name
        )
        
        # Credit: Provision Payable
        JournalItem.objects.create(
            entry=entry,
            account=payable_account,
            debit=0,
            credit=amount,
            partner=obligation.contract.supplier.name
        )
        
        JournalEntryService.post_entry(entry)
        
        obligation.journal_entry = entry
        obligation.save()
        return entry

    @staticmethod
    @transaction.atomic
    def register_invoice(obligation, data):
        from billing.models import Invoice
        
        # 1. Reverse Provision if exists
        if obligation.journal_entry:
            ServiceObligationService.reverse_provision(obligation, data['invoice_date'])
        
        # 2. Create the invoice
        invoice = Invoice.objects.create(
            date=data['invoice_date'],
            number=data['invoice_number'],
            total=data['amount'],
            dte_type=data.get('dte_type', 'FACTURA'),
            contact=obligation.contract.supplier,
            service_obligation=obligation,
            status='POSTED',
            document_attachment=data.get('document_attachment'),
            purchase_order=None
        )
        
        # 3. Create Accounting Entry for Invoice (Dr Expense / Cr Supplier Payable)
        # We handle it here because BillingService.create_purchase_bill is tied to PurchaseOrder
        
        settings = AccountingSettings.objects.first()
        # For the real payable, we use the supplier's account or system default
        real_payable_account = obligation.contract.supplier.account_payable or (settings.default_payable_account if settings else None)
        tax_account = settings.default_tax_receivable_account if settings else None
        
        if not real_payable_account:
             real_payable_account = Account.objects.filter(account_type='LIABILITY').first()

        invoice_entry = JournalEntry.objects.create(
            date=data['invoice_date'],
            description=f"Gasto Servicio {obligation.contract.name} - {invoice.get_dte_type_display()} {data['invoice_number']}",
            reference=f"SVC-INV-{obligation.id}",
            state=JournalEntry.State.DRAFT
        )
        
        is_boleta = data.get('dte_type') == 'BOLETA'
        total = Decimal(str(data['amount']))
        
        # Calculate net and tax regardless of type for the record
        # Net = Total / 1.19, Tax = Total - Net
        net = (total / Decimal('1.19')).quantize(Decimal('1'), rounding='ROUND_HALF_UP')
        tax = total - net
        
        # Update invoice records for consistency
        invoice.total_net = net
        invoice.total_tax = tax
        invoice.save()

        # Use contract accounts or fallback to category defaults
        expense_account = obligation.contract.expense_account or obligation.contract.category.expense_account

        if is_boleta:
            # Debit: Expense (Total)
            JournalItem.objects.create(
                entry=invoice_entry,
                account=expense_account,
                debit=total,
                credit=0,
                partner=obligation.contract.supplier.name,
                label="Gasto Servicio (IVA Capitalizado)"
            )
        else:
            # Factura: Separate VAT in JE
            # Debit: Expense (Net)
            JournalItem.objects.create(
                entry=invoice_entry,
                account=expense_account,
                debit=net,
                credit=0,
                partner=obligation.contract.supplier.name
            )
            
            # Debit: Tax (IVA Crédito)
            if tax > 0 and tax_account:
                JournalItem.objects.create(
                    entry=invoice_entry,
                    account=tax_account,
                    debit=tax,
                    credit=0,
                    label="IVA Crédito Fiscal (Servicios)"
                )
        
        # Credit: Supplier Payable (Total)
        JournalItem.objects.create(
            entry=invoice_entry,
            account=real_payable_account,
            debit=0,
            credit=total,
            partner=obligation.contract.supplier.name
        )
        
        JournalEntryService.post_entry(invoice_entry)
        invoice.journal_entry = invoice_entry
        invoice.save()

        # 4. Link it
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
