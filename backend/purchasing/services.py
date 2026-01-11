from django.db import transaction, models
from django.core.exceptions import ValidationError
from django.utils import timezone
from .models import PurchaseOrder, PurchaseReceipt, PurchaseReceiptLine
from accounting.models import JournalEntry, JournalItem, Account, AccountType, AccountingSettings
from accounting.services import JournalEntryService, AccountingMapper
from core.services import SequenceService, BaseNoteService
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
        3. Creates Accounting Entry (via Mapper)
        4. Updates Purchase Line received qty
        """
        if receipt.status != PurchaseReceipt.Status.DRAFT:
            raise ValidationError("Solo se pueden confirmar recepciones en borrador.")
            
        from accounting.models import AccountingSettings
        from inventory.services import StockService
        from inventory.models import StockMove
        from accounting.services import JournalEntryService, AccountingMapper

        settings = AccountingSettings.objects.first()
        if not settings:
            raise ValidationError("No se encontró configuración contable.")

        # 1 & 2 & 4. Business Logic: Stock, Costs, and PO status
        has_boleta = receipt.purchase_order.invoices.filter(dte_type='BOLETA').exists()
        
        for line in receipt.lines.all():
            # Determine the effective unit cost (including VAT if Boleta)
            effective_unit_cost = line.unit_cost
            if has_boleta:
                tax_rate = line.purchase_line.tax_rate
                effective_unit_cost = line.unit_cost * (Decimal('1') + (tax_rate / Decimal('100.0')))
            
            # Base quantity conversion
            base_qty = StockService.convert_quantity(
                line.quantity_received,
                from_uom=line.purchase_line.uom,
                to_uom=line.product.uom
            )
            
            if base_qty > 0:
                cost_per_base_unit = (line.quantity_received * effective_unit_cost) / base_qty
            else:
                cost_per_base_unit = effective_unit_cost

            # Update Product Cost (Weighted Average)
            PurchasingService._update_product_cost(line.product, base_qty, cost_per_base_unit)
            
            # Create Stock Move (IN) - Placeholder for journal_entry
            stock_move = StockMove.objects.create(
                date=receipt.receipt_date,
                product=line.product,
                warehouse=receipt.warehouse,
                quantity=base_qty,
                move_type=StockMove.Type.IN,
                description=f"Recepción OC-{receipt.purchase_order.number}"
            )
            line.stock_move = stock_move
            line.save()
            
            # Update Purchase Line
            line.purchase_line.quantity_received += line.quantity_received
            line.purchase_line.save()

        # 3. Final Accounting Entry via Mapper (includes Consumable logic)
        description, reference, items = AccountingMapper.get_entries_for_receipt(receipt, settings)
        entry = JournalEntryService.create_entry(
            {
                'date': receipt.receipt_date,
                'description': description,
                'reference': reference,
                'state': JournalEntry.State.DRAFT
            },
            items
        )
        
        # Link Stock Moves to the Entry
        for line in receipt.lines.all():
            if line.stock_move:
                line.stock_move.journal_entry = entry
                line.stock_move.save()

        # Finalize
        JournalEntryService.post_entry(entry)
        receipt.journal_entry = entry
        receipt.status = PurchaseReceipt.Status.CONFIRMED
        receipt.save()

    @staticmethod
    def _update_product_cost(product, quantity, unit_cost):
        """
        Updates product cost price using Weighted Average Cost.
        Quantity and unit_cost MUST be in base units.
        """
        # Get current total stock across all warehouses (simplified)
        # Ideally we should use accurate stock at that moment.
        # Check if StockService has get_total_stock
        current_stock = Decimal('0')
        moves = StockMove.objects.filter(product=product)
        current_stock = moves.aggregate(total=models.Sum('quantity'))['total'] or Decimal('0')
        
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
        
        settings = AccountingSettings.objects.first()
        if not settings:
             raise ValidationError("No se encontró configuración contable.")
        
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
        
        # 1 & 2. Create Invoice Note and Journal Entry via BaseNoteService
        invoice, entry = BaseNoteService.create_document_note(
            order=order,
            note_type=note_type,
            amount_net=amount_net,
            amount_tax=amount_tax,
            document_number=document_number,
            document_attachment=document_attachment,
            partner_name=order.supplier.name
        )

        payable_account = order.supplier.account_payable or settings.default_payable_account
        if not payable_account:
            raise ValidationError("No se encontró cuenta por pagar para el proveedor.")
            
        if payable_account.account_type != AccountType.LIABILITY:
             # Fallback if the associated account is not a Liability (e.g. user assigned Receivable by mistake)
             if settings.default_payable_account and settings.default_payable_account.account_type == AccountType.LIABILITY:
                 payable_account = settings.default_payable_account
             else:
                 # If even default is wrong, warn but proceed? Or strict error? 
                 # Strict error is safer to prevent accounting mess.
                 raise ValidationError(f"La cuenta asignada ({payable_account.name}) no es de Pasivo. Verifique la configuración del proveedor.")

        stock_input_account = settings.stock_input_account or settings.default_inventory_account
        if not stock_input_account:
            raise ValidationError("No se encontró cuenta de entrada de stock.")

        # 2. Create Accounting Entry via Mapper
        description, reference, items = AccountingMapper.get_entries_for_purchase_order(order, settings)
        entry = JournalEntryService.create_entry(
            {
                'date': timezone.now().date(),
                'description': description,
                'reference': reference,
                'state': JournalEntry.State.DRAFT
            },
            items
        )

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

        # 6. Process Inventory Movements (for both NC and ND if return_items specified)
        if return_items:
            for item in return_items:
                product_id = item.get('product_id')
                quantity = Decimal(str(item.get('quantity', 0)))
                line_id = item.get('line_id')  
                
                if quantity <= 0:
                    continue
                
                # Find the purchase line
                if line_id:
                    purchase_line = order.lines.filter(id=line_id).first()
                else:
                    purchase_line = order.lines.filter(product_id=product_id).first()
                
                if not purchase_line:
                    raise ValidationError(f"No se encontró línea de compra para producto ID {product_id}")
                
                # For Credit Notes, validate quantity doesn't exceed purchased quantity
                if note_type == Invoice.DTEType.NOTA_CREDITO:
                    if quantity > purchase_line.quantity:
                        raise ValidationError(
                            f"Cantidad a devolver ({quantity}) excede la cantidad comprada ({purchase_line.quantity}) "
                            f"para {purchase_line.product.name}"
                        )
                    
                    # Validation: Cannot return more than received (Physical Return)
                    if quantity > purchase_line.quantity_received:
                         raise ValidationError(
                            f"No puede devolver {quantity} unidades de {purchase_line.product.name} porque solo se han recibido {purchase_line.quantity_received}. "
                            "Si desea anular la factura de items no recibidos, reduzca la cantidad de devolución."
                         )
                
                # Determine Warehouse
                warehouse = None
                for receipt in order.receipts.filter(status=PurchaseReceipt.Status.CONFIRMED):
                    receipt_line = receipt.lines.filter(purchase_line=purchase_line).first()
                    if receipt_line:
                        warehouse = receipt.warehouse
                        break
                
                if not warehouse:
                    warehouse = order.warehouse
                
                # Create Stock Move
                move_type = StockMove.Type.OUT if note_type == Invoice.DTEType.NOTA_CREDITO else StockMove.Type.IN
                move_qty = -quantity if note_type == Invoice.DTEType.NOTA_CREDITO else quantity
                
                StockMove.objects.create(
                    date=timezone.now().date(),
                    product=purchase_line.product,
                    warehouse=warehouse,
                    quantity=move_qty,
                    move_type=move_type,
                    description=f"{invoice.get_dte_type_display()} {document_number} (OC-{order.number})",
                    journal_entry=entry
                )
                
                # ACCOUNTING FOR INVENTORY RETURN
                # We need to reverse the Reception: Dr Stock Input (Liability), Cr Inventory (Asset)
                # This Dr Stock Input cancels the Cr Stock Input from the Financial Reversal (Step 4)
                
                inventory_account = purchase_line.product.get_asset_account or settings.default_inventory_account
                line_cost = (quantity * purchase_line.unit_cost).quantize(Decimal('0.01'), rounding='ROUND_HALF_UP')
                
                if line_cost > 0:
                    if note_type == Invoice.DTEType.NOTA_CREDITO:
                        # Credit Note = Return Goods
                        # Debit: Stock Input (Bridge) - Offsets the financial Credit
                        # Credit: Inventory (Asset) - Reduces stock value
                        JournalItem.objects.create(
                            entry=entry,
                            account=stock_input_account,
                            debit=line_cost,
                            credit=0,
                            label=f"Reverso Recepción (Devolución) - {purchase_line.product.code}"
                        )
                        JournalItem.objects.create(
                            entry=entry,
                            account=inventory_account,
                            debit=0,
                            credit=line_cost,
                            label=f"Baja de Inventario - {purchase_line.product.code}"
                        )
                    else:
                        # Debit Note = Receive Goods (Rare, usually price adjustment, but if qty > 0)
                        # Credit: Stock Input
                        # Debit: Inventory
                        JournalItem.objects.create(
                            entry=entry,
                            account=stock_input_account,
                            debit=0,
                            credit=line_cost,
                            label=f"Ajuste Recepción (Corrección) - {purchase_line.product.code}"
                        )
                        JournalItem.objects.create(
                            entry=entry,
                            account=inventory_account,
                            debit=line_cost,
                            credit=0,
                            label=f"Alta de Inventario - {purchase_line.product.code}"
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
        Only allowed for DRAFT receipts.
        """
        if receipt.status != PurchaseReceipt.Status.DRAFT:
            raise ValidationError("Solo se pueden eliminar recepciones en estado Borrador.")

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
    def annul_receipt(receipt: PurchaseReceipt):
        """
        Annuls a confirmed receipt:
        1. Reverses accounting entry.
        2. Creates reversal stock movements (OUT).
        3. Reverts received quantities on purchase lines.
        4. Marks receipt as CANCELLED.
        """
        if receipt.status != PurchaseReceipt.Status.CONFIRMED:
            raise ValidationError("Solo se pueden anular recepciones confirmadas.")

        # 1. Reverse Accounting
        if receipt.journal_entry:
             JournalEntryService.reverse_entry(receipt.journal_entry, description=f"Anulación Recepción {receipt.number}")

        # 2. Reverse Stock Moves & Update Purchase Lines
        from inventory.models import StockMove
        for line in receipt.lines.all():
            # Create Reversal Move (OUT)
            if line.stock_move:
                StockMove.objects.create(
                    date=timezone.now().date(),
                    product=line.product,
                    warehouse=receipt.warehouse,
                    quantity=-abs(line.stock_move.quantity), # Negative OUT
                    move_type=StockMove.Type.OUT,
                    description=f"Anulación Recepción {receipt.number} ({line.product.code})"
                )
            
            # Revert received quantity
            line.purchase_line.quantity_received -= line.quantity_received
            line.purchase_line.save()

        # 3. Update Receipt Status
        receipt.status = PurchaseReceipt.Status.CANCELLED
        receipt.save()
        
        # 4. Update Order Status
        PurchasingService._update_order_receiving_status(receipt.purchase_order)
        
        return receipt

    @staticmethod
    @transaction.atomic
    def annul_purchase_order(order: PurchaseOrder, force: bool = False):
        """
        Annuls a purchase order and all its associated documents (Invoices, Receipts, Payments).
        """
        if order.status == PurchaseOrder.Status.CANCELLED:
             return order

        from billing.models import Invoice
        from billing.services import BillingService
        from treasury.services import TreasuryService

        # 1. Annul Invoices (Bills)
        for invoice in order.invoices.all():
            if invoice.status != Invoice.Status.CANCELLED:
                 BillingService.annul_invoice(invoice, force=force)
        
        # 2. Annul Receipts
        for receipt in order.receipts.all():
            if receipt.status != PurchaseReceipt.Status.CANCELLED:
                 PurchasingService.annul_receipt(receipt)
        
        # 3. Annul stand-alone Payments
        for payment in order.payments.all():
            if payment.journal_entry and payment.journal_entry.state == 'POSTED':
                 TreasuryService.annul_payment(payment)

        order.status = PurchaseOrder.Status.CANCELLED
        order.save()
        return order

    @staticmethod
    @transaction.atomic
    def purchase_checkout(order_data, dte_type, document_number='', document_date=None, document_attachment=None,
                         payment_method='CREDIT', amount=None, treasury_account_id=None, transaction_number=None,
                         payment_is_pending=False, receipt_type='IMMEDIATE', receipt_data=None):
        """
        Complete Purchase checkout: Create Order -> Register Bill -> Payment -> Receipt.
        
        Args:
            order_data: dict with order info or {'id': existing_order_id}
            dte_type: 'BOLETA', 'FACTURA', 'FACTURA_EXENTA'
            document_number: Supplier's invoice number (folio)
            document_date: Invoice date
            document_attachment: File attachment
            payment_method: 'CASH', 'CARD', 'TRANSFER', 'CREDIT'
            amount: Payment amount (defaults to order total)
            treasury_account_id: Treasury account for payment
            transaction_number: Transaction reference
            payment_is_pending: Mark payment as pending validation
            receipt_type: 'IMMEDIATE', 'DEFERRED', 'PARTIAL'
            receipt_data: For partial receipts: {'line_data': [{'line_id': 1, 'quantity': 5}]}
        
        Returns:
            dict: {'order': order, 'invoice': invoice, 'payment': payment, 'receipt': receipt}
        """
        from purchasing.serializers import WritePurchaseOrderSerializer
        from treasury.services import TreasuryService
        from billing.services import BillingService
        from billing.models import Invoice
        
        # 1. Get or Create Purchase Order
        order = None
        if isinstance(order_data, str):
            import json
            order_data = json.loads(order_data)
        
        if 'id' in order_data:
            order = PurchaseOrder.objects.get(id=order_data['id'])
        else:
            order_serializer = WritePurchaseOrderSerializer(data=order_data)
            if not order_serializer.is_valid():
                raise ValidationError(order_serializer.errors)
            order = order_serializer.save()
        
        # Confirm order if still DRAFT
        if order.status == PurchaseOrder.Status.DRAFT:
            order.status = PurchaseOrder.Status.CONFIRMED
            order.save()
        
        # 2. Register Bill (Invoice)
        invoice_status = Invoice.Status.DRAFT if not document_number else Invoice.Status.POSTED
        invoice = BillingService.create_purchase_bill(
            order=order,
            supplier_invoice_number=document_number,
            dte_type=dte_type,
            document_attachment=document_attachment,
            date=document_date or timezone.now().date(),
            status=invoice_status
        )
        
        # 3. Register Payment (if not CREDIT)
        payment = None
        if payment_method != 'CREDIT':
            payment_amount = Decimal(str(amount)) if amount else order.total
            
            payment = TreasuryService.register_payment(
                amount=payment_amount,
                payment_type='OUTBOUND',
                payment_method=payment_method,
                reference=f"OC-{order.number}",
                partner=order.supplier,
                invoice=invoice,
                purchase_order=order,
                treasury_account_id=treasury_account_id,
                transaction_number=transaction_number,
                is_pending_registration=payment_is_pending
            )
        
        # 4. Receive Merchandise (if not DEFERRED)
        receipt = None
        warehouse = order.warehouse or Warehouse.objects.first()
        
        if receipt_type == 'IMMEDIATE':
            receipt = PurchasingService.receive_order(
                order=order,
                warehouse=warehouse,
                receipt_date=timezone.now().date(),
                delivery_reference=receipt_data.get('delivery_reference', '') if receipt_data else '',
                notes=receipt_data.get('notes', '') if receipt_data else ''
            )
        elif receipt_type == 'PARTIAL' and receipt_data:
            receipt = PurchasingService.partial_receive(
                order=order,
                warehouse=warehouse,
                line_data=receipt_data.get('line_data', []),
                receipt_date=receipt_data.get('receipt_date') or timezone.now().date(),
                delivery_reference=receipt_data.get('delivery_reference', ''),
                notes=receipt_data.get('notes', '')
            )
        # DEFERRED: No receipt created
        
        return {
            'order': order,
            'invoice': invoice,
            'payment': payment,
            'receipt': receipt
        }

    @staticmethod
    @transaction.atomic
    def delete_purchase_order(order: PurchaseOrder):
        """
        Deletes a purchase order, its invoices, and associated journal entries.
        Only allowed for DRAFT orders.
        """
        if order.status != PurchaseOrder.Status.DRAFT:
            raise ValidationError("Solo se pueden eliminar órdenes de compra en estado Borrador.")

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
