from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils import timezone
from .models import WorkOrder, ProductionConsumption, BillOfMaterials, WorkOrderMaterial, WorkOrderHistory
from accounting.models import JournalEntry, JournalItem, Account, AccountType
from accounting.services import JournalEntryService
from inventory.models import StockMove, Product, UoM, Warehouse
from inventory.services import StockService
from decimal import Decimal

class WorkOrderService:
    @staticmethod
    @transaction.atomic
    def create_from_sale_line(sale_line):
        """
        Creates a Work Order from a sale line.
        Automatically assigns materials if an active BOM exists.
        """
        product = sale_line.product
        if not product or product.product_type != Product.Type.MANUFACTURABLE:
            return None

        # Determine number
        last_order = WorkOrder.objects.all().order_by('id').last()
        if last_order and last_order.number.isdigit():
            number = str(int(last_order.number) + 1).zfill(6)
        else:
            number = '000001'

        work_order = WorkOrder.objects.create(
            number=number,
            description=f"{product.name} - NV-{sale_line.order.number}",
            sale_order=sale_line.order,
            sale_line=sale_line,
            status=WorkOrder.Status.DRAFT,
            current_stage=WorkOrder.Stage.MATERIAL_ASSIGNMENT,
            warehouse=sale_line.order.deliveries.first().warehouse if sale_line.order.deliveries.filter(warehouse__isnull=False).exists() else Warehouse.objects.first(),
            stage_data=WorkOrderService._map_manufacturing_data(sale_line.manufacturing_data) if sale_line.manufacturing_data else {}
        )

        # Auto-assign materials from BOM if active
        active_bom = BillOfMaterials.objects.filter(product=product, active=True).first()
        if active_bom:
            for line in active_bom.lines.all():
                WorkOrderMaterial.objects.create(
                    work_order=work_order,
                    component=line.component,
                    quantity_planned=line.quantity * sale_line.quantity,
                    uom=line.uom or line.component.uom,
                    source='BOM'
                )

        WorkOrderHistory.objects.create(
            work_order=work_order,
            stage=work_order.current_stage,
            status=work_order.status,
            notes="OT generada automáticamente desde venta."
        )

        # Express Flow: Auto-finalize if product is configured for it
        if product.mfg_auto_finalize:
            WorkOrderService.transition_to(
                work_order, 
                WorkOrder.Stage.FINISHED, 
                notes="Finalización automática (Flujo Express)"
            )

        return work_order

    @staticmethod
    @transaction.atomic
    def create_manual(product, quantity, description, uom=None, warehouse=None, stage_data=None):
        """
        Creates a manual Work Order for internal needs.
        """
        if product.product_type != Product.Type.MANUFACTURABLE:
            raise ValidationError("El producto debe ser fabricable.")

        final_stage_data = {'quantity': float(quantity)}
        if uom:
             final_stage_data['uom_id'] = uom.id
             final_stage_data['uom_name'] = uom.name
        
        if stage_data:
            final_stage_data.update(stage_data)

        work_order = WorkOrder.objects.create(
            description=description,
            is_manual=True,
            product=product,
            status=WorkOrder.Status.DRAFT,
            current_stage=WorkOrder.Stage.MATERIAL_ASSIGNMENT,
            warehouse=warehouse,
            stage_data=final_stage_data
        )

        # Auto-assign materials from BOM if active
        active_bom = BillOfMaterials.objects.filter(product=product, active=True).first()
        if active_bom:
            from inventory.services import UoMService
            
            # Convert produced quantity to product base UoM if necessary for BOM calculation
            # BOM quantities are usually per 1 unit of Product Base UoM
            
            qty_base = Decimal(str(quantity))
            if uom and uom != product.uom:
                 qty_base = UoMService.convert_quantity(Decimal(str(quantity)), uom, product.uom)

            for line in active_bom.lines.all():
                WorkOrderMaterial.objects.create(
                    work_order=work_order,
                    component=line.component,
                    quantity_planned=line.quantity * qty_base,
                    uom=line.uom or line.component.uom,
                    source='BOM'
                )

        return work_order

    @staticmethod
    @transaction.atomic
    def transition_to(work_order, next_stage, user=None, notes="", data=None):
        """
        Handles transition between stages and business logic for each.
        """
        old_stage = work_order.current_stage
        
        # Merge stage data
        if data:
            if not work_order.stage_data:
                work_order.stage_data = {}
            work_order.stage_data[next_stage.lower()] = data

        # Specific logic per stage transition
        if next_stage == WorkOrder.Stage.MATERIAL_APPROVAL:
            # Check if all materials have enough stock
            for mat in work_order.materials.all():
                available = mat.component.qty_available
                if available < mat.quantity_planned:
                    # We allow proceeding but maybe log a warning or require explicit approval
                    pass
        
        elif next_stage == WorkOrder.Stage.FINISHED:
            # Finalize: stock movements
            WorkOrderService.finalize_production(work_order, user)
            work_order.status = WorkOrder.Status.FINISHED

        elif next_stage == WorkOrder.Stage.CANCELLED:
             work_order.status = WorkOrder.Status.CANCELLED
             
        elif next_stage not in [WorkOrder.Stage.MATERIAL_ASSIGNMENT, WorkOrder.Stage.MATERIAL_APPROVAL] and work_order.status != WorkOrder.Status.IN_PROGRESS:
            # If moving past initial stages (Assignment/Approval), status becomes IN_PROGRESS
            work_order.status = WorkOrder.Status.IN_PROGRESS

        work_order.current_stage = next_stage
        work_order.save()

        WorkOrderHistory.objects.create(
            work_order=work_order,
            stage=next_stage,
            status=work_order.status,
            notes=notes,
            user=user
        )

        return work_order

    @staticmethod
    @transaction.atomic
    def finalize_production(work_order, user=None):
        """
        Performs the inventory movements:
        1. Decrease materials (Stock OUT).
        2. Increase product (Stock IN) if storable.
        3. Calculate production cost and update product Weighted Average Cost.
        """
        from inventory.services import UoMService
        if not work_order.warehouse:
            raise ValidationError("Se requiere una bodega para finalizar la producción y registrar consumos.")

        total_material_cost = Decimal('0')

        # 1. Consume materials
        for mat in work_order.materials.all():
            # Convert quantity from planned UoM to component base UoM
            base_comp_qty = UoMService.convert_quantity(
                mat.quantity_planned,
                from_uom=mat.uom,
                to_uom=mat.component.uom
            )

            # Calculate cost of this material usage
            # cost_price is per Base Unit
            material_cost = base_comp_qty * mat.component.cost_price
            total_material_cost += material_cost

            move = StockMove.objects.create(
                product=mat.component,
                warehouse=work_order.warehouse,
                uom=mat.component.uom,
                quantity=-base_comp_qty, # Consumption in base units
                move_type=StockMove.Type.OUT,
                description=f"Consumo producción OT-{work_order.number}"
            )
            mat.quantity_consumed = mat.quantity_planned # We consume what was planned
            mat.save()
            
            # Create traceability record
            ProductionConsumption.objects.create(
                work_order=work_order,
                product=mat.component,
                warehouse=work_order.warehouse,
                quantity=base_comp_qty,
                stock_move=move
            )

        # 2. Add finished product
        product = None
        quantity = Decimal('0')
        uom = None
        
        if work_order.sale_line:
            product = work_order.sale_line.product
            quantity = work_order.sale_line.quantity
            uom = work_order.sale_line.uom
        elif work_order.product:
            product = work_order.product
            quantity = Decimal(str(work_order.stage_data.get('quantity', 0)))
            uom = product.uom

        if product and product.track_inventory:
            # Convert quantity from work order/sale line UoM to product base UoM
            base_qty = UoMService.convert_quantity(
                quantity,
                from_uom=uom,
                to_uom=product.uom
            )

            if base_qty > 0:
                # 3. Cost Calculation & WAC Update
                # Calculate Unit Production Cost
                unit_production_cost = total_material_cost / base_qty
                
                # Update Weighted Average Cost
                old_qty = product.qty_on_hand
                old_cost = product.cost_price
                new_total_qty = old_qty + base_qty
                
                if new_total_qty > 0:
                    if old_qty <= 0:
                        # If we had 0 or negative stock, new cost is just production cost
                        new_wac = unit_production_cost
                    else:
                        current_val = old_qty * old_cost
                        new_val = base_qty * unit_production_cost
                        new_wac = (current_val + new_val) / new_total_qty
                    
                    product.cost_price = new_wac.quantize(Decimal('0.01'))
                    product.save()

            StockMove.objects.create(
                product=product,
                warehouse=work_order.warehouse,
                uom=product.uom,
                quantity=base_qty,
                move_type=StockMove.Type.IN,
                description=f"Entrada producción OT-{work_order.number}"
            )
        
        # If associated with a sale line, update its status (conceptually)
        if work_order.sale_line:
            # Possible logic to mark line as 'Produced' or 'Ready for dispatch'
            pass

    @staticmethod
    @transaction.atomic
    def add_material(work_order, component, quantity, uom=None):
        """
        Adds a material manually to a Work Order.
        """
        material, created = WorkOrderMaterial.objects.get_or_create(
            work_order=work_order,
            component=component,
            defaults={
                'quantity_planned': Decimal(str(quantity)),
                'uom': uom or component.uom,
                'source': 'MANUAL'
            }
        )
        if not created:
            material.quantity_planned += Decimal(str(quantity))
            material.save()
        
        return material

    @staticmethod
    def _map_manufacturing_data(mfg_data):
        """
        Maps nested manufacturing data from SaleLine to flat stage_data structure 
        expected by WorkOrder frontend.
        """
        if not mfg_data:
            return {}
            
        stage_data = {
            'internal_notes': mfg_data.get('description', ''),
            'product_description': mfg_data.get('product_description', ''),
            'contact_name': mfg_data.get('contact', {}).get('name', '') if mfg_data.get('contact') else '',
            'contact_id': mfg_data.get('contact', {}).get('id') if mfg_data.get('contact') else None,
            'contact_tax_id': mfg_data.get('contact', {}).get('tax_id') if mfg_data.get('contact') else '',
            'folio_enabled': mfg_data.get('folio_enabled', False),
            'folio_start': mfg_data.get('folio_start', ''),
            'design_attachments': [
                f.get('name') if isinstance(f, dict) else str(f) 
                for f in mfg_data.get('design_files', []) 
                if (isinstance(f, dict) and f.get('name')) or (not isinstance(f, dict) and str(f))
            ],
            # Map specs
            'prepress_specs': mfg_data.get('specifications', {}).get('prepress', ''),
            'press_specs': mfg_data.get('specifications', {}).get('press', ''),
            'postpress_specs': mfg_data.get('specifications', {}).get('postpress', ''),
            # Map phases to root keys for serializer to pick up if needed, or just store them
            'phases': mfg_data.get('phases', {}),
            # Missing fields added
            'design_needed': mfg_data.get('design_needed', False),
            'print_type': mfg_data.get('print_type')
        }
        return stage_data
