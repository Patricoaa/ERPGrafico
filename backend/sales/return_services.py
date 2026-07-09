from decimal import Decimal

from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from core.prefix_registry import EntityPrefix
from accounting.glosa_builder import GlosaBuilder, Roles
from accounting.models import JournalEntry, JournalItem
from accounting.services import JournalEntryService
from inventory.models import StockMove, Warehouse
from inventory.services import UoMService

from .models import SaleOrder, SaleReturn, SaleReturnLine


class ReturnService:
    @staticmethod
    @transaction.atomic
    def annul_return(return_doc_id: int):
        """
        Annuls a return:
        1. Reverse/Cancel Accounting Entry.
        2. Reverse/Cancel Stock Moves.
        3. Set status to CANCELLED.
        """
        try:
            doc = SaleReturn.objects.get(id=return_doc_id)
        except SaleReturn.DoesNotExist:
            raise ValidationError("Devolución no encontrada.")

        if doc.status == SaleReturn.Status.CANCELLED:
            return doc

        # 1. Reverse Accounting
        if doc.journal_entry:
            JournalEntryService.reverse_entry(
                doc.journal_entry, description=f"Anulación {doc.display_id}"
            )

        # 2. Reverse Stock Moves (Create opposite moves)
        from inventory.models import InventoryDocument, InventoryDocumentDetail
        from inventory.services import InventoryService

        doc_inv = InventoryDocument.objects.create(
            document_type=InventoryDocument.Type.DELIVERY,
            status=InventoryDocument.Status.DRAFT,
            date=timezone.now().date(),
            reference=f"Anulación {doc.display_id}",
            partner=doc.sale_order.client
        )
        details_to_create = []

        for line in doc.lines.all():
            if line.stock_move:
                details_to_create.append(
                    InventoryDocumentDetail(
                        document=doc_inv,
                        product=line.product,
                        warehouse=doc.warehouse,
                        quantity=abs(line.stock_move.quantity),  # Delivery expects positive
                        unit_cost=line.stock_move.unit_cost
                    )
                )

        if details_to_create:
            InventoryDocumentDetail.objects.bulk_create(details_to_create)
            InventoryService.confirmar_documento(doc_inv)
        else:
            doc_inv.delete()

        doc.status = SaleReturn.Status.CANCELLED
        doc.save()
        return doc

    @staticmethod
    @transaction.atomic
    def create_return_from_note_request(
        order: SaleOrder,
        items: list,  # [{'product_id': 1, 'quantity': 10, 'uom_id': 2}, ...]
        warehouse_id: int,
        date: str = None,
        notes: str = "",
        credit_note: "Invoice" = None,
    ) -> SaleReturn:
        """
        Creates a DRAFT SaleReturn from a Credit Note request (or standalone return).
        """
        if not date:
            date = timezone.now().date()

        try:
            warehouse = Warehouse.objects.get(id=warehouse_id)
        except Warehouse.DoesNotExist:
            raise ValidationError(f"Bodega con ID {warehouse_id} no existe.")

        # Create Return Header
        ret_doc = SaleReturn.objects.create(
            sale_order=order,
            warehouse=warehouse,
            date=date,
            status=SaleReturn.Status.DRAFT,
            notes=notes,
            credit_note=credit_note,
        )

        # Create Return Lines
        for item in items:
            product_id = item["product_id"]
            quantity = Decimal(str(item["quantity"]))

            if quantity <= 0:
                continue

            # Find matching Product
            from inventory.models import Product

            try:
                product = Product.objects.get(id=product_id)
            except Product.DoesNotExist:
                continue

            # TRY TO FIND ORIGINAL COST (from last successful delivery of this product in this order)
            # This ensures accounting reversal uses the cost at sale time, not current WAC.
            from sales.models import SaleDeliveryLine

            original_delivery_line = (
                SaleDeliveryLine.objects.filter(
                    delivery__sale_order=order, product=product, delivery__status="CONFIRMED"
                )
                .order_by("-delivery__delivery_date", "-id")
                .first()
            )

            original_cost = (
                original_delivery_line.unit_cost if original_delivery_line else product.cost_price
            )

            # Determine unit prices (prefer provided, then original sale line, then product)
            unit_price = item.get("unit_price")
            unit_price_gross = item.get("unit_price_gross")

            if unit_price is None and original_delivery_line:
                unit_price = original_delivery_line.unit_price
                unit_price_gross = original_delivery_line.unit_price_gross
            elif unit_price is None:  # Fallback to product current prices
                unit_price = product.sale_price
                # Note: gross calculation if product doesn't have it explicitly stored
                from accounting.utils import get_vat_multiplier

                unit_price_gross = product.sale_price * get_vat_multiplier()

            # Create Line
            SaleReturnLine.objects.create(
                return_doc=ret_doc,
                product=product,
                quantity=quantity,
                uom_id=item.get("uom_id"),
                unit_price=unit_price,
                unit_price_gross=unit_price_gross,
                unit_cost=original_cost,
            )

        # VALIDATION: Check total returned quantity against Credit Note limits
        if credit_note:
            # Re-fetch lines to include the newly created ones (or calculate manually)
            # We want to ensure Sum(Returns linked to this NC) <= NC Quantity

            for item in items:
                p_id = item["product_id"]
                # Get NC line quantity
                # NC lines are stored in workflow.selected_items (JSON) or we might need to rely on the fact
                # that 'credit_note' model usually doesn't store lines in a related table if it was created via workflow,
                # BUT the Invoice serializer creates a 'lines' representation.
                # However, for robustness, we look at the Workflow data if available, or just assume the user knows.
                # BETTER APPROACH: The NC itself doesn't track "remaining".
                # But we can check if Sum(All Returns for this NC) > NC Total Qty for that product.

                # 1. Get allocated qty in NC
                nc_qty = Decimal(0)
                if (
                    hasattr(credit_note, "workflow")
                    and credit_note.workflow
                    and credit_note.workflow.selected_items
                ):
                    for nc_item in credit_note.workflow.selected_items:
                        if nc_item["product_id"] == p_id:
                            nc_qty += Decimal(str(nc_item["quantity"]))

                if nc_qty > 0:
                    # 2. Get total already returned (including this new doc's lines)
                    # We filter returns linked to this credit_note, EXCLUDING cancelled ones
                    total_returned = Decimal(0)
                    linked_returns = SaleReturn.objects.filter(credit_note=credit_note).exclude(
                        status=SaleReturn.Status.CANCELLED
                    )

                    for ret in linked_returns:
                        for line in ret.lines.all():
                            if line.product_id == p_id:
                                total_returned += line.quantity

                    if total_returned > nc_qty:
                        # Rollback!
                        # Since we are in atomic block, raising error will rollback everything including ret_doc creation
                        raise ValidationError(
                            f"La cantidad total a devolver ({total_returned}) excede la cantidad autorizada en la Nota de Crédito ({nc_qty}) para el producto ID {p_id}."
                        )

        ret_doc.save()  # Trigger totals calc
        return ret_doc

    @staticmethod
    @transaction.atomic
    def confirm_return(return_doc: SaleReturn):
        """
        Confirms the Return:
        1. Generates Stock Moves (IN).
        2. Generates Accounting Entry (COGS Reversal).
        """
        if return_doc.status != SaleReturn.Status.DRAFT:
            return return_doc

        from accounting.models import AccountingSettings

        settings = AccountingSettings.get_solo()

        created_moves = []
        total_cogs_reversal = Decimal("0")

        # 1. Stock Moves
        from inventory.models import InventoryDocument, InventoryDocumentDetail
        from inventory.services import InventoryService

        doc_inv = InventoryDocument.objects.create(
            document_type=InventoryDocument.Type.RECEIPT,
            status=InventoryDocument.Status.DRAFT,
            date=return_doc.date,
            reference=f"Devolución {EntityPrefix.SALE_ORDER}-{return_doc.sale_order.number}",
            partner=return_doc.sale_order.customer
        )
        details_to_create = []

        for line in return_doc.lines.all():
            product = line.product
            if product.track_inventory and not product.requires_advanced_manufacturing:
                # Convert to base UoM
                qty_base = UoMService.convert_quantity(
                    line.quantity, from_uom=line.uom or product.uom, to_uom=product.uom
                )

                details_to_create.append(
                    InventoryDocumentDetail(
                        document=doc_inv,
                        product=product,
                        warehouse=return_doc.warehouse,
                        quantity=qty_base,
                        unit_cost=line.unit_cost
                    )
                )

                # COGS Reversal amount for this line (Using original unit_cost from the return line)
                line_cogs = qty_base * line.unit_cost
                total_cogs_reversal += line_cogs

        if details_to_create:
            InventoryDocumentDetail.objects.bulk_create(details_to_create)
            doc_inv, generated_moves = InventoryService.confirmar_documento(doc_inv)
            
            # Map lines to generated moves
            inventory_lines = [l for l in return_doc.lines.all() if l.product.track_inventory and not l.product.requires_advanced_manufacturing]
            for line, move in zip(inventory_lines, generated_moves):
                line.stock_move = move
                line.save()
                created_moves.append(move)
        else:
            doc_inv.delete()

        # 2. Accounting Entry (COGS Reversal)
        if total_cogs_reversal > 0 and settings:
            doc_id = return_doc.display_id
            customer_name = return_doc.sale_order.customer.name

            entry = JournalEntry.objects.create(
                date=return_doc.date,
                description=GlosaBuilder.build(
                    GlosaBuilder.DEVOLUCION_FISICA, doc_id, customer_name, total_cogs_reversal,
                ),
                reference=return_doc.display_id,
                status=JournalEntry.State.DRAFT,
                source_content_type=ContentType.objects.get_for_model(SaleReturn),
                source_object_id=return_doc.id,
            )

            inv_acc = (
                settings.storable_inventory_account or settings.manufacturable_inventory_account
            )
            cogs_acc = (
                settings.stock_input_account
                or settings.merchandise_cogs_account
                or settings.default_expense_account
            )

            if inv_acc and cogs_acc:
                # Debit Inventory (Asset increases)
                JournalItem.objects.create(
                    entry=entry,
                    account=inv_acc,
                    debit=total_cogs_reversal,
                    credit=0,
                    label=GlosaBuilder.item(Roles.INVENTARIO, doc_ref=doc_id),
                )
                # Credit COGS (Expense decreases)
                JournalItem.objects.create(
                    entry=entry,
                    account=cogs_acc,
                    debit=0,
                    credit=total_cogs_reversal,
                    label=GlosaBuilder.item(Roles.COSTO_VENTA, doc_ref=doc_id),
                )

                JournalEntryService.post_entry(entry)
                return_doc.journal_entry = entry

                # Link moves to journal entry — requires internal flag since StockMoves are immutable post-creation
                for m in created_moves:
                    m.journal_entry = entry
                    m._allow_update = True
                    m.save(update_fields=["journal_entry"])

        return_doc.status = SaleReturn.Status.CONFIRMED
        return_doc.save()
        return return_doc


class SalesReturnService:
    """Alias/facade for merchandise return operations called from views."""

    @staticmethod
    def register_merchandise_return(order: SaleOrder, return_items: list, warehouse, notes: str = ""):
        """
        Creates and immediately confirms a merchandise return for a sale order.
        Called from the register_merchandise_return view action.
        """
        import datetime
        ret_doc = ReturnService.create_return_from_note_request(
            order=order,
            items=return_items,
            warehouse_id=warehouse.id,
            date=datetime.date.today().isoformat(),
            notes=notes,
        )
        return ReturnService.confirm_return(ret_doc)

    @staticmethod
    def register_merchandise_return_from_request(request, order: SaleOrder):
        """Parse request and call register_merchandise_return."""
        return_items = request.data.get("return_items", [])
        warehouse_id = request.data.get("warehouse_id")
        notes = request.data.get("notes", "")

        if not warehouse_id:
            raise ValidationError("Se requiere especificar la bodega.")
        if not return_items:
            raise ValidationError("Debe especificar al menos un producto a devolver.")

        warehouse = Warehouse.objects.get(id=warehouse_id)
        return SalesReturnService.register_merchandise_return(order, return_items, warehouse, notes)

