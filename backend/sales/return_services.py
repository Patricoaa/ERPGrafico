from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils import timezone
from .models import SaleOrder, SaleReturn, SaleReturnLine
from accounting.models import JournalEntry, JournalItem, Account, AccountType
from accounting.services import JournalEntryService
from inventory.models import StockMove, Warehouse
from decimal import Decimal
from inventory.services import UoMService

class ReturnService:
    @staticmethod
    @transaction.atomic
    def annul_return(return_doc_id: int):
        """
        Annuls a return:
        1. Reverse/Cancel Accounting Entry.
        2. Reverse/Cancel Stock Moves.
        3. Set status to CANCELLED.
        """
        try:
            doc = SaleReturn.objects.get(id=return_doc_id)
        except SaleReturn.DoesNotExist:
            raise ValidationError("Devolución no encontrada.")
            
        if doc.status == SaleReturn.Status.CANCELLED:
            return doc
            
        # 1. Reverse Accounting
        if doc.journal_entry:
            JournalEntryService.reverse_entry(doc.journal_entry, description=f"Anulación {doc.display_id}")
            
        # 2. Reverse Stock Moves (Create opposite moves)
        for line in doc.lines.all():
            if line.stock_move:
                # Original was IN, so we create OUT
                StockMove.objects.create(
                    date=timezone.now().date(),
                    product=line.product,
                    warehouse=doc.warehouse,
                    uom=line.stock_move.uom,
                    quantity=abs(line.stock_move.quantity) * -1, # Negative for OUT
                    move_type=StockMove.Type.OUT,
                    description=f"Anulación {doc.display_id}",
                    source_uom=line.stock_move.source_uom,
                    source_quantity=line.stock_move.source_quantity
                )
                
        doc.status = SaleReturn.Status.CANCELLED
        doc.save()
        return doc

    @staticmethod
    @transaction.atomic
    def create_return_from_note_request(
        order: SaleOrder,
        items: list, # [{'product_id': 1, 'quantity': 10, 'uom_id': 2}, ...]
        warehouse_id: int,
        date: str = None,
        notes: str = ""
    ) -> SaleReturn:
        """
        Creates a DRAFT SaleReturn from a Credit Note request (or standalone return).
        """
        if not date:
            date = timezone.now().date()
            
        try:
            warehouse = Warehouse.objects.get(id=warehouse_id)
        except Warehouse.DoesNotExist:
             raise ValidationError(f"Bodega con ID {warehouse_id} no existe.")
        
        # Create Return Header
        ret_doc = SaleReturn.objects.create(
            sale_order=order,
            warehouse=warehouse,
            date=date,
            status=SaleReturn.Status.DRAFT,
            notes=notes
        )
        
        # Create Return Lines
        for item in items:
            product_id = item['product_id']
            quantity = Decimal(str(item['quantity']))
            
            if quantity <= 0: continue
            
            # Find matching Product
            from inventory.models import Product
            try:
                product = Product.objects.get(id=product_id)
            except Product.DoesNotExist:
                continue

            # TRY TO FIND ORIGINAL COST (from last successful delivery of this product in this order)
            # This ensures accounting reversal uses the cost at sale time, not current WAC.
            from sales.models import SaleDeliveryLine
            original_delivery_line = SaleDeliveryLine.objects.filter(
                delivery__sale_order=order,
                product=product,
                delivery__status='CONFIRMED'
            ).order_by('-delivery__delivery_date', '-id').first()
            
            original_cost = original_delivery_line.unit_cost if original_delivery_line else product.cost_price

            # Create Line
            SaleReturnLine.objects.create(
                return_doc=ret_doc,
                product=product,
                quantity=quantity,
                uom_id=item.get('uom_id'), # Optional UoM
                unit_price=item.get('unit_price', 0), # Optional reference
                unit_cost=original_cost # Snapshot ORIGINAL cost
            )
            
        ret_doc.save() # Trigger totals calc
        return ret_doc

    @staticmethod
    @transaction.atomic
    def confirm_return(return_doc: SaleReturn):
        """
        Confirms the Return:
        1. Generates Stock Moves (IN).
        2. Generates Accounting Entry (COGS Reversal).
        """
        if return_doc.status != SaleReturn.Status.DRAFT:
            return return_doc
            
        from accounting.models import AccountingSettings
        settings = AccountingSettings.objects.first()
        
        created_moves = []
        total_cogs_reversal = Decimal('0')
        
        # 1. Stock Moves
        for line in return_doc.lines.all():
            product = line.product
            if product.track_inventory:
                # Convert to base UoM
                qty_base = UoMService.convert_quantity(
                    line.quantity, 
                    from_uom=line.uom or product.uom, 
                    to_uom=product.uom
                )
                
                # Create Stock Move (IN)
                move = StockMove.objects.create(
                    date=return_doc.date,
                    product=product,
                    warehouse=return_doc.warehouse,
                    uom=product.uom,
                    quantity=qty_base,
                    move_type=StockMove.Type.IN,
                    description=f"Devolución NV-{return_doc.sale_order.number}",
                    source_uom=line.uom or product.uom,
                    source_quantity=line.quantity
                )
                line.stock_move = move
                line.save()
                created_moves.append(move)
                
                # COGS Reversal amount for this line (Using original unit_cost from the return line)
                line_cogs = qty_base * line.unit_cost
                total_cogs_reversal += line_cogs
        
        # 2. Accounting Entry (COGS Reversal)
        if total_cogs_reversal > 0 and settings:
            entry = JournalEntry.objects.create(
                date=return_doc.date,
                description=f"Reverso COGS - {return_doc.display_id}",
                reference=return_doc.display_id,
                state=JournalEntry.State.DRAFT
            )
            
            inv_acc = settings.default_inventory_account
            cogs_acc = (settings.stock_input_account or 
                        settings.merchandise_cogs_account or 
                        settings.default_expense_account)
            
            if inv_acc and cogs_acc:
                # Debit Inventory (Asset increases)
                JournalItem.objects.create(
                    entry=entry,
                    account=inv_acc,
                    debit=total_cogs_reversal,
                    credit=0,
                    label=f"Reingreso Stock - {return_doc.display_id}"
                )
                # Credit COGS (Expense decreases)
                JournalItem.objects.create(
                    entry=entry,
                    account=cogs_acc,
                    debit=0,
                    credit=total_cogs_reversal,
                    label=f"Reverso Costo Venta"
                )
                
                JournalEntryService.post_entry(entry)
                return_doc.journal_entry = entry
                
                # Link moves
                for m in created_moves:
                    m.journal_entry = entry
                    m.save()

        return_doc.status = SaleReturn.Status.CONFIRMED
        return_doc.save()
        return return_doc
