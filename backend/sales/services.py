from decimal import Decimal

from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from accounting.models import JournalEntry, JournalItem
from accounting.services import AccountingMapper, JournalEntryService
from core.services import BaseNoteService
from inventory.models import StockMove, Warehouse

from .models import SaleDelivery, SaleDeliveryLine, SaleOrder


class SalesService:
    @staticmethod
    @transaction.atomic
    def create_sale_order(validated_data: dict) -> SaleOrder:
        """Creates a SaleOrder and its lines atomically."""
        from .models import SaleLine

        lines_data = validated_data.pop("lines", [])
        payment_method_id = validated_data.pop("payment_method_id", None)

        pm_ref = None
        if payment_method_id:
            from treasury.models import PaymentMethod as TreasuryPM
            pm_ref = TreasuryPM.objects.filter(id=payment_method_id).first()

        order = SaleOrder.objects.create(**validated_data, payment_method_ref=pm_ref)

        for line_data in lines_data:
            SaleLine.objects.create(order=order, **line_data)

        order.recalculate_totals()
        order.save()

        return order

    @staticmethod
    def create_sale_order_from_pos(user, data, files, serializer):
        """
        Validates POS session and PIN, then saves the serializer and confirms the sale.
        """
        pos_session_id = data.get("pos_session_id")
        from treasury.models import POSSession

        session = None
        if pos_session_id:
            session = POSSession.objects.filter(id=pos_session_id, status="OPEN").first()
            if not session:
                raise ValidationError("La sesión de caja especificada no es válida o está cerrada.")
        else:
            session = POSSession.objects.filter(user=user, status="OPEN").last()
            if not session:
                raise ValidationError("Debe tener una sesión de caja activa para crear ventas (o seleccionar una compartida).")

        pos_pin = data.get("pos_pin")
        from core.services import PINService
        from rest_framework.exceptions import PermissionDenied

        salesperson = user

        if pos_pin:
            pin_user = PINService.validate_pin(pos_pin)
            if not pin_user:
                raise PermissionDenied("PIN de seguridad incorrecto.")
            salesperson = pin_user
        else:
            if user == session.user:
                raise PermissionDenied("Se requiere PIN de autorización para confirmar la venta en este terminal.")
            salesperson = user

        serializer.is_valid(raise_exception=True)
        order = serializer.save(pos_session=session, salesperson=salesperson)

        line_files = {}
        if files:
            for key, file_obj in files.items():
                parts = key.split("_")
                if len(parts) >= 3 and parts[0] == "line":
                    try:
                        line_idx = int(parts[1])
                        file_type = parts[2]
                        if line_idx not in line_files:
                            line_files[line_idx] = {"design": [], "approval": None}
                        if file_type == "design":
                            line_files[line_idx]["design"].append(file_obj)
                        elif file_type == "approval":
                            line_files[line_idx]["approval"] = file_obj
                    except ValueError:
                        continue

        SalesService.confirm_sale(order, line_files=line_files)
        return order

    @staticmethod
    def write_off(order):
        from accounting.models import AccountingSettings, JournalEntry, JournalItem
        from treasury.models import TreasuryMovement

        payments = order.payments.filter(is_pending_registration=False)
        paid_in = sum((p.amount for p in payments if p.movement_type in ["INBOUND", "ADJUSTMENT"]), Decimal("0"))
        paid_out = sum((p.amount for p in payments if p.movement_type == "OUTBOUND"), Decimal("0"))
        balance = order.effective_total - (paid_in - paid_out)

        if balance <= 0:
            raise ValidationError("Esta orden no tiene saldo pendiente para castigar.")

        settings = AccountingSettings.get_solo()
        if not settings or not settings.default_uncollectible_expense_account:
            raise ValidationError("No hay una cuenta de gasto por incobrabilidad configurada.")

        contact = order.customer
        receivable_account = settings.default_receivable_account
        if not receivable_account:
            raise ValidationError("No se encontró una cuenta por cobrar configurada.")

        with transaction.atomic():
            entry = JournalEntry.objects.create(
                description=f"Castigo de documento {order.number}: {contact.name}",
                reference=f"CASTIGO-{order.number}",
                status="POSTED",
                source_content_type=ContentType.objects.get_for_model(order.__class__),
                source_object_id=order.id,
            )
            JournalItem.objects.create(
                entry=entry,
                account=settings.default_uncollectible_expense_account,
                label=f"Pérdida por incobrabilidad {order.number}",
                debit=balance,
                credit=0,
            )
            JournalItem.objects.create(
                entry=entry,
                account=receivable_account,
                partner=contact,
                partner_name=contact.name,
                label=f"Cierre de deuda {order.number}",
                debit=0,
                credit=balance,
            )
            TreasuryMovement.objects.create(
                movement_type="ADJUSTMENT",
                payment_method="WRITE_OFF",
                amount=balance,
                contact=contact,
                sale_order=order,
                journal_entry=entry,
                reference="CASTIGO-DOC",
                notes=f"Castigo individual de documento (Asiento {entry.display_id})",
                is_pending_registration=False,
            )

            if not contact.is_default_customer:
                contact.credit_blocked = True
                contact.credit_auto_blocked = False
                contact.credit_risk_level = "CRITICAL"
                contact.save()
            return entry, balance

    @staticmethod
    def confirm_sale(order: SaleOrder, line_files=None):
        """Deprecated: Use SaleOrderService().confirm() instead."""
        from core.services.document import DocumentRegistry

        return DocumentRegistry.for_instance(order).confirm(order, user=None, line_files=line_files)

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
                if (
                    product.strategy.requires_manufacturing_profile
                    and product.requires_advanced_manufacturing
                ):
                    # Check if all associated OTs are finished (unless auto-finalize/express)
                    auto_finalize = (
                        product.mfg_profile.mfg_auto_finalize if product.mfg_profile else False
                    )
                    if not auto_finalize:
                        ots = sale_line.work_orders.exclude(status="CANCELLED")
                        if not ots.exists() or not all(
                            ot.current_stage == "FINISHED" for ot in ots
                        ):
                            raise ValidationError(
                                f"No se puede despachar '{product.name}' porque requiere fabricación avanzada "
                                "y su Orden de Trabajo aún no está finalizada."
                            )

                # Case 2: Simple/Express Manufacturing (Needs BOM components stock)
                elif (
                    product.strategy.requires_manufacturing_profile
                    and not product.requires_advanced_manufacturing
                ):
                    auto_finalize = (
                        product.mfg_profile.mfg_auto_finalize if product.mfg_profile else False
                    )
                    if product.has_bom and not auto_finalize:
                        manufacturable_qty = product.get_manufacturable_quantity()
                        # get_manufacturable_quantity returns None if no BOM or no constraints
                        if manufacturable_qty is not None and manufacturable_qty < requested_qty:
                            raise ValidationError(
                                f"Stock insuficiente de componentes para fabricar '{product.name}'. "
                                f"Máximo posible: {manufacturable_qty}, Solicitado: {requested_qty}"
                            )

                # Case 3: Storable Product (Needs physical stock)
                elif product.strategy.tracks_inventory:
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
            status=SaleDelivery.Status.DRAFT,
        )

        # Process each line
        for sale_line in order.lines.all():
            if sale_line.quantity_pending > 0:
                SalesService._create_delivery_line(
                    delivery=delivery,
                    sale_line=sale_line,
                    quantity=sale_line.quantity_pending,
                    warehouse=warehouse,
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
    def create_delivery_from_note(
        order: SaleOrder,
        warehouse: Warehouse,
        line_data: list,
        delivery_date=None,
        notes=None,
        related_note: "Invoice" = None,
    ):
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
            related_note=related_note,
        )

        for item in line_data:
            line_id = item.get("line_id")
            quantity = Decimal(str(item.get("quantity", 0)))
            uom_id = item.get("uom_id")

            if quantity <= 0:
                continue

            # If line_id exists, use it. If not, we might need to fetch product directly.
            product_id = item.get("product_id")
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
                        quantity=0,  # Note: Actual dispatch qty is in the DeliveryLine
                        unit_price=item.get(
                            "unit_price", product.cost_price * Decimal("1.2")
                        ),  # Fallback markup or provided price
                        uom=uom_id if uom_id else product.uom,
                    )
                    order.recalculate_totals()

            if not sale_line:
                # If still no line, skip
                continue

            # Check Availability
            if product.strategy.tracks_inventory:
                # Simplified check: assumes base UoM for now
                if product.qty_available < quantity:
                    raise ValidationError(f"Stock insuficiente para {product.name} (Nota Débito).")

            uom = UoM.objects.filter(id=uom_id).first() if uom_id else sale_line.uom

            SalesService._create_delivery_line(
                delivery=delivery,
                sale_line=sale_line,
                quantity=quantity,
                warehouse=warehouse,
                uom=uom,
            )

        SalesService.confirm_delivery(delivery)
        return delivery

    @staticmethod
    @transaction.atomic
    def partial_dispatch(
        order: SaleOrder, warehouse: Warehouse, line_data: list, delivery_date=None
    ):
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
            status=SaleDelivery.Status.DRAFT,
        )

        # Process specified lines
        for item in line_data:
            line_id = item.get("line_id")
            quantity = Decimal(str(item.get("quantity", 0)))
            uom_id = item.get("uom_id")

            if quantity <= 0:
                continue

            sale_line = order.lines.get(id=line_id)

            # VALIDATION: Prevent dispatch based on stock/production status
            product = sale_line.product
            if product:
                # Case 1: Advanced Manufacturing (Needs Finished OT)
                if (
                    product.strategy.requires_manufacturing_profile
                    and product.requires_advanced_manufacturing
                ):
                    auto_finalize = (
                        product.mfg_profile.mfg_auto_finalize if product.mfg_profile else False
                    )
                    if not auto_finalize:
                        ots = sale_line.work_orders.exclude(status="CANCELLED")
                        if not ots.exists() or not all(
                            ot.current_stage == "FINISHED" for ot in ots
                        ):
                            raise ValidationError(
                                f"No se puede despachar '{product.name}' porque requiere fabricación avanzada "
                                "y su Orden de Trabajo aún no está finalizada."
                            )

                # Case 2: Simple/Express Manufacturing (Needs BOM components stock)
                elif (
                    product.strategy.requires_manufacturing_profile
                    and not product.requires_advanced_manufacturing
                ):
                    auto_finalize = (
                        product.mfg_profile.mfg_auto_finalize if product.mfg_profile else False
                    )
                    if product.has_bom and not auto_finalize:
                        manufacturable_qty = product.get_manufacturable_quantity()
                        if manufacturable_qty is not None and manufacturable_qty < quantity:
                            raise ValidationError(
                                f"Stock insuficiente de componentes para fabricar '{product.name}'. "
                                f"Máximo posible: {manufacturable_qty}, Solicitado: {quantity}"
                            )

                # Case 3: Storable Product (Needs physical stock)
                elif product.strategy.tracks_inventory:
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
                uom=uom,
            )

        # Confirm delivery
        SalesService.confirm_delivery(delivery)

        # Update order delivery status
        SalesService._update_order_delivery_status(order)

        return delivery

    @staticmethod
    def partial_dispatch_from_request(order, request_data):
        warehouse_id = request_data.get("warehouse_id")
        delivery_date = request_data.get("delivery_date")
        # Support both old and new format for safer transition
        line_quantities = request_data.get("line_quantities")
        if line_quantities and isinstance(line_quantities, dict):
            line_data = [{"line_id": int(k), "quantity": v} for k, v in line_quantities.items()]
        else:
            line_data = request_data.get("line_data", [])

        warehouse = Warehouse.objects.get(pk=warehouse_id)
        return SalesService.partial_dispatch(
            order=order, warehouse=warehouse, line_data=line_data, delivery_date=delivery_date
        )

    @staticmethod
    def _create_delivery_line(delivery, sale_line, quantity, warehouse, uom=None):
        """Helper to create a delivery line"""
        product = sale_line.product

        if not product:
            raise ValidationError(f"La línea '{sale_line.description}' no tiene producto asociado.")

        # Determine unit cost
        if product.strategy.can_have_bom:
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
            unit_cost=unit_cost,
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

        from inventory.models import Product
        from inventory.services import UoMService
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
            if product and product.strategy.requires_manufacturing_profile:
                if product.requires_advanced_manufacturing:
                    continue

                # Create OT for express products
                auto_finalize = (
                    product.mfg_profile.mfg_auto_finalize if product.mfg_profile else False
                )
                if auto_finalize:
                    print(
                        f"DEBUG: Creating OT for EXPRESS product {product.internal_code} in delivery {delivery.number}"
                    )
                    work_order = WorkOrderService.create_ot_for_delivery_line(
                        delivery_line=line,
                        related_note=delivery.related_note,  # Will be set for debit note deliveries
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
                    line.quantity, from_uom=line.uom or line.sale_line.uom, to_uom=line.product.uom
                )

                # Create stock move (OUT)
                print(
                    f"DEBUG: Creating StockMove for product {product.internal_code}, qty {-base_qty}, warehouse {delivery.warehouse.name}"
                )
                stock_move = StockMove.objects.create(
                    date=delivery.delivery_date,
                    product=product,
                    warehouse=delivery.warehouse,
                    uom=product.uom,
                    quantity=-base_qty,  # Negative for OUT move
                    move_type=StockMove.Type.OUT,
                    description=f"Despacho NV-{delivery.sale_order.number}",  # Updated description
                    source_uom=line.uom or line.sale_line.uom,
                    source_quantity=line.quantity,
                )
                created_moves.append(stock_move)

                # Link stock move to delivery line
                line.stock_move = stock_move
                # Ensure unit_cost is the product's current cost
                line.unit_cost = product.cost_price
                line.save()

            # PATH B: Product DOES NOT track inventory (Service or Non-tracked Manufactured)
            else:
                if product.strategy.can_have_bom:
                    # SAFEGUARD: If this sale line already has a Work Order,
                    # do NOT explode BOM again here (production already consumed materials).
                    if line.sale_line.work_orders.exists():
                        print(
                            f"DEBUG: Product {product.internal_code} has Work Order - cost already expensed in OT"
                        )
                        # For products with finished OTs, the cost was already expensed during production
                        # We just need to set the unit_cost for reference (no new stock moves or accounting entries)
                        line.unit_cost = product.get_bom_cost()
                        line.save()
                        # IMPORTANT: Do NOT create stock moves or accounting entries here
                        # They were already created during OT finalization
                    else:
                        active_bom = BillOfMaterials.objects.filter(
                            product=product, active=True
                        ).first()
                        if active_bom:
                            # BOM Explosion: Consume components instead of the product
                            line_total_cost = Decimal("0.00")
                            for bom_line in active_bom.lines.all():
                                # 1. First, calculate total requirement in the BOM line's UoM
                                # Requirement = (Sale Qty in Sale UoM) * (BOM Qty per Unit)
                                # NOTE: This assumes BOM quantity is per "Base Unit" of the product.
                                # If sold in a different UoM, we must convert Sale Qty to Base UoM first.
                                base_sale_qty = UoMService.convert_quantity(
                                    line.quantity, from_uom=line.sale_line.uom, to_uom=product.uom
                                )

                                comp_qty_in_bom_uom = base_sale_qty * bom_line.quantity

                                # 2. Convert to component's base UoM for Kardex
                                base_comp_qty = UoMService.convert_quantity(
                                    comp_qty_in_bom_uom,
                                    from_uom=bom_line.uom,
                                    to_uom=bom_line.component.uom,
                                )

                                # Create stock move (OUT) for the COMPONENT
                                comp_move = StockMove.objects.create(
                                    date=delivery.delivery_date,
                                    product=bom_line.component,
                                    warehouse=delivery.warehouse,
                                    uom=bom_line.component.uom,
                                    quantity=-base_comp_qty,
                                    move_type=StockMove.Type.OUT,
                                    description=f"Consumo BOM p/Despacho {delivery.number} ({product.name})",
                                )
                                created_moves.append(comp_move)

                                # Calculate component cost contribution
                                line_total_cost += base_comp_qty * bom_line.component.cost_price

                            # Set unit_cost for accounting based on component consumption
                            if line.quantity > 0:
                                line.unit_cost = (line_total_cost / line.quantity).quantize(
                                    Decimal("0.01")
                                )
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
            description, reference, items = AccountingMapper.get_entries_for_delivery(
                delivery, settings
            )

            if items:
                entry = JournalEntryService.create_entry(
                    {
                        "date": delivery.delivery_date,
                        "description": description,
                        "status": JournalEntry.State.DRAFT,
                        "is_manual": False,
                        "source_content_type": ContentType.objects.get_for_model(delivery),
                        "source_object_id": delivery.id,
                    },
                    items,
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
        total_qty = sum(line.quantity for line in original_lines)
        total_delivered = sum(line.quantity_delivered for line in original_lines)
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
    def cancel_sale_order(order: SaleOrder, user=None, reason: str = ""):
        """
        Cancels a sale order by cancelling children and marking it as CANCELLED.
        - DRAFT order → soft cancel children, mark CANCELLED, no reversals.
        - CONFIRMED order → delegate to SaleOrderService.cancel() (full annul).
        """
        from core.services.document import lock_document

        lock_document(order)

        if order.status == SaleOrder.Status.CANCELLED:
            return order

        from billing.services import BillingService
        from treasury.models import TreasuryMovement
        from treasury.services import TreasuryService

        if order.status == SaleOrder.Status.DRAFT:
            # VALIDATION 1: Deliveries with confirmed status
            confirmed_deliveries = order.deliveries.filter(status="CONFIRMED").exists()
            if confirmed_deliveries:
                raise ValidationError(
                    "❌ No se puede cancelar: existen despachos confirmados.\n"
                    "📦 Los productos ya fueron despachados físicamente.\n"
                    "💡 Use la acción 'Anular' en el despacho primero."
                )

            # VALIDATION 2: Posted payments (status is canonical; JE check covers
            # legacy movements created before the status field existed)
            from django.db.models import Q

            posted_payments = order.payments.filter(
                Q(status=TreasuryMovement.MovementStatus.POSTED) | Q(journal_entry__status="POSTED")
            ).exists()
            if posted_payments:
                raise ValidationError(
                    "❌ No se puede cancelar: existen pagos contabilizados.\n"
                    "💡 Use la acción 'Anular' para revertir con asientos de reversión."
                )

            # Soft cancel children
            for invoice in order.invoices.all():
                if invoice.status != "CANCELLED":
                    BillingService.cancel_invoice(invoice, user=user, reason=reason)

            for movement in order.payments.all():
                if movement.status != TreasuryMovement.MovementStatus.CANCELLED:
                    TreasuryService.cancel_movement(movement, user=user, reason=reason)

            for delivery in order.deliveries.all():
                if delivery.status != SaleDelivery.Status.CANCELLED:
                    delivery.status = SaleDelivery.Status.CANCELLED
                    delivery.save()

            # Work Orders: annul_work_order valida etapa límite y consumos;
            # si la OT ya avanzó demasiado, bloquea toda la cancelación (atomic).
            from production.models import WorkOrder
            from production.services import WorkOrderService

            for work_order in order.work_orders.exclude(status=WorkOrder.Status.CANCELLED):
                WorkOrderService.annul_work_order(work_order, user=user, notes=reason)

            if order.journal_entry:
                from tax.services import validate_period_open

                validate_period_open(order.journal_entry.date, action="cancelar la orden")
                order.journal_entry.delete()

            order.status = SaleOrder.Status.CANCELLED
            order.save()

            from workflow.services import WorkflowService

            WorkflowService.log_transition(order, "cancel", user=user, reason=reason)
        else:
            # CONFIRMED: delegate to DocumentService.cancel (full annul with reversals)
            from core.services.document import DocumentRegistry

            DocumentRegistry.for_instance(order).cancel(order, user=user, reason=reason)

        return order

    @staticmethod
    def validate_purge(order: SaleOrder):
        """
        Un documento solo puede purgarse (hard delete) si está CANCELLED y no dejó
        huella contable: documentos anulados con reversos se conservan por auditoría.
        """
        if order.status != SaleOrder.Status.CANCELLED:
            raise ValidationError("Use POST /cancel/ para cancelar documentos activos.")
        has_accounting_trace = (
            order.journal_entry_id is not None
            or order.invoices.filter(journal_entry__isnull=False).exists()
            or order.payments.filter(journal_entry__isnull=False).exists()
            or order.deliveries.filter(journal_entry__isnull=False).exists()
        )
        if has_accounting_trace:
            raise ValidationError(
                "No se puede eliminar: el documento tiene asientos contables asociados. "
                "Los documentos anulados se conservan como pista de auditoría."
            )

    @staticmethod
    @transaction.atomic
    def annul_delivery(delivery: SaleDelivery, user=None, reason: str = ""):
        """
        Annuls a confirmed delivery:
        1. Reverses COGS accounting entry.
        2. Creates reversal stock movements (IN).
        3. Reverts delivered quantities on sale lines.
        4. Marks delivery as CANCELLED.
        """
        from core.services.document import lock_document

        lock_document(delivery)

        if delivery.status == SaleDelivery.Status.CANCELLED:
            return delivery

        if not reason:
            raise ValidationError("Debe indicar el motivo de la anulación.")

        if delivery.status != SaleDelivery.Status.CONFIRMED:
            raise ValidationError("Solo se pueden anular despachos confirmados.")

        # 1. Reverse Accounting
        rev_entry = None
        if delivery.journal_entry:
            from tax.services import validate_period_open

            validate_period_open(timezone.now().date(), action="anular el despacho")
            rev_entry = JournalEntryService.reverse_entry(
                delivery.journal_entry, description=f"Anulación Despacho {delivery.number}"
            )

        # 2. Reverse Stock Moves & Update Sale Lines
        for line in delivery.lines.all():
            # Create Reversal Move (IN)
            if line.stock_move:
                StockMove.objects.create(
                    date=timezone.now().date(),
                    product=line.product,
                    warehouse=delivery.warehouse,
                    quantity=abs(line.stock_move.quantity),  # Positive IN
                    move_type=StockMove.Type.IN,
                    description=f"Anulación Despacho {delivery.number} ({line.product.code})",
                    journal_entry=rev_entry,
                )

            # Revert delivered quantity
            line.sale_line.quantity_delivered -= line.quantity
            line.sale_line.save()

        # 3. Update Delivery Status
        delivery.status = SaleDelivery.Status.CANCELLED
        delivery.save()

        # 4. Update Order Delivery Status
        SalesService._update_order_delivery_status(delivery.sale_order)

        from workflow.services import WorkflowService

        WorkflowService.log_transition(delivery, "annul", user=user, reason=reason)

        return delivery

    @staticmethod
    def register_note_from_request(request, order: SaleOrder):
        import json
        from purchasing.serializers import NoteCreationSerializer
        
        data = request.data.dict() if hasattr(request.data, "dict") else request.data.copy()
        if "return_items" in data and isinstance(data["return_items"], str):
            try:
                data["return_items"] = json.loads(data["return_items"])
            except Exception:
                pass

        serializer = NoteCreationSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        val = serializer.validated_data
        return SalesService.create_note(
            order=order,
            note_type=val["note_type"],
            amount_net=val["amount_net"],
            amount_tax=val["amount_tax"],
            document_number=val["document_number"],
            document_attachment=request.FILES.get("document_attachment"),
            return_items=val.get("return_items"),
            original_invoice_id=val.get("original_invoice_id"),
            date=val.get("document_date"),
        )

    @staticmethod
    @transaction.atomic
    def create_note(
        order: SaleOrder,
        note_type: str,
        amount_net: Decimal,
        amount_tax: Decimal,
        document_number: str,
        document_attachment=None,
        return_items=None,
        original_invoice_id=None,
        date=None,
    ):
        print(f"DEBUG: create_note service started for order {order.number}")
        print(f"DEBUG: note_type: {note_type}, return_items: {return_items}")
        """
        Creation of a Credit or Debit Note linked to a Sale Order.
        - note_type: NOTA_CREDITO or NOTA_DEBITO
        - return_items: list of { 'product_id': int, 'quantity': Decimal }
        """
        from accounting.models import AccountingSettings
        from billing.models import Invoice
        from inventory.models import Product, StockMove, Warehouse

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
                    Invoice.DTEType.BOLETA_EXENTA,
                ]
            ).first()

        # 1. Business Logic Validations
        if return_items:
            for item in return_items:
                product = Product.objects.get(id=item["product_id"])
                quantity = Decimal(str(item["quantity"]))

                # Rule: No returns for services
                if not product.strategy.supports_returns:
                    raise ValidationError(
                        f"No se pueden registrar devoluciones físicas para servicios ({product.name})."
                    )

                # Rule: Debit Note restricted for manufacturable non-storable products
                if note_type == Invoice.DTEType.NOTA_DEBITO:
                    if (
                        product.strategy.requires_manufacturing_profile
                        and not product.track_inventory
                    ):
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
            partner_name=order.customer.name,
            date=date,
        )

        if original_invoice:
            invoice.corrected_invoice = original_invoice
            invoice.save()

        # 3. Accounting Entries
        # We try to use specific product accounts for NC/ND transparency
        receivable_account = settings.default_receivable_account
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
            label=f"{invoice.get_dte_type_display()} {document_number} - NV {order.number}",
        )

        # Revenue and Tax side (per product if return_items exist, otherwise global)
        if return_items:
            total_qty = sum(Decimal(str(i.get("quantity", 0))) for i in return_items)
            for item in return_items:
                product = Product.objects.get(id=item["product_id"])
                qty = Decimal(str(item.get("quantity", 0)))
                if qty <= 0:
                    continue

                # Try to use provided unit_price/tax if available (from frontend)
                # otherwise fall back to proportional distribution
                item_price = Decimal(str(item.get("unit_price", 0)))
                item_tax = Decimal(str(item.get("tax_amount", 0)))

                if item_price > 0:
                    line_net = (qty * item_price).quantize(Decimal("0.01"))
                    from accounting.utils import get_default_vat_rate

                    line_tax = (
                        (qty * item_tax).quantize(Decimal("0.01"))
                        if item_tax > 0
                        else (line_net * get_default_vat_rate() / Decimal("100")).quantize(
                            Decimal("0.01")
                        )
                    )  # Fallback tax
                elif total_qty > 0:
                    line_net = (qty * (amount_net / total_qty)).quantize(Decimal("0.01"))
                    line_tax = (qty * (amount_tax / total_qty)).quantize(Decimal("0.01"))
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
                    label=f"{'Reverso' if note_type == Invoice.DTEType.NOTA_CREDITO else 'Ajuste'} Venta {product.code or product.id}",
                )

                # Tax Reverse/Increase
                if line_tax > 0:
                    JournalItem.objects.create(
                        entry=entry,
                        account=tax_account,
                        debit=line_tax if note_type == Invoice.DTEType.NOTA_CREDITO else 0,
                        credit=0 if note_type == Invoice.DTEType.NOTA_CREDITO else line_tax,
                        label=f"{'Reverso' if note_type == Invoice.DTEType.NOTA_CREDITO else 'Ajuste'} IVA - {product.code or product.id}",
                    )
        else:
            # Global adjustment if no items specified
            revenue_account = settings.default_revenue_account
            JournalItem.objects.create(
                entry=entry,
                account=revenue_account,
                debit=amount_net if note_type == Invoice.DTEType.NOTA_CREDITO else 0,
                credit=0 if note_type == Invoice.DTEType.NOTA_CREDITO else amount_net,
                label=f"{'Reverso' if note_type == Invoice.DTEType.NOTA_CREDITO else 'Ajuste'} Venta Global",
            )
            if amount_tax > 0:
                JournalItem.objects.create(
                    entry=entry,
                    account=tax_account,
                    debit=amount_tax if note_type == Invoice.DTEType.NOTA_CREDITO else 0,
                    credit=0 if note_type == Invoice.DTEType.NOTA_CREDITO else amount_tax,
                    label=f"{'Reverso' if note_type == Invoice.DTEType.NOTA_CREDITO else 'Ajuste'} IVA Global",
                )

        # 4. Inventory Moves & COGS Reversal (Credit Note Returns)
        if note_type == Invoice.DTEType.NOTA_CREDITO and return_items:
            # Determine target warehouse: Try last delivery warehouse, then first available
            last_delivery = order.deliveries.filter(status="CONFIRMED").order_by("-id").first()
            default_warehouse = (
                last_delivery.warehouse if last_delivery else Warehouse.objects.first()
            )

            if not default_warehouse:
                print("WARNING: No warehouse found for return moves")

            for item in return_items:
                product_id = item.get("product_id")
                if not product_id:
                    print(f"DEBUG: item missing product_id: {item}")
                    continue

                product = Product.objects.get(id=product_id)
                quantity = Decimal(str(item.get("quantity", 0)))
                print(f"DEBUG: Processing return for product {product.name}, quantity {quantity}")

                if quantity <= 0:
                    continue

                # Update Sale Line quantities (Revert Delivered Qty)
                sale_line = order.lines.filter(product=product).first()
                if sale_line:
                    sale_line.quantity_delivered -= quantity
                    if sale_line.quantity_delivered < 0:
                        sale_line.quantity_delivered = 0
                    sale_line.save()
                    print(
                        f"DEBUG: Reverted delivered qty for line {sale_line.id} to {sale_line.quantity_delivered}"
                    )

                # Check if we should track inventory for this move
                if product.track_inventory:
                    # Create Stock Move (IN) - Returning to stock
                    StockMove.objects.create(
                        date=date or timezone.now().date(),
                        product=product,
                        warehouse=default_warehouse,
                        uom=product.uom,
                        quantity=quantity,
                        move_type=StockMove.Type.IN,
                        description=f"Devolución NC {document_number} - NV {order.number}",
                        journal_entry=entry,
                    )
                    print(f"DEBUG: Created StockMove (IN) for {product.internal_code}")

                # REVERSE COGS
                # Logic: We use the Original Unit Cost from deliveries if possible, then product.cost_price
                original_delivery_line = None
                if sale_line:
                    original_delivery_line = (
                        SaleDeliveryLine.objects.filter(
                            sale_line=sale_line, delivery__status="CONFIRMED"
                        )
                        .order_by("-id")
                        .first()
                    )

                unit_cost = (
                    original_delivery_line.unit_cost
                    if original_delivery_line
                    else product.cost_price
                )
                line_cogs = (quantity * unit_cost).quantize(
                    Decimal("0.01"), rounding="ROUND_HALF_UP"
                )

                print(
                    f"DEBUG: Calculated Reversal COGS for {product.name}: {line_cogs} (Unit Cost: {unit_cost})"
                )

                if line_cogs > 0:
                    # Get correct COGS and Inventory accounts from settings
                    # Priority: Product Override -> Settings Type-based -> Settings Global Fallback
                    inventory_account = product.get_asset_account

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
                            label=f"Reingreso Stock - {product.code or product.id}",
                        )
                        # Credit: COGS (Expense decreases)
                        JournalItem.objects.create(
                            entry=entry,
                            account=cogs_account,
                            debit=0,
                            credit=line_cogs,
                            label=f"Reverso COGS - NV {order.number}",
                        )
                        print(
                            f"DEBUG: Created JournalItems for COGS reversal (Inv: {inventory_account.code}, COGS: {cogs_account.code})"
                        )
                    else:
                        print(
                            f"DEBUG: Skipping accounting items - missing accounts (Inv: {inventory_account}, COGS: {cogs_account})"
                        )

        JournalEntryService.post_entry(entry)
        invoice.journal_entry = entry
        invoice.save()

        return invoice


