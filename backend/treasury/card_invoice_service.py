from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from .models import CardPaymentProvider, DailySettlement
from billing.models import Invoice
from accounting.models import JournalEntry, JournalItem, AccountingSettings
from workflow.models import Task, TaskAssignmentRule
from decimal import Decimal

class CardInvoiceService:
    @staticmethod
    @transaction.atomic
    def generate_monthly_invoice(provider: CardPaymentProvider, year: int, month: int, user=None):
        """
        Generates a draft invoice for card commissions of the given month.
        Aggregates all daily settlements that haven't been invoiced yet.
        Creates a Workflow Task for approval.
        """
        # 1. Find settlements
        settlements = DailySettlement.objects.filter(
            provider=provider,
            settlement_date__year=year,
            settlement_date__month=month,
            monthly_invoice__isnull=True
        )
        
        if not settlements.exists():
            return None 

        totals = settlements.aggregate(
            comm=Sum('total_commission'),
            vat=Sum('total_vat')
        )
        
        commission_total = totals['comm'] or Decimal(0)
        vat_total = totals['vat'] or Decimal(0)
        total_amount = commission_total + vat_total
        
        if total_amount == 0:
            return None

        # 2. Create Invoice Record (DRAFT)
        # We manually create it as a PURCHASE document (Factura de Compra)
        invoice = Invoice.objects.create(
            dte_type='PURCHASE_INV', 
            number='', # Draft
            date=timezone.now().date(),
            contact=provider.supplier, 
            total_net=commission_total,
            total_tax=vat_total,
            total=total_amount,
            status='DRAFT',
            payment_method='CREDIT'
        )
        
        # 3. Create Journal Entry (Draft)
        settings = AccountingSettings.objects.first()
        
        # Accounts
        expense_account = settings.bank_commission_account
        
        # Use provider specific commission account if exists? 
        # But we don't have that field on Provider. 
        # We have commission_bridge_account (Liability) and receivable_account (Asset).
        # DiffService uses bank_commission_account. We stick to that.
        
        tax_account = settings.default_tax_receivable_account
        payable_account = provider.supplier.account_payable or settings.default_payable_account
        
        if expense_account and tax_account and payable_account:
            entry = JournalEntry.objects.create(
                date=timezone.now().date(),
                description=f"Provisión Comisiones {provider.name} - {month}/{year}",
                reference=f"COMM-{month}{year}-{provider.code}",
                state='DRAFT',
                created_by=user
            )
            
            # Dr Expense
            JournalItem.objects.create(
                entry=entry,
                account=expense_account,
                debit=commission_total,
                credit=0,
                label=f"Comisiones {month}/{year}"
            )
            
            # Dr Tax
            if vat_total > 0:
                JournalItem.objects.create(
                    entry=entry,
                    account=tax_account,
                    debit=vat_total,
                    credit=0,
                    label="IVA Crédito Fiscal"
                )
                
            # Cr Payable
            JournalItem.objects.create(
                entry=entry,
                account=payable_account,
                debit=0,
                credit=total_amount,
                partner=provider.supplier.name
            )
            
            invoice.journal_entry = entry
            invoice.save()

        # 4. Link Settlements
        settlements.update(monthly_invoice=invoice)
        
        # 5. Create Task
        rule = TaskAssignmentRule.objects.filter(task_type='CARD_INVOICE_APPROVAL').first()
        
        task = Task.objects.create(
            title=f"Aprobar Factura Comisiones {provider.name}",
            description=f"Periodo: {month}/{year}. Monto Total: ${total_amount:,.0f}",
            task_type='CARD_INVOICE_APPROVAL',
            priority='HIGH',
            content_object=invoice,
            created_by=user,
            status='PENDING',
            category='APPROVAL'
        )
        
        if rule:
            if rule.assigned_user:
                task.assigned_to = rule.assigned_user
            
            # Legacy Group assignment if needed
            # if rule.assigned_group:
            #     from django.contrib.auth.models import Group
            #     g = Group.objects.filter(name=rule.assigned_group).first()
            #     if g: task.assigned_group = g
        
        task.save()
        return invoice
