from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils import timezone
from .models import Invoice
from accounting.models import JournalEntry, JournalItem, AccountingSettings, AccountType
from accounting.services import JournalEntryService, AccountingMapper
from sales.models import SaleOrder
from purchasing.models import PurchaseOrder
from decimal import Decimal


class BillingService:
    @staticmethod
    def _capitalize_tax_to_product_cost(product, tax_amount, unit_cost, quantity):
        """
        Capitalizes tax amount into product cost using weighted average.
        This is used for Boletas and Draft Facturas.
        """
        from inventory.models import StockMove
        total_stock = sum(m.quantity for m in StockMove.objects.filter(product=product))
        
        if total_stock > 0:
            current_value = product.cost_price * total_stock
            product.cost_price = (current_value + tax_amount) / total_stock
        else:
            # No stock yet, set cost to unit cost + tax per unit
            product.cost_price = unit_cost + (tax_amount / quantity)
        product.save()
    
    @staticmethod
    def _revert_tax_from_product_cost(product, tax_amount):
        """
        Reverts previously capitalized tax from product cost.
        This is used when confirming a Draft Factura as a regular Factura.
        """
        from inventory.models import StockMove
        total_stock = sum(m.quantity for m in StockMove.objects.filter(product=product))
        
        if total_stock > 0:
            current_value = product.cost_price * total_stock
            product.cost_price = (current_value - tax_amount) / total_stock
            product.save()
    
    @staticmethod
    @transaction.atomic
    def create_sale_invoice(order: SaleOrder, dte_type: str, payment_method: str = 'CREDIT', status: str = Invoice.Status.POSTED, number: str = None):
        """
        Creates a Sale Invoice (Factura/Boleta) from a SaleOrder.
        """
        if order.status not in [SaleOrder.Status.CONFIRMED, SaleOrder.Status.DRAFT]:
             # Allow from draft if POS immediate
             pass
        
        # 1. Create Invoice Record
        invoice = Invoice.objects.create(
            dte_type=dte_type,
            number=number,
            date=timezone.now().date(),
            sale_order=order,
            payment_method=payment_method,
            total_net=order.total_net,
            total_tax=order.total_tax,
            total=order.total,
            status=status
        )

        # 2. Accounting Entry via Mapper
        description, reference, items = AccountingMapper.get_entries_for_sale_invoice(invoice, settings)
        entry = JournalEntryService.create_entry(
            {
                'date': timezone.now().date(),
                'description': description,
                'reference': reference,
                'state': JournalEntry.State.DRAFT
            },
            items
        )

        if status == Invoice.Status.POSTED:
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
    def create_purchase_bill(order: PurchaseOrder, supplier_invoice_number: str = '', 
                             dte_type: str = Invoice.DTEType.PURCHASE_INV, 
                             document_attachment=None, date=None, status=Invoice.Status.POSTED):
        """
        Creates a Purchase Bill from a PurchaseOrder.
        If status is DRAFT, it allows empty folio and deferred VAT separation.
        """
        if status == Invoice.Status.POSTED and not supplier_invoice_number:
            raise ValidationError("El número de folio es obligatorio para publicar la factura.")

        invoice = Invoice.objects.create(
            dte_type=dte_type,
            number=supplier_invoice_number,
            document_attachment=document_attachment,
            date=date or timezone.now().date(),
            purchase_order=order,
            total_net=order.total_net,
            total_tax=order.total_tax,
            total=order.total,
            status=status
        )

        # 2. Accounting Entry via Mapper (includes tax capitalization logic for Boletas)
        settings = AccountingSettings.objects.first()
        description, reference, items = AccountingMapper.get_entries_for_purchase_bill(invoice, settings)
        entry = JournalEntryService.create_entry(
            {
                'date': timezone.now().date(),
                'description': description,
                'reference': reference,
                'state': JournalEntry.State.DRAFT
            },
            items
        )

        # Keep cost capitalization update for Boletas
        if dte_type == Invoice.DTEType.BOLETA:
            for line in order.lines.all():
                line_tax = (line.subtotal * (line.tax_rate / Decimal('100.0'))).quantize(Decimal('1'), rounding='ROUND_HALF_UP')
                if line_tax > 0 and line.quantity > 0:
                    BillingService._capitalize_tax_to_product_cost(line.product, line_tax, line.unit_cost, line.quantity)

        # Only post the entry if the invoice is POSTED, not DRAFT
        if status == Invoice.Status.POSTED:
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
    def pos_checkout(order_data, dte_type, payment_method, transaction_number=None, is_pending_registration=False, amount=None, treasury_account_id=None, document_number=None, document_date=None, document_attachment=None):
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
            status = Invoice.Status.DRAFT if is_pending_registration else Invoice.Status.POSTED
            invoice = BillingService.create_sale_invoice(order, dte_type, payment_method, status=status, number=document_number)
            if document_date:
                invoice.date = document_date
            if document_attachment:
                invoice.document_attachment = document_attachment
            invoice.save()
        
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
    def confirm_invoice(invoice: Invoice, number: str, document_attachment=None):
        """
        Finalizes a DRAFT invoice, adding folio and separating VAT if Factura.
        Works for both Purchase Orders and Service Obligations.
        """
        if invoice.status != Invoice.Status.DRAFT:
            raise ValidationError("Solo se pueden confirmar facturas en estado borrador.")
        
        if not number:
            raise ValidationError("El número de folio es obligatorio para confirmar la factura.")

        invoice.number = number
        if document_attachment:
            invoice.document_attachment = document_attachment
        invoice.status = Invoice.Status.POSTED
        invoice.save()

        # Adjust Journal Entry
        entry = invoice.journal_entry
        if entry:
            # 1. Update Description
            if invoice.purchase_order:
                entry.description = f"{invoice.get_dte_type_display()} Compra {number} - OC {invoice.purchase_order.number}"
            elif invoice.sale_order:
                entry.description = f"{invoice.get_dte_type_display()} {number} - Pedido {invoice.sale_order.number}"
            elif invoice.service_obligation:
                entry.description = f"Gasto Servicio {invoice.service_obligation.contract.name} - {invoice.get_dte_type_display()} {number}"
            
            entry.reference = f"{invoice.dte_type[:3]}-{number}"
            entry.save()


            # Post entry (it was created in DRAFT state)
            JournalEntryService.post_entry(entry)

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
