from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils import timezone
from .models import Product, Warehouse, StockMove
from accounting.models import JournalEntry, JournalItem, Account, AccountType
from accounting.services import JournalEntryService
from decimal import Decimal

class StockService:
    @staticmethod
    @transaction.atomic
    def adjust_stock(product: Product, warehouse: Warehouse, quantity: Decimal, unit_cost: Decimal, description: str):
        """
        Creates a Stock Move (Adjustment) and the corresponding Journal Entry.
        
        IN (Positive Qty):
            Debit: Asset (Stock)
            Credit: Income/Adjustment Account (e.g., Initial Inventory or Gain)
        
        OUT (Negative Qty):
            Debit: Expense (Loss/COGS)
            Credit: Asset (Stock)
        """
        
        if quantity == 0:
            return None

        # 1. Create Stock Move
        move_type = StockMove.Type.ADJUSTMENT
        if quantity > 0:
             move_type = StockMove.Type.IN
        elif quantity < 0:
             move_type = StockMove.Type.OUT
             
        move = StockMove.objects.create(
            date=timezone.now().date(),
            product=product,
            warehouse=warehouse,
            quantity=quantity,
            move_type=move_type,
            description=description
        )

        # 2. Accounting Logic
        asset_account = product.get_asset_account
        if not asset_account:
             raise ValidationError(f"El producto {product.name} (o su categoría) no tiene configurada una Cuenta de Activo.")

        # Determine Counterpart Account
        # For simplicity, we assume a generic "Inventory Adjustment" account if not specified
        # In a real scenario, this might come from a 'Reason' code or settings.
        try:
             # Default Adjustment Account (Income/Expense depending on sign)
             # Logic: If Gain -> Income (Credit). If Loss -> Expense (Debit).
             if quantity > 0:
                 contra_account = Account.objects.filter(account_type=AccountType.INCOME).first() # TODO: Fix
             else:
                 contra_account = Account.objects.filter(account_type=AccountType.EXPENSE).first() # TODO: Fix
        except:
             raise ValidationError("No se encontró cuenta de contrapartida para ajuste.")

        total_value = abs(quantity * unit_cost)

        entry = JournalEntry.objects.create(
            date=timezone.now().date(),
            description=f"Ajuste Stock {product.code}: {description}",
            reference=f"STK-{move.id}",
            state=JournalEntry.State.DRAFT
        )

        if quantity > 0:
            # Debit Asset, Credit Income
            JournalItem.objects.create(entry=entry, account=asset_account, debit=total_value, credit=0)
            JournalItem.objects.create(entry=entry, account=contra_account, debit=0, credit=total_value)
        else:
            # Debit Expense, Credit Asset
            JournalItem.objects.create(entry=entry, account=contra_account, debit=total_value, credit=0)
            JournalItem.objects.create(entry=entry, account=asset_account, debit=0, credit=total_value)
            
        JournalEntryService.post_entry(entry)
        
        move.journal_entry = entry
        move.save()
        
        return move
