from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils import timezone
from .models import WorkOrder, ProductionConsumption, BillOfMaterials
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

    @staticmethod
    @transaction.atomic
    def create_work_order_from_sale(sale_line):
        """
        Creates a Work Order in DRAFT status from a sale line with a MANUFACTURABLE product.
        Auto-fills specifications with product data.
        """
        product = sale_line.product
        
        if not product or product.product_type != 'MANUFACTURABLE':
            raise ValidationError("Solo se pueden crear OT para productos fabricables.")
        
        # Build specifications from product data
        specs_parts = [
            f"Producto: {product.name} ({product.code})",
            f"Cantidad: {sale_line.quantity}",
            f"Precio Unitario: ${sale_line.unit_price}",
        ]
        
        # Add BOM info if available
        active_bom = BillOfMaterials.objects.filter(product=product, active=True).first()
        if active_bom:
            specs_parts.append(f"\nBOM: {active_bom.name}")
            specs_parts.append("Componentes:")
            for line in active_bom.lines.all():
                specs_parts.append(f"  - {line.component.code}: {line.quantity} {line.unit}")
        
        specifications = "\n".join(specs_parts)
        
        # Create Work Order
        work_order = WorkOrder.objects.create(
            description=f"{product.name} - NV-{sale_line.order.number}",
            sale_order=sale_line.order,
            sale_line=sale_line,
            status=WorkOrder.Status.DRAFT,
            specifications=specifications,
            estimated_completion_date=None  # Can be calculated based on business rules
        )
        
        return work_order
    
    @staticmethod
    @transaction.atomic
    def consume_materials_from_bom(work_order: WorkOrder, warehouse, multiplier: Decimal = Decimal('1.0')):
        """
        Consumes materials based on the BOM of the product associated with the work order.
        
        Args:
            work_order: The work order to consume materials for
            warehouse: The warehouse to consume from
            multiplier: Quantity multiplier (e.g., if producing 10 units, multiplier=10)
        
        Returns:
            List of ProductionConsumption records created
        """
        if not work_order.sale_line or not work_order.sale_line.product:
            raise ValidationError("La orden de trabajo debe estar asociada a una línea de venta con producto.")
        
        product = work_order.sale_line.product
        
        if product.product_type != 'MANUFACTURABLE':
            raise ValidationError("El producto debe ser fabricable.")
        
        # Get active BOM
        active_bom = BillOfMaterials.objects.filter(product=product, active=True).first()
        
        if not active_bom:
            raise ValidationError(f"No hay BOM activo para el producto {product.name}.")
        
        if not active_bom.lines.exists():
            raise ValidationError(f"El BOM {active_bom.name} no tiene componentes definidos.")
        
        consumptions = []
        
        # Consume each component
        for bom_line in active_bom.lines.all():
            quantity_to_consume = bom_line.quantity * multiplier
            
            consumption = ProductionService.consume_material(
                work_order=work_order,
                product=bom_line.component,
                warehouse=warehouse,
                quantity=quantity_to_consume
            )
            
            consumptions.append(consumption)
        
        return consumptions
