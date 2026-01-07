from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils import timezone
from .models import SaleOrder, SaleDelivery, SaleDeliveryLine
from accounting.models import JournalEntry, JournalItem, Account, AccountType
from accounting.services import JournalEntryService
from inventory.models import StockMove, Warehouse
from decimal import Decimal

class SalesService:
    @staticmethod
    @transaction.atomic
    def confirm_sale(order: SaleOrder):
        """
        Confirms a sale order and creates the corresponding Journal Entry.
        Debit: Accounts Receivable (or Cash)
        Credit: Sales Revenue
        Credit: Tax Payable
        """
        if order.status != SaleOrder.Status.DRAFT:
            return order

        # 1. Update Order Status
        order.status = SaleOrder.Status.CONFIRMED
        order.save()

        # NOTE: Accounting entry moved to BillingService.create_sale_invoice
        
        return order

    @staticmethod
    @transaction.atomic
    def dispatch_order(order: SaleOrder, warehouse: Warehouse, delivery_date=None):
        """
        Dispatches a complete sale order.
        Creates delivery, reduces stock, and generates COGS accounting entries.
        
        Args:
            order: SaleOrder to dispatch
            warehouse: Warehouse to dispatch from
            delivery_date: Date of delivery (defaults to today)
        
        Returns:
            SaleDelivery instance
        """
        if order.delivery_status == SaleOrder.DeliveryStatus.DELIVERED:
            raise ValidationError("La orden ya está completamente despachada.")
        
        if not delivery_date:
            delivery_date = timezone.now().date()
        
        # Create delivery
        delivery = SaleDelivery.objects.create(
            sale_order=order,
            warehouse=warehouse,
            delivery_date=delivery_date,
            status=SaleDelivery.Status.DRAFT
        )
        
        # Process each line
        for sale_line in order.lines.all():
            if sale_line.quantity_pending > 0:
                SalesService._create_delivery_line(
                    delivery=delivery,
                    sale_line=sale_line,
                    quantity=sale_line.quantity_pending,
                    warehouse=warehouse
                )
        
        # Confirm delivery (creates stock moves and COGS)
        SalesService.confirm_delivery(delivery)
        
        # Update order delivery status
        order.delivery_status = SaleOrder.DeliveryStatus.DELIVERED
        order.save()
        
        return delivery
    
    @staticmethod
    @transaction.atomic
    def partial_dispatch(order: SaleOrder, warehouse: Warehouse, line_quantities: dict, delivery_date=None):
        """
        Dispatches specific quantities of products from a sale order.
        
        Args:
            order: SaleOrder to dispatch
            warehouse: Warehouse to dispatch from
            line_quantities: Dict mapping sale_line_id to quantity to dispatch
            delivery_date: Date of delivery (defaults to today)
        
        Returns:
            SaleDelivery instance
        """
        if not delivery_date:
            delivery_date = timezone.now().date()
        
        # Create delivery
        delivery = SaleDelivery.objects.create(
            sale_order=order,
            warehouse=warehouse,
            delivery_date=delivery_date,
            status=SaleDelivery.Status.DRAFT
        )
        
        # Process specified lines
        for sale_line_id, quantity in line_quantities.items():
            sale_line = order.lines.get(id=sale_line_id)
            
            if quantity > sale_line.quantity_pending:
                raise ValidationError(
                    f"Cantidad a despachar ({quantity}) excede la cantidad pendiente ({sale_line.quantity_pending}) para {sale_line.description}"
                )
            
            if quantity > 0:
                SalesService._create_delivery_line(
                    delivery=delivery,
                    sale_line=sale_line,
                    quantity=Decimal(str(quantity)),
                    warehouse=warehouse
                )
        
        # Confirm delivery
        SalesService.confirm_delivery(delivery)
        
        # Update order delivery status
        SalesService._update_order_delivery_status(order)
        
        return delivery
    
    @staticmethod
    def _create_delivery_line(delivery, sale_line, quantity, warehouse):
        """Helper to create a delivery line"""
        product = sale_line.product
        
        if not product:
            raise ValidationError(f"La línea '{sale_line.description}' no tiene producto asociado.")
        
        # Get current cost price
        unit_cost = product.cost_price
        
        # Create delivery line
        delivery_line = SaleDeliveryLine.objects.create(
            delivery=delivery,
            sale_line=sale_line,
            product=product,
            quantity_delivered=quantity,
            unit_cost=unit_cost
        )
        
        return delivery_line
    
    @staticmethod
    @transaction.atomic
    def confirm_delivery(delivery: SaleDelivery):
        """
        Confirms a delivery:
        1. Creates stock movements (OUT)
        2. Creates COGS accounting entry
        3. Updates sale line quantities
        """
        if delivery.status != SaleDelivery.Status.DRAFT:
            raise ValidationError("Solo se pueden confirmar despachos en borrador.")
        
        # Create master COGS journal entry
        entry = JournalEntry.objects.create(
            date=delivery.delivery_date,
            description=f"Costo de Venta - Despacho-{delivery.number} (NV-{delivery.sale_order.number})",
            reference=f"Despacho-{delivery.number}",
            state=JournalEntry.State.DRAFT
        )
        
        total_cogs = Decimal('0.00')
        
        # Process each delivery line
        for line in delivery.lines.all():
            from inventory.services import StockService
            # Convert to base UoM
            base_qty = StockService.convert_quantity(
                line.quantity_delivered,
                from_uom=line.sale_line.uom,
                to_uom=line.product.uom
            )

            # 1. Create stock move (OUT)
            stock_move = StockMove.objects.create(
                date=delivery.delivery_date,
                product=line.product,
                warehouse=delivery.warehouse,
                quantity=-base_qty,  # Negative for OUT
                move_type=StockMove.Type.OUT,
                description=f"Despacho-{delivery.number} (NV-{delivery.sale_order.number})",
                journal_entry=entry
            )
            
            # Link stock move to delivery line
            line.stock_move = stock_move
            line.save()
            
            # 2. Update sale line delivered quantity
            line.sale_line.quantity_delivered += line.quantity_delivered
            line.sale_line.save()
            
            # 3. Accumulate COGS
            total_cogs += line.total_cost
        
        # 4. Create COGS accounting entries
        if total_cogs > 0:
            # Get accounts
            try:
                cogs_account = Account.objects.get(code='5.1.01')  # Cost of Goods Sold
            except Account.DoesNotExist:
                cogs_account = Account.objects.filter(account_type=AccountType.EXPENSE).first()
            
            from accounting.models import AccountingSettings
            settings = AccountingSettings.objects.first()
            inventory_account = settings.default_inventory_account if settings else None
            
            if not cogs_account or not inventory_account:
                raise ValidationError("Faltan cuentas contables (COGS o Inventario) configuradas.")
            
            # Debit: Cost of Goods Sold
            JournalItem.objects.create(
                entry=entry,
                account=cogs_account,
                debit=total_cogs,
                credit=0,
                label=f"Costo de Venta Despacho-{delivery.number}"
            )
            
            # Credit: Inventory
            JournalItem.objects.create(
                entry=entry,
                account=inventory_account,
                debit=0,
                credit=total_cogs,
                label=f"Reducción Inventario Despacho-{delivery.number}"
            )
            
            # Post entry
            JournalEntryService.post_entry(entry)
        
        # Link entry to delivery
        delivery.journal_entry = entry
        delivery.status = SaleDelivery.Status.CONFIRMED
        delivery.save()
        
        return delivery
    
    @staticmethod
    def _update_order_delivery_status(order: SaleOrder):
        """Updates the delivery status of a sale order based on delivered quantities"""
        total_quantity = sum(line.quantity for line in order.lines.all())
        total_delivered = sum(line.quantity_delivered for line in order.lines.all())
        
        if total_delivered == 0:
            order.delivery_status = SaleOrder.DeliveryStatus.PENDING
        elif total_delivered >= total_quantity:
            order.delivery_status = SaleOrder.DeliveryStatus.DELIVERED
        else:
            order.delivery_status = SaleOrder.DeliveryStatus.PARTIAL
        
        order.save()

    @staticmethod
    @transaction.atomic
    def delete_sale_order(order: SaleOrder):
        """
        Deletes a sale order, its invoices, and associated journal entries.
        """
        from billing.services import BillingService
        from treasury.services import TreasuryService
        
        # 1. Delete associated invoices (and their payments/JEs)
        for invoice in order.invoices.all():
            if invoice.status != 'CANCELLED': # Safety check if needed
                 BillingService.delete_invoice(invoice)
        
        # 2. Delete stand-alone payments linked to order
        for payment in order.payments.all():
            TreasuryService.delete_payment(payment)

        # 3. Delete order's own journal entry
        if order.journal_entry:
            order.journal_entry.delete()
            
        # 4. Delete Order
        order.delete()
