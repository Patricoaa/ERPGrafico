from django.db import models, transaction
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
    def adjust_stock(product: Product, warehouse: Warehouse, quantity: Decimal, unit_cost: Decimal, description: str, adjustment_reason: str = None, uom: UoM = None):
        """
        Creates a Stock Move (Adjustment) and the corresponding Journal Entry.
        Handles cost ponderation for entries and uses specific accounts from AccountingSettings.
        """
        if quantity == 0:
            return None

        quantity_orig = quantity

        from accounting.models import AccountingSettings
        settings = AccountingSettings.objects.first()
        if not settings:
            raise ValidationError("No se encontró la configuración contable global.")

        # UoM Conversion Logic
        if uom and product.uom and uom != product.uom:
             # Validate compatibility
             if uom.category != product.uom.category:
                 raise ValidationError(f"La unidad {uom.name} no es compatible con la unidad base del producto {product.uom.name}")
             
             # Convert Quantity
             qty_in_base = StockService.convert_quantity(quantity, uom, product.uom)
             
             # Convert Unit Cost (Inverse of quantity conversion)
             # CostBase = CostInput * (QtyInput / QtyBase) ???
             # Total Value = QtyInput * CostInput
             # Total Value = QtyBase * CostBase
             # CostBase = (QtyInput * CostInput) / QtyBase
             # CostBase = (QtyInput * CostInput) / (QtyInput * Factor) = CostInput / Factor
             
             # Factor = FromRatio / ToRatio
             factor = Decimal(str(uom.ratio)) / Decimal(str(product.uom.ratio))
             cost_in_base = unit_cost / factor
             
             # Append to description for traceability
             description += f" (Conv: {quantity} {uom.name} @ {unit_cost})"
             
             # Reassign for processing
             quantity = qty_in_base
             unit_cost = cost_in_base

        # Validation: Negative Stock
        current_stock = product.qty_on_hand
        future_stock = current_stock + quantity
        
        # Allow negative stock ONLY if the system explicitly allows it (not implemented yet, so strict by default)
        # Note: 'quantity' is signed here. If it's an OUT move, quantity is negative.
        if future_stock < 0:
            raise ValidationError(f"No hay suficiente stock para realizar este ajuste. Stock actual: {current_stock}, Solicitado: {abs(quantity)}.")

        # Validation: Revaluation logic
        # Interpretation: Revaluation implies adjusting value of existing stock. 
        # If stock is 0, it should be 'INITIAL' or 'CORRECTION' not 'REVALUATION'.
        if adjustment_reason == StockMove.AdjustmentReason.REVALUATION and current_stock <= 0:
             raise ValidationError("No se puede realizar una revalorización sobre un stock nulo o negativo. Use 'Inventario Inicial' o 'Corrección'.")

        # 1. Logic for unit_cost and cost pondering
        if unit_cost is None or unit_cost == 0:
            if quantity > 0 and (product.cost_price == 0 or adjustment_reason == StockMove.AdjustmentReason.INITIAL):
                 raise ValidationError(f"Debe especificar un costo unitario para esta entrada de stock del producto {product.name}.")
            unit_cost = product.cost_price

        # Update product weighted average cost for entries
        if quantity > 0:
            old_qty = product.qty_on_hand
            old_cost = product.cost_price
            new_qty = old_qty + quantity
            
            if new_qty > 0:
                # Weighted Average Formula: (old_stock * old_cost + new_stock * new_cost) / total_stock
                # But only if new_qty > 0 to avoid division by zero
                # If we were at 0 or negative, the new unit_cost becomes the reference
                if old_qty <= 0:
                    product.cost_price = unit_cost
                else:
                    new_cost = ((old_qty * old_cost) + (quantity * unit_cost)) / new_qty
                    product.cost_price = new_cost.quantize(Decimal('0.01'))
                product.save()

        # 2. Create Stock Move
        move_type = StockMove.Type.ADJUSTMENT
        # Even if tagged as ADJ, we check direction for move_type logic if needed (though ADJ is valid)
        # We'll use ADJ but keep the direction in quantity
             
        move = StockMove.objects.create(
            date=timezone.now().date(),
            product=product,
            warehouse=warehouse,
            uom=product.uom,
            quantity=quantity,
            move_type=move_type,
            adjustment_reason=adjustment_reason,
            description=description,
            source_uom=uom or product.uom,
            source_quantity=quantity_orig,
            unit_cost=unit_cost  # Frozen at creation time
        )

        # 3. Accounting Logic
        asset_account = product.get_asset_account
        if not asset_account:
             raise ValidationError(f"El producto {product.name} (o su categoría) no tiene configurada una Cuenta de Activo.")

        # Determine Counterpart Account based on reason
        contra_account = None
        
        if adjustment_reason == StockMove.AdjustmentReason.INITIAL:
            contra_account = settings.initial_inventory_account
        elif adjustment_reason == StockMove.AdjustmentReason.REVALUATION:
            contra_account = settings.revaluation_account
        elif quantity > 0:
            # Gain/Sobrante
            contra_account = settings.adjustment_income_account or Account.objects.filter(account_type=AccountType.INCOME).first()
        else:
            # Loss/Merma
            contra_account = settings.adjustment_expense_account or Account.objects.filter(account_type=AccountType.EXPENSE).first()

        if not contra_account:
             raise ValidationError(f"No se encontró una cuenta de contrapartida configurada para el motivo: {adjustment_reason or 'Ajuste Genérico'}.")

        total_value = abs(quantity * unit_cost)

        entry = JournalEntry.objects.create(
            date=timezone.now().date(),
            description=f"Ajuste Stock {product.internal_code}: {description} ({adjustment_reason or 'Manual'})",
            reference=f"STK-{move.id}",
            state=JournalEntry.State.DRAFT
        )

        if quantity > 0:
            # Entry: Debit Asset, Credit Counterpart
            JournalItem.objects.create(entry=entry, account=asset_account, debit=total_value, credit=0, label=description)
            JournalItem.objects.create(entry=entry, account=contra_account, debit=0, credit=total_value, label=description)
        else:
            # Exit: Debit Counterpart, Credit Asset
            JournalItem.objects.create(entry=entry, account=contra_account, debit=total_value, credit=0, label=description)
            JournalItem.objects.create(entry=entry, account=asset_account, debit=0, credit=total_value, label=description)
            
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
        converted_qty = (quantity * from_uom.ratio) / to_uom.ratio
        
        # Apply rounding if to_uom has it
        if hasattr(to_uom, 'rounding') and to_uom.rounding:
            rounding = Decimal(str(to_uom.rounding))
            return converted_qty.quantize(rounding)
            
        return converted_qty

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
            return product.sale_price_gross or (product.sale_price * Decimal('1.19')).quantize(Decimal('1'))
            
        base_price = product.sale_price_gross or (product.sale_price * Decimal('1.19')).quantize(Decimal('1'))
        
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
                    if rule.fixed_price_gross is not None:
                        best_price = rule.fixed_price_gross
                    elif rule.fixed_price is not None:
                        best_price = (rule.fixed_price * Decimal('1.19')).quantize(Decimal('1'), rounding='ROUND_HALF_UP')
                elif rule.rule_type == PricingRule.RuleType.PACKAGE_FIXED:
                    # Package fixed price is also usually interpreted as Gross
                    p_price = rule.fixed_price_gross if rule.fixed_price_gross is not None else (rule.fixed_price * Decimal('1.19') if rule.fixed_price else None)
                    if p_price is not None:
                         # We need to return UNIT price, so we divide by quantity
                         if quantity > 0:
                             best_price = (p_price / quantity).quantize(Decimal('1'), rounding='ROUND_HALF_UP')
                         else:
                             best_price = p_price
                else:
                    if rule.discount_percentage is not None:
                        best_price = (base_price * (1 - (rule.discount_percentage / 100))).quantize(Decimal('1'), rounding='ROUND_HALF_UP')
                
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




