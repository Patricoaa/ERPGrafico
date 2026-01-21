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
    def _validate_document_uniqueness(number, dte_type, supplier_id=None, exclude_id=None):
        """
        Validates that the document number is unique.
        - For Sales: Global uniqueness per DTE type.
        - For Purchases: Uniqueness per supplier and DTE type.
        """
        if not number or number == 'Draft' or number == '':
            return

        from .models import Invoice
        
        # Base query
        query = Invoice.objects.filter(number=number, dte_type=dte_type)
        
        if exclude_id:
            query = query.exclude(id=exclude_id)

        if supplier_id:
            # Purchase validation: unique per supplier
            query = query.filter(purchase_order__supplier_id=supplier_id)
        else:
            # Sale validation: global per DTE type (excluding purchases)
            query = query.filter(sale_order__isnull=False)

        if query.exists():
            if supplier_id:
                raise ValidationError(f"El folio {number} ya ha sido registrado para este proveedor en otro documento.")
            else:
                raise ValidationError(f"El folio {number} ya ha sido utilizado en otro documento de venta.")

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
        
        from core.services import SequenceService
        
        # Auto-generate folio for Boletas if empty
        if dte_type == Invoice.DTEType.BOLETA and not number:
            number = SequenceService.get_next_number(
                Invoice, 
                filter_kwargs={'dte_type': Invoice.DTEType.BOLETA}
            )

        # Validate Uniqueness
        if number:
            BillingService._validate_document_uniqueness(number, dte_type)

        # 1. Create Invoice Record
        invoice = Invoice.objects.create(
            dte_type=dte_type,
            number=number or '',
            date=timezone.now().date(),
            sale_order=order,
            payment_method=payment_method,
            total_net=order.total_net,
            total_tax=order.total_tax,
            total=order.total,
            status=status
        )

        # 2. Accounting Entry via Mapper
        settings = AccountingSettings.objects.first()
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
            
            receivable_account = order.customer.account_receivable or settings.default_receivable_account
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

        # 0. Validate Uniqueness
        if supplier_invoice_number:
            BillingService._validate_document_uniqueness(
                supplier_invoice_number, 
                dte_type, 
                supplier_id=order.supplier_id
            )

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
            
            payable_account = order.supplier.account_payable or settings.default_payable_account
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
    def pos_checkout(order_data, dte_type, payment_method, transaction_number=None, 
                     is_pending_registration=False, payment_is_pending=False, amount=None, treasury_account_id=None, 
                     document_number=None, document_date=None, document_attachment=None,
                     delivery_type='IMMEDIATE', delivery_date=None, delivery_notes='', immediate_lines=None, payment_type='INBOUND',
                     line_files=None):
        """
        Complete POS checkout: Create Order -> Confirm -> Invoice -> Payment -> (Optional) Delivery.
        """
        from sales.serializers import CreateSaleOrderSerializer
        from treasury.services import TreasuryService
        from inventory.models import Warehouse
        
        # 1. Get or Create Order
        order = None
        if isinstance(order_data, list):
            order_data = order_data[0]
            
        if isinstance(order_data, str):
            import json
            order_data = json.loads(order_data)

        if 'id' in order_data:
            order = SaleOrder.objects.get(id=order_data['id'])
        else:
            if 'payment_method' not in order_data:
                order_data['payment_method'] = payment_method
                
            order_serializer = CreateSaleOrderSerializer(data=order_data)
            print(f"DEBUG: order_data before validation: {order_data}")
            if not order_serializer.is_valid():
                print(f"DEBUG: serializer errors: {order_serializer.errors}")
                raise ValidationError(order_serializer.errors)
            
            # Use provided channel or default to POS
            channel = order_data.get('channel', 'POS')
            order = order_serializer.save(channel=channel)
        
        # 2. Confirm Order
        from sales.services import SalesService
        SalesService.confirm_sale(order, line_files=line_files)
        
        # 3. Handle Delivery Scheduling / Action
        if delivery_type == 'IMMEDIATE':
            # Dispatch everything right now from the first available warehouse
            warehouse = Warehouse.objects.first()
            if not warehouse:
                raise ValidationError("Debe existir al menos una bodega para realizar despachos.")
            SalesService.dispatch_order(order, warehouse)
        
        elif delivery_type == 'PARTIAL':
            # Partial Dispatch: Immediate lines are dispatched now, others are scheduled
            warehouse = Warehouse.objects.first()
            if not warehouse:
                raise ValidationError("Debe existir al menos una bodega para realizar despachos.")

            if not immediate_lines:
                # Fallback to SCHEDULED if no lines are marked for immediate
                delivery_type = 'SCHEDULED'
            else:
                # Prepare data for immediate lines
                line_data = []
                for item in immediate_lines:
                    try:
                        if isinstance(item, dict) and 'id' in item:
                            line_id = item['id']
                            qty = Decimal(str(item.get('quantity', 0)))
                            uom_id = item.get('uom')
                        else:
                            line_id = item
                            line = order.lines.get(id=line_id)
                            qty = line.quantity_pending
                            uom_id = line.uom.id if line.uom else None
                        
                        if qty > 0:
                            line_data.append({
                                'line_id': line_id,
                                'quantity': qty,
                                'uom_id': uom_id
                            })
                    except (SaleOrder.DoesNotExist, ValueError, TypeError):
                        continue
                
                if line_data:
                    SalesService.partial_dispatch(order, warehouse, line_data)
            
            # For the REST (or all if fallback), schedule them
            if delivery_type == 'PARTIAL' or delivery_type == 'SCHEDULED': # Logic applies to remainder
                if delivery_date:
                    order.delivery_date = delivery_date
                
                notes_prefix = "Despacho Parcial: " if delivery_type == 'PARTIAL' else ""
                if delivery_notes:
                    order.notes = f"{order.notes}\n{notes_prefix}Notas Despacho: {delivery_notes}".strip()
                order.save()

        elif delivery_type == 'SCHEDULED':
            order.delivery_status = SaleOrder.DeliveryStatus.PENDING
            if delivery_date:
                order.delivery_date = delivery_date
            if delivery_notes:
                order.notes = f"{order.notes}\nNotas Despacho: {delivery_notes}".strip()
            order.save()
        elif delivery_type == 'PICKUP':
            # Could be handled similarly to IMMEDIATE or just marked as PENDING for now
            order.delivery_status = SaleOrder.DeliveryStatus.PENDING
            order.save()

        # 4. Create Invoice (if not already invoiced)
        invoice = order.invoices.filter(status=Invoice.Status.POSTED).first()
        if not invoice:
            status = Invoice.Status.DRAFT if is_pending_registration else Invoice.Status.POSTED
            
            # Validate uniqueness if number provided
            if document_number:
                BillingService._validate_document_uniqueness(document_number, dte_type)
                
            invoice = BillingService.create_sale_invoice(order, dte_type, payment_method, status=status, number=document_number)
            if document_date:
                invoice.date = document_date
            if document_attachment:
                invoice.document_attachment = document_attachment
            invoice.save()
        
        # 4. Create Payment (if not credit)
        if payment_method != 'CREDIT':
            # Ensure amount is Decimal (from request it might be string)
            # Cap the payment amount at the order total to avoid overvaluing treasury when change is given
            received_amount = Decimal(str(amount)) if amount is not None and str(amount) != '' else order.total
            payment_amount = min(received_amount, order.total)
            
            TreasuryService.register_payment(
                amount=payment_amount,
                payment_type=payment_type,
                payment_method=payment_method,
                reference=f"NV-{order.number}",
                partner=order.customer,
                invoice=invoice,
                sale_order=order,
                treasury_account_id=treasury_account_id,
                transaction_number=transaction_number,
                is_pending_registration=payment_is_pending
            )
            
        return invoice

    @staticmethod
    @transaction.atomic
    def confirm_invoice(invoice: Invoice, number: str, document_attachment=None):
        """
        Finalizes a DRAFT or PAID-without-folio invoice, adding folio and separating VAT.
        Works for Sale Orders, Purchase Orders and Service Obligations.
        """
        # Allow PAID status because a draft can be fully paid before folio is registered
        if invoice.status not in [Invoice.Status.DRAFT, Invoice.Status.PAID]:
            raise ValidationError(f"Solo se pueden confirmar facturas en estado Borrador (actual: {invoice.status}).")
        
        if not number:
            raise ValidationError("El número de folio es obligatorio para confirmar la factura.")

        # Validate Uniqueness
        supplier_id = None
        if invoice.purchase_order:
            supplier_id = invoice.purchase_order.supplier_id
            
        BillingService._validate_document_uniqueness(
            number, 
            invoice.dte_type, 
            supplier_id=supplier_id, 
            exclude_id=invoice.id
        )

        invoice.number = number
        if document_attachment:
            invoice.document_attachment = document_attachment
        
        # Avoid downgrading status if it was already PAID
        if invoice.status == Invoice.Status.DRAFT:
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
            
            entry.reference = f"{invoice.dte_type[:3]}-{number}"
            entry.save()

            # Post entry if it's still in DRAFT (which it is for Draft/Paid-Draft invoices)
            if entry.state == JournalEntry.State.DRAFT:
                JournalEntryService.post_entry(entry)

        return invoice

    @staticmethod
    @transaction.atomic
    def delete_invoice(invoice: Invoice):
        """
        Deletes an invoice, its associated Journal Entry, and its associated payments.
        Only allowed for DRAFT invoices.
        """
        if invoice.status != Invoice.Status.DRAFT:
            raise ValidationError("Solo se pueden eliminar facturas en estado Borrador.")

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

    @staticmethod
    @transaction.atomic
    def annul_invoice(invoice: Invoice, force: bool = False):
        """
        Annuls a POSTED invoice with strict business rule validations.
        Reverses the accounting entry and marks as CANCELLED.
        If force is True, also annuls associated payments.
        """
        if invoice.status not in [Invoice.Status.POSTED, Invoice.Status.PAID]:
             raise ValidationError("Solo se pueden anular facturas publicadas o pagadas.")

        # VALIDATION 1: Folio registrado (fiscal requirement)
        if invoice.number and invoice.number != 'Draft':
            raise ValidationError(
                "❌ No se puede anular una factura con folio asignado.\n"
                "📋 Razón: Obligación fiscal de mantener trazabilidad de documentos emitidos.\n"
                "💡 Use una Nota de Crédito para ajustar esta factura."
            )
        
        # VALIDATION 2: Despachos confirmados (para ventas)
        if invoice.sale_order:
            confirmed_deliveries = invoice.sale_order.deliveries.filter(
                status='CONFIRMED'
            ).exists()
            
            if confirmed_deliveries:
                raise ValidationError(
                    "❌ No se puede anular: existen despachos confirmados asociados.\n"
                    "📦 Los productos ya fueron despachados físicamente.\n"
                    "💡 Opciones:\n"
                    "   1. Registrar una devolución de mercadería (solo productos stockeables)\n"
                    "   2. Usar una Nota de Crédito para ajustar la factura"
                )
        
        # VALIDATION 3: Recepciones confirmadas (para compras)
        if invoice.purchase_order:
            confirmed_receipts = invoice.purchase_order.receipts.filter(
                status='CONFIRMED'
            ).exists()
            
            if confirmed_receipts:
                raise ValidationError(
                    "❌ No se puede anular: existen recepciones confirmadas asociadas.\n"
                    "📦 Los productos ya fueron recibidos físicamente.\n"
                    "💡 Opciones:\n"
                    "   1. Registrar una devolución de mercadería al proveedor\n"
                    "   2. Usar una Nota de Crédito para ajustar la factura"
                )
        
        # VALIDATION 4: Pagos registrados
        posted_payments = invoice.payments.filter(journal_entry__state='POSTED')
        if posted_payments.exists():
             if not force:
                 raise ValidationError(
                     "❌ No se puede anular: existen pagos registrados asociados.\n"
                     "💰 Los pagos ya fueron contabilizados.\n"
                     "💡 Opciones:\n"
                     "   1. Anular los pagos primero (use force=True para anulación en cascada)\n"
                     "   2. Registrar una devolución de pago\n"
                     "   3. Usar una Nota de Crédito para ajustar la factura"
                 )
             
             # Annul payments in cascade
             for payment in posted_payments:
                 TreasuryService.annul_payment(payment)

        # 1. Reverse Accounting Entry
        if invoice.journal_entry:
            JournalEntryService.reverse_entry(invoice.journal_entry, description=f"Anulación Factura {invoice.number}")
        
        # 2. Handle associated payments (already handled in validation)
        from treasury.services import TreasuryService

        # 3. Update Status
        invoice.status = Invoice.Status.CANCELLED
        invoice.save()

        # 4. Update Order Status
        if invoice.sale_order:
            invoice.sale_order.status = SaleOrder.Status.CONFIRMED # Revert to confirmed
            invoice.sale_order.save()
        elif invoice.purchase_order:
             invoice.purchase_order.status = PurchaseOrder.Status.RECEIVED # Revert to received
             invoice.purchase_order.save()
        
        return invoice