from core.services.document import DocumentRegistry, DocumentService


@DocumentRegistry.register("sales.saleorder")
class SaleOrderService(DocumentService):
    @transaction.atomic
    def confirm(self, document, *, user, **kwargs):
        """
        Confirms a sale order and creates the corresponding Journal Entry.
        """
        order = document
        line_files = kwargs.get("line_files")

        if order.status != SaleOrder.Status.DRAFT:
            return order

        # Compute totals before confirming (part of P-04 pattern)
        if hasattr(order, "totals_strategy") and order.totals_strategy:
            order.totals_strategy().compute(order)

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
                            line.quantity, from_uom=line.uom, to_uom=product.uom
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

            for i, line in enumerate(order.lines.all()):
                if line.product and line.product.strategy.requires_manufacturing_profile:
                    # IMPORTANT: Only create OT if requires advanced manufacturing
                    # Express products: OT will be created during delivery confirmation
                    if line.product.requires_advanced_manufacturing:
                        # Check if an OT already exists for this line to avoid duplicates
                        if not line.work_orders.exists():
                            print(
                                f"DEBUG: Triggering auto-OT for ADVANCED product {line.product.internal_code} on SaleOrder {order.number}"
                            )
                            try:
                                # Extract files for this specific line if provided
                                current_line_files = line_files.get(i) if line_files else None
                                ot = WorkOrderService.create_from_sale_line(
                                    line, files=current_line_files
                                )
                                if ot:
                                    print(
                                        f"DEBUG: Successfully created OT {ot.number} for {line.product.internal_code}"
                                    )
                                else:
                                    print(
                                        f"DEBUG: WorkOrderService.create_from_sale_line returned None for {line.product.internal_code}"
                                    )
                            except Exception as e:
                                print(
                                    f"ERROR creating OT for {line.product.internal_code}: {str(e)}"
                                )
                        else:
                            print(
                                f"DEBUG: OT already exists for line {line.id} ({line.product.internal_code})"
                            )
                    else:
                        print(
                            f"DEBUG: Skipping OT creation for EXPRESS product {line.product.internal_code} - will be created at dispatch"
                        )

            # NOTE: Accounting entry moved to BillingService.create_sale_invoice

            # Create HUB stage tasks for the inbox
            # HUB Tasks Sync
            from workflow.services import WorkflowService

            WorkflowService.sync_hub_tasks(order)

            return order

    @transaction.atomic
    def cancel(self, document, *, user, reason: str = "", **kwargs):
        """
        Annuls a sale order and all its associated documents.
        """
        order = document
        force = kwargs.get("force", False)

        from core.services.document import lock_document

        lock_document(order)

        if order.status == SaleOrder.Status.CANCELLED:
            return order

        if not reason:
            raise ValidationError("Debe indicar el motivo de la anulación.")

        from billing.models import Invoice
        from billing.services import BillingService
        from treasury.models import TreasuryMovement
        from treasury.services import TreasuryService

        # 1. Handle Invoices — cancel if DRAFT, annul if POSTED/PAID
        for invoice in order.invoices.all():
            if invoice.status == Invoice.Status.CANCELLED:
                continue
            if invoice.status == Invoice.Status.DRAFT:
                BillingService.cancel_invoice(invoice, user=user, reason=reason)
            else:
                BillingService.annul_invoice(invoice, force=force, user=user, reason=reason)

        # 2. Handle Deliveries — cancel if DRAFT, annul if CONFIRMED
        for delivery in order.deliveries.all():
            if delivery.status == SaleDelivery.Status.CANCELLED:
                continue
            if delivery.status == SaleDelivery.Status.DRAFT:
                delivery.status = SaleDelivery.Status.CANCELLED
                delivery.save()
            else:
                SalesService.annul_delivery(delivery, user=user, reason=reason)

        # 3. Handle Payments — cancel if DRAFT (sin JE POSTED), annul if POSTED
        for movement in order.payments.all():
            if movement.status == TreasuryMovement.MovementStatus.CANCELLED:
                continue
            je_posted = movement.journal_entry and movement.journal_entry.status == "POSTED"
            if movement.status == TreasuryMovement.MovementStatus.DRAFT and not je_posted:
                TreasuryService.cancel_movement(movement, user=user, reason=reason)
            else:
                TreasuryService.annul_movement(
                    movement,
                    user=user,
                    reason=reason,
                    treasury_account_id=(
                        movement.to_account_id
                        if movement.movement_type == "INBOUND"
                        else movement.from_account_id
                    ),
                )

        # 4. Handle Work Orders — annul with stage-limit/consumption validations.
        # Si una OT superó la etapa límite, ValidationError aborta toda la anulación.
        from production.models import WorkOrder
        from production.services import WorkOrderService

        for work_order in order.work_orders.exclude(status=WorkOrder.Status.CANCELLED):
            WorkOrderService.annul_work_order(work_order, user=user, notes=reason)

        order.status = SaleOrder.Status.CANCELLED
        if reason:
            order.notes = (order.notes or "") + f"\nAnulado: {reason}"
        order.save()

        WorkflowService.log_transition(order, "annul", user=user, reason=reason)
        return order

    @staticmethod
    def get_comments_queryset(order):
        from django.contrib.contenttypes.models import ContentType
        from production.models import WorkOrder
        from workflow.models import Comment

        so_ct = ContentType.objects.get_for_model(order.__class__)
        qs = Comment.objects.filter(content_type=so_ct, object_id=order.pk)

        # Fetch comments from all related WorkOrders
        production_orders = order.production_orders.all()
        if production_orders.exists():
            wo_ct = ContentType.objects.get_for_model(WorkOrder)
            wo_qs = Comment.objects.filter(
                content_type=wo_ct, object_id__in=production_orders.values_list("pk", flat=True)
            )
            qs = (qs | wo_qs).order_by("created_at")
        else:
            qs = qs.order_by("created_at")
        return qs

    @staticmethod
    def add_comment_from_request(order, request):
        text = (request.data.get("text") or "").strip()
        if not text:
            raise ValidationError("text es requerido")

        from workflow.services import WorkflowService

        return WorkflowService.add_comment(
            content_object=order,
            user=request.user,
            text=text,
        )


