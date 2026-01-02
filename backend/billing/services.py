from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils import timezone
from .models import Invoice
from accounting.models import JournalEntry, JournalItem, AccountingSettings, AccountType
from accounting.services import JournalEntryService
from sales.models import SaleOrder
from purchasing.models import PurchaseOrder
from decimal import Decimal

class BillingService:
    @staticmethod
    @transaction.atomic
    def create_sale_invoice(order: SaleOrder, dte_type: str, payment_method: str = 'CREDIT'):
        """
        Creates a Sale Invoice (Factura/Boleta) from a SaleOrder.
        """
        if order.status not in [SaleOrder.Status.CONFIRMED, SaleOrder.Status.DRAFT]:
             # Allow from draft if POS immediate
             pass
        
        # 1. Create Invoice Record
        invoice = Invoice.objects.create(
            dte_type=dte_type,
            date=timezone.now().date(),
            sale_order=order,
            payment_method=payment_method,
            total_net=order.total_net,
            total_tax=order.total_tax,
            total=order.total,
            status=Invoice.Status.POSTED
        )

        # 2. Accounting Entry
        settings = AccountingSettings.objects.first()
        if not settings:
            raise ValidationError("Debe configurar la contabilidad primero.")

        receivable_account = settings.default_receivable_account
        revenue_account = settings.default_revenue_account
        tax_account = settings.default_tax_payable_account
        
        if not all([receivable_account, revenue_account, tax_account]):
            raise ValidationError("Faltan cuentas predeterminadas en la configuración contable.")

        entry = JournalEntry.objects.create(
            date=timezone.now().date(),
            description=f"{invoice.get_dte_type_display()} {invoice.number or ''} - Pedido {order.number}",
            reference=f"{invoice.dte_type[:3]}-{order.number}",
            state=JournalEntry.State.DRAFT
        )

        # Debit: Receivable (Total)
        JournalItem.objects.create(
            entry=entry,
            account=receivable_account,
            debit=invoice.total,
            credit=0,
            partner=order.customer.name
        )

        # Credit: Revenue (Net)
        JournalItem.objects.create(
            entry=entry,
            account=revenue_account,
            debit=0,
            credit=invoice.total_net
        )

        # Credit: Tax (IVA Débito)
        if invoice.total_tax > 0:
            JournalItem.objects.create(
                entry=entry,
                account=tax_account,
                debit=0,
                credit=invoice.total_tax,
                label=f"IVA {invoice.dte_type}"
            )

        JournalEntryService.post_entry(entry)
        invoice.journal_entry = entry
        invoice.save()

        # Update Order
        order.status = SaleOrder.Status.INVOICED
        order.save()

        return invoice

    @staticmethod
    @transaction.atomic
    def create_purchase_bill(order: PurchaseOrder, supplier_invoice_number: str):
        """
        Creates a Purchase Bill from a PurchaseOrder.
        """
        invoice = Invoice.objects.create(
            dte_type=Invoice.DTEType.PURCHASE_INV,
            number=supplier_invoice_number,
            date=timezone.now().date(),
            purchase_order=order,
            total_net=order.total_net,
            total_tax=order.total_tax,
            total=order.total,
            status=Invoice.Status.POSTED
        )

        settings = AccountingSettings.objects.first()
        payable_account = order.supplier.payable_account or (settings.default_payable_account if settings else None)
        tax_account = settings.default_tax_receivable_account if settings else None
        
        # We need an Inventory clearing account (Received Not Billed)
        # For now, we'll use a generic one or fallback to expense/asset?
        # Let's assume there is a clearing account or we use the direct asset.
        clearing_account = settings.default_inventory_account # Simplified

        entry = JournalEntry.objects.create(
            date=timezone.now().date(),
            description=f"Factura Compra {supplier_invoice_number} - OC {order.number}",
            reference=f"FCP-{supplier_invoice_number}",
            state=JournalEntry.State.DRAFT
        )

        # Credit: AP (Total)
        JournalItem.objects.create(
            entry=entry,
            account=payable_account,
            debit=0,
            credit=invoice.total,
            partner=order.supplier.name
        )

        # Debit: Inventory Clearing / Asset (Net)
        JournalItem.objects.create(
            entry=entry,
            account=clearing_account,
            debit=invoice.total_net,
            credit=0
        )

        # Debit: Tax (IVA Crédito)
        if invoice.total_tax > 0:
             JournalItem.objects.create(
                entry=entry,
                account=tax_account,
                debit=invoice.total_tax,
                credit=0,
                label="IVA Compras"
             )

        JournalEntryService.post_entry(entry)
        invoice.journal_entry = entry
        invoice.save()

        order.status = PurchaseOrder.Status.INVOICED
        order.save()

        return invoice

    @staticmethod
    @transaction.atomic
    def pos_checkout(order_data, dte_type, payment_method, transaction_number=None, is_pending_registration=False, amount=None):
        """
        Complete POS checkout: Create Order -> Confirm -> Invoice -> Payment.
        """
        from sales.serializers import CreateSaleOrderSerializer
        from treasury.models import BankJournal
        from treasury.services import TreasuryService
        
        # 1. Get or Create Order
        order = None
        if 'id' in order_data:
            order = SaleOrder.objects.get(id=order_data['id'])
        else:
            if 'payment_method' not in order_data:
                order_data['payment_method'] = payment_method
                
            order_serializer = CreateSaleOrderSerializer(data=order_data)
            if not order_serializer.is_valid():
                raise ValidationError(order_serializer.errors)
            order = order_serializer.save(channel='POS')
        
        # 2. Confirm Order (Inventory deduction happen here if implemented)
        from sales.services import SalesService
        SalesService.confirm_sale(order)
        
        # 3. Create Invoice (if not already invoiced)
        invoice = order.invoices.filter(status=Invoice.Status.POSTED).first()
        if not invoice:
            invoice = BillingService.create_sale_invoice(order, dte_type, payment_method)
        
        # 4. Create Payment (if not credit)
        if payment_method != 'CREDIT':
            journal = BankJournal.objects.first() # Default
            if not journal:
                 raise ValidationError("Debe configurar al menos un Diario de Caja/Banco.")
            
            # Use specific account if configured
            payment_account = None
            settings = AccountingSettings.objects.first()
            if settings:
                if payment_method == 'CASH': payment_account = settings.default_cash_account
                elif payment_method == 'CARD': payment_account = settings.default_card_account
                elif payment_method == 'TRANSFER': payment_account = settings.default_transfer_account

            TreasuryService.register_payment(
                journal=journal,
                amount=amount or order.total,
                payment_type='INBOUND',
                reference=f"NV-{order.number}",
                partner=order.customer,
                invoice=invoice,
                sale_order=order,
                account=payment_account,
                transaction_number=transaction_number,
                is_pending_registration=is_pending_registration
            )
            
        return invoice

    @staticmethod
    @transaction.atomic
    def delete_invoice(invoice: Invoice):
        """
        Deletes an invoice, its associated Journal Entry, and its associated payments.
        """
        from treasury.services import TreasuryService
        
        # 1. Delete associated payments
        for payment in invoice.payments.all():
            TreasuryService.delete_payment(payment)
        
        # 2. Delete invoice's own Journal Entry
        if invoice.journal_entry:
            invoice.journal_entry.delete()
        
        # 3. Delete invoice
        invoice.delete()