class ProductService:
    @staticmethod
    def check_archiving_restrictions(product: Product):
        """
        Checks for dependencies that prevent archiving a product.
        Returns a list of dicts with {type, label, description, count, link} for feedback.
        """
        restrictions = []
        
        # 1. Stock
        on_hand = product.qty_on_hand
        if on_hand > 0:
            restrictions.append({
                'type': 'stock',
                'label': 'Stock Activo',
                'description': f'El producto tiene {on_hand} {product.uom.name if product.uom else ""} en inventario.',
                'action_hint': 'Ajuste el stock a cero para proceder.',
                'count': float(on_hand),
                'link': '/inventory/stock'
            })
            
        # 2. BOM as component
        from production.models import BillOfMaterialsLine
        bom_lines = BillOfMaterialsLine.objects.filter(component=product, bom__active=True)
        if bom_lines.exists():
            restrictions.append({
                'type': 'bom_component',
                'label': 'Componente de BOM',
                'description': f'Este producto es parte de {bom_lines.count()} Lista(s) de Materiales activa(s).',
                'action_hint': 'Elimine el producto de los BOMs o desactive los BOMs para proceder.',
                'count': bom_lines.count(),
                'link': '/production/boms'
            })
            
        # 3. BOM as finished product
        from production.models import BillOfMaterials
        boms = BillOfMaterials.objects.filter(product=product, active=True)
        if boms.exists():
            restrictions.append({
                'type': 'bom_parent',
                'label': 'Producto con BOM',
                'description': 'Este producto tiene una Lista de Materiales activa.',
                'action_hint': 'Desactive el BOM del producto para proceder.',
                'count': boms.count(),
                'link': '/production/boms'
            })
            
        # 4. Pending Work Orders
        from production.models import WorkOrder
        pending_ots = WorkOrder.objects.filter(
            models.Q(product=product) | models.Q(sale_line__product=product) | models.Q(materials__component=product),
            status__in=[WorkOrder.Status.DRAFT, WorkOrder.Status.PLANNED, WorkOrder.Status.IN_PROGRESS]
        ).distinct()
        if pending_ots.exists():
            restrictions.append({
                'type': 'work_order',
                'label': 'Órdenes de Trabajo Pendientes',
                'description': f'Hay {pending_ots.count()} OT(s) en proceso que requieren o fabrican este producto.',
                'action_hint': 'Finalice, cierre o anule las OTs pendientes para proceder.',
                'count': pending_ots.count(),
                'link': '/production/orders'
            })
            
        # 5. Pending Sale Orders
        from sales.models import SaleLine, SaleOrder
        pending_sales = SaleLine.objects.filter(
            product=product,
            order__status__in=[SaleOrder.Status.DRAFT, SaleOrder.Status.CONFIRMED]
        ).exclude(order__delivery_status=SaleOrder.DeliveryStatus.DELIVERED).distinct()
        if pending_sales.exists():
            restrictions.append({
                'type': 'sale_order',
                'label': 'Notas de Venta Pendientes',
                'description': f'Hay {pending_sales.count()} Nota(s) de Venta con despachos pendientes.',
                'action_hint': 'Complete los despachos o anule las Notas de Venta para proceder.',
                'count': pending_sales.count(),
                'link': '/billing/sales'
            })
            
        # 6. Pending Purchase Orders
        from purchasing.models import PurchaseLine, PurchaseOrder
        pending_purchases = PurchaseLine.objects.filter(
            product=product,
            order__status__in=[PurchaseOrder.Status.DRAFT, PurchaseOrder.Status.CONFIRMED]
        ).exclude(order__receiving_status=PurchaseOrder.ReceivingStatus.RECEIVED).distinct()
        if pending_purchases.exists():
            restrictions.append({
                'type': 'purchase_order',
                'label': 'Órdenes de Compra en Proceso',
                'description': f'Hay {pending_purchases.count()} Orden(es) de Compra pendientes de recepción.',
                'action_hint': 'Finalice las recepciones o anule las órdenes para proceder.',
                'count': pending_purchases.count(),
                'link': '/billing/purchases'
            })

        # 7. Active Subscriptions
        from .models import Subscription
        active_subs = Subscription.objects.filter(
            product=product, 
            status=Subscription.Status.ACTIVE
        )
        if active_subs.exists():
            restrictions.append({
                'type': 'subscription',
                'label': 'Suscripciones Activas',
                'description': f'Este producto tiene {active_subs.count()} suscripción(es) activa(s).',
                'action_hint': 'Pause o cancele las suscripciones para proceder.',
                'count': active_subs.count(),
                'link': '/subscriptions'
            })
            
        return restrictions
