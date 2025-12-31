from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils import timezone
from .models import PurchaseOrder, PurchaseOrder
from accounting.models import JournalEntry, JournalItem, Account, AccountType
from accounting.services import JournalEntryService
from inventory.services import StockService
from decimal import Decimal

class PurchasingService:
    @staticmethod
    @transaction.atomic
    def receive_order(order: PurchaseOrder):
        """
        Receives a PO:
        1. Updates Order Status to RECEIVED.
        2. Increases Stock for each line (via StockService).
        3. Creates Accounting Entry for Accounts Payable.
           Debit: Asset/Expense (handled by StockService? No, StockService handles Stock Move accounting)
           
           *Correction*: StockService.adjust_stock usually handles Debit Asset / Credit Adjustment.
           Here we want Debit Asset / Credit AP.
           
           Strategy:
           We will manually call StockMoves for inventory tracking, but we might want to override the accounting
           OR separate the accounting. 
           
           For this System v1:
           We will let StockService handle the `Input` (Debit Asset, Credit 'Adjustment').
           Then we do a Reclass or we just implement specific logic here.
           
           Better Approach for `receive_order`:
           Do NOT use `StockService.adjust_stock` for accounting. Use it only for creating the Move record if possible,
           or replicate logic to ensure specific accounts (Credit AP).
           
           Let's replicate logic lightly to allow custom Credit Account (AP).
        """
        if order.status != PurchaseOrder.Status.CONFIRMED:
            raise ValidationError("Solo se pueden recibir órdenes confirmadas.")

        # 1. Update Status
        order.status = PurchaseOrder.Status.RECEIVED
        order.save()

        # 2. Prepare master Journal Entry
        entry = JournalEntry.objects.create(
            date=timezone.now().date(),
            description=f"Recepción OC-{order.number} - {order.supplier.name}",
            reference=f"OC-{order.number}",
            state=JournalEntry.State.DRAFT
        )

        total_payable = Decimal('0.00')

        # 3. Process Lines
        for line in order.lines.all():
            quantity = line.quantity
            cost = line.unit_cost
            total_line = line.subtotal
            
            # A. Inventory Move
            # We use StockService to create the move, but we might need to patch it to NOT create a Journal Entry
            # or we create the move manually here to control links.
            # Let's create manually for full control.
            
            from inventory.models import StockMove
            move = StockMove.objects.create(
                date=timezone.now().date(),
                product=line.product,
                warehouse=order.warehouse,
                quantity=quantity,
                move_type=StockMove.Type.IN,
                description=f"Recepción OC-{order.number}",
                journal_entry=entry # Link to this big entry
            )
            
            # B. Accounting Debits (Asset/Expense)
            asset_account = line.product.get_asset_account
            if not asset_account:
                 raise ValidationError(f"El producto {line.product.name} no tiene cuenta de activo configurada.")

            JournalItem.objects.create(
                entry=entry,
                account=asset_account,
                debit=total_line,
                credit=0,
                label=f"{line.product.code} x {quantity}"
            )
            
            total_payable += total_line

        # 4. Accounting Credit (Inventory Clearing / Received Not Billed)
        from accounting.models import AccountingSettings
        settings = AccountingSettings.objects.first()
        
        # We use the inventory account as a clearing account for now if not specific clearing defined
        # In a real ERP there is a specific 'Stock Input' account.
        clearing_account = settings.default_inventory_account 

        if not clearing_account:
             raise ValidationError("Debe configurar la cuenta de inventario para la recepción.")
              
        JournalItem.objects.create(
            entry=entry,
            account=clearing_account,
            debit=0,
            credit=total_payable, # Net amount only for clearing
            label=f"Provisión Recepción OC-{order.number}"
        )
        
        # NOTE: Tax and AP move to BillingService.create_purchase_bill
        
        # Post
        JournalEntryService.post_entry(entry)
        
        order.journal_entry = entry
        order.save()

        return order
