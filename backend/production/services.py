from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils import timezone
from .models import WorkOrder, ProductionConsumption
from accounting.models import JournalEntry, JournalItem, Account, AccountType
from accounting.services import JournalEntryService
from inventory.models import StockMove
from inventory.services import StockService # Use adjust_stock if possible, or replicate
from decimal import Decimal

class ProductionService:
    @staticmethod
    @transaction.atomic
    def consume_material(work_order: WorkOrder, product, warehouse, quantity: Decimal):
        """
        Records consumption of material for a Work Order.
        1. Creates ProductionConsumption record.
        2. Creates Stock Move (OUT).
        3. Creates Accounting Entry (Debit Cost/Expense, Credit Asset).
        """
        
        if quantity <= 0:
            raise ValidationError("La cantidad debe ser mayor a 0.")

        # 1. Create Stock Move (OUT)
        # We manually create it to link it specifically or use StockService if it allows custom links.
        # StockService.adjust_stock creates a JE for "Adjustment".
        # Here we want a JE for "Production Cost".
        # So we better create manually or enhance StockService.
        # Decisions: Create manually here for precision in this MVP.

        move = StockMove.objects.create(
            date=timezone.now().date(),
            product=product,
            warehouse=warehouse,
            quantity=-quantity, # Negative for OUT
            move_type=StockMove.Type.OUT,
            description=f"Consumo OT-{work_order.number}",
        )
        
        # 2. Accounting
        cost_price = product.cost_price # Estimated cost
        total_cost = quantity * cost_price

        entry = JournalEntry.objects.create(
            date=timezone.now().date(),
            description=f"Consumo Material OT-{work_order.number} - {product.name}",
            reference=f"OT-{work_order.number}",
            state=JournalEntry.State.DRAFT
        )

        # Debit: Cost of Production (Expense)
        # Try to find a specific Cost account, else generic Expense
        try:
             cost_account = Account.objects.get(code='5.1.01') # Example: Costo de Ventas / Prod
        except:
             cost_account = product.get_expense_account or Account.objects.filter(account_type=AccountType.EXPENSE).first()

        # Credit: Asset (Raw Material)
        asset_account = product.get_asset_account
        
        if not asset_account or not cost_account:
             raise ValidationError("Faltan cuentas contables (Activo o Costo) para el producto.")

        JournalItem.objects.create(
            entry=entry,
            account=cost_account,
            debit=total_cost,
            credit=0,
            label=f"Consumo {product.name}"
        )

        JournalItem.objects.create(
            entry=entry,
            account=asset_account,
            debit=0,
            credit=total_cost
        )
        
        JournalEntryService.post_entry(entry)
        
        # Link move to entry
        move.journal_entry = entry
        move.save()

        # 3. Create Consumption Record
        consumption = ProductionConsumption.objects.create(
            work_order=work_order,
            product=product,
            warehouse=warehouse,
            quantity=quantity,
            stock_move=move
        )
        
        return consumption
