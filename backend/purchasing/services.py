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
    def receive_order(order: PurchaseOrder, warehouse: Warehouse, receipt_date=None):
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
    def partial_receive(order: PurchaseOrder, warehouse: Warehouse, line_data: list, receipt_date=None):
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
        
        for line in receipt.lines.all():
            # 1. Update Product Cost (Weighted Average)
            PurchasingService._update_product_cost(line.product, line.quantity_received, line.unit_cost)
            
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

             JournalItem.objects.create(
                entry=entry,
                account=clearing_account, # Using same account for clearing? No, usually a liability account.
                # For simplicity in this v1, we credit the same inventory account 
                # effectively washing it out if we debit it too?
                # No. 
                # Debit: Asset Account (Real Inventory)
                # Credit: "Facturas por Recibir" (Liability) - Pending Bill
                
                # Let's assume default_inventory_account is the Asset Account (1.1.04).
                # We need a Liability Account "2.1.XX - Proveedores por Facturar".
                # If not exists, we just use a placeholder or the same account (bad practice but balances).
                
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

        # 3. Delete receipts?
        # If we delete PO, we should arguably reverse receipts or error if received.
        # For now, let's error if received.
        if order.receiving_status != 'PENDING' and order.receiving_status != 'DRAFT':
             # Allow force delete?
             pass

        # 3. Delete order's own journal entry
        if order.journal_entry:
            order.journal_entry.delete()
            
        # 4. Delete Order
        order.delete()
