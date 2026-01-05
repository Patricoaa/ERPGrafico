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

        receivable_account = order.customer.account_receivable or settings.default_receivable_account
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

        # Check for advances and link them
        advances = order.payments.filter(invoice__isnull=True)
        total_advanced = sum(p.amount for p in advances)

        if total_advanced > 0:
            recon_entry = JournalEntry.objects.create(
                date=timezone.now().date(),
                description=f"Conciliación Anticipos - Pedido {order.number} -> Factura {invoice.id}",
                reference=f"RECO-{invoice.id}", 
                state=JournalEntry.State.DRAFT
            )
            
            advance_account = settings.default_advance_payment_account or receivable_account
            
            # Debit: Advance Account (Clear the liability)
            JournalItem.objects.create(
                entry=recon_entry,
                account=advance_account,
                debit=total_advanced,
                credit=0,
                partner=order.customer.name
            )
            
            # Credit: Receivable Account (Reduce what they owe us)
            JournalItem.objects.create(
                entry=recon_entry,
                account=receivable_account,
                debit=0,
                credit=total_advanced,
                partner=order.customer.name
            )
            
            JournalEntryService.post_entry(recon_entry)
            
            for payment in advances:
                payment.invoice = invoice
                payment.save()

        # Update Order Status
        if total_advanced >= order.total:
             order.status = SaleOrder.Status.PAID
        else:
             order.status = SaleOrder.Status.INVOICED
        order.save()

        return invoice

    @staticmethod
    @transaction.atomic
    def create_purchase_bill(order: PurchaseOrder, supplier_invoice_number: str, 
                             dte_type: str = Invoice.DTEType.PURCHASE_INV, 
                             document_attachment=None, date=None):
        """
        Creates a Purchase Bill from a PurchaseOrder.
        """
        invoice = Invoice.objects.create(
            dte_type=dte_type,
            number=supplier_invoice_number,
            document_attachment=document_attachment,
            date=date or timezone.now().date(),
            purchase_order=order,
            total_net=order.total_net,
            total_tax=order.total_tax,
            total=order.total,
            status=Invoice.Status.POSTED
        )

        settings = AccountingSettings.objects.first()
        payable_account = order.supplier.account_payable or (settings.default_payable_account if settings else None)
        tax_account = settings.default_tax_receivable_account if settings else None
        
        # We need to clear the Stock Interim (Received Not Billed)
        # established during reception.
        stock_input_account = settings.stock_input_account if settings else None
        
        if not stock_input_account:
            # Fallback to inventory if someone is not using bridge accounts
            stock_input_account = settings.default_inventory_account

        entry = JournalEntry.objects.create(
            date=timezone.now().date(),
            description=f"Factura Compra {supplier_invoice_number} - OC {order.number}",
            reference=f"FCP-{supplier_invoice_number}",
            state=JournalEntry.State.DRAFT
        )

        # Credit: Accounts Payable (Total real debt)
        JournalItem.objects.create(
            entry=entry,
            account=payable_account,
            debit=0,
            credit=invoice.total,
            partner=order.supplier.name
        )

        # Debit: Stock Interim (Net) - CLEARING the liability from reception
        # If it's a BOLETA, the bridge account (stock_input_account) only has the NET value from reception.
        # So we clear the NET part and debit the rest to INVENTORY (capitalizing the tax).
        is_boleta = dte_type == Invoice.DTEType.BOLETA
        
        # 1. Clear Bridge Account for the NET amount (always net from reception)
        JournalItem.objects.create(
            entry=entry,
            account=stock_input_account,
            debit=invoice.total_net,
            credit=0,
            label="Limpieza Cuenta Puente Recepción"
        )

        if is_boleta:
            # 2. Capitalize Tax into Inventory and Product Cost
            for line in order.lines.all():
                asset_account = line.product.get_asset_account or settings.default_inventory_account
                # Calculate tax portion for this line
                line_tax = (line.subtotal * (line.tax_rate / Decimal('100.0'))).quantize(Decimal('1'), rounding='ROUND_HALF_UP')
                
                if line_tax > 0 and asset_account:
                    JournalItem.objects.create(
                        entry=entry,
                        account=asset_account,
                        debit=line_tax,
                        credit=0,
                        label=f"IVA Capitalizado (Boleta) - {line.product.code}"
                    )
                    
                    # Update Product Cost Price (Correct WAC adjustment for capitalized tax)
                    if line.quantity > 0:
                        product = line.product
                        from inventory.models import StockMove
                        total_stock = sum(m.quantity for m in StockMove.objects.filter(product=product))
                        
                        if total_stock > 0:
                            # Add the tax portion to the total inventory value and re-average
                            current_value = product.cost_price * total_stock
                            product.cost_price = (current_value + line_tax) / total_stock
                        else:
                            # Fallback if stock is inconsistent
                            product.cost_price = line.unit_cost + (line_tax / line.quantity)
                        
                        product.save()
        else:
            # 2. Factura: Normal tax handling (VAT Receivable / IVA Crédito)
            if invoice.total_tax > 0 and tax_account:
                 JournalItem.objects.create(
                    entry=entry,
                    account=tax_account,
                    debit=invoice.total_tax,
                    credit=0,
                    label="IVA Compras (Crédito Fiscal)"
                 )

        JournalEntryService.post_entry(entry)
        invoice.journal_entry = entry
        invoice.save()

        # Check for prepayments on this order and link them
        prepayments = order.payments.filter(invoice__isnull=True)
        total_prepaid = sum(p.amount for p in prepayments)

        if total_prepaid > 0:
            # Reconcile prepayments: Move from Prepayment Account to Payable Account
            recon_entry = JournalEntry.objects.create(
                date=timezone.now().date(),
                description=f"Conciliación Anticipos - OC {order.number} -> Factura {supplier_invoice_number}",
                reference=f"RECO-{invoice.id}", # Reconciliation
                state=JournalEntry.State.DRAFT
            )
            
            prepayment_account = settings.default_prepayment_account or payable_account
            
            # Debit: Payable Account (Reduce what we owe)
            JournalItem.objects.create(
                entry=recon_entry,
                account=payable_account,
                debit=total_prepaid,
                credit=0,
                partner=order.supplier.name
            )
            
            # Credit: Prepayment Account (Clear the advance)
            JournalItem.objects.create(
                entry=recon_entry,
                account=prepayment_account,
                debit=0,
                credit=total_prepaid,
                partner=order.supplier.name
            )
            
            JournalEntryService.post_entry(recon_entry)
            
            # Link payments to the new invoice
            for payment in prepayments:
                payment.invoice = invoice
                payment.save()

        # Update Order Status
        if total_prepaid >= order.total:
            order.status = PurchaseOrder.Status.PAID
        else:
            order.status = PurchaseOrder.Status.INVOICED
        order.save()

        return invoice

    @staticmethod
    @transaction.atomic
    def pos_checkout(order_data, dte_type, payment_method, transaction_number=None, is_pending_registration=False, amount=None, treasury_account_id=None):
        """
        Complete POS checkout: Create Order -> Confirm -> Invoice -> Payment.
        """
        from sales.serializers import CreateSaleOrderSerializer
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
            TreasuryService.register_payment(
                amount=amount or order.total,
                payment_type='INBOUND',
                payment_method=payment_method,
                reference=f"NV-{order.number}",
                partner=order.customer,
                invoice=invoice,
                sale_order=order,
                treasury_account_id=treasury_account_id,
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
        
        # 2.5 Delete reconciliation journal entries (RECO-...)
        JournalEntry.objects.filter(reference=f"RECO-{invoice.id}").delete()
        
        # 3. Delete invoice
        invoice.delete()
