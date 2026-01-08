from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils import timezone
from django.db.models import Q
from .models import Product, Warehouse, StockMove, PricingRule, UoM
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

    @staticmethod
    def convert_quantity(quantity: Decimal, from_uom, to_uom) -> Decimal:
        """
        Converts quantity from one UoM to another.
        """
        if not from_uom or not to_uom:
            return quantity
            
        if from_uom == to_uom:
            return quantity
            
        if from_uom.category_id != to_uom.category_id:
             # Fallback or error? For now we will assume if categories match we convert, else we might return as is or error
             # But models constraints should prevent this.
             if from_uom.category != to_uom.category:
                raise ValidationError(f"No se puede convertir de {from_uom.name} a {to_uom.name} (Categorías distintas)")
        
        # Conversion: Qty * (FromRatio / ToRatio)
        # 1 Box (12) -> Unit (1). 1.0 * (12.0 / 1.0) = 12.0
        # 1 Unit (1) -> Box (12). 1.0 * (1.0 / 12.0) = 0.0833
        

        return (quantity * from_uom.ratio) / to_uom.ratio

class PricingService:
    @staticmethod
    def get_product_price(product: Product, quantity: Decimal, date=None, uom: UoM = None) -> Decimal:
        """
        Calculates the best price for a product given a quantity, date and specific UoM.
        """
        if date is None:
            date = timezone.now().date()
        
        if uom is None:
            uom = product.uom if hasattr(product, 'uom') else None
            
        if uom is None:
            # If still no UoM, we can't do advanced pricing rules that depend on it
            return product.sale_price
            
        base_price = product.sale_price
        
        # Find active rules
        rules = PricingRule.objects.filter(
            active=True
        ).filter(
            Q(start_date__isnull=True) | Q(start_date__lte=date)
        ).filter(
            Q(end_date__isnull=True) | Q(end_date__gte=date)
        ).filter(
            Q(product=product) | Q(category=product.category)
        ).order_by('-priority')
        
        best_price = base_price
        
        for rule in rules:
            # Convert objective quantity to rule's UoM if specified
            # Otherwise we use the provided quantity as is (assuming it's in product.uom if not specified)
            check_qty = quantity
            if rule.uom:
                 try:
                    # Convert from provided UoM to Rule UoM
                    check_qty = StockService.convert_quantity(quantity, uom, rule.uom)
                 except ValidationError:
                    # If conversion fails (different categories), skip this rule
                    continue
            else:
                # If rule doesn't specify UoM, we assume it's in the product's base UoM
                # So we convert the provided quantity to base UoM
                if uom != product.uom:
                    try:
                        check_qty = StockService.convert_quantity(quantity, uom, product.uom)
                    except ValidationError:
                        continue

            # Check if quantity satisfies the rule operator
            matches = False
            op = rule.operator
            min_q = rule.min_quantity
            max_q = rule.max_quantity

            if op == PricingRule.Operator.GE:
                matches = check_qty >= min_q
            elif op == PricingRule.Operator.GT:
                matches = check_qty > min_q
            elif op == PricingRule.Operator.LE:
                matches = check_qty <= min_q
            elif op == PricingRule.Operator.LT:
                matches = check_qty < min_q
            elif op == PricingRule.Operator.EQ:
                matches = check_qty == min_q
            elif op == PricingRule.Operator.BT:
                if max_q is not None:
                    matches = min_q <= check_qty <= max_q
                else:
                    matches = check_qty >= min_q # Fallback if max is null
            
            if matches:
                # Calculate price
                if rule.rule_type == PricingRule.RuleType.FIXED:
                    if rule.fixed_price is not None:
                        # If rule has a UoM, the fixed price might be per that UoM?
                        # Usually sale prices are per product.uom. 
                        # If the rule defines a price, it's usually what the user sees for the line.
                        # However, if we store base price we might need to adjust.
                        # For now, we assume the fixed price is the price per UNIT (product.uom)
                        # but triggered by the rule's measure.
                        best_price = rule.fixed_price
                else:
                    if rule.discount_percentage is not None:
                        best_price = base_price * (1 - (rule.discount_percentage / 100))
                
                # Rule applied, stop (rules are ordered by priority)
                break
            
        return best_price
