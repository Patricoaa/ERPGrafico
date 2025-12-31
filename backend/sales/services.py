from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils import timezone
from .models import SaleOrder, SaleOrder
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
            raise ValidationError("Solo se pueden confirmar pedidos en borrador.")

        # 1. Update Order Status
        order.status = SaleOrder.Status.CONFIRMED
        order.save()

        # 2. Identify Accounts
        # For simplicity, we get standard accounts. In real apps, these come from settings.
        try:
            # Asset: Cuentas por Cobrar (Receivable)
            receivable_account = Account.objects.get(code='1.1.02.001') # Example code
        except Account.DoesNotExist:
            # Fallback or error
            receivable_account = Account.objects.filter(account_type=AccountType.ASSET).first() # TODO: Fix hardcoding

        try:
            # Income: Ventas (Revenue)
            revenue_account = Account.objects.get(code='4.1.01') # Example
        except Account.DoesNotExist:
             revenue_account = Account.objects.filter(account_type=AccountType.INCOME).first()

        try:
           # Liability: IVA Débito (Tax Payable)
            tax_account = Account.objects.get(code='2.1.04') 
        except Account.DoesNotExist:
            tax_account = Account.objects.filter(account_type=AccountType.LIABILITY).first()


        if not all([receivable_account, revenue_account, tax_account]):
             raise ValidationError("No se encontraron las cuentas contables necesarias (Por Cobrar, Ingresos, Impuestos). Configure el Plan de Cuentas.")


        # 3. Create Journal Entry
        entry = JournalEntry.objects.create(
            date=timezone.now().date(),
            description=f"Venta NV-{order.number} - {order.customer.name}",
            reference=f"NV-{order.number}",
            state=JournalEntry.State.DRAFT
        )

        # Debit: Receivable (Total)
        JournalItem.objects.create(
            entry=entry,
            account=receivable_account,
            debit=order.total,
            credit=Decimal('0.00'),
            partner=order.customer.name
        )

        # Credit: Revenue (Net)
        if order.total_net > 0:
            JournalItem.objects.create(
                entry=entry,
                account=revenue_account,
                debit=Decimal('0.00'),
                credit=order.total_net
            )

        # Credit: Tax (Tax Amount)
        if order.total_tax > 0:
            JournalItem.objects.create(
                entry=entry,
                account=tax_account,
                debit=Decimal('0.00'),
                credit=order.total_tax,
                label=f"IVA Venta {order.number}"
            )

        # Post Entry
        JournalEntryService.post_entry(entry)
        
        # Link Entry
        order.journal_entry = entry
        order.save()

        return order
