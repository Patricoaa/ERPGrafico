from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils import timezone
from .models import PurchaseOrder, PurchaseReceipt, PurchaseReceiptLine
from accounting.models import JournalEntry, JournalItem, Account, AccountType
from accounting.services import JournalEntryService
from inventory.models import StockMove, Warehouse
from inventory.services import StockService
from decimal import Decimal

class PurchasingService:
    @staticmethod
    @transaction.atomic
    def receive_order(order: PurchaseOrder, warehouse: Warehouse, receipt_date=None, delivery_reference='', notes=''):
        """
        Receives a complete purchase order.
        Creates receipt, increases stock, updates costs, and generates accounting entries.
        """
        if order.receiving_status == PurchaseOrder.ReceivingStatus.RECEIVED:
             raise ValidationError("La orden ya está completamente recibida.")

        if not receipt_date:
            receipt_date = timezone.now().date()
            
        # Create Receipt
        receipt = PurchaseReceipt.objects.create(
            purchase_order=order,
            warehouse=warehouse,
            receipt_date=receipt_date,
            delivery_reference=delivery_reference,
            notes=notes,
            status=PurchaseReceipt.Status.DRAFT
        )
        
        # Process all pending lines
        for line in order.lines.all():
            if line.quantity_pending > 0:
                PurchasingService._create_receipt_line(
                    receipt=receipt,
                    purchase_line=line,
                    quantity=line.quantity_pending,
                    unit_cost=line.unit_cost # Use PO cost by default
                )
        
        # Confirm receipt
        PurchasingService.confirm_receipt(receipt)
        
        # Update Order Status
        order.receiving_status = PurchaseOrder.ReceivingStatus.RECEIVED
        order.status = PurchaseOrder.Status.RECEIVED # Compatible with old status
        order.save()
        
        return receipt

    @staticmethod
    @transaction.atomic
    def partial_receive(order: PurchaseOrder, warehouse: Warehouse, line_data: list, receipt_date=None, delivery_reference='', notes=''):
        """
        Receives specific quantities and potentially adjusted costs.
        line_data = [{ 'line_id': 1, 'quantity': 5, 'unit_cost': 1000 }, ...]
        """
        if not receipt_date:
            receipt_date = timezone.now().date()
            
        # Create Receipt
        receipt = PurchaseReceipt.objects.create(
            purchase_order=order,
            warehouse=warehouse,
            receipt_date=receipt_date,
            delivery_reference=delivery_reference,
            notes=notes,
            status=PurchaseReceipt.Status.DRAFT
        )
        
        for item in line_data:
            line_id = item.get('line_id')
            quantity = Decimal(str(item.get('quantity', 0)))
            unit_cost = Decimal(str(item.get('unit_cost', 0)))
            
            if quantity <= 0:
                continue
                
            purchase_line = order.lines.get(id=line_id)
            
            if quantity > purchase_line.quantity_pending:
                 raise ValidationError(f"Cantidad a recibir ({quantity}) excede la pendiente ({purchase_line.quantity_pending}) para {purchase_line.product.name}")
            
            PurchasingService._create_receipt_line(
                receipt=receipt,
                purchase_line=purchase_line,
                quantity=quantity,
                unit_cost=unit_cost if unit_cost > 0 else purchase_line.unit_cost
            )
            
        # Confirm receipt
        PurchasingService.confirm_receipt(receipt)
        
        # Update Order Receiving Status
        PurchasingService._update_order_receiving_status(order)
        
        return receipt

    @staticmethod
    @transaction.atomic
    def partial_return(order: PurchaseOrder, warehouse: Warehouse, line_data: list, receipt_date=None, delivery_reference='', notes=''):
        """
        Returns specific quantities.
        line_data = [{ 'line_id': 1, 'quantity': 5, 'unit_cost': 1000 }, ...]
        """
        if not receipt_date:
            receipt_date = timezone.now().date()
            
        # Create Receipt (acts as Return document)
        receipt = PurchaseReceipt.objects.create(
            purchase_order=order,
            warehouse=warehouse,
            receipt_date=receipt_date,
            delivery_reference=delivery_reference,
            notes=notes,
            status=PurchaseReceipt.Status.DRAFT
        )
        
        for item in line_data:
            line_id = item.get('line_id')
            quantity = Decimal(str(item.get('quantity', 0)))
            unit_cost = Decimal(str(item.get('unit_cost', 0)))
            
            if quantity <= 0:
                continue
                
            purchase_line = order.lines.get(id=line_id)
            
            PurchasingService._create_receipt_line(
                receipt=receipt,
                purchase_line=purchase_line,
                quantity=-quantity, # Negative for return
                unit_cost=unit_cost if unit_cost > 0 else purchase_line.unit_cost
            )
            
        # Confirm "receipt" (return)
        PurchasingService.confirm_return(receipt)
        
        # Update Order Receiving Status
        PurchasingService._update_order_receiving_status(order)
        
        return receipt

    @staticmethod
    @transaction.atomic
    def confirm_return(receipt: PurchaseReceipt):
        """
        Confirms return:
        1. Creates Stock Moves (OUT)
        2. Creates Accounting Entry (Debit Received Not Billed, Credit Inventory)
        3. Updates Purchase Line received qty (decreases)
        """
        if receipt.status != PurchaseReceipt.Status.DRAFT:
            raise ValidationError("Solo se pueden confirmar devoluciones en borrador.")
            
        # Create Accounting Entry
        entry = JournalEntry.objects.create(
            date=receipt.receipt_date,
            description=f"Devolución OC-{receipt.purchase_order.number} (Ret-{receipt.number})",
            reference=f"Ret-{receipt.number}",
            state=JournalEntry.State.DRAFT
        )
        
        total_amount = Decimal('0.00')
        from accounting.models import AccountingSettings
        settings = AccountingSettings.objects.first()
        
        for line in receipt.lines.all():
            # 1. Create Stock Move (OUT) - quantity is already negative in receipt line
            from inventory.models import StockMove
            stock_move = StockMove.objects.create(
                date=receipt.receipt_date,
                product=line.product,
                warehouse=receipt.warehouse,
                quantity=line.quantity_received, 
                move_type=StockMove.Type.OUT,
                description=f"Devolución OC-{receipt.purchase_order.number}",
                journal_entry=entry
            )
            line.stock_move = stock_move
            line.save()
            
            # 2. Update Purchase Line (Revert receiving)
            line.purchase_line.quantity_received += line.quantity_received
            line.purchase_line.save()
            
            # 3. Accounting
            asset_account = line.product.get_asset_account or (settings.default_inventory_account if settings else None)
            line_total = abs(line.total_cost)
            total_amount += line_total
            
            if asset_account:
                # Credit Inventory (Asset)
                JournalItem.objects.create(
                    entry=entry,
                    account=asset_account,
                    debit=0,
                    credit=line_total,
                    label=f"Devolución {line.product.code} x {abs(line.quantity_received)}"
                )
        
        # 4. Debit Received Not Billed (Liability clearing)
        if total_amount > 0:
            credit_account = settings.stock_input_account if settings else None
            if not credit_account and settings:
                credit_account = settings.default_payable_account
            
            if credit_account:
                JournalItem.objects.create(
                    entry=entry,
                    account=credit_account, 
                    debit=total_amount,
                    credit=0,
                    label=f"Contrapartida Devolución OC-{receipt.purchase_order.number}"
                )

        JournalEntryService.post_entry(entry)
        receipt.journal_entry = entry
        receipt.status = PurchaseReceipt.Status.CONFIRMED
        receipt.save()

    @staticmethod
    def _create_receipt_line(receipt, purchase_line, quantity, unit_cost):
        PurchaseReceiptLine.objects.create(
            receipt=receipt,
            purchase_line=purchase_line,
            product=purchase_line.product,
            quantity_received=quantity,
            unit_cost=unit_cost
        )

    @staticmethod
    @transaction.atomic
    def confirm_receipt(receipt: PurchaseReceipt):
        """
        Confirms receipt:
        1. Creates Stock Moves (IN)
        2. Updates Product Cost Price (Weighted Average)
        3. Creates Accounting Entry (Debit Inventory, Credit Received Not Billed)
        4. Updates Purchase Line received qty
        """
        if receipt.status != PurchaseReceipt.Status.DRAFT:
            raise ValidationError("Solo se pueden confirmar recepciones en borrador.")
            
        # Create Accounting Entry
        entry = JournalEntry.objects.create(
            date=receipt.receipt_date,
            description=f"Recepción OC-{receipt.purchase_order.number} (Recep-{receipt.number})",
            reference=f"Recep-{receipt.number}",
            state=JournalEntry.State.DRAFT
        )
        
        total_amount = Decimal('0.00')
        
        # Check if this PO has a Boleta invoice (VAT should be capitalized)
        order = receipt.purchase_order
        has_boleta = order.invoices.filter(dte_type='BOLETA').exists()
        
        for line in receipt.lines.all():
            # Determine the effective unit cost (including VAT if Boleta)
            effective_unit_cost = line.unit_cost
            if has_boleta:
                # Find the tax rate from the purchase line
                tax_rate = line.purchase_line.tax_rate
                effective_unit_cost = line.unit_cost * (Decimal('1') + (tax_rate / Decimal('100.0')))
            
            # 1. Update Product Cost (Weighted Average) with effective cost
            PurchasingService._update_product_cost(line.product, line.quantity_received, effective_unit_cost)
            
            # 2. Create Stock Move (IN)
            stock_move = StockMove.objects.create(
                date=receipt.receipt_date,
                product=line.product,
                warehouse=receipt.warehouse,
                quantity=line.quantity_received,
                move_type=StockMove.Type.IN,
                description=f"Recepción OC-{receipt.purchase_order.number}",
                journal_entry=entry
            )
            line.stock_move = stock_move
            line.save()
            
            # 3. Update Purchase Line
            line.purchase_line.quantity_received += line.quantity_received
            line.purchase_line.save()
            
            # 4. Accounting Debits (Asset)
            asset_account = line.product.get_asset_account
            if not asset_account:
                 # Fallback to default inventory account
                 pass 
                 # raise ValidationError(f"El producto {line.product.name} no tiene cuenta de activo configurada.")
            
            line_total = line.total_cost
            total_amount += line_total
            
            if asset_account:
                JournalItem.objects.create(
                    entry=entry,
                    account=asset_account,
                    debit=line_total,
                    credit=0,
                    label=f"{line.product.code} x {line.quantity_received}"
                )
        
        # 5. Accounting Credit (Clearing Account)
        from accounting.models import AccountingSettings
        settings = AccountingSettings.objects.first()
        clearing_account = settings.default_inventory_account if settings else None
        
        if clearing_account and total_amount > 0:
             # If we didn't create debits above because of missing asset account, we might have an unbalanced entry.
             # Ideally validation should prevent this.
             if not entry.items.exists():
                 # Create Debit to Inventory (clearing) as fallback if product has no asset account?
                 # Or assume all goes to Inventory Account
                 JournalItem.objects.create(
                    entry=entry,
                    account=clearing_account,
                    debit=total_amount,
                    credit=0,
                    label="Inventario (Fallback)"
                )

             # Debit: Asset Account (Real Inventory)
             # Credit: "Facturas por Recibir" (Liability) - Pending Bill (stock_input_account)
             
             credit_account = settings.stock_input_account if settings else None
             
             if not credit_account and settings:
                 # Fallback to default payable if no specific stock input account
                 credit_account = settings.default_payable_account
                 
             if not credit_account:
                 # Ultimate fallback to clearing (inventory) but warn it's bad practice
                 credit_account = clearing_account

             if credit_account:
                 JournalItem.objects.create(
                    entry=entry,
                    account=credit_account, 
                    debit=0,
                    credit=total_amount,
                    label=f"Contrapartida Recepción OC-{receipt.purchase_order.number}"
                 )
        JournalEntryService.post_entry(entry)
        receipt.journal_entry = entry
        receipt.status = PurchaseReceipt.Status.CONFIRMED
        receipt.save()

    @staticmethod
    def _update_product_cost(product, quantity, unit_cost):
        """
        Updates product cost price using Weighted Average Cost
        """
        # Get current total stock across all warehouses (simplified)
        # Ideally we should use accurate stock at that moment.
        # Check if StockService has get_total_stock
        current_stock = 0
        moves = StockMove.objects.filter(product=product)
        current_stock = sum(m.quantity for m in moves)
        
        # If stock is negative (bad data) or zero, new cost = unit_cost
        if current_stock <= 0:
            product.cost_price = unit_cost
        else:
            current_value = current_stock * product.cost_price
            new_value = (quantity * unit_cost)
            total_qty = current_stock + quantity
            
            if total_qty > 0:
                product.cost_price = (current_value + new_value) / total_qty
        
        product.save()

    @staticmethod
    def _update_order_receiving_status(order):
        total_qty = sum(l.quantity for l in order.lines.all())
        received_qty = sum(l.quantity_received for l in order.lines.all())
        
        if received_qty == 0:
            order.receiving_status = PurchaseOrder.ReceivingStatus.PENDING
        elif received_qty >= total_qty:
            order.receiving_status = PurchaseOrder.ReceivingStatus.RECEIVED
            order.status = PurchaseOrder.Status.RECEIVED
        else:
            order.receiving_status = PurchaseOrder.ReceivingStatus.PARTIAL
        order.save()

    @staticmethod
    @transaction.atomic
    def create_note(order: PurchaseOrder, note_type: str, amount_net: Decimal, amount_tax: Decimal, 
                    document_number: str, document_attachment=None, return_items=None, original_invoice_id=None):
        """
        Integral creation of a Credit or Debit Note linked to a Purchase Order.
        Properly reverses the original invoice accounting based on document type (Boleta vs Factura).
        
        - note_type: NOTA_CREDITO or NOTA_DEBITO
        - return_items: list of { 'product_id': int, 'quantity': Decimal, 'line_id': int }
          (unit_cost is locked to original invoice values)
        """
        from billing.models import Invoice
        from accounting.models import AccountingSettings, JournalEntry, JournalItem
        from inventory.models import StockMove
        from billing.services import BillingService
        
        # Get the original invoice to determine document type
        original_invoice = None
        if original_invoice_id:
             original_invoice = Invoice.objects.filter(id=original_invoice_id).first()

        if not original_invoice:
            original_invoice = order.invoices.filter(
                dte_type__in=[Invoice.DTEType.FACTURA, Invoice.DTEType.PURCHASE_INV, Invoice.DTEType.BOLETA]
            ).first()
        
        if not original_invoice:
            raise ValidationError("No se encontró factura/boleta original para crear la nota.")
        
        is_boleta = original_invoice.dte_type == Invoice.DTEType.BOLETA
        
        # Validate note amount doesn't exceed invoice total
        if note_type == Invoice.DTEType.NOTA_CREDITO:
            # For credit notes, check we don't exceed invoice amount
            existing_credits = order.invoices.filter(dte_type=Invoice.DTEType.NOTA_CREDITO)
            total_credited = sum(cn.total for cn in existing_credits)
            if (total_credited + amount_net + amount_tax) > original_invoice.total:
                raise ValidationError(
                    f"El monto de la nota de crédito excede el total de la factura original. "
                    f"Factura: ${original_invoice.total}, Ya acreditado: ${total_credited}, "
                    f"Intentando acreditar: ${amount_net + amount_tax}"
                )
        
        total_amount = amount_net + amount_tax
        
        # 1. Create Invoice Note
        invoice = Invoice.objects.create(
            dte_type=note_type,
            number=document_number,
            document_attachment=document_attachment,
            purchase_order=order,
            date=timezone.now().date(),
            total_net=amount_net,
            total_tax=amount_tax,
            total=total_amount,
            status=Invoice.Status.POSTED
        )

        # 2. Create Accounting Entry
        settings = AccountingSettings.objects.first()
        if not settings:
            raise ValidationError("No se encontró configuración contable.")
            
        entry = JournalEntry.objects.create(
            date=timezone.now().date(),
            description=f"{invoice.get_dte_type_display()} {document_number} (Ref OC-{order.number})",
            reference=f"NOTE-{invoice.id}",
            state=JournalEntry.State.DRAFT
        )

        payable_account = order.supplier.account_payable or settings.default_payable_account
        if not payable_account:
            raise ValidationError("No se encontró cuenta por pagar para el proveedor.")

        stock_input_account = settings.stock_input_account or settings.default_inventory_account
        if not stock_input_account:
            raise ValidationError("No se encontró cuenta de entrada de stock.")

        # 3. Accounts Payable Entry (opposite for credit vs debit)
        if note_type == Invoice.DTEType.NOTA_CREDITO:
            # Credit Note: Reduces debt -> Debit AP (we owe less)
            JournalItem.objects.create(
                entry=entry, 
                account=payable_account, 
                debit=total_amount, 
                credit=0, 
                partner=order.supplier.name
            )
        else:
            # Debit Note: Increases debt -> Credit AP (we owe more)
            JournalItem.objects.create(
                entry=entry, 
                account=payable_account, 
                debit=0, 
                credit=total_amount, 
                partner=order.supplier.name
            )

        # 4. Reverse Stock Input Account (clearing account)
        # 4. Reverse Stock Input Account (clearing account)
        # This reverses the "Debit: Stock Input" from the original invoice
        if note_type == Invoice.DTEType.NOTA_CREDITO:
            # Credit: Stock Input (reverses the debit from invoice)
            # FIX: Use CREDIT, not DEBIT
            JournalItem.objects.create(
                entry=entry, 
                account=stock_input_account, 
                debit=0, 
                credit=amount_net,
                label="Reverso Limpieza Cuenta Puente"
            )
        else:
            # Debit: Stock Input
            # FIX: Use DEBIT, not CREDIT
            JournalItem.objects.create(
                entry=entry, 
                account=stock_input_account, 
                debit=amount_net, 
                credit=0,
                label="Ajuste Cuenta Puente"
            )

        # 5. Tax Handling - depends on original document type
        if amount_tax > 0:
            if is_boleta:
                # BOLETA: Tax was capitalized into product cost
                # Need to reverse the capitalized VAT from inventory
                if return_items:
                    # Process per product to reverse capitalized VAT
                    for item in return_items:
                        product_id = item.get('product_id')
                        quantity = Decimal(str(item.get('quantity', 0)))
                        
                        # Find the purchase line to get unit cost and tax rate
                        purchase_line = order.lines.filter(product_id=product_id).first()
                        if not purchase_line:
                            continue
                            
                        # Calculate the tax portion for this line
                        line_tax = (purchase_line.unit_cost * quantity * (purchase_line.tax_rate / Decimal('100.0'))).quantize(
                            Decimal('0.01'), rounding='ROUND_HALF_UP'
                        )
                        
                        if line_tax > 0:
                            asset_account = purchase_line.product.get_asset_account or settings.default_inventory_account
                            
                            if note_type == Invoice.DTEType.NOTA_CREDITO:
                                # Credit: Asset Account (reverse capitalized VAT)
                                # FIX: Use CREDIT, not DEBIT
                                JournalItem.objects.create(
                                    entry=entry,
                                    account=asset_account,
                                    debit=0,
                                    credit=line_tax,
                                    label=f"Reverso IVA Capitalizado - {purchase_line.product.code}"
                                )
                                
                                # Reverse VAT from product cost
                                BillingService._revert_tax_from_product_cost(purchase_line.product, line_tax)
                            else:
                                # Debit: Asset Account (add capitalized VAT)
                                # FIX: Use DEBIT, not CREDIT
                                JournalItem.objects.create(
                                    entry=entry,
                                    account=asset_account,
                                    debit=line_tax,
                                    credit=0,
                                    label=f"IVA Capitalizado - {purchase_line.product.code}"
                                )
                                
                                # Add VAT to product cost
                                if quantity > 0:
                                    BillingService._capitalize_tax_to_product_cost(
                                        purchase_line.product, line_tax, purchase_line.unit_cost, quantity
                                    )
                else:
                    # No return items specified, use global adjustment to inventory
                    if note_type == Invoice.DTEType.NOTA_CREDITO:
                        # FIX: Use CREDIT
                        JournalItem.objects.create(
                            entry=entry,
                            account=settings.default_inventory_account,
                            debit=0,
                            credit=amount_tax,
                            label="Reverso IVA Capitalizado (Global)"
                        )
                    else:
                        # FIX: Use DEBIT
                        JournalItem.objects.create(
                            entry=entry,
                            account=settings.default_inventory_account,
                            debit=amount_tax,
                            credit=0,
                            label="IVA Capitalizado (Global)"
                        )
            else:
                # FACTURA: Tax was recorded as IVA Crédito Fiscal
                # Reverse the tax receivable account
                tax_account = settings.default_tax_receivable_account
                if not tax_account:
                    raise ValidationError("No se encontró cuenta de IVA Crédito Fiscal.")
                
                if note_type == Invoice.DTEType.NOTA_CREDITO:
                    # Credit: IVA Crédito Fiscal (reverses the debit from invoice)
                    # FIX: Use CREDIT
                    JournalItem.objects.create(
                        entry=entry, 
                        account=tax_account, 
                        debit=0, 
                        credit=amount_tax,
                        label="Reverso IVA Crédito Fiscal"
                    )
                else:
                    # Debit: IVA Crédito Fiscal
                    # FIX: Use DEBIT
                    JournalItem.objects.create(
                        entry=entry, 
                        account=tax_account, 
                        debit=amount_tax, 
                        credit=0,
                        label="IVA Crédito Fiscal"
                    )

        # 6. Process Inventory Returns (only for credit notes)
        if note_type == Invoice.DTEType.NOTA_CREDITO and return_items:
            for item in return_items:
                product_id = item.get('product_id')
                quantity = Decimal(str(item.get('quantity', 0)))
                line_id = item.get('line_id')  # Optional: link to specific purchase line
                
                if quantity <= 0:
                    continue
                
                # Find the purchase line
                if line_id:
                    purchase_line = order.lines.filter(id=line_id).first()
                else:
                    purchase_line = order.lines.filter(product_id=product_id).first()
                
                if not purchase_line:
                    raise ValidationError(f"No se encontró línea de compra para producto ID {product_id}")
                
                # Validate quantity doesn't exceed purchased quantity
                if quantity > purchase_line.quantity:
                    raise ValidationError(
                        f"Cantidad a devolver ({quantity}) excede la cantidad comprada ({purchase_line.quantity}) "
                        f"para {purchase_line.product.name}"
                    )
                
                # Create Stock Move (OUT) for the return
                # Find the warehouse from the most recent receipt
                warehouse = None
                for receipt in order.receipts.filter(status=PurchaseReceipt.Status.CONFIRMED):
                    receipt_line = receipt.lines.filter(purchase_line=purchase_line).first()
                    if receipt_line:
                        warehouse = receipt.warehouse
                        break
                
                if not warehouse:
                    # Fallback to order's warehouse if no receipts found
                    warehouse = order.warehouse
                
                StockMove.objects.create(
                    date=timezone.now().date(),
                    product=purchase_line.product,
                    warehouse=warehouse,
                    quantity=-quantity,  # Negative for OUT
                    move_type=StockMove.Type.OUT,
                    description=f"Devolución NC-{document_number} (OC-{order.number})",
                    journal_entry=entry
                )

        # 7. Post the entry
        JournalEntryService.post_entry(entry)
        invoice.journal_entry = entry
        invoice.save()
        
        return invoice


    @staticmethod
    @transaction.atomic
    def delete_receipt(receipt: PurchaseReceipt):
        """
        Deletes a purchase receipt, its journal entry, and associated stock moves.
        Also reverts quantity_received on the purchase order lines.
        """
        # 1. Revert received quantities & Delete Stock Moves
        for line in receipt.lines.all():
            if line.stock_move:
                line.stock_move.delete() # Accounting entry for move is often shared with receipt JE
            
            line.purchase_line.quantity_received -= line.quantity_received
            line.purchase_line.save()

        # 2. Delete Journal Entry
        if receipt.journal_entry:
            receipt.journal_entry.delete()

        # 3. Delete Receipt
        receipt.delete()

    @staticmethod
    @transaction.atomic
    def delete_purchase_order(order: PurchaseOrder):
        """
        Deletes a purchase order, its invoices, and associated journal entries.
        """
        from billing.services import BillingService
        from treasury.services import TreasuryService
        
        # 1. Delete associated invoices (and their payments/JEs)
        for invoice in order.invoices.all():
            if invoice.status != 'CANCELLED':
                 BillingService.delete_invoice(invoice)
        
        # 2. Delete stand-alone payments linked to order
        for payment in order.payments.all():
            TreasuryService.delete_payment(payment)

        # 3. Delete receipts (which removes Stock Moves and their JEs)
        for receipt in order.receipts.all():
            PurchasingService.delete_receipt(receipt)

        # 3. Delete order's own journal entry
        if order.journal_entry:
            order.journal_entry.delete()
            
        # 4. Delete Order
        order.delete()