class SalesSettingsService:
    ACCOUNTING_SETTINGS_FIELDS = ["default_receivable_account", "default_revenue_account"]

    @staticmethod
    def get_accounting_settings_data():
        from accounting.models import AccountingSettings

        settings = AccountingSettings.get_solo()
        return {
            "default_receivable_account": settings.default_receivable_account_id,
            "default_revenue_account": settings.default_revenue_account_id,
        }

    @staticmethod
    def update_accounting_settings(fields_data):
        from accounting.models import Account, AccountingSettings

        settings = AccountingSettings.get_solo()
        updated = False
        if "default_receivable_account" in fields_data:
            val = fields_data["default_receivable_account"]
            settings.default_receivable_account = (
                Account.objects.get(pk=int(val)) if val else None
            )
            updated = True
        if "default_revenue_account" in fields_data:
            val = fields_data["default_revenue_account"]
            settings.default_revenue_account = (
                Account.objects.get(pk=int(val)) if val else None
            )
            updated = True
        if updated:
            settings.save()

    @staticmethod
    def get_or_update_current_settings(obj, request_data, method, serializer_factory):
        if method == "GET":
            serializer = serializer_factory(obj)
            data = serializer.data
            data.update(SalesSettingsService.get_accounting_settings_data())
            return data

        sales_fields = {
            k: v
            for k, v in request_data.items()
            if k not in SalesSettingsService.ACCOUNTING_SETTINGS_FIELDS
        }
        accounting_fields = {
            k: v
            for k, v in request_data.items()
            if k in SalesSettingsService.ACCOUNTING_SETTINGS_FIELDS
        }

        if sales_fields:
            serializer = serializer_factory(obj, data=sales_fields, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()

        if accounting_fields:
            SalesSettingsService.update_accounting_settings(accounting_fields)

        serializer = serializer_factory(obj)
        data = serializer.data
        data.update(SalesSettingsService.get_accounting_settings_data())
        return data
