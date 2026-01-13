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

        # 1. Validate Stock Availability (Strict Reservation)
        from inventory.services import UoMService
        from sales.models import SalesSettings
        settings = SalesSettings.objects.first()
        
        if settings and settings.restrict_stock_sales:
            for line in order.lines.all():
                product = line.product
                if product and product.track_inventory:
                    # Convert requested qty to Product UoM
                    qty_needed = UoMService.convert_quantity(
                        line.quantity,
                        from_uom=line.uom,
                        to_uom=product.uom
                    )
                    
                    # Check availability
                    if product.qty_available < qty_needed:
                        raise ValidationError(
                            f"Stock insuficiente para '{product.name}'. "
                            f"Solicitado: {qty_needed} {product.uom.name}, "
                            f"Disponible: {product.qty_available} {product.uom.name}"
                        )

        # 2. Update Order Status
        order.status = SaleOrder.Status.CONFIRMED
        order.save()

        # 3. Trigger Work Order creation for manufacturable products
        from production.services import WorkOrderService
        from inventory.models import Product
        
        for line in order.lines.all():
            if line.product and line.product.product_type == Product.Type.MANUFACTURABLE:
                # Check if an OT already exists for this line to avoid duplicates
                if not line.work_orders.exists():
                    print(f"DEBUG: Triggering auto-OT for product {line.product.internal_code} on SaleOrder {order.number}")
                    try:
                        ot = WorkOrderService.create_from_sale_line(line)
                        if ot:
                            print(f"DEBUG: Successfully created OT {ot.number} for {line.product.internal_code}")
                        else:
                            print(f"DEBUG: WorkOrderService.create_from_sale_line returned None for {line.product.internal_code}")
                    except Exception as e:
                        print(f"ERROR creating OT for {line.product.internal_code}: {str(e)}")
                        # We don't necessarily want to block the sale if OT creation fails, 
                        # but it's important to know why.
                else:
                    print(f"DEBUG: OT already exists for line {line.id} ({line.product.internal_code})")

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
        
        # Determine unit cost
        if product.product_type == 'MANUFACTURABLE':
            unit_cost = product.get_bom_cost()
            # If unit_cost is 0, it means no BOM or components have 0 cost.
            # This aligns with "postponing" COGS for manufacturable products.
        else:
            # Get current cost price (weighted average)
            unit_cost = product.cost_price
        
        # Create delivery line
        delivery_line = SaleDeliveryLine.objects.create(
            delivery=delivery,
            sale_line=sale_line,
            product=product,
            uom=sale_line.uom,
            quantity=quantity,
            unit_cost=unit_cost
        )
        
        return delivery_line
    
    @staticmethod
    @transaction.atomic
    def confirm_delivery(delivery: SaleDelivery):
        """
        Confirms a delivery:
        1. Creates stock movements (OUT) - Handles BOM explosion for non-tracked manufactured products.
        2. Creates COGS accounting entry
        3. Updates sale line quantities
        """
        from inventory.services import UoMService
        from inventory.models import StockMove
        from production.models import BillOfMaterials

        # 0. Collect moves to link them later to the journal entry
        created_moves = []

        # 1. Process lines for stock moves and quantity updates
        for line in delivery.lines.all():
            product = line.product
            
            # PATH A: Product tracks inventory directly
            if product.track_inventory:
                # Base quantity conversion
                base_qty = StockService.convert_quantity(
                    line.quantity,
                    from_uom=line.uom or line.sale_line.uom,
                    to_uom=line.product.uom
                )

                # Create stock move (OUT)
                print(f"DEBUG: Creating StockMove for product {product.internal_code}, qty {-base_qty}, warehouse {delivery.warehouse.name}")
                stock_move = StockMove.objects.create(
                    date=delivery.delivery_date,
                    product=product,
                    warehouse=delivery.warehouse,
                    uom=product.uom,
                    quantity=-base_qty, # Negative for OUT move
                    move_type=StockMove.Type.OUT,
                    description=f"Despacho NV-{delivery.sale_order.number}", # Updated description
                    source_uom=line.uom or line.sale_line.uom,
                    source_quantity=line.quantity
                )
                created_moves.append(stock_move)
                
                # Link stock move to delivery line
                line.stock_move = stock_move
                # Ensure unit_cost is the product's current cost
                line.unit_cost = product.cost_price
                line.save()
            
            # PATH B: Product DOES NOT track inventory (Service or Non-tracked Manufactured)
            else:
                if product.product_type == 'MANUFACTURABLE':
                    # SAFEGUARD: If this sale line already has a Work Order, 
                    # do NOT explode BOM again here (production already consumed materials).
                    if line.sale_line.work_orders.exists():
                        print(f"DEBUG: Skipping BOM explosion for {product.internal_code} - OT already exists.")
                        line.unit_cost = product.get_bom_cost()
                        line.save()
                        continue

                    active_bom = BillOfMaterials.objects.filter(product=product, active=True).first()
                    
                    if active_bom:
                        # BOM Explosion: Consume components instead of the product
                        line_total_cost = Decimal('0.00')
                        for bom_line in active_bom.lines.all():
                            # 1. First, calculate total requirement in the BOM line's UoM
                            # Requirement = (Sale Qty in Sale UoM) * (BOM Qty per Unit)
                            # NOTE: This assumes BOM quantity is per "Base Unit" of the product.
                            # If sold in a different UoM, we must convert Sale Qty to Base UoM first.
                            base_sale_qty = UoMService.convert_quantity(
                                line.quantity,
                                from_uom=line.sale_line.uom,
                                to_uom=product.uom
                            )
                            
                            comp_qty_in_bom_uom = base_sale_qty * bom_line.quantity
                            
                            # 2. Convert to component's base UoM for Kardex
                            base_comp_qty = UoMService.convert_quantity(
                                comp_qty_in_bom_uom,
                                from_uom=bom_line.uom,
                                to_uom=bom_line.component.uom
                            )
                            
                            # Create stock move (OUT) for the COMPONENT
                            comp_move = StockMove.objects.create(
                                date=delivery.delivery_date,
                                product=bom_line.component,
                                warehouse=delivery.warehouse,
                                uom=bom_line.component.uom,
                                quantity=-base_comp_qty,
                                move_type=StockMove.Type.OUT,
                                description=f"Consumo BOM p/Despacho {delivery.number} ({product.name})"
                            )
                            created_moves.append(comp_move)
                            
                            # Calculate component cost contribution
                            line_total_cost += base_comp_qty * bom_line.component.cost_price
                        
                        # Set unit_cost for accounting based on component consumption
                        if line.quantity > 0:
                            line.unit_cost = (line_total_cost / line.quantity).quantize(Decimal('0.01'))
                        else:
                            line.unit_cost = 0
                        line.save()
                    else:
                        # No BOM and no tracking: usually 0 cost (Service/Consumable)
                        line.unit_cost = 0
                        line.save()
                else:
                    # Service or other non-tracked product
                    line.unit_cost = 0
                    line.save()

            # Update sale line delivered quantity
            line.sale_line.quantity_delivered += line.quantity
            line.sale_line.save()

        # 2. Accounting Entry via Mapper (using total_cost for COGS)
        # Recalculate totals after updating line costs
        delivery.total_cost = sum(line.total_cost for line in delivery.lines.all())
        delivery.recalculate_totals()
        
        from accounting.models import AccountingSettings
        settings = AccountingSettings.objects.first()
        
        if delivery.total_cost > 0:
            description, reference, items = AccountingMapper.get_entries_for_delivery(delivery, settings)
            entry = JournalEntryService.create_entry(
                {
                    'date': delivery.delivery_date,
                    'description': description,
                    'reference': reference,
                    'state': JournalEntry.State.DRAFT
                },
                items
            )
            
            JournalEntryService.post_entry(entry)
            delivery.journal_entry = entry
            
            # Link all created stock moves to this entry
            for move in created_moves:
                move.journal_entry = entry
                move.save()
        
        # Confirm delivery
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
        Only allowed for DRAFT orders.
        """
        if order.status != SaleOrder.Status.DRAFT:
            raise ValidationError("Solo se pueden eliminar notas de venta en estado Borrador.")

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

    @staticmethod
    @transaction.atomic
    def annul_delivery(delivery: SaleDelivery):
        """
        Annuls a confirmed delivery:
        1. Reverses COGS accounting entry.
        2. Creates reversal stock movements (IN).
        3. Reverts delivered quantities on sale lines.
        4. Marks delivery as CANCELLED.
        """
        if delivery.status != SaleDelivery.Status.CONFIRMED:
            raise ValidationError("Solo se pueden anular despachos confirmados.")

        # 1. Reverse Accounting
        rev_entry = None
        if delivery.journal_entry:
            rev_entry = JournalEntryService.reverse_entry(delivery.journal_entry, description=f"Anulación Despacho {delivery.number}")

        # 2. Reverse Stock Moves & Update Sale Lines
        from inventory.models import StockMove
        for line in delivery.lines.all():
            # Create Reversal Move (IN)
            if line.stock_move:
                StockMove.objects.create(
                    date=timezone.now().date(),
                    product=line.product,
                    warehouse=delivery.warehouse,
                    quantity=abs(line.stock_move.quantity), # Positive IN
                    move_type=StockMove.Type.IN,
                    description=f"Anulación Despacho {delivery.number} ({line.product.code})",
                    journal_entry=rev_entry
                )
            
            # Revert delivered quantity
            line.sale_line.quantity_delivered -= line.quantity
            line.sale_line.save()

        # 3. Update Delivery Status
        delivery.status = SaleDelivery.Status.CANCELLED
        delivery.save()
        
        # 4. Update Order Delivery Status
        SalesService._update_order_delivery_status(delivery.sale_order)
        
        return delivery

    @staticmethod
    @transaction.atomic
    def annul_sale_order(order: SaleOrder, force: bool = False):
        """
        Annuls a sale order and all its associated documents.
        """
        if order.status == SaleOrder.Status.CANCELLED:
             return order
             
        from billing.models import Invoice
        from billing.services import BillingService
        from treasury.services import TreasuryService

        # 1. Annul Invoices (this will block if payments exist and force is False)
        for invoice in order.invoices.all():
            if invoice.status != Invoice.Status.CANCELLED:
                 BillingService.annul_invoice(invoice, force=force)
        
        # 2. Annul Deliveries
        for delivery in order.deliveries.all():
            if delivery.status != SaleDelivery.Status.CANCELLED:
                 SalesService.annul_delivery(delivery)
        
        # 3. Annul stand-alone Payments (if any)
        for payment in order.payments.all():
            if payment.journal_entry and payment.journal_entry.state == 'POSTED':
                 TreasuryService.annul_payment(payment)
        
        order.status = SaleOrder.Status.CANCELLED
        order.save()
        return order
    @staticmethod
    @transaction.atomic
    def create_note(order: SaleOrder, note_type: str, amount_net: Decimal, amount_tax: Decimal, 
                    document_number: str, document_attachment=None, return_items=None, original_invoice_id=None):
        """
        Creation of a Credit or Debit Note linked to a Sale Order.
        - note_type: NOTA_CREDITO or NOTA_DEBITO
        - return_items: list of { 'product_id': int, 'quantity': Decimal }
        """
        from billing.models import Invoice
        from accounting.models import AccountingSettings, JournalEntry, JournalItem, AccountType
        from inventory.models import StockMove
        
        # 1 & 2. Create Invoice Note and Journal Entry via BaseNoteService
        settings = AccountingSettings.objects.first()
        if not settings:
            raise ValidationError("Debe configurar la contabilidad primero.")

        invoice, entry = BaseNoteService.create_document_note(
            order=order,
            note_type=note_type,
            amount_net=amount_net,
            amount_tax=amount_tax,
            document_number=document_number,
            document_attachment=document_attachment,
            partner_name=order.customer.name
        )

        receivable_account = order.customer.account_receivable or settings.default_receivable_account
        revenue_account = settings.default_revenue_account
        tax_account = settings.default_tax_payable_account
        
        if not all([receivable_account, revenue_account, tax_account]):
            raise ValidationError("Faltan cuentas predeterminadas en la configuración contable.")

        # 3. Entries based on note_type
        total_amount = amount_net + amount_tax
        if note_type == Invoice.DTEType.NOTA_CREDITO:
            # Credit Note (Return/Discount)
            # Credit: Receivable (Total)
            JournalItem.objects.create(
                entry=entry,
                account=receivable_account,
                debit=0,
                credit=total_amount,
                partner=order.customer.name,
                label=f"NC {document_number} - NV {order.number}"
            )
            # Debit: Revenue (Net)
            JournalItem.objects.create(
                entry=entry,
                account=revenue_account,
                debit=amount_net,
                credit=0,
                label=f"Reverso Venta Net - NC {document_number}"
            )
            # Debit: Tax (IVA Débito)
            if amount_tax > 0:
                JournalItem.objects.create(
                    entry=entry,
                    account=tax_account,
                    debit=amount_tax,
                    credit=0,
                    label=f"Reverso IVA - NC {document_number}"
                )
        else:
            # Debit Note (Charge)
            # Debit: Receivable (Total)
            JournalItem.objects.create(
                entry=entry,
                account=receivable_account,
                debit=total_amount,
                credit=0,
                partner=order.customer.name,
                label=f"ND {document_number} - NV {order.number}"
            )
            # Credit: Revenue (Net)
            JournalItem.objects.create(
                entry=entry,
                account=revenue_account,
                debit=0,
                credit=amount_net,
                label=f"Cargo Adicional Net - ND {document_number}"
            )
            # Credit: Tax (IVA Débito)
            if amount_tax > 0:
                JournalItem.objects.create(
                    entry=entry,
                    account=tax_account,
                    debit=0,
                    credit=amount_tax,
                    label=f"IVA Cargo Adicional - ND {document_number}"
                )

        # 4. Inventory Moves (for Credit Note with returns)
        if note_type == Invoice.DTEType.NOTA_CREDITO and return_items:
            # We assume returns go back to the original warehouse or a default one
            # For simplicity, we use the first warehouse or require one. 
            # In SaleDelivery we know the warehouse.
            default_warehouse = Warehouse.objects.first()
            
            for item in return_items:
                product_id = item.get('product_id')
                quantity = Decimal(str(item.get('quantity', 0)))
                
                if quantity <= 0:
                    continue
                
                from inventory.models import Product
                product = Product.objects.get(id=product_id)
                
                # Check for COGS reversal
                # We need to find the unit cost. Use current cost or original sold unit cost?
                # Usually we reverse at the cost it was sold.
                unit_cost = product.cost_price 
                
                # Stock Move (IN)
                StockMove.objects.create(
                    date=timezone.now().date(),
                    product=product,
                    warehouse=default_warehouse,
                    quantity=quantity,
                    move_type=StockMove.Type.IN,
                    description=f"Devolución NC {document_number} - NV {order.number}",
                    journal_entry=entry
                )
                
                # Reverse COGS entry
                cogs_account = Account.objects.filter(code='5.1.01').first() or \
                               Account.objects.filter(account_type=AccountType.EXPENSE).first()
                inventory_account = settings.default_inventory_account
                
                line_cogs = (quantity * unit_cost).quantize(Decimal('0.01'), rounding='ROUND_HALF_UP')
                
                if line_cogs > 0 and cogs_account and inventory_account:
                    # Debit: Inventory (Asset)
                    JournalItem.objects.create(
                        entry=entry,
                        account=inventory_account,
                        debit=line_cogs,
                        credit=0,
                        label=f"Reincorporación Stock - {product.code}"
                    )
                    # Credit: COGS (Expense)
                    JournalItem.objects.create(
                        entry=entry,
                        account=cogs_account,
                        debit=0,
                        credit=line_cogs,
                        label=f"Reverso COGS - {product.code}"
                    )

        JournalEntryService.post_entry(entry)
        invoice.journal_entry = entry
        invoice.save()
        
        return invoice
