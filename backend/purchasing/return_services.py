from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils import timezone
from .models import PurchaseOrder, PurchaseReturn, PurchaseReturnLine
from accounting.models import JournalEntry, JournalItem, Account, AccountType
from accounting.services import JournalEntryService
from inventory.models import StockMove, Warehouse
from decimal import Decimal
from inventory.services import UoMService

class PurchaseReturnService:
    @staticmethod
    @transaction.atomic
    def annul_return(return_doc_id: int):
        """
        Annuls a return:
        1. Reverse Stock Moves.
        2. Set status to CANCELLED.
        """
        try:
            doc = PurchaseReturn.objects.get(id=return_doc_id)
        except PurchaseReturn.DoesNotExist:
            raise ValidationError("Devolución no encontrada.")
            
        if doc.status == PurchaseReturn.Status.CANCELLED:
            return doc
            
        # 1. Reverse Stock Moves
        for line in doc.lines.all():
            if line.stock_move:
                # Original was OUT (negative), so we create IN (positive)
                StockMove.objects.create(
                    date=timezone.now().date(),
                    product=line.product,
                    warehouse=doc.warehouse,
                    uom=line.stock_move.uom,
                    quantity=abs(line.stock_move.quantity), # Positive for IN
                    move_type=StockMove.Type.IN,
                    description=f"Anulación {doc.display_id}",
                    source_uom=line.stock_move.source_uom,
                    source_quantity=line.stock_move.source_quantity
                )
                
        doc.status = PurchaseReturn.Status.CANCELLED
        doc.save()
        return doc

    @staticmethod
    @transaction.atomic
    def create_return_from_note_request(
        order: PurchaseOrder,
        items: list, # [{'product_id': 1, 'quantity': 10, 'uom_id': 2}, ...]
        warehouse_id: int,
        date: str = None,
        notes: str = "",
        credit_note: 'Invoice' = None
    ) -> PurchaseReturn:
        """
        Creates a DRAFT PurchaseReturn from a Credit Note request.
        """
        if not date:
            date = timezone.now().date()
            
        try:
            warehouse = Warehouse.objects.get(id=warehouse_id)
        except Warehouse.DoesNotExist:
             raise ValidationError(f"Bodega con ID {warehouse_id} no existe.")
        
        # Create Return Header
        ret_doc = PurchaseReturn.objects.create(
            purchase_order=order,
            warehouse=warehouse,
            date=date,
            status=PurchaseReturn.Status.DRAFT,
            notes=notes,
            credit_note=credit_note
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

            # Create Line
            PurchaseReturnLine.objects.create(
                return_doc=ret_doc,
                product=product,
                quantity=quantity,
                uom_id=item.get('uom_id'), # Optional UoM
                unit_cost=item.get('unit_cost', product.cost_price) # Snapshot cost
            )

        # VALIDATION: Check total returned quantity against Credit Note limits (Purchase Side)
        if credit_note:
            for item in items:
                p_id = item['product_id']
                
                # 1. Get allocated qty in NC
                nc_qty = Decimal(0)
                if hasattr(credit_note, 'workflow') and credit_note.workflow and credit_note.workflow.selected_items:
                    for nc_item in credit_note.workflow.selected_items:
                        if nc_item['product_id'] == p_id:
                            nc_qty += Decimal(str(nc_item['quantity']))
                
                if nc_qty > 0:
                    # 2. Get total already returned
                    total_returned = Decimal(0)
                    linked_returns = PurchaseReturn.objects.filter(
                        credit_note=credit_note
                    ).exclude(status=PurchaseReturn.Status.CANCELLED)
                    
                    for ret in linked_returns:
                        for line in ret.lines.all():
                            if line.product_id == p_id:
                                total_returned += line.quantity
                    
                    if total_returned > nc_qty:
                         raise ValidationError(
                            f"La cantidad total a devolver ({total_returned}) excede la cantidad autorizada en la Nota de Crédito ({nc_qty}) para el producto ID {p_id}."
                        )
            
        ret_doc.save() # Trigger totals calc
        return ret_doc

    @staticmethod
    @transaction.atomic
    def confirm_return(return_doc: PurchaseReturn):
        """
        Confirms the Return:
        1. Generates Stock Moves (OUT).
        2. Generates Accounting Entry (Inventory Reversal).
        """
        if return_doc.status != PurchaseReturn.Status.DRAFT:
            return return_doc
            
        from accounting.models import AccountingSettings
        settings = AccountingSettings.objects.first()
        
        created_moves = []
        total_inventory_reversal = Decimal('0')
        
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
                 
                 # Create Stock Move (OUT) - Return to supplier
                 move = StockMove.objects.create(
                     date=return_doc.date,
                     product=product,
                     warehouse=return_doc.warehouse,
                     uom=product.uom,
                     quantity=-qty_base, # Negative for OUT move
                     move_type=StockMove.Type.OUT,
                     description=f"Devolución OCS-{return_doc.purchase_order.number}",
                     source_uom=line.uom or product.uom,
                     source_quantity=line.quantity
                 )
                 line.stock_move = move
                 line.save()
                 created_moves.append(move)
                 
                 # Inventory Reversal amount for this line
                 line_val = qty_base * line.unit_cost
                 total_inventory_reversal += line_val
        
        # 2. Accounting Entry (Bridge Reversal)
        # Standard flow for Purchase Return:
        # Credit Inventory (Asset decreases)
        # Debit Goods Received Not Billed / Bridge (Liability/Clearing decreases)
        if total_inventory_reversal > 0 and settings:
            bridge_account = settings.stock_input_account or settings.default_expense_account
            
            if bridge_account:
                entry = JournalEntryService.create_entry(
                    {
                        'date': return_doc.date,
                        'description': f"Devolución Física OCS-{return_doc.purchase_order.number} ({return_doc.display_id})",
                        'reference': return_doc.display_id,
                        'state': JournalEntry.State.DRAFT
                    },
                    [] # Items added below
                )
                
                # Debit Bridge
                JournalItem.objects.create(
                    entry=entry,
                    account=bridge_account,
                    debit=total_inventory_reversal,
                    credit=0,
                    label=f"Reverso Puente Recepción - {return_doc.display_id}"
                )
                
                # Credit Inventory per line (to maintain granular tracking if needed)
                for line in return_doc.lines.all():
                    product = line.product
                    if product.track_inventory:
                        inv_account = product.get_asset_account or settings.default_inventory_account
                        line_val = (UoMService.convert_quantity(line.quantity, line.uom or product.uom, product.uom) * line.unit_cost)
                        
                        if line_val > 0 and inv_account:
                            JournalItem.objects.create(
                                entry=entry,
                                account=inv_account,
                                debit=0,
                                credit=line_val,
                                label=f"Salida Stock: {product.name}"
                            )
                
                JournalEntryService.post_entry(entry)
                return_doc.journal_entry = entry

        return_doc.status = PurchaseReturn.Status.CONFIRMED
        return_doc.save()
        return return_doc
