from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils import timezone
from .models import SaleOrder, SaleDelivery, SaleDeliveryLine
from accounting.models import JournalEntry, JournalItem, Account, AccountType
from accounting.services import JournalEntryService, AccountingMapper
from core.mixins import TotalsCalculationMixin
from core.services import SequenceService, BaseNoteService
from inventory.models import StockMove, Warehouse
from decimal import Decimal


class SalesReturnService:
    """
    Service for handling merchandise and payment returns.
    Only available for orders with DRAFT invoices.
    """
    
    @staticmethod
    @transaction.atomic
    def register_merchandise_return(
        order: SaleOrder,
        return_items: list,  # [{'line_id': 1, 'quantity': 5, 'reason': '...'}, ...]
        warehouse: Warehouse,
        notes: str = ""
    ):
        """
        Registers merchandise return (partial or total).
        Only for stockable products and DRAFT invoices.
        
        Args:
            order: Sale order to process return for
            return_items: List of items being returned with reasons
            warehouse: Warehouse receiving the returned goods
            notes: Additional notes about the return
        
        Returns:
            SaleDelivery: Return delivery document (negative quantities)
        
        Raises:
            ValidationError: If invoice is not DRAFT or products not stockable
        """
        # 1. Validate invoice status (must be DRAFT)
        draft_invoices = order.invoices.filter(status='DRAFT')
        if not draft_invoices.exists():
            raise ValidationError(
                "❌ Solo se pueden registrar devoluciones para facturas en borrador.\n"
                "📋 Para facturas publicadas, use una Nota de Crédito."
            )
        
        # 2. Validate return items
        for item in return_items:
            line = order.lines.get(id=item['line_id'])
            
            # Check if product is stockable
            if not line.product.track_inventory:
                raise ValidationError(
                    f"❌ No se puede devolver '{line.product.name}': "
                    "producto no stockeable (servicio/consumible).\n"
                    "💡 Use una Nota de Crédito para ajustar servicios."
                )
            
            # Check quantity
            quantity = Decimal(str(item['quantity']))
            if quantity > line.quantity_delivered:
                raise ValidationError(
                    f"❌ Cantidad a devolver ({quantity}) excede "
                    f"cantidad despachada ({line.quantity_delivered}) para '{line.product.name}'."
                )
            
            if quantity <= 0:
                raise ValidationError(
                    f"❌ La cantidad a devolver debe ser mayor a cero."
                )
        
        # 3. Create return delivery (negative quantities)
        return_delivery = SaleDelivery.objects.create(
            sale_order=order,
            warehouse=warehouse,
            delivery_date=timezone.now().date(),
            status=SaleDelivery.Status.DRAFT,
            notes=f"DEVOLUCIÓN: {notes}"
        )
        
        # 4. Create return lines with reasons
        for item in return_items:
            line = order.lines.get(id=item['line_id'])
            quantity = Decimal(str(item['quantity']))
            reason = item.get('reason', 'Sin especificar')
            
            delivery_line = SaleDeliveryLine.objects.create(
                delivery=return_delivery,
                sale_line=line,
                product=line.product,
                uom=line.uom,
                quantity=-quantity,  # Negative for return
                unit_price=line.unit_price,
                unit_cost=line.product.cost_price
            )
            
            # Store return reason in delivery notes
            if reason:
                return_delivery.notes += f"\n- {line.product.name}: {reason}"
        
        return_delivery.save()
        
        # 5. Confirm return (creates stock IN movements and COGS reversal)
        SalesReturnService._confirm_return_delivery(return_delivery)
        
        # 6. Update delivered quantities
        for item in return_items:
            line = order.lines.get(id=item['line_id'])
            quantity = Decimal(str(item['quantity']))
            line.quantity_delivered -= quantity
            line.save()
        
        # 7. Update order delivery status
        from sales.services import SalesService
        SalesService._update_order_delivery_status(order)
        
        return return_delivery
    
    @staticmethod
    @transaction.atomic
    def _confirm_return_delivery(delivery: SaleDelivery):
        """
        Confirms a return delivery:
        1. Creates stock movements (IN) for returned products
        2. Creates COGS reversal accounting entry (separate from original)
        3. Marks delivery as CONFIRMED
        """
        from inventory.services import UoMService
        from accounting.models import AccountingSettings
        
        created_moves = []
        
        # 1. Process return lines for stock movements
        for line in delivery.lines.all():
            product = line.product
            
            if product.track_inventory:
                # Convert quantity (already negative) to base UoM
                base_qty = UoMService.convert_quantity(
                    abs(line.quantity),  # Use absolute value for conversion
                    from_uom=line.uom or line.sale_line.uom,
                    to_uom=product.uom
                )
                
                # Create stock move (IN - positive quantity for return)
                stock_move = StockMove.objects.create(
                    date=delivery.delivery_date,
                    product=product,
                    warehouse=delivery.warehouse,
                    uom=product.uom,
                    quantity=base_qty,  # Positive for IN move
                    move_type=StockMove.Type.IN,
                    description=f"Devolución NV-{delivery.sale_order.number}",
                    source_uom=line.uom or line.sale_line.uom,
                    source_quantity=abs(line.quantity)
                )
                created_moves.append(stock_move)
                
                # Link stock move to delivery line
                line.stock_move = stock_move
                line.unit_cost = product.cost_price
                line.save()
        
        # 2. Create COGS reversal accounting entry (separate entry)
        delivery.total_cost = sum(abs(line.total_cost) for line in delivery.lines.all())
        delivery.recalculate_totals()
        
        settings = AccountingSettings.objects.first()
        
        if delivery.total_cost > 0:
            # Create reversal entry for COGS
            cogs_account = Account.objects.filter(code='5.1.01').first() or \
                          Account.objects.filter(account_type=AccountType.EXPENSE).first()
            inventory_account = settings.default_inventory_account
            
            if cogs_account and inventory_account:
                entry = JournalEntry.objects.create(
                    date=delivery.delivery_date,
                    description=f"Reversión COGS - Devolución DES-{delivery.number}",
                    reference=f"DEV-{delivery.number}",
                    state=JournalEntry.State.DRAFT
                )
                
                # Debit: Inventory (Asset increases)
                JournalItem.objects.create(
                    entry=entry,
                    account=inventory_account,
                    debit=delivery.total_cost,
                    credit=0,
                    label=f"Devolución mercadería - NV-{delivery.sale_order.number}"
                )
                
                # Credit: COGS (Expense decreases)
                JournalItem.objects.create(
                    entry=entry,
                    account=cogs_account,
                    debit=0,
                    credit=delivery.total_cost,
                    label=f"Reversión COGS - Devolución"
                )
                
                JournalEntryService.post_entry(entry)
                delivery.journal_entry = entry
                
                # Link all created stock moves to this entry
                for move in created_moves:
                    move.journal_entry = entry
                    move.save()
        
        # 3. Confirm delivery
        delivery.status = SaleDelivery.Status.CONFIRMED
        delivery.save()
        
        return delivery
