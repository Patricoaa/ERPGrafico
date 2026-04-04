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
    def confirm_sale(order: SaleOrder, line_files=None):
        """
        Confirms a sale order and creates the corresponding Journal Entry.
        Debit: Accounts Receivable (or Cash)
        Credit: Sales Revenue
        Credit: Tax Payable
        """
        if order.status != SaleOrder.Status.DRAFT:
            return order

        # Acquire strict product locks to prevent concurrent double-spends
        product_ids = [line.product_id for line in order.lines.all() if line.product_id]
        lock_resources = [f"stock_prod_{pid}" for pid in set(product_ids)]
        
        from core.cache import acquire_locks
        with acquire_locks(lock_resources, timeout=10):
            # 1. Validate Stock Availability (Strict Reservation)
            from inventory.services import UoMService
            from sales.models import SalesSettings
            settings = SalesSettings.get_solo()
            
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

            # 3. Trigger Work Order creation ONLY for ADVANCED manufacturable products
            # Express products (mfg_auto_finalize=True) will have OTs created at dispatch time
            from production.services import WorkOrderService
            from inventory.models import Product
            
            for i, line in enumerate(order.lines.all()):
                if line.product and line.product.product_type == Product.Type.MANUFACTURABLE:
                    # IMPORTANT: Only create OT if requires advanced manufacturing
                    # Express products: OT will be created during delivery confirmation
                    if line.product.requires_advanced_manufacturing:
                        # Check if an OT already exists for this line to avoid duplicates
                        if not line.work_orders.exists():
                            print(f"DEBUG: Triggering auto-OT for ADVANCED product {line.product.internal_code} on SaleOrder {order.number}")
                            try:
                                # Extract files for this specific line if provided
                                current_line_files = line_files.get(i) if line_files else None
                                ot = WorkOrderService.create_from_sale_line(line, files=current_line_files)
                                if ot:
                                    print(f"DEBUG: Successfully created OT {ot.number} for {line.product.internal_code}")
                                else:
                                    print(f"DEBUG: WorkOrderService.create_from_sale_line returned None for {line.product.internal_code}")
                            except Exception as e:
                                print(f"ERROR creating OT for {line.product.internal_code}: {str(e)}")
                        else:
                            print(f"DEBUG: OT already exists for line {line.id} ({line.product.internal_code})")
                    else:
                        print(f"DEBUG: Skipping OT creation for EXPRESS product {line.product.internal_code} - will be created at dispatch")

            # NOTE: Accounting entry moved to BillingService.create_sale_invoice
            
            # Create HUB stage tasks for the inbox
            # HUB Tasks Sync
            from workflow.services import WorkflowService
            WorkflowService.sync_hub_tasks(order)
            
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

        # VALIDATION: Prevent dispatch of products based on stock/production status
        for sale_line in order.lines.all():
            if sale_line.quantity_pending > 0:
                product = sale_line.product
                if not product:
                    continue

                requested_qty = sale_line.quantity_pending

                # Case 1: Advanced Manufacturing (Needs Finished OT)
                if product.product_type == 'MANUFACTURABLE' and product.requires_advanced_manufacturing:
                    # Check if all associated OTs are finished (unless auto-finalize/express)
                    if not product.mfg_auto_finalize:
                        ots = sale_line.work_orders.exclude(status='CANCELLED')
                        if not ots.exists() or not all(ot.current_stage == 'FINISHED' for ot in ots):
                             raise ValidationError(
                                f"No se puede despachar '{product.name}' porque requiere fabricación avanzada "
                                "y su Orden de Trabajo aún no está finalizada."
                            )

                # Case 2: Simple/Express Manufacturing (Needs BOM components stock)
                elif product.product_type == 'MANUFACTURABLE' and not product.requires_advanced_manufacturing:
                    if product.has_bom and not product.mfg_auto_finalize:
                        manufacturable_qty = product.get_manufacturable_quantity()
                        # get_manufacturable_quantity returns None if no BOM or no constraints
                        if manufacturable_qty is not None and manufacturable_qty < requested_qty:
                            raise ValidationError(
                                f"Stock insuficiente de componentes para fabricar '{product.name}'. "
                                f"Máximo posible: {manufacturable_qty}, Solicitado: {requested_qty}"
                            )
                
                # Case 3: Storable Product (Needs physical stock)
                elif product.product_type == 'STORABLE' and product.track_inventory:
                    # Logic: We must have enough stock, but we ignore what THIS order has already reserved
                    # because the reservation already lowered qty_available.
                    available_for_this_order = product.qty_available + sale_line.quantity_pending
                    if available_for_this_order < requested_qty:
                         raise ValidationError(
                            f"Stock insuficiente para '{product.name}'. "
                            f"Disponible real: {available_for_this_order}, Solicitado: {requested_qty}"
                        )
        
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
        
        # Auto-complete logistics HUB task
        # HUB Tasks Sync
        from workflow.services import WorkflowService
        WorkflowService.sync_hub_tasks(order)
        
        return delivery
    
    @staticmethod
    @transaction.atomic
    def create_delivery_from_note(order: SaleOrder, warehouse: Warehouse, line_data: list, delivery_date=None, notes=None, related_note: 'Invoice' = None):
        """
        Creates a delivery specifically for a Debit Note (Supplemental Dispatch).
        Differs from partial_dispatch:
        1. Bypasses 'quantity_pending' check.
        2. Validates availability.
        3. Creates delivery and marks it as CONFIRMED.
        """
        if not delivery_date:
            delivery_date = timezone.now().date()
        
        # Create delivery
        delivery = SaleDelivery.objects.create(
            sale_order=order,
            warehouse=warehouse,
            delivery_date=delivery_date,
            status=SaleDelivery.Status.DRAFT,
            notes=f"Nota de Débito: {notes or ''}",
            related_note=related_note
        )
        
        for item in line_data:
            line_id = item.get('line_id')
            quantity = Decimal(str(item.get('quantity', 0)))
            uom_id = item.get('uom_id')
            
            if quantity <= 0: continue

            # If line_id exists, use it. If not, we might need to fetch product directly.
            product_id = item.get('product_id')
            from inventory.models import Product, UoM
            
            sale_line = None
            if line_id:
                sale_line = order.lines.get(id=line_id)
                product = sale_line.product
            elif product_id:
                 product = Product.objects.get(id=product_id)
                 # Try to find existing line for same product
                 sale_line = order.lines.filter(product=product).first()
                 
                 if not sale_line:
                     # CREATE NEW LINE on the fly for Supplemental Dispatch
                     from .models import SaleLine
                     sale_line = SaleLine.objects.create(
                         order=order,
                         product=product,
                         quantity=0, # Note: Actual dispatch qty is in the DeliveryLine
                         unit_price=item.get('unit_price', product.cost_price * Decimal('1.2')), # Fallback markup or provided price
                         uom=uom_id if uom_id else product.uom
                     )
                     order.recalculate_totals()
            
            if not sale_line:
                # If still no line, skip
                continue

            # Check Availability
            if product.product_type == 'STORABLE' and product.track_inventory:
                # Simplified check: assumes base UoM for now
                if product.qty_available < quantity:
                    raise ValidationError(f"Stock insuficiente para {product.name} (Nota Débito).")

            uom = UoM.objects.filter(id=uom_id).first() if uom_id else sale_line.uom

            SalesService._create_delivery_line(
                delivery=delivery,
                sale_line=sale_line,
                quantity=quantity,
                warehouse=warehouse,
                uom=uom
            )
        
        SalesService.confirm_delivery(delivery)
        return delivery
    
    @staticmethod
    @transaction.atomic
    def partial_dispatch(order: SaleOrder, warehouse: Warehouse, line_data: list, delivery_date=None):
        """
        Dispatches specific quantities of products.
        line_data = [{'line_id': 1, 'quantity': 5, 'uom_id': 2}, ...]
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
        for item in line_data:
            line_id = item.get('line_id')
            quantity = Decimal(str(item.get('quantity', 0)))
            uom_id = item.get('uom_id')
            
            if quantity <= 0:
                continue

            sale_line = order.lines.get(id=line_id)
            
            # VALIDATION: Prevent dispatch based on stock/production status
            product = sale_line.product
            if product:
                # Case 1: Advanced Manufacturing (Needs Finished OT)
                if product.product_type == 'MANUFACTURABLE' and product.requires_advanced_manufacturing:
                    if not product.mfg_auto_finalize:
                        ots = sale_line.work_orders.exclude(status='CANCELLED')
                        if not ots.exists() or not all(ot.current_stage == 'FINISHED' for ot in ots):
                             raise ValidationError(
                                f"No se puede despachar '{product.name}' porque requiere fabricación avanzada "
                                "y su Orden de Trabajo aún no está finalizada."
                            )

                # Case 2: Simple/Express Manufacturing (Needs BOM components stock)
                elif product.product_type == 'MANUFACTURABLE' and not product.requires_advanced_manufacturing:
                    if product.has_bom and not product.mfg_auto_finalize:
                        manufacturable_qty = product.get_manufacturable_quantity()
                        if manufacturable_qty is not None and manufacturable_qty < quantity:
                            raise ValidationError(
                                f"Stock insuficiente de componentes para fabricar '{product.name}'. "
                                f"Máximo posible: {manufacturable_qty}, Solicitado: {quantity}"
                            )
                
                # Case 3: Storable Product (Needs physical stock)
                elif product.product_type == 'STORABLE' and product.track_inventory:
                    # Logic: qty_available already reflects the reservation of the whole order.
                    # We add back the pending quantity of THIS line to see if we can dispatch it.
                    available_for_this_order = product.qty_available + sale_line.quantity_pending
                    if available_for_this_order < quantity:
                         raise ValidationError(
                            f"Stock insuficiente para '{product.name}'. "
                            f"Disponible real: {available_for_this_order}, Solicitado: {quantity}"
                        )

            if quantity > sale_line.quantity_pending:
                # Validation might need UoM conversion if uom_id differs
                pass
            
            uom = None
            if uom_id:
                from inventory.models import UoM
                uom = UoM.objects.filter(id=uom_id).first()

            SalesService._create_delivery_line(
                delivery=delivery,
                sale_line=sale_line,
                quantity=quantity,
                warehouse=warehouse,
                uom=uom
            )
        
        # Confirm delivery
        SalesService.confirm_delivery(delivery)
        
        # Update order delivery status
        SalesService._update_order_delivery_status(order)
        
        return delivery
    
    @staticmethod
    def _create_delivery_line(delivery, sale_line, quantity, warehouse, uom=None):
        """Helper to create a delivery line"""
        product = sale_line.product
        
        if not product:
            raise ValidationError(f"La línea '{sale_line.description}' no tiene producto asociado.")
        
        # Determine unit cost
        if product.product_type == 'MANUFACTURABLE':
            unit_cost = product.get_bom_cost()
        else:
            unit_cost = product.cost_price
        
        # Create delivery line
        delivery_line = SaleDeliveryLine.objects.create(
            delivery=delivery,
            sale_line=sale_line,
            product=product,
            uom=uom or sale_line.uom,
            quantity=quantity,
            unit_price=sale_line.unit_price,
            unit_price_gross=sale_line.unit_price_gross,
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
        if delivery.status != SaleDelivery.Status.DRAFT:
            return delivery
            
        from inventory.services import UoMService
        from inventory.models import StockMove, Product
        from production.models import BillOfMaterials

        # 0. Collect moves to link them later to the journal entry
        created_moves = []

        # 1. Create Work Orders for EXPRESS manufacturable products FIRST
        # This ensures that for express products, the Work Order exists before processing BOM explosion below,
        # preventing duplicate stock movements.
        from production.services import WorkOrderService
        
        for line in delivery.lines.all():
            product = line.product
            
            # Skip if advanced manufacturing (OT was created at sale confirmation)
            if product and product.product_type == Product.Type.MANUFACTURABLE:
                if product.requires_advanced_manufacturing:
                    continue
                
                # Create OT for express products
                if product.mfg_auto_finalize:
                    print(f"DEBUG: Creating OT for EXPRESS product {product.internal_code} in delivery {delivery.number}")
                    work_order = WorkOrderService.create_ot_for_delivery_line(
                        delivery_line=line,
                        related_note=delivery.related_note  # Will be set for debit note deliveries
                    )
                    if work_order:
                        # Link to delivery for traceability
                        line.work_order = work_order
                        line.save()
                        print(f"DEBUG: Created OT-{work_order.number} for {product.internal_code}")
                    else:
                        print(f"DEBUG: No OT created for {product.internal_code} (not express)")

        # 2. Process lines for stock moves and quantity updates
        for line in delivery.lines.all():
            product = line.product
            
            # PATH A: Product tracks inventory directly
            if product.track_inventory:
                # Base quantity conversion
                base_qty = UoMService.convert_quantity(
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
                        print(f"DEBUG: Product {product.internal_code} has Work Order - cost already expensed in OT")
                        # For products with finished OTs, the cost was already expensed during production
                        # We just need to set the unit_cost for reference (no new stock moves or accounting entries)
                        line.unit_cost = product.get_bom_cost()
                        line.save()
                        # IMPORTANT: Do NOT create stock moves or accounting entries here
                        # They were already created during OT finalization
                    else:
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

        # 3. Accounting Entry via Mapper (using total_cost for COGS)
        # Recalculate totals after updating line costs
        delivery.total_cost = sum(line.total_cost for line in delivery.lines.all())
        delivery.recalculate_totals()
        
        from accounting.models import AccountingSettings
        settings = AccountingSettings.get_solo()
        
        if delivery.total_cost > 0:
            description, reference, items = AccountingMapper.get_entries_for_delivery(delivery, settings)
            
            if items:
                entry = JournalEntryService.create_entry(
                    {
                        'date': delivery.delivery_date,
                        'description': description,
                        'reference': reference,
                        'status': JournalEntry.State.DRAFT
                    },
                    items
                )
                
                JournalEntryService.post_entry(entry)
                delivery.journal_entry = entry
                
                # Link all created stock moves to this entry
                for move in created_moves:
                    move.journal_entry = entry
                    move.save()
        
        # 4. Confirm delivery
        delivery.status = SaleDelivery.Status.CONFIRMED
        delivery.save()
        
        # Auto-complete logistics HUB task if order is fully dispatched
        from workflow.services import WorkflowService
        order = delivery.sale_order
        original_lines = order.lines.filter(related_note__isnull=True)
        total_qty = sum(l.quantity for l in original_lines)
        total_delivered = sum(l.quantity_delivered for l in original_lines)
        if total_delivered >= total_qty:
            WorkflowService.sync_hub_tasks(order)
        
        return delivery
    
    @staticmethod
    def _update_order_delivery_status(order: SaleOrder):
        """Updates the delivery status of a sale order based on delivered quantities"""
        # Only consider original lines for order status
        original_lines = order.lines.filter(related_note__isnull=True)
        
        total_quantity = sum(line.quantity for line in original_lines)
        total_delivered = sum(line.quantity_delivered for line in original_lines)
        
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
        Deletes a sale order with strict business rule validations.
        Only allowed for DRAFT orders without physical or financial impact.
        """
        if order.status != SaleOrder.Status.DRAFT:
            raise ValidationError("Solo se pueden eliminar notas de venta en estado Borrador.")

        # VALIDATION 1: Despachos confirmados
        confirmed_deliveries = order.deliveries.filter(status='CONFIRMED').exists()
        if confirmed_deliveries:
            raise ValidationError(
                "❌ No se puede eliminar: existen despachos confirmados.\n"
                "📦 Los productos ya fueron despachados físicamente.\n"
                "💡 Opciones:\n"
                "   1. Anular los despachos primero (solo si son productos stockeables)\n"
                "   2. Registrar devolución de mercadería\n"
                "   3. Confirmar la orden y usar Nota de Crédito"
            )
        
        # VALIDATION 2: Pagos registrados
        posted_payments = order.payments.filter(
            journal_entry__status='POSTED'
        ).exists()
        
        if posted_payments:
            raise ValidationError(
                "❌ No se puede eliminar: existen pagos registrados.\n"
                "💰 Los pagos ya fueron contabilizados.\n"
                "💡 Opciones:\n"
                "   1. Registrar devolución de pago\n"
                "   2. Confirmar la orden y usar Nota de Crédito"
            )
        
        # VALIDATION 3: Productos no stockeables despachados
        has_non_stockable_delivered = False
        for line in order.lines.all():
            if line.quantity_delivered > 0 and line.product:
                if not line.product.track_inventory:
                    has_non_stockable_delivered = True
                    break
        
        if has_non_stockable_delivered:
            raise ValidationError(
                "❌ No se puede eliminar: se despacharon productos no stockeables (servicios/consumibles).\n"
                "⚠️ No es posible revertir estos despachos ya que no afectan inventario.\n"
                "💡 Debe confirmar la orden y usar Nota de Crédito para ajustar."
            )

        from billing.services import BillingService
        from treasury.services import TreasuryService
        
        # 1. Delete associated invoices (and their payments/JEs)
        for invoice in order.invoices.all():
            if invoice.status != 'CANCELLED': # Safety check if needed
                 BillingService.delete_invoice(invoice)
        
        # 2. Delete stand-alone payments linked to order
        for movement in order.payments.all():
            TreasuryService.delete_movement(movement)

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
        for movement in order.payments.all():
            if movement.journal_entry and movement.journal_entry.status == 'POSTED':
                 TreasuryService.annul_movement(movement)
        
        order.status = SaleOrder.Status.CANCELLED
        order.save()
        return order
    @staticmethod
    @transaction.atomic
    def create_note(order: SaleOrder, note_type: str, amount_net: Decimal, amount_tax: Decimal, 
                    document_number: str, document_attachment=None, return_items=None, original_invoice_id=None):
        print(f"DEBUG: create_note service started for order {order.number}")
        print(f"DEBUG: note_type: {note_type}, return_items: {return_items}")
        """
        Creation of a Credit or Debit Note linked to a Sale Order.
        - note_type: NOTA_CREDITO or NOTA_DEBITO
        - return_items: list of { 'product_id': int, 'quantity': Decimal }
        """
        from billing.models import Invoice
        from accounting.models import AccountingSettings, JournalEntry, JournalItem, AccountType
        from inventory.models import StockMove, Product, Warehouse
        
        # 0. Initial Validations
        settings = AccountingSettings.get_solo()
        if not settings:
            raise ValidationError("Debe configurar la contabilidad primero.")

        original_invoice = None
        if original_invoice_id:
            original_invoice = Invoice.objects.filter(id=original_invoice_id).first()
        else:
            # Fallback: link to the first primary invoice if exists
            original_invoice = order.invoices.filter(
                dte_type__in=[
                    Invoice.DTEType.FACTURA, 
                    Invoice.DTEType.FACTURA_EXENTA,
                    Invoice.DTEType.BOLETA, 
                    Invoice.DTEType.BOLETA_EXENTA
                ]
            ).first()
        
        # 1. Business Logic Validations
        if return_items:
            for item in return_items:
                product = Product.objects.get(id=item['product_id'])
                quantity = Decimal(str(item['quantity']))
                
                # Rule: No returns for services
                if product.product_type == Product.Type.SERVICE:
                    raise ValidationError(f"No se pueden registrar devoluciones físicas para servicios ({product.name}).")
                
                # Rule: Debit Note restricted for manufacturable non-storable products
                if note_type == Invoice.DTEType.NOTA_DEBITO:
                    if product.product_type == Product.Type.MANUFACTURABLE and not product.track_inventory:
                        raise ValidationError(
                            f"No se permite crear Nota de Débito para el producto fabricado '{product.name}' sin stock. "
                            "Por favor, cree una nueva Nota de Venta en su lugar."
                        )

                # Rule: Validate quantity doesn't exceed delivered
                # Find matching sale line to check delivered qty
                sale_line = order.lines.filter(product=product).first()
                if sale_line:
                    # Logic should ideally consider previous credit notes (TBA if model allows)
                    if quantity > sale_line.quantity_delivered:
                         raise ValidationError(
                            f"Cantidad a devolver ({quantity}) excede la cantidad entregada físicamente "
                            f"({sale_line.quantity_delivered}) para {product.name}."
                        )

        # 2. Create Invoice Note and Journal Entry via BaseNoteService
        invoice, entry = BaseNoteService.create_document_note(
            order=order,
            note_type=note_type,
            amount_net=amount_net,
            amount_tax=amount_tax,
            document_number=document_number,
            document_attachment=document_attachment,
            partner_name=order.customer.name
        )
        
        if original_invoice:
            invoice.corrected_invoice = original_invoice
            invoice.save()

        # 3. Accounting Entries
        # We try to use specific product accounts for NC/ND transparency
        receivable_account = order.customer.account_receivable or settings.default_receivable_account
        tax_account = settings.default_tax_payable_account
        
        total_amount = amount_net + amount_tax
        
        # Receivable side
        JournalItem.objects.create(
            entry=entry,
            account=receivable_account,
            debit=total_amount if note_type == Invoice.DTEType.NOTA_DEBITO else 0,
            credit=0 if note_type == Invoice.DTEType.NOTA_DEBITO else total_amount,
            partner=order.customer,
            partner_name=order.customer.name,
            label=f"{invoice.get_dte_type_display()} {document_number} - NV {order.number}"
        )

        # Revenue and Tax side (per product if return_items exist, otherwise global)
        if return_items:
            total_qty = sum(Decimal(str(i.get('quantity', 0))) for i in return_items)
            for item in return_items:
                product = Product.objects.get(id=item['product_id'])
                qty = Decimal(str(item.get('quantity', 0)))
                if qty <= 0: continue

                # Try to use provided unit_price/tax if available (from frontend)
                # otherwise fall back to proportional distribution
                item_price = Decimal(str(item.get('unit_price', 0)))
                item_tax = Decimal(str(item.get('tax_amount', 0)))
                
                if item_price > 0:
                    line_net = (qty * item_price).quantize(Decimal('0.01'))
                    line_tax = (qty * item_tax).quantize(Decimal('0.01')) if item_tax > 0 else \
                               (line_net * Decimal('0.19')).quantize(Decimal('0.01')) # Fallback tax
                elif total_qty > 0:
                    line_net = (qty * (amount_net / total_qty)).quantize(Decimal('0.01'))
                    line_tax = (qty * (amount_tax / total_qty)).quantize(Decimal('0.01'))
                else:
                    line_net = 0
                    line_tax = 0
                
                prod_revenue_acc = product.get_income_account or settings.default_revenue_account
                
                # Revenue Reverse/Increase
                JournalItem.objects.create(
                    entry=entry,
                    account=prod_revenue_acc,
                    debit=line_net if note_type == Invoice.DTEType.NOTA_CREDITO else 0,
                    credit=0 if note_type == Invoice.DTEType.NOTA_CREDITO else line_net,
                    label=f"{'Reverso' if note_type == Invoice.DTEType.NOTA_CREDITO else 'Ajuste'} Venta {product.code or product.id}"
                )
                
                # Tax Reverse/Increase
                if line_tax > 0:
                    JournalItem.objects.create(
                        entry=entry,
                        account=tax_account,
                        debit=line_tax if note_type == Invoice.DTEType.NOTA_CREDITO else 0,
                        credit=0 if note_type == Invoice.DTEType.NOTA_CREDITO else line_tax,
                        label=f"{'Reverso' if note_type == Invoice.DTEType.NOTA_CREDITO else 'Ajuste'} IVA - {product.code or product.id}"
                    )
        else:
            # Global adjustment if no items specified
            revenue_account = settings.default_revenue_account
            JournalItem.objects.create(
                entry=entry,
                account=revenue_account,
                debit=amount_net if note_type == Invoice.DTEType.NOTA_CREDITO else 0,
                credit=0 if note_type == Invoice.DTEType.NOTA_CREDITO else amount_net,
                label=f"{'Reverso' if note_type == Invoice.DTEType.NOTA_CREDITO else 'Ajuste'} Venta Global"
            )
            if amount_tax > 0:
                JournalItem.objects.create(
                    entry=entry,
                    account=tax_account,
                    debit=amount_tax if note_type == Invoice.DTEType.NOTA_CREDITO else 0,
                    credit=0 if note_type == Invoice.DTEType.NOTA_CREDITO else amount_tax,
                    label=f"{'Reverso' if note_type == Invoice.DTEType.NOTA_CREDITO else 'Ajuste'} IVA Global"
                )

        # 4. Inventory Moves & COGS Reversal (Credit Note Returns)
        if note_type == Invoice.DTEType.NOTA_CREDITO and return_items:
            # Determine target warehouse: Try last delivery warehouse, then first available
            last_delivery = order.deliveries.filter(status='CONFIRMED').order_by('-id').first()
            default_warehouse = last_delivery.warehouse if last_delivery else Warehouse.objects.first()
            
            if not default_warehouse:
                print("WARNING: No warehouse found for return moves")
            
            for item in return_items:
                product_id = item.get('product_id')
                if not product_id:
                     print(f"DEBUG: item missing product_id: {item}")
                     continue
                     
                product = Product.objects.get(id=product_id)
                quantity = Decimal(str(item.get('quantity', 0)))
                print(f"DEBUG: Processing return for product {product.name}, quantity {quantity}")
                
                if quantity <= 0: continue
                
                # Update Sale Line quantities (Revert Delivered Qty)
                sale_line = order.lines.filter(product=product).first()
                if sale_line:
                    sale_line.quantity_delivered -= quantity
                    if sale_line.quantity_delivered < 0: sale_line.quantity_delivered = 0
                    sale_line.save()
                    print(f"DEBUG: Reverted delivered qty for line {sale_line.id} to {sale_line.quantity_delivered}")
                
                # Check if we should track inventory for this move
                if product.track_inventory:
                    # Create Stock Move (IN) - Returning to stock
                    StockMove.objects.create(
                        date=timezone.now().date(),
                        product=product,
                        warehouse=default_warehouse,
                        uom=product.uom,
                        quantity=quantity,
                        move_type=StockMove.Type.IN,
                        description=f"Devolución NC {document_number} - NV {order.number}",
                        journal_entry=entry
                    )
                    print(f"DEBUG: Created StockMove (IN) for {product.internal_code}")
                
                # REVERSE COGS
                # Logic: We use the Original Unit Cost from deliveries if possible, then product.cost_price
                original_delivery_line = None
                if sale_line:
                    original_delivery_line = SaleDeliveryLine.objects.filter(
                        sale_line=sale_line,
                        delivery__status='CONFIRMED'
                    ).order_by('-id').first()
                
                unit_cost = original_delivery_line.unit_cost if original_delivery_line else product.cost_price
                line_cogs = (quantity * unit_cost).quantize(Decimal('0.01'), rounding='ROUND_HALF_UP')
                
                print(f"DEBUG: Calculated Reversal COGS for {product.name}: {line_cogs} (Unit Cost: {unit_cost})")
                
                if line_cogs > 0:
                    # Get correct COGS and Inventory accounts from settings
                    # Priority: Product Override -> Settings Type-based -> Settings Global Fallback
                    inventory_account = product.get_asset_account or settings.default_inventory_account
                    
                    # COGS Account selection
                    cogs_account = product.get_expense_account
                    if not cogs_account:
                        if product.product_type == Product.Type.STORABLE:
                            cogs_account = settings.merchandise_cogs_account
                        elif product.product_type == Product.Type.MANUFACTURABLE:
                            cogs_account = settings.manufactured_cogs_account
                        
                    if not cogs_account:
                        cogs_account = settings.default_expense_account
                    
                    if not cogs_account:
                        raise ValidationError(
                            f"No se pudo determinar la cuenta de COGS para {product.name}. "
                            "Por favor configure las cuentas de costo en Configuración de Inventario."
                        )
                    
                    if cogs_account and inventory_account:
                        # Reversal Entries:
                        # Original Sale: Dr COGS, Cr Inventory
                        # RETURN Reversal: Dr Inventory, Cr COGS
                        
                        # Debit: Inventory (Asset increases)
                        JournalItem.objects.create(
                            entry=entry,
                            account=inventory_account,
                            debit=line_cogs,
                            credit=0,
                            label=f"Reingreso Stock - {product.code or product.id}"
                        )
                        # Credit: COGS (Expense decreases)
                        JournalItem.objects.create(
                            entry=entry,
                            account=cogs_account,
                            debit=0,
                            credit=line_cogs,
                            label=f"Reverso COGS - NV {order.number}"
                        )
                        print(f"DEBUG: Created JournalItems for COGS reversal (Inv: {inventory_account.code}, COGS: {cogs_account.code})")
                    else:
                        print(f"DEBUG: Skipping accounting items - missing accounts (Inv: {inventory_account}, COGS: {cogs_account})")

        JournalEntryService.post_entry(entry)
        invoice.journal_entry = entry
        invoice.save()
        
        return invoice
