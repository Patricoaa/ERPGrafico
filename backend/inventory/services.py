from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils import timezone
from django.db.models import Q, QuerySet
from .models import Product, Warehouse, StockMove, PricingRule, UoM
from accounting.models import JournalEntry, JournalItem, Account, AccountType
from accounting.services import JournalEntryService
from decimal import Decimal
from typing import Tuple, Optional

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

class UoMService:
    """
    Servicio centralizado para gestión de Unidades de Medida (UoM).
    
    Proporciona funcionalidades de:
    - Conversión entre unidades de la misma categoría
    - Validación de compatibilidad de UoMs
    - Obtención de UoMs permitidos según contexto
    - Formateo inteligente de cantidades para display
    """
    
    @staticmethod
    def convert_quantity(qty: Decimal, from_uom: UoM, to_uom: UoM) -> Decimal:
        """
        Convierte cantidad entre UoMs de la misma categoría.
        
        Args:
            qty: Cantidad en unidad origen
            from_uom: UoM origen
            to_uom: UoM destino
            
        Returns:
            Cantidad convertida en unidad destino
            
        Raises:
            ValidationError: Si las UoMs son de categorías diferentes
            
        Examples:
            >>> convert_quantity(Decimal('1.5'), kg_uom, g_uom)
            Decimal('1500')
            >>> convert_quantity(Decimal('2'), rollo_uom, metro_uom)  # 1 rollo = 50m
            Decimal('100')
        """
        if not UoMService.validate_uom_compatibility(from_uom, to_uom):
            raise ValidationError(
                f"No se puede convertir de '{from_uom.name}' ({from_uom.category.name}) "
                f"a '{to_uom.name}' ({to_uom.category.name}). "
                f"Las unidades deben pertenecer a la misma categoría."
            )
        
        # Si son la misma UoM, no hay conversión
        if from_uom.id == to_uom.id:
            return qty
        
        # Conversión usando ratios
        # Fórmula: qty_to = qty_from * (ratio_from / ratio_to)
        # Ejemplo: 1.5 kg a g -> 1.5 * (1.0 / 0.001) = 1500 g
        from_ratio = Decimal(str(from_uom.ratio))
        to_ratio = Decimal(str(to_uom.ratio))
        
        if to_ratio == 0:
            raise ValidationError(f"La UoM '{to_uom.name}' tiene un ratio inválido (0).")
        
        converted_qty = qty * (from_ratio / to_ratio)
        
        # Aplicar redondeo de la UoM destino
        rounding = Decimal(str(to_uom.rounding))
        return converted_qty.quantize(rounding)
    
    @staticmethod
    def validate_uom_compatibility(uom1: UoM, uom2: UoM) -> bool:
        """
        Valida que dos UoMs pertenezcan a la misma categoría.
        
        Args:
            uom1: Primera UoM
            uom2: Segunda UoM
            
        Returns:
            True si son compatibles (misma categoría), False en caso contrario
        """
        return uom1.category_id == uom2.category_id
    
    @staticmethod
    def get_allowed_uoms_for_context(product: Product, context: str) -> QuerySet:
        """
        Retorna UoMs permitidos según contexto.
        
        Args:
            product: Producto para el cual obtener UoMs
            context: Contexto de uso ('sale', 'purchase', 'bom', 'stock')
            
        Returns:
            QuerySet de UoMs permitidos
            
        Context behaviors:
            - 'sale': uom base + allowed_sale_uoms (restrictivo)
            - 'purchase': TODA la categoría del uom base (flexible)
            - 'bom': TODA la categoría del uom base (flexible)
            - 'stock': solo uom base
        """
        if not product.uom:
            return UoM.objects.none()
        
        if context == 'stock':
            # Solo la unidad base
            return UoM.objects.filter(id=product.uom.id)
        
        elif context == 'sale':
            # Base + allowed_sale_uoms (restrictivo)
            allowed_ids = [product.uom.id]
            allowed_ids.extend(product.allowed_sale_uoms.values_list('id', flat=True))
            return UoM.objects.filter(id__in=allowed_ids, active=True)
        
        elif context in ['purchase', 'bom']:
            # Toda la categoría (flexible)
            return UoM.objects.filter(
                category=product.uom.category,
                active=True
            ).order_by('ratio')
        
        else:
            raise ValueError(f"Contexto inválido: '{context}'. Use: 'sale', 'purchase', 'bom', o 'stock'")
    
    @staticmethod
    def get_smart_display_uom(qty: Decimal, base_uom: UoM) -> Tuple[Decimal, UoM]:
        """
        Determina la mejor UoM para mostrar una cantidad.
        
        Lógica:
        1. Si qty >= 1 en base_uom -> retorna (qty, base_uom)
        2. Si qty < 1 -> busca UoM más pequeño donde qty >= 1
        3. Si no encuentra -> retorna (qty, base_uom) en decimales
        
        Args:
            qty: Cantidad en unidad base
            base_uom: UoM base del producto
            
        Returns:
            Tupla (cantidad_convertida, uom_display)
            
        Examples:
            >>> get_smart_display_uom(Decimal('0.5'), kg_uom)
            (Decimal('500'), g_uom)
            >>> get_smart_display_uom(Decimal('100'), kg_uom)
            (Decimal('100'), kg_uom)
        """
        # Si qty >= 1, usar la unidad base
        if qty >= 1:
            return (qty, base_uom)
        
        # Buscar UoMs más pequeños de la misma categoría
        smaller_uoms = UoM.objects.filter(
            category=base_uom.category,
            ratio__lt=base_uom.ratio,
            active=True
        ).order_by('-ratio')  # De mayor a menor (más cercano a base primero)
        
        for smaller_uom in smaller_uoms:
            try:
                converted_qty = UoMService.convert_quantity(qty, base_uom, smaller_uom)
                # Si la cantidad convertida es >= 1, usar esta UoM
                if converted_qty >= 1:
                    return (converted_qty, smaller_uom)
            except ValidationError:
                continue
        
        # Fallback: retornar en base con decimales
        return (qty, base_uom)
    
    @staticmethod
    def format_quantity_display(qty: Decimal, base_uom: UoM, smart_convert: bool = True) -> str:
        """
        Formatea cantidad con unidad para display.
        
        Args:
            qty: Cantidad en unidad base
            base_uom: UoM base del producto
            smart_convert: Si True, convierte cantidades < 1 a unidad menor
            
        Returns:
            String formateado con cantidad y unidad
            
        Examples:
            >>> format_quantity_display(Decimal('100'), kg_uom)
            '100 kg'
            >>> format_quantity_display(Decimal('0.5'), kg_uom, smart_convert=True)
            '500 g'
            >>> format_quantity_display(Decimal('0.5'), kg_uom, smart_convert=False)
            '0.5 kg'
        """
        if smart_convert and qty < 1:
            display_qty, display_uom = UoMService.get_smart_display_uom(qty, base_uom)
        else:
            display_qty, display_uom = qty, base_uom
        
        # Formatear cantidad (eliminar ceros innecesarios)
        qty_str = str(display_qty.normalize())
        
        return f"{qty_str} {display_uom.name}"
    
    @staticmethod
    def get_conversion_hint(qty: Decimal, from_uom: UoM, to_uom: UoM) -> str:
        """
        Genera un hint de conversión para mostrar al usuario.
        
        Args:
            qty: Cantidad en unidad origen
            from_uom: UoM origen
            to_uom: UoM destino (típicamente la base)
            
        Returns:
            String con hint de conversión
            
        Example:
            >>> get_conversion_hint(Decimal('2'), rollo_uom, metro_uom)
            '2 Rollos = 100 Metros (stock)'
        """
        if from_uom.id == to_uom.id:
            return ""
        
        try:
            converted_qty = UoMService.convert_quantity(qty, from_uom, to_uom)
            from_str = f"{qty.normalize()} {from_uom.name}"
            to_str = f"{converted_qty.normalize()} {to_uom.name}"
            return f"{from_str} = {to_str} (stock)"
        except ValidationError:
            return ""

