import logging

from django.core.exceptions import ValidationError
from django.db import transaction

logger = logging.getLogger(__name__)
from decimal import Decimal

from django.contrib.contenttypes.models import ContentType
from django.utils import timezone

from core.models import Attachment
from core.prefix_registry import EntityPrefix
from inventory.models import Product, UoM, Warehouse
from purchasing.models import PurchaseLine, PurchaseOrder
from workflow.models import Task
from workflow.services import WorkflowService

from .models import (
    BillOfMaterials,
    BillOfMaterialsLine,
    ProductionConsumption,
    WorkOrder,
    WorkOrderHistory,
    WorkOrderMaterial,
)


class BillOfMaterialsService:
    """
    Service layer for BillOfMaterials lifecycle operations.

    Owns all write operations that touch both BillOfMaterials and
    BillOfMaterialsLine in a single atomic transaction. Serializers
    delegate here instead of managing transaction scope themselves.
    """

    @staticmethod
    @transaction.atomic
    def create_bom(validated_data: dict) -> BillOfMaterials:
        """
        Create a BillOfMaterials and its lines in one atomic transaction.

        Args:
            validated_data: Dict from BillOfMaterialsSerializer after validation.
                            `lines` (if present) is popped and created here.

        Returns:
            The newly created BillOfMaterials instance.
        """
        lines_data = validated_data.pop("lines", [])
        bom = BillOfMaterials.objects.create(**validated_data)
        for line_data in lines_data:
            BillOfMaterialsLine.objects.create(bom=bom, **line_data)
        return bom

    @staticmethod
    @transaction.atomic
    def update_bom(instance: BillOfMaterials, validated_data: dict) -> BillOfMaterials:
        """
        Update a BillOfMaterials and replace its lines in one atomic transaction.

        Lines are replaced wholesale (delete + recreate) when `lines` is present
        in validated_data. When absent, existing lines are left untouched.

        Args:
            instance: The BillOfMaterials instance to update.
            validated_data: Dict from BillOfMaterialsSerializer after validation.

        Returns:
            The updated BillOfMaterials instance.
        """
        lines_data = validated_data.pop("lines", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if lines_data is not None:
            instance.lines.all().delete()
            for line_data in lines_data:
                BillOfMaterialsLine.objects.create(bom=instance, **line_data)
        return instance


class WorkOrderService:
    @staticmethod
    def _validate_product_manufacturable(product, require_manufacturable: bool = True) -> None:
        """TASK-209: Centralised product validation for WorkOrder creation.

        Raises ValidationError when:
          - require_manufacturable=True and product is not MANUFACTURABLE.
          - product.requires_bom_validation is True (Express product missing BOM).
        """
        if require_manufacturable and not product.strategy.requires_manufacturing_profile:
            raise ValidationError("El producto debe ser fabricable.")

        if product.requires_bom_validation:
            variant_hint = "esta variante" if product.parent_template else "este producto"
            raise ValidationError(
                f"El producto '{product.name}' es Express y requiere un BOM asignado "
                f"antes de crear una Orden de Trabajo. "
                f"Por favor, asigne un BOM a {variant_hint}."
            )

    @staticmethod
    @transaction.atomic
    def create_from_sale_line(sale_line, files=None):
        """
        Creates a Work Order from a sale line.
        Automatically assigns materials if an active BOM exists.
        """
        product = sale_line.product
        if not product or not product.strategy.requires_manufacturing_profile:
            return None

        # TASK-209: Centralised validation
        WorkOrderService._validate_product_manufacturable(product, require_manufacturable=False)

        delivery_with_wh = sale_line.order.deliveries.filter(warehouse__isnull=False).first()
        work_order = WorkOrder.objects.create(
            description=f"{product.name} - {EntityPrefix.SALE_ORDER}-{sale_line.order.number}",
            sale_order=sale_line.order,
            sale_line=sale_line,
            related_note=getattr(sale_line, "related_note", None),
            status=WorkOrder.Status.DRAFT,
            current_stage=WorkOrder.Stage.MATERIAL_ASSIGNMENT,
            warehouse=delivery_with_wh.warehouse if delivery_with_wh else WorkOrderService._default_warehouse(),
            stage_data={},
            start_date=timezone.now().date(),
        )

        # TASK-113: Flat stage_data — no more nested prepress/press/postpress copies
        if sale_line.manufacturing_data:
            flat_data = WorkOrderService._map_manufacturing_data(sale_line.manufacturing_data)
            flat_data["_version"] = 1
            work_order.stage_data = flat_data
            work_order.save()

        # Attach files if provided
        if files:
            WorkOrderService._attach_creation_files(work_order, files)

        # TASK-110: Expand BOM via shared helper
        WorkOrderService._expand_bom_into_materials(
            work_order, product, sale_line.quantity, sale_line.uom
        )

        # Materials / outsourced services captured in the POS manufacturing drawer
        WorkOrderService._apply_planning_drafts(work_order, sale_line.manufacturing_data)

        # TASK-111: Create history + workflow task via shared helper
        WorkOrderService._create_initial_artifacts(
            work_order,
            origin_notes="OT generada automáticamente desde venta.",
            task_meta={
                "sale_order_id": work_order.sale_order_id,
                "order_type": "sale",
                "order_number": work_order.sale_order.number if work_order.sale_order else "",
                "prefix": EntityPrefix.SALE_ORDER,
            },
        )

        # Express Flow: Auto-finalize if product is configured for it
        if product.is_express:
            try:
                # Use a savepoint to rollback only the finalization if it fails
                with transaction.atomic():
                    WorkOrderService._finalize_express(
                        work_order, notes="Finalización automática (Flujo Express)"
                    )
            except Exception as e:
                # Log error but keep OT created
                logger.exception("Auto-finalize failed for %s-%s", EntityPrefix.WORK_ORDER, work_order.number)
                WorkOrderHistory.objects.create(
                    work_order=work_order,
                    stage=work_order.current_stage,
                    status=work_order.status,
                    notes=f"Fallo en finalización automática: {str(e)}",
                    user=None,  # System action
                )

        return work_order

    @staticmethod
    @transaction.atomic
    def create_manual(product, quantity, description, uom=None, warehouse=None, stage_data=None):
        """
        Creates a manual Work Order for internal needs.
        """
        # TASK-209: Centralised validation
        WorkOrderService._validate_product_manufacturable(product)

        if not uom:
            raise ValidationError("La unidad de medida es requerida para fabricaciones manuales.")

        final_stage_data = {"quantity": float(quantity), "_version": 1}
        if uom:
            final_stage_data["uom_id"] = uom.id
            final_stage_data["uom_name"] = uom.name

        if stage_data:
            final_stage_data.update(stage_data)

        work_order = WorkOrder.objects.create(
            description=description,
            is_manual=True,
            product=product,
            status=WorkOrder.Status.DRAFT,
            current_stage=WorkOrder.Stage.MATERIAL_ASSIGNMENT,
            warehouse=warehouse,
            stage_data=final_stage_data,
        )

        # TASK-110: Expand BOM via shared helper
        WorkOrderService._expand_bom_into_materials(work_order, product, quantity, uom)

        # TASK-111: Create history + workflow task via shared helper
        WorkOrderService._create_initial_artifacts(
            work_order,
            origin_notes="OT creada manualmente.",
            task_meta={"order_type": "manual"},
        )

        return work_order

    @staticmethod
    @transaction.atomic
    def duplicate(work_order, user=None):
        """
        TASK-302: Duplicates a WorkOrder.
        Clones description, product, warehouse, stage_data, materials (as MANUAL).
        No link to sale_line.
        """
        # Configuration is copied; the run state of the original is not (its rectification
        # snapshot points at the original's materials, photos/approvals are its evidence).
        run_state_keys = {"rectification_snapshot", "final_photo", "approval_attachment"}
        stage_data = {
            key: value
            for key, value in (work_order.stage_data or {}).items()
            if key not in run_state_keys
        }
        stage_data.setdefault("_version", 1)
        # A linked OT takes its volume from the sale line: the manual copy needs it explicitly
        if work_order.sale_line:
            stage_data.setdefault("quantity", float(work_order.sale_line.quantity))
            if work_order.sale_line.uom_id:
                stage_data.setdefault("uom_id", work_order.sale_line.uom_id)
                stage_data.setdefault("uom_name", work_order.sale_line.uom.name)

        new_wo = WorkOrder.objects.create(
            description=f"Copia de {work_order.description or work_order.display_id}",
            is_manual=True,
            product=work_order.product
            if not work_order.sale_line
            else work_order.sale_line.product,
            status=WorkOrder.Status.DRAFT,
            current_stage=WorkOrder.Stage.MATERIAL_ASSIGNMENT,
            warehouse=work_order.warehouse,
            stage_data=stage_data,
            estimated_completion_date=work_order.estimated_completion_date,
        )

        for mat in work_order.materials.all():
            WorkOrderMaterial.objects.create(
                work_order=new_wo,
                component=mat.component,
                quantity_planned=mat.quantity_planned,
                uom=mat.uom,
                source="MANUAL",
                is_outsourced=mat.is_outsourced,
                supplier=mat.supplier,
                unit_price=mat.unit_price,
                notes=mat.notes,
            )

        WorkOrderService._create_initial_artifacts(
            new_wo,
            origin_notes=f"OT duplicada desde {EntityPrefix.WORK_ORDER}-{work_order.number}.",
            task_meta={"order_type": "manual"},
            user=user,
        )

        return new_wo

    @staticmethod
    @transaction.atomic
    def create_ot_for_delivery_line(delivery_line, related_note=None):
        """
        Creates a Work Order for a delivery line if product is express manufacturable.
        This method is called during delivery confirmation to create OTs for products
        with mfg_auto_finalize = True.

        Args:
            delivery_line: SaleDeliveryLine instance
            related_note: Optional Invoice (for debit note deliveries)

        Returns:
            WorkOrder instance or None if not applicable
        """
        product = delivery_line.product
        sale_line = delivery_line.sale_line

        # Only for express manufacturable products
        if not (product and product.strategy.requires_manufacturing_profile and product.is_express):
            return None

        # TASK-209: Centralised validation
        WorkOrderService._validate_product_manufacturable(product, require_manufacturable=False)

        # Create OT with delivered quantity
        work_order = WorkOrder.objects.create(
            description=f"{product.name} - Despacho {delivery_line.delivery.number}",
            sale_order=sale_line.order,
            sale_line=sale_line,
            related_note=related_note,
            status=WorkOrder.Status.DRAFT,
            current_stage=WorkOrder.Stage.MATERIAL_ASSIGNMENT,
            warehouse=delivery_line.delivery.warehouse,
            stage_data={"quantity": float(delivery_line.quantity)},
            start_date=timezone.now().date(),
        )

        # TASK-110: Expand BOM via shared helper
        WorkOrderService._expand_bom_into_materials(
            work_order, product, delivery_line.quantity, delivery_line.uom or sale_line.uom
        )

        # TASK-111: Create history + workflow task via shared helper
        WorkOrderService._create_initial_artifacts(
            work_order,
            origin_notes="OT generada desde despacho (Producto Express)",
            task_meta={
                "sale_order_id": work_order.sale_order_id,
                "order_type": "sale",
                "order_number": work_order.sale_order.number if work_order.sale_order else "",
                "prefix": EntityPrefix.SALE_ORDER,
            },
        )

        # Express Flow: finalize right away. A failure must abort the dispatch: the
        # delivery skips the BOM explosion for lines whose OT consumed it, so a draft
        # OT left behind would mean components never consumed nor costed.
        WorkOrderService._finalize_express(
            work_order, notes="Finalización automática (Flujo Express - Despacho)"
        )

        return work_order

    @staticmethod
    def _parse_creation_files(files):
        """Design / approval files of a creation request, whatever key the client used.

        The wizard sends ``design_file_<n>``; older clients ``design_files`` / ``design``.
        """
        if not files:
            return {}
        design = list(files.getlist("design_files")) + list(files.getlist("design"))
        design += [f for key, f in files.items() if key.startswith("design_file_")]
        parsed = {}
        if design:
            parsed["design"] = design
        approval = files.get("approval_file") or files.get("approval")
        if approval:
            parsed["approval"] = approval
        return parsed

    @staticmethod
    def _attach_creation_files(work_order, parsed_files, user=None):
        content_type = ContentType.objects.get_for_model(work_order)
        for design_file in parsed_files.get("design", []):
            Attachment.objects.create(
                file=design_file,
                original_filename=design_file.name,
                content_type=content_type,
                object_id=work_order.id,
                user=user,
            )
        approval_file = parsed_files.get("approval")
        if approval_file:
            Attachment.objects.create(
                file=approval_file,
                original_filename=approval_file.name,
                content_type=content_type,
                object_id=work_order.id,
                user=user,
            )
            work_order.stage_data = {
                **(work_order.stage_data or {}),
                "approval_attachment": approval_file.name,
            }
            work_order.save(update_fields=["stage_data"])

    @staticmethod
    @transaction.atomic
    def create_from_request_payload(data, files, user):
        """TASK-202: Unified entrypoint for WorkOrder creation from HTTP requests.

        Centralises the branching logic previously duplicated in views.py so that
        WorkOrderViewSet.create() stays <= 20 LOC.

        Branches:
            1. Manual (product_id present, no sale_line) -> create_manual()
            2. Sale-linked (sale_line_id present) -> create_from_sale_line() + partial update
        Anything else is rejected: a bare model create would skip BOM, tasks and history.
        """
        import json

        from inventory.models import Product, Warehouse
        from sales.models import SaleLine

        _EMPTY_SALE_LINE = {"", "none", "__none__"}

        stage_data = data.get("stage_data", {})
        if isinstance(stage_data, str):
            try:
                stage_data = json.loads(stage_data)
            except (json.JSONDecodeError, TypeError):
                stage_data = {}
        if not isinstance(stage_data, dict):
            stage_data = {}

        initial_materials_raw = data.get("initial_materials")
        if isinstance(initial_materials_raw, str):
            try:
                initial_materials = json.loads(initial_materials_raw)
            except (json.JSONDecodeError, TypeError):
                initial_materials = []
        else:
            initial_materials = initial_materials_raw or []

        product_id = data.get("product_id")
        sale_line_id = data.get("sale_line")
        is_linked = bool(sale_line_id) and sale_line_id not in _EMPTY_SALE_LINE
        parsed_files = WorkOrderService._parse_creation_files(files)

        if is_linked:
            sale_line = SaleLine.objects.select_related("order", "product").get(pk=sale_line_id)
            sale_order_id = data.get("sale_order")
            if sale_order_id not in (None, "", *_EMPTY_SALE_LINE) and str(sale_line.order_id) != str(sale_order_id):
                raise ValidationError("La línea seleccionada no pertenece a la Orden de Venta indicada.")

            work_order = WorkOrderService.create_from_sale_line(sale_line, files=parsed_files or None)
            if work_order is None:
                raise ValidationError(
                    f"El producto '{sale_line.product.name if sale_line.product else ''}' no es fabricable."
                )

            from .serializers import WorkOrderWriteSerializer

            # Wizard values complete the configuration captured at the sale (POS);
            # identity fields are fixed by the line itself.
            fields = {
                key: data.get(key)
                for key in ("description", "start_date", "estimated_completion_date", "related_contact")
                if data.get(key) not in (None, "")
            }
            if stage_data:
                fields["stage_data"] = {**(work_order.stage_data or {}), **stage_data}
            serializer = WorkOrderWriteSerializer(work_order, data=fields, partial=True)
            serializer.is_valid(raise_exception=True)
            work_order = serializer.save()

        elif product_id:
            from decimal import Decimal as _D

            product = Product.objects.get(pk=product_id)
            quantity = _D(str(data.get("quantity", 0)))
            uom_id = data.get("uom_id")
            wh_id = data.get("warehouse_id")
            desc = data.get("description", "")

            warehouse = Warehouse.objects.get(pk=wh_id) if wh_id else WorkOrderService._default_warehouse()
            if not uom_id:
                raise ValidationError(
                    "La unidad de medida es requerida para fabricaciones manuales."
                )
            uom = UoM.objects.get(pk=uom_id)

            work_order = WorkOrderService.create_manual(
                product=product,
                quantity=quantity,
                description=desc,
                warehouse=warehouse,
                uom=uom,
                stage_data=stage_data,
            )
            WorkOrderService._attach_creation_files(work_order, parsed_files, user)

        else:
            raise ValidationError("Indique un producto o una línea de Orden de Venta para crear la OT.")

        if initial_materials:
            from .models import WorkOrderMaterial
            from .serializers import WorkOrderInitialMaterialSerializer

            for m in initial_materials:
                serializer = WorkOrderInitialMaterialSerializer(data=m)
                serializer.is_valid(raise_exception=True)

                v_data = serializer.validated_data
                comp_id = v_data["component_id"]
                uom_id = v_data.get("uom_id")
                if not uom_id:
                    comp_product = Product.objects.get(pk=comp_id)
                    uom_id = comp_product.uom_id

                WorkOrderMaterial.objects.create(
                    work_order=work_order,
                    component_id=comp_id,
                    quantity_planned=v_data["quantity_planned"],
                    is_outsourced=v_data.get("is_outsourced", False),
                    supplier_id=v_data.get("supplier_id"),
                    unit_price=v_data.get("unit_price") or 0,
                    uom_id=uom_id,
                    source="MANUAL",
                )

        return work_order

    @staticmethod
    def _default_warehouse():
        """Deterministic fallback warehouse (lowest id) when none is given."""
        return Warehouse.objects.order_by("pk").first()

    @staticmethod
    @transaction.atomic
    def annul_work_order(work_order, user=None, notes=""):
        """
        Annuls a Work Order with strict business rule validations.
        Only allowed if materials have not been physically consumed yet.
        1. Validates terminal state, stage limit, consumptions and PO state
        2. Cancels linked Purchase Orders (if status permits)
        3. Updates status to CANCELLED and stage to CANCELLED
        4. Closes pending approval tasks
        """
        if work_order.status == WorkOrder.Status.CANCELLED:
            return work_order

        # VALIDATION 0: Estado terminal explícito — FINISHED no es anulable
        if work_order.status == WorkOrder.Status.FINISHED:
            raise ValidationError(
                "No se puede anular una OT finalizada. FINISHED es un estado terminal."
            )

        # VALIDATION 2: Dynamic Production Stage Limit (Printing/Prepress/Approval)
        limit_stage = work_order.cancellation_limit_stage
        if not work_order.is_cancellable:
            limit_display = WorkOrder.Stage(limit_stage).label
            raise ValidationError(
                f"❌ No se puede anular: la OT ya superó la etapa límite permitida ({limit_display}).\n"
                f"📍 Etapa actual: {work_order.get_current_stage_display()}\n"
                f"⚠️ El proceso de producción ya ha avanzado más allá de lo reversible.\n"
                f"💡 Si necesita anular, considere revertir los consumos manualmente si aplica."
            )

        # VALIDATION 3: Consumos ya registrados en sistema (Safety check)
        if ProductionConsumption.objects.filter(work_order=work_order).exists():
            raise ValidationError(
                "❌ No se puede anular: ya existen consumos de materiales registrados en el sistema.\n"
                "⚠️ Debe revertir los consumos manualmente antes de anular la OT.\n"
            )

        # VALIDATION 4: Guard para OCs con estado fuera del ciclo esperado (future-proof)
        from purchasing.services import PurchasingService

        non_cancellable_pos = work_order.purchase_orders.exclude(
            status__in=[
                PurchaseOrder.Status.DRAFT,
                PurchaseOrder.Status.CONFIRMED,
                PurchaseOrder.Status.CANCELLED,
            ]
        )
        if non_cancellable_pos.exists():
            ids = ", ".join(po.display_id for po in non_cancellable_pos)
            raise ValidationError(
                f"No se puede anular: existen OC vinculadas que no pueden cancelarse ({ids})."
            )

        # 2. Cancel Linked Purchase Orders via service (cascades invoices,
        # payments, receipts and JE cleanup; reversals if PO is CONFIRMED)
        for po in work_order.purchase_orders.all():
            if po.status in [PurchaseOrder.Status.DRAFT, PurchaseOrder.Status.CONFIRMED]:
                PurchasingService.cancel_purchase_order(po)
                po.notes += f"\nAnulado por anulación de {EntityPrefix.WORK_ORDER}-{work_order.number}"
                po.save(update_fields=["notes"])

        # 3. Finalize Annulment
        work_order.status = WorkOrder.Status.CANCELLED
        work_order.current_stage = WorkOrder.Stage.CANCELLED
        work_order._change_reason = notes  # G-03: propagate reason to django-simple-history
        work_order.save()

        # Nothing is left to do on an annulled OT: close its open tasks (creation and
        # stage approvals) so they don't linger in the inbox.
        Task.objects.filter(
            content_type=ContentType.objects.get_for_model(work_order),
            object_id=work_order.id,
            status__in=[Task.Status.PENDING, Task.Status.IN_PROGRESS],
        ).update(status=Task.Status.CANCELLED, completed_at=timezone.now(), completed_by=user)

        WorkOrderHistory.objects.create(
            work_order=work_order,
            stage=WorkOrder.Stage.CANCELLED,
            status=WorkOrder.Status.CANCELLED,
            notes=notes or "Orden de Trabajo Anulada.",
            user=user,
        )

        WorkflowService.log_transition(work_order, "annul", user=user, reason=notes)

        return work_order

    @staticmethod
    @transaction.atomic
    def _ensure_stage_task(*, content_object, task_type, **kwargs):
        """Create the stage approval task unless the OT already has one of that type.

        Re-entering a stage after a rewind must reuse (and reopen) the existing task
        instead of stacking a duplicate approval next to the reset one.
        """
        work_order = content_object
        existing = Task.objects.filter(
            content_type=ContentType.objects.get_for_model(work_order),
            object_id=work_order.pk,
            task_type=task_type,
            category=Task.Category.APPROVAL,
        ).first()
        if existing is None:
            return WorkflowService.create_task(task_type=task_type, content_object=work_order, **kwargs)
        if existing.status == Task.Status.COMPLETED:
            existing.status = Task.Status.PENDING
            existing.completed_at = None
            existing.completed_by = None
            existing.save(update_fields=["status", "completed_at", "completed_by"])
        return existing

    @staticmethod
    @transaction.atomic
    def transition_to(work_order, next_stage, user=None, notes="", data=None, files=None):
        """
        Handles transition between stages and business logic for each.
        """
        Stage = WorkOrder.Stage
        # Lock the row: two concurrent transitions (double click, two operators) would
        # otherwise both run the side effects of the same move (e.g. purchase orders).
        if work_order.pk:
            locked = WorkOrder.objects.select_for_update().get(pk=work_order.pk)
            work_order.current_stage = locked.current_stage
            work_order.status = locked.status
        # Terminal states cannot transition out
        if work_order.current_stage in (Stage.FINISHED, Stage.CANCELLED):
            raise ValidationError(
                f"Transición inválida: la OT está en estado terminal '{work_order.get_current_stage_display()}'."
            )
        if next_stage == work_order.current_stage:
            raise ValidationError(
                f"La OT ya está en la etapa {work_order.get_current_stage_display()}."
            )
        # Cancelling has its own rules (limit stage, consumptions, purchase orders)
        if next_stage == Stage.CANCELLED:
            return WorkOrderService.annul_work_order(work_order, user=user, notes=notes)

        # TASK-311: Enforce manufacturing profile requirements
        # If moving FORWARD, ensure the target stage is enabled in the OT's profile.
        # This prevents Kanban/Bulk actions from bypassing the product's workflow configuration.
        if next_stage == Stage.PREPRESS and not work_order.requires_prepress:
            raise ValidationError("Esta OT no requiere etapa de Pre-Prensa según su configuración.")
        if next_stage == Stage.PRESS and not work_order.requires_press:
            raise ValidationError("Esta OT no requiere etapa de Impresión según su configuración.")
        if next_stage == Stage.POSTPRESS and not work_order.requires_postpress:
            raise ValidationError(
                "Esta OT no requiere etapa de Post-Impresión según su configuración."
            )

        sequence = WorkOrderService.STAGE_SEQUENCE
        if next_stage not in sequence:
            raise ValidationError(f"Etapa inválida: {next_stage}")
        old_idx = sequence.index(work_order.current_stage)
        new_idx = sequence.index(next_stage)
        is_forward = new_idx > old_idx
        if not is_forward:
            blockers = WorkOrderService.rewind_blockers(work_order, next_stage)
            if blockers:
                raise ValidationError("Retroceso bloqueado: " + " ".join(blockers))
        # Forward moves may skip only the stages that do not apply to this OT
        if is_forward and next_stage not in WorkOrderService.allowed_forward_stages(work_order):
            raise ValidationError(
                f"Transición inválida: {work_order.get_current_stage_display()} → "
                f"{WorkOrder.Stage(next_stage).label}."
            )

        old_stage = work_order.current_stage

        # Moving forward: the current stage's approval tasks must be completed. This runs
        # before any mutation (and before auto-completion below) so it is enforced for
        # every caller, not only the wizard footer.
        if is_forward:
            pending_tasks = Task.objects.filter(
                content_type=ContentType.objects.get_for_model(work_order),
                object_id=work_order.pk,
                task_type=WorkflowService.stage_task_type(old_stage),
                category=Task.Category.APPROVAL,
                status__in=[Task.Status.PENDING, Task.Status.IN_PROGRESS],
            )
            if pending_tasks.exists():
                raise ValidationError(
                    f"Existen aprobaciones pendientes para la etapa {work_order.get_current_stage_display()}. Por favor, complételas antes de continuar."
                )

        # Validate and merge stage data
        if data:
            from .validators import validate_transition_data

            validate_transition_data(data, next_stage)
            if not work_order.stage_data:
                work_order.stage_data = {}
            work_order.stage_data[next_stage.lower()] = data

        # Handle file attachments with validation
        if files:
            from core.validators import validate_file_extension, validate_file_size

            content_type = ContentType.objects.get_for_model(work_order)

            for field_name, file_obj in files.items():
                # Validate file before creating attachment
                try:
                    validate_file_size(file_obj)
                    validate_file_extension(file_obj)
                except ValidationError as e:
                    raise ValidationError(f"Archivo '{file_obj.name}': {str(e)}")

                # Create attachment after validation
                Attachment.objects.create(
                    file=file_obj,
                    original_filename=file_obj.name,
                    content_type=content_type,
                    object_id=work_order.id,
                    user=user,
                )

                # Fix: Update stage_data if it's the approval file (or design)
                # We assume 'approval_attachment' key from frontend form data maps here
                # But files dict keys are field names.
                # If we received 'approval_attachment', we should update stage_data['approval_attachment']
                if field_name == "approval_attachment":
                    if not work_order.stage_data:
                        work_order.stage_data = {}
                    work_order.stage_data["approval_attachment"] = file_obj.name

        # --- OT_CREATION TASK COMPLETION ---
        # Complete OT_CREATION task when moving past assignment stages
        # The user defined "Creación" as MATERIAL_ASSIGNMENT and OUTSOURCING_ASSIGNMENT
        if old_stage in [
            WorkOrder.Stage.MATERIAL_ASSIGNMENT,
            WorkOrder.Stage.OUTSOURCING_ASSIGNMENT,
        ] and next_stage not in [
            WorkOrder.Stage.MATERIAL_ASSIGNMENT,
            WorkOrder.Stage.OUTSOURCING_ASSIGNMENT,
        ]:
            Task.objects.filter(
                content_type=ContentType.objects.get_for_model(work_order),
                object_id=work_order.id,
                task_type="OT_CREATION",
                status__in=[Task.Status.PENDING, Task.Status.IN_PROGRESS],
            ).update(status=Task.Status.COMPLETED, completed_at=timezone.now(), completed_by=user)

        # Leaving stock approval: every material must be available. Enforced here so the
        # Kanban / bulk moves can't bypass it either.
        if old_stage == WorkOrder.Stage.MATERIAL_APPROVAL and is_forward:
            from .serializers import WorkOrderSerializer

            stocks, products_by_id = WorkOrderService.build_stock_context(work_order)
            materials = WorkOrderSerializer(
                work_order, context={"stocks_by_product": stocks, "products_by_id": products_by_id}
            ).data.get("materials", [])
            WorkOrderService.validate_transition_stock(work_order, next_stage, materials)

        # Entering a stage (re)opens its approval task. Approvals of the stage being left
        # were checked above; nothing else is auto-approved on the user's behalf.
        # 2. Automation: Create tasks upon ENTERING a new stage
        if next_stage == WorkOrder.Stage.MATERIAL_APPROVAL:
            WorkOrderService._ensure_stage_task(
                task_type="OT_MATERIAL_APPROVAL",
                title=f"Aprobación Stock: {EntityPrefix.WORK_ORDER}-{work_order.number}",
                description=f"Valide la disponibilidad de stock para procesar la {EntityPrefix.WORK_ORDER}-{work_order.number}.",
                content_object=work_order,
                created_by=user,
            )

        if next_stage == WorkOrder.Stage.PREPRESS:
            WorkOrderService._ensure_stage_task(
                task_type="OT_PREPRESS_APPROVAL",
                title=f"Aprobación Pre-Impresión: {EntityPrefix.WORK_ORDER}-{work_order.number}",
                content_object=work_order,
                created_by=user,
            )

        if next_stage == WorkOrder.Stage.PRESS:
            WorkOrderService._ensure_stage_task(
                task_type="OT_PRESS_APPROVAL",
                title=f"Supervisión Impresión: {EntityPrefix.WORK_ORDER}-{work_order.number}",
                description=f"Supervise el inicio de tiraje de la {EntityPrefix.WORK_ORDER}-{work_order.number}.",
                content_object=work_order,
                created_by=user,
            )

        if next_stage == WorkOrder.Stage.POSTPRESS:
            WorkOrderService._ensure_stage_task(
                task_type="OT_POSTPRESS_APPROVAL",
                title=f"Supervisión Post-Impresión: {EntityPrefix.WORK_ORDER}-{work_order.number}",
                description=f"Valide terminaciones y empaque de la {EntityPrefix.WORK_ORDER}-{work_order.number}.",
                content_object=work_order,
                created_by=user,
            )

        if next_stage == WorkOrder.Stage.OUTSOURCING_VERIFICATION:
            WorkOrderService._ensure_stage_task(
                task_type="OT_OUTSOURCING_VERIFICATION_APPROVAL",
                title=f"Verificación Tercerizados: {EntityPrefix.WORK_ORDER}-{work_order.number}",
                description=f"Valide la recepción de servicios externos para la {EntityPrefix.WORK_ORDER}-{work_order.number}.",
                content_object=work_order,
                created_by=user,
            )

        if next_stage == WorkOrder.Stage.RECTIFICATION:
            WorkOrderService._ensure_stage_task(
                task_type="OT_RECTIFICATION_APPROVAL",
                title=f"Rectificación: {EntityPrefix.WORK_ORDER}-{work_order.number}",
                description=f"Revise y confirme las cantidades reales de materiales consumidos y producción para la {EntityPrefix.WORK_ORDER}-{work_order.number}.",
                content_object=work_order,
                created_by=user,
            )
        # --- END WORKFLOW INTEGRATION ---

        # When moving forward from OUTSOURCING_ASSIGNMENT, create POs for outsourced services
        if old_stage == WorkOrder.Stage.OUTSOURCING_ASSIGNMENT and next_stage not in [
            WorkOrder.Stage.CANCELLED,
            WorkOrder.Stage.MATERIAL_ASSIGNMENT,
            WorkOrder.Stage.MATERIAL_APPROVAL,
        ]:
            WorkOrderService._create_outsourcing_purchase_orders(work_order)

        # Validation for OUTSOURCING_VERIFICATION
        if next_stage == WorkOrder.Stage.OUTSOURCING_VERIFICATION:
            outsourced_mats = work_order.materials.filter(is_outsourced=True)
            if not outsourced_mats.exists():
                # If no outsourced services, we can skip or just move through
                pass

        # When moving forward FROM OUTSOURCING_VERIFICATION to FINISHED
        if (
            old_stage == WorkOrder.Stage.OUTSOURCING_VERIFICATION
            and next_stage == WorkOrder.Stage.FINISHED
        ):
            pass  # Validation will happen in next_stage == FINISHED

        elif next_stage == WorkOrder.Stage.FINISHED:
            # Final validation for outsourced services if any
            from purchasing.models import PurchaseOrder

            pending_pos = work_order.purchase_orders.exclude(
                receiving_status=PurchaseOrder.ReceivingStatus.RECEIVED
            ).exclude(status=PurchaseOrder.Status.CANCELLED)

            if pending_pos.exists():
                pos_str = ", ".join([po.display_id for po in pending_pos])
                raise ValidationError(
                    f"No se puede finalizar la OT: las siguientes Órdenes de Compra aún no han sido recibidas completamente: {pos_str}. "
                    "Asegúrese de registrar la recepción del servicio en el Hub de la OC."
                )

            # Finalize: stock movements
            WorkOrderService.finalize_production(work_order, user)
            work_order.status = WorkOrder.Status.FINISHED

        elif (
            next_stage in [WorkOrder.Stage.MATERIAL_ASSIGNMENT, WorkOrder.Stage.MATERIAL_APPROVAL]
            and work_order.status == WorkOrder.Status.IN_PROGRESS
        ):
            # Rewinding to the draft stages (no irreversible effects, checked above)
            work_order.status = WorkOrder.Status.DRAFT

        elif (
            next_stage
            not in [WorkOrder.Stage.MATERIAL_ASSIGNMENT, WorkOrder.Stage.MATERIAL_APPROVAL]
            and work_order.status != WorkOrder.Status.IN_PROGRESS
        ):
            # If moving past initial stages (Assignment/Approval), status becomes IN_PROGRESS
            work_order.status = WorkOrder.Status.IN_PROGRESS

        old_idx = sequence.index(old_stage)
        next_idx = sequence.index(next_stage)

        # Moving Backward: Reset tasks for the stages being "un-done"
        if next_idx < old_idx:
            # The reopened stage must be approved again. Later stages keep their completed
            # task, which _ensure_stage_task reopens when the OT enters them again — so no
            # stale "pending" approval sits in the inbox for a stage the OT is not in.
            WorkflowService.reset_tasks_for_object(work_order, [next_stage])
            if old_stage == WorkOrder.Stage.RECTIFICATION:
                WorkOrderService._restore_planned_quantities(work_order)

        work_order.current_stage = next_stage
        work_order.save()

        WorkOrderHistory.objects.create(
            work_order=work_order,
            stage=next_stage,
            status=work_order.status,
            event=WorkOrderHistory.Event.REOPENED if next_idx < old_idx else WorkOrderHistory.Event.ENTERED,
            notes=notes,
            user=user,
        )

        return work_order

    @staticmethod
    @transaction.atomic
    def _finalize_express(work_order, notes, user=None):
        """Finish an Express OT at creation time.

        Express products have no production stages to walk through, so this does not go
        through ``transition_to`` (whose stage graph only reaches FINISHED from
        RECTIFICATION): it consumes the materials and closes the OT directly.
        """
        WorkOrderService.finalize_production(work_order, user)
        work_order.status = WorkOrder.Status.FINISHED
        work_order.current_stage = WorkOrder.Stage.FINISHED
        work_order.save(update_fields=["status", "current_stage"])
        WorkOrderHistory.objects.create(
            work_order=work_order,
            stage=WorkOrder.Stage.FINISHED,
            status=WorkOrder.Status.FINISHED,
            notes=notes,
            user=user,
        )

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
            raise ValidationError(
                "Se requiere una bodega para finalizar la producción y registrar consumos."
            )

        total_material_cost = Decimal("0")

        # 1. Services: no stock move, their cost is the OC price (outsourced) or the
        # component cost. They are kept apart so they are counted exactly once.
        service_costs = []  # (material, cost)
        for mat in work_order.materials.select_related("component"):
            if mat.component.product_type != Product.Type.SERVICE:
                continue
            mat.quantity_consumed = mat.quantity_planned
            mat.save(update_fields=["quantity_consumed"])
            unit_cost = mat.unit_price if mat.is_outsourced else mat.component.cost_price
            cost = (mat.quantity_planned * unit_cost).quantize(Decimal("0.01"))
            service_costs.append((mat, cost))
            total_material_cost += cost

        from inventory.models import InventoryDocument, InventoryDocumentDetail
        from inventory.services import InventoryService

        doc_inv = InventoryDocument.objects.create(
            document_type=InventoryDocument.Type.PRODUCTION,
            status=InventoryDocument.Status.DRAFT,
            date=timezone.now().date(),
            reference=f"Producción {EntityPrefix.WORK_ORDER}-{work_order.number}",
            source_document_type="production.workorder",
            source_document_id=work_order.id,
        )
        details_to_create = []
        mat_consumptions_data = []

        # 2. Process Material Consumption (stock items only)
        for mat in work_order.materials.select_related("component", "component__uom", "uom"):
            if not mat.component or mat.component.product_type == Product.Type.SERVICE:
                continue

            # Convert quantity from planned UoM to component base UoM
            base_comp_qty = UoMService.convert_quantity(
                mat.quantity_planned, from_uom=mat.uom, to_uom=mat.component.uom
            )

            # Calculate cost of this material usage (cost_price is per base unit)
            total_material_cost += (base_comp_qty * mat.component.cost_price).quantize(Decimal("0.01"))

            # VALIDATION: Prevent negative stock during production consumption
            if mat.component.track_inventory and mat.component.qty_on_hand < base_comp_qty:
                raise ValidationError(
                    f"Stock insuficiente para '{mat.component_name}'. "
                    f"Disponible: {mat.component.qty_on_hand} {mat.component.uom.name}, "
                    f"Requerido: {base_comp_qty} {mat.component.uom.name}"
                )

            details_to_create.append(
                InventoryDocumentDetail(
                    document=doc_inv,
                    product=mat.component,
                    warehouse=work_order.warehouse,
                    quantity=-base_comp_qty,  # Consumption in base units
                    unit_cost=mat.component.cost_price
                )
            )
            mat_consumptions_data.append((mat, base_comp_qty))

            mat.quantity_consumed = mat.quantity_planned  # We consume what was planned
            mat.save(update_fields=["quantity_consumed"])

        # 3. Add finished product
        product = None
        quantity = Decimal("0")
        uom = None

        if work_order.sale_line:
            product = work_order.sale_line.product
            uom = work_order.sale_line.uom
            # Use actual_quantity_produced when set (rectification on OV-linked OT)
            if work_order.actual_quantity_produced is not None:
                quantity = work_order.actual_quantity_produced
            else:
                quantity = work_order.sale_line.quantity
        elif work_order.product:
            product = work_order.product
            # Use actual_quantity_produced if set (from rectification), otherwise planned quantity
            if work_order.actual_quantity_produced is not None:
                quantity = work_order.actual_quantity_produced
            else:
                quantity = Decimal(str(work_order.canonical_stage_data.get("quantity", 0)))
            uom = product.uom

        if product and product.track_inventory:
            # Convert quantity from work order/sale line UoM to product base UoM
            base_qty = UoMService.convert_quantity(quantity, from_uom=uom, to_uom=product.uom)

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

                    product.cost_price = new_wac.quantize(Decimal("0.01"))
                    product.save()

                details_to_create.append(
                    InventoryDocumentDetail(
                        document=doc_inv,
                        product=product,
                        warehouse=work_order.warehouse,
                        quantity=base_qty,
                        unit_cost=unit_production_cost
                    )
                )

        finished_move = None
        if details_to_create:
            InventoryDocumentDetail.objects.bulk_create(details_to_create)
            doc_inv, _moves = InventoryService.confirmar_documento(doc_inv)

            # Each detail knows its own move; pairing by list position mixed them up.
            consumption_moves = {}
            for detail in doc_inv.details.select_related("stock_move"):
                if detail.quantity < 0:
                    consumption_moves[detail.product_id] = detail.stock_move
                elif product and detail.product_id == product.id:
                    finished_move = detail.stock_move

            # Create traceability records for materials
            for mat, base_comp_qty in mat_consumptions_data:
                ProductionConsumption.objects.create(
                    work_order=work_order,
                    product=mat.component,
                    warehouse=work_order.warehouse,
                    quantity=base_comp_qty,
                    stock_move=consumption_moves.get(mat.component_id),
                )
        else:
            doc_inv.delete()

        # 4. Generate Accounting Entry for Production
        if product and product.strategy.requires_manufacturing_profile:
            if total_material_cost > 0:
                from accounting.models import AccountingSettings, JournalEntry
                from accounting.services import JournalEntryService

                settings = AccountingSettings.get_solo()
                if not settings:
                    raise ValidationError("Debe configurar la contabilidad primero.")

                # Get debit account (Asset if track_inventory, Expense if not)
                if product.track_inventory:
                    debit_account = product.get_asset_account
                    label = f"Ingreso Inventario: {product.name[:100]}"
                else:
                    debit_account = product.get_expense_account or settings.default_expense_account
                    label = f"COGS Producción: {product.name[:100]}"

                if not debit_account:
                    raise ValidationError(
                        f"Falta configurar cuenta (inventario o gasto) para el producto {product.internal_code}."
                    )

                # Create journal entry
                entry_data = {
                    "date": timezone.now().date(),
                    "description": f"Consumo Producción {EntityPrefix.WORK_ORDER}-{work_order.number}",
                    "reference": f"{EntityPrefix.WORK_ORDER}-{work_order.number}",
                    "status": JournalEntry.State.DRAFT,
                    "source_content_type": ContentType.objects.get_for_model(WorkOrder),
                    "source_object_id": work_order.id,
                }

                items = []

                # Debit
                items.append(
                    {
                        "account": debit_account,
                        "debit": total_material_cost,
                        "credit": Decimal("0.00"),
                        "label": label,
                    }
                )

                # Credit: Component Inventory Accounts (grouped by account)
                component_credits = {}  # account -> amount

                for consumption in ProductionConsumption.objects.filter(work_order=work_order):
                    component = consumption.product
                    comp_cost = (consumption.quantity * component.cost_price).quantize(
                        Decimal("0.01")
                    )

                    comp_inventory_account = component.get_asset_account
                    if not comp_inventory_account:
                        raise ValidationError(
                            f"Falta cuenta de inventario para {component.internal_code}"
                        )

                    component_credits[comp_inventory_account] = (
                        component_credits.get(comp_inventory_account, Decimal("0.00")) + comp_cost
                    )

                # Outsourced / internal services: their cost was booked as expense by the
                # purchase bill; production moves it into the finished product.
                for mat, cost in service_costs:
                    if cost <= 0:
                        continue
                    service_account = (
                        mat.component.get_expense_account or settings.default_expense_account
                    )
                    if not service_account:
                        raise ValidationError(
                            f"Falta cuenta de gasto para el servicio {mat.component.internal_code}"
                        )
                    component_credits[service_account] = (
                        component_credits.get(service_account, Decimal("0.00")) + cost
                    )

                # The debit is the sum of the credits, so rounding can never unbalance it
                items[0]["debit"] = sum(component_credits.values(), Decimal("0.00"))

                # Add credit items
                for account, amount in component_credits.items():
                    items.append(
                        {
                            "account": account,
                            "debit": Decimal("0.00"),
                            "credit": amount,
                            "label": f"Consumo {EntityPrefix.WORK_ORDER}-{work_order.number}",
                        }
                    )

                # Create and post entry
                entry = JournalEntryService.create_entry(entry_data, items)
                JournalEntryService.post_entry(entry)

                # Link stock moves to this entry
                for consumption in ProductionConsumption.objects.filter(work_order=work_order):
                    if consumption.stock_move:
                        consumption.stock_move.journal_entry = entry
                        consumption.stock_move._allow_update = True
                        consumption.stock_move.save()

                # If track_inventory, also link the entry to the finished-product move
                if finished_move:
                    finished_move.journal_entry = entry
                    finished_move._allow_update = True
                    finished_move.save()

        # Record production discrepancy in audit trail when quantity differs from sale line
        if work_order.sale_line and work_order.actual_quantity_produced is not None:
            sold_qty = work_order.sale_line.quantity
            produced_qty = work_order.actual_quantity_produced
            if produced_qty != sold_qty:
                delta = produced_qty - sold_qty
                sign = "+" if delta > 0 else ""
                WorkOrderHistory.objects.create(
                    work_order=work_order,
                    stage=work_order.current_stage,
                    status=work_order.status,
                    notes=(
                        f"DISCREPANCIA: Se produjeron {produced_qty} unidades "
                        f"(vendido: {sold_qty}, delta: {sign}{delta}). "
                        "El vendedor debe revisar el pedido."
                    ),
                    user=user,
                )

    @staticmethod
    @transaction.atomic
    def rectify_production(
        work_order,
        material_adjustments=None,
        outsourced_adjustments=None,
        produced_quantity=None,
        user=None,
        notes="",
    ):
        """
        Declares actual quantities consumed and produced before transitioning to FINISHED.

        This method ADJUSTS the planned quantities on WorkOrderMaterials so that when
        finalize_production runs (at FINISHED transition), it uses the real values.

        Args:
            work_order: WorkOrder instance (must be in RECTIFICATION stage)
            material_adjustments: list of dicts: [{material_id, actual_quantity}]
                                  If empty or None, quantities remain unchanged.
            outsourced_adjustments: list of dicts: [{material_id, actual_quantity, actual_unit_price}]
            produced_quantity: Decimal. Real quantity produced (only for manual OTs with track_inventory).
            user: User performing the action.
            notes: Optional notes to record in the history.
        """
        if work_order.current_stage != WorkOrder.Stage.RECTIFICATION:
            raise ValidationError(
                f"La OT debe estar en etapa de Rectificación para rectificar. "
                f"Etapa actual: {work_order.get_current_stage_display()}"
            )

        if work_order.status == WorkOrder.Status.FINISHED:
            raise ValidationError("No se puede rectificar una OT ya finalizada.")

        changes_summary = []

        # Keep the planned figures once, so reopening Rectification can restore them
        WorkOrderService._snapshot_planned_quantities(work_order)

        # 1. Adjust material quantities
        if material_adjustments:
            for adj in material_adjustments:
                material_id = adj.get("material_id")
                actual_qty_raw = adj.get("actual_quantity")

                if material_id is None or actual_qty_raw is None:
                    continue

                try:
                    material = WorkOrderMaterial.objects.get(pk=material_id, work_order=work_order)
                except WorkOrderMaterial.DoesNotExist:
                    raise ValidationError(
                        f"Material con ID {material_id} no encontrado en esta OT."
                    )

                actual_qty = Decimal(str(actual_qty_raw))
                if actual_qty < Decimal("0"):
                    raise ValidationError(
                        f"La cantidad real para '{material.component.name}' no puede ser negativa."
                    )

                original_qty = material.quantity_planned
                if original_qty != actual_qty:
                    changes_summary.append(
                        f"{material.component.name}: {original_qty} → {actual_qty} {material.uom.name}"
                    )
                    material.quantity_planned = actual_qty
                    material.save()

        # 1.5 Adjust outsourced services
        if outsourced_adjustments:
            for adj in outsourced_adjustments:
                material_id = adj.get("material_id")
                actual_qty_raw = adj.get("actual_quantity")
                actual_price_raw = adj.get("actual_unit_price")

                if material_id is None:
                    continue

                try:
                    material = WorkOrderMaterial.objects.get(
                        pk=material_id, work_order=work_order, is_outsourced=True
                    )
                except WorkOrderMaterial.DoesNotExist:
                    raise ValidationError(
                        f"Servicio tercerizado con ID {material_id} no encontrado en esta OT."
                    )

                updates = []
                if actual_qty_raw is not None:
                    actual_qty = Decimal(str(actual_qty_raw))
                    if actual_qty < Decimal("0"):
                        raise ValidationError("La cantidad real no puede ser negativa.")
                    if material.quantity_planned != actual_qty:
                        updates.append(f"Qty: {material.quantity_planned} → {actual_qty}")
                        material.quantity_planned = actual_qty

                if actual_price_raw is not None:
                    actual_price = Decimal(str(actual_price_raw))
                    if actual_price < Decimal("0"):
                        raise ValidationError("El precio real no puede ser negativo.")
                    if material.unit_price != actual_price:
                        updates.append(f"Precio: {material.unit_price} → {actual_price}")
                        material.unit_price = actual_price

                if updates:
                    changes_summary.append(
                        f"Servicio {material.component.name}: " + ", ".join(updates)
                    )
                    # Record discrepancy against Purchase Order (if unit price changed or quantity changed and we have a PO)
                    if material.purchase_line:
                        po_qty = material.purchase_line.quantity
                        po_price = material.purchase_line.unit_cost
                        if material.quantity_planned != po_qty or material.unit_price != po_price:
                            changes_summary.append(
                                f"DISCREPANCIA con OC-{material.purchase_line.order.number} en {material.component.name}"
                            )
                    material.save()

        # 2. Adjust produced quantity
        if produced_quantity is not None:
            produced_qty = Decimal(str(produced_quantity))
            if produced_qty <= Decimal("0"):
                raise ValidationError("La cantidad real producida debe ser mayor a 0.")

            planned_qty = Decimal(str(work_order.canonical_stage_data.get("quantity", 0)))
            if planned_qty != produced_qty:
                changes_summary.append(f"Cantidad producida: {planned_qty} → {produced_qty}")

            work_order.actual_quantity_produced = produced_qty

        # 3. Mark as rectified and save
        work_order.is_rectified = True
        work_order.save()

        # 4. Record in history
        change_text = (
            "\n".join(changes_summary) if changes_summary else "Sin cambios en cantidades."
        )
        history_notes = f"Rectificación registrada.\n{change_text}"
        if notes:
            history_notes += f"\nNotas: {notes}"

        WorkOrderHistory.objects.create(
            work_order=work_order,
            stage=WorkOrder.Stage.RECTIFICATION,
            status=work_order.status,
            notes=history_notes,
            user=user,
        )

        return work_order

    @staticmethod
    @transaction.atomic
    def add_material(
        work_order,
        component,
        quantity,
        uom=None,
        is_outsourced=False,
        supplier=None,
        unit_price=0,
        document_type="FACTURA",
    ):
        """
        Adds a material manually to a Work Order.

        Merges only into the row of the same component, kind (own / outsourced),
        supplier and UoM — the identity of ``unique_workorder_material_variant``.
        Merging by component alone turned an own BOM material into an outsourced one
        and added quantities across UoMs.
        """
        identity = {
            "work_order": work_order,
            "component": component,
            "is_outsourced": is_outsourced,
            "supplier": supplier,
            "uom": uom or component.uom,
        }
        material = WorkOrderMaterial.objects.filter(**identity).first()
        if material is None:
            return WorkOrderMaterial.objects.create(
                **identity,
                quantity_planned=Decimal(str(quantity)),
                source="MANUAL",
                unit_price=Decimal(str(unit_price)),
                document_type=document_type,
            )

        WorkOrderService._assert_material_not_ordered(material)
        material.quantity_planned += Decimal(str(quantity))
        material.unit_price = Decimal(str(unit_price))
        material.document_type = document_type
        material.save()
        return material

    # Production stages in order. CANCELLED is not part of the sequence: it is reached
    # through annul_work_order from any stage up to the cancellation limit.
    STAGE_SEQUENCE = [
        "MATERIAL_ASSIGNMENT", "MATERIAL_APPROVAL", "OUTSOURCING_ASSIGNMENT", "PREPRESS",
        "PRESS", "POSTPRESS", "OUTSOURCING_VERIFICATION", "RECTIFICATION", "FINISHED",
    ]

    # Stock movements (ProductionConsumption) block reopening any stage that preceded
    # or includes the production execution.  All stages from MATERIAL_ASSIGNMENT onward
    # (except OUTSOURCING_VERIFICATION and later) are blocked once consumption records exist.
    _STOCK_BLOCKED_STAGES = {
        "MATERIAL_ASSIGNMENT", "MATERIAL_APPROVAL", "OUTSOURCING_ASSIGNMENT",
        "PREPRESS", "PRESS", "POSTPRESS",
    }

    @staticmethod
    def _stage_is_mandatory(work_order, stage, materials):
        """A stage that applies to this OT and therefore cannot be skipped."""
        if stage == "MATERIAL_APPROVAL":
            return any(not m.is_outsourced for m in materials)
        if stage in ("PREPRESS", "PRESS", "POSTPRESS"):
            return getattr(work_order, f"requires_{stage.lower()}")
        if stage == "OUTSOURCING_VERIFICATION":
            return any(m.is_outsourced for m in materials)
        return stage in ("RECTIFICATION", "FINISHED")

    @staticmethod
    def _stage_is_reachable(work_order, stage):
        if stage in ("PREPRESS", "PRESS", "POSTPRESS"):
            return getattr(work_order, f"requires_{stage.lower()}")
        return True

    @staticmethod
    def allowed_forward_stages(work_order) -> list[str]:
        """Stages the OT may move forward to: up to (and including) the first mandatory one."""
        sequence = WorkOrderService.STAGE_SEQUENCE
        if work_order.current_stage not in sequence:
            return []
        materials = list(work_order.materials.all())
        allowed = []
        for stage in sequence[sequence.index(work_order.current_stage) + 1:]:
            if WorkOrderService._stage_is_reachable(work_order, stage):
                allowed.append(stage)
            if WorkOrderService._stage_is_mandatory(work_order, stage, materials):
                break
        return allowed

    @staticmethod
    def stage_plan(work_order) -> list[str]:
        """Stages the wizard shows for this OT, in order (single source for the UI rail)."""
        materials = list(work_order.materials.all())
        return [
            stage
            for stage in WorkOrderService.STAGE_SEQUENCE
            if stage in ("MATERIAL_ASSIGNMENT", "OUTSOURCING_ASSIGNMENT")
            or stage == work_order.current_stage
            or WorkOrderService._stage_is_mandatory(work_order, stage, materials)
        ]

    @staticmethod
    def next_stage(work_order):
        """The stage "Siguiente" leads to: the next one in the plan."""
        sequence = WorkOrderService.STAGE_SEQUENCE
        if work_order.current_stage not in sequence:
            return None
        current = sequence.index(work_order.current_stage)
        return next(
            (s for s in WorkOrderService.stage_plan(work_order) if sequence.index(s) > current), None
        )

    @staticmethod
    def _is_backward(work_order, next_stage):
        order = WorkOrderService.STAGE_SEQUENCE
        if work_order.current_stage not in order or next_stage not in order:
            return False
        return order.index(next_stage) < order.index(work_order.current_stage)

    @staticmethod
    def _snapshot_planned_quantities(work_order):
        """Store planned quantities/prices before the first rectification overwrites them."""
        stage_data = dict(work_order.stage_data or {})
        if "rectification_snapshot" in stage_data:
            return
        stage_data["rectification_snapshot"] = {
            "materials": {
                str(m.pk): {
                    "quantity_planned": str(m.quantity_planned),
                    "unit_price": str(m.unit_price),
                }
                for m in work_order.materials.all()
            },
        }
        work_order.stage_data = stage_data

    @staticmethod
    def _restore_planned_quantities(work_order):
        """Undo a rectification: planned figures return and the OT is no longer rectified."""
        stage_data = dict(work_order.stage_data or {})
        snapshot = stage_data.pop("rectification_snapshot", None)
        if snapshot:
            for material in work_order.materials.all():
                saved = snapshot.get("materials", {}).get(str(material.pk))
                if saved:
                    material.quantity_planned = Decimal(saved["quantity_planned"])
                    material.unit_price = Decimal(saved["unit_price"])
                    material.save(update_fields=["quantity_planned", "unit_price"])
        work_order.stage_data = stage_data
        work_order.is_rectified = False
        work_order.actual_quantity_produced = None

    @staticmethod
    def _assert_material_not_ordered(material):
        """A service already covered by a live purchase order is read-only on the OT."""
        line = material.purchase_line
        if line is not None and line.order.status != PurchaseOrder.Status.CANCELLED:
            raise ValidationError(
                f"'{material.component.name}' ya tiene la Orden de Compra "
                f"OC-{line.order.number}. Modifique la OC o use \"Crear OT corregida\"."
            )

    @staticmethod
    def update_material(
        *,
        work_order: "WorkOrder",
        material_id: int,
        quantity: "Decimal",
        uom_id: int | None = None,
        is_outsourced: bool | None = None,
        supplier_id: int | None = None,
        unit_price: "Decimal | None" = None,
        document_type: str | None = None,
    ) -> "WorkOrderMaterial":
        """
        Actualiza los campos editables de un WorkOrderMaterial.

        Reemplaza el bloque de ``if field in request.data: material.field = ...`` +
        ``material.save()`` que vivía directamente en
        ``WorkOrderViewSet.update_material`` (producción/views.py).

        Raises:
            WorkOrderMaterial.DoesNotExist: Si el material no pertenece al work_order.
        """
        material = WorkOrderMaterial.objects.get(pk=material_id, work_order=work_order)
        WorkOrderService._assert_material_not_ordered(material)
        material.quantity_planned = quantity

        if uom_id is not None:
            material.uom_id = uom_id
        if is_outsourced is not None:
            material.is_outsourced = is_outsourced
        if supplier_id is not None:
            material.supplier_id = supplier_id
        if unit_price is not None:
            material.unit_price = unit_price
        if document_type is not None:
            material.document_type = document_type

        material.save()
        return material

    @staticmethod
    def _create_outsourcing_purchase_orders(work_order):
        """
        Creates confirmed Purchase Orders and draft Invoices for outsourced materials in the Work Order.
        Groups materials by supplier and document type (Factura/Boleta).
        """
        from django.db.models import Q

        outsourced_mats = work_order.materials.filter(
            Q(purchase_line__isnull=True) | Q(purchase_line__order__status=PurchaseOrder.Status.CANCELLED),
            is_outsourced=True,
            supplier__isnull=False,
        )
        if not outsourced_mats.exists():
            return

        # Group by (supplier_id, document_type)
        mats_by_group = {}
        for mat in outsourced_mats:
            key = (mat.supplier_id, mat.document_type)
            if key not in mats_by_group:
                mats_by_group[key] = []
            mats_by_group[key].append(mat)

        for (supplier_id, document_type), mats in mats_by_group.items():
            from billing.models import Invoice
            from billing.services import BillingService
            from core.services import SequenceService

            # 1. Create Purchase Order in CONFIRMED status
            po = PurchaseOrder.objects.create(
                number=SequenceService.get_next_number(PurchaseOrder),
                supplier_id=supplier_id,
                work_order=work_order,
                warehouse=work_order.warehouse or WorkOrderService._default_warehouse(),
                status=PurchaseOrder.Status.CONFIRMED,
                notes=f"Generado automáticamente desde {work_order.display_id}",
            )

            for mat in mats:
                line = PurchaseLine.objects.create(
                    order=po,
                    product=mat.component,
                    quantity=mat.quantity_planned,
                    unit_cost=mat.unit_price,
                    uom=mat.uom,
                )
                mat.purchase_line = line
                mat.save()

            # Recalculate PO totals
            po.recalculate_totals()
            po.save()

            # 2. Create Draft Invoice (Factura/Boleta)
            # Map production document type to billing DTEType
            dte_type = Invoice.DTEType.FACTURA  # Default Factura
            if document_type == "BOLETA":
                dte_type = Invoice.DTEType.BOLETA

            BillingService.create_purchase_bill(
                order=po,
                supplier_invoice_number="",  # Empty for draft
                dte_type=dte_type,
                status=Invoice.Status.DRAFT,
            )

    # ── TASK-110: Extracted BOM expansion helper ────────────────────────────
    @staticmethod
    def _expand_bom_into_materials(work_order, product, requested_qty, qty_uom=None):
        """Expand the active BOM into WorkOrderMaterial rows scaled by qty/yield factor.

        Replaces the duplicated BOM-expansion blocks in create_from_sale_line,
        create_manual and create_ot_for_delivery_line. Returns a list of
        created WorkOrderMaterial instances (may be empty if no active BOM).
        """
        active_bom = BillOfMaterials.objects.filter(product=product, active=True).first()
        if not active_bom:
            return []

        from inventory.services import UoMService

        # Convert requested quantity to product's base UoM
        qty_base = Decimal(str(requested_qty))
        if qty_uom and qty_uom != product.uom:
            try:
                qty_base = UoMService.convert_quantity(
                    qty_base, from_uom=qty_uom, to_uom=product.uom
                )
            except Exception:
                pass

        # Convert BOM yield to product's base UoM
        bom_yield_base = active_bom.yield_quantity
        if active_bom.yield_uom and active_bom.yield_uom != product.uom:
            try:
                bom_yield_base = UoMService.convert_quantity(
                    active_bom.yield_quantity,
                    from_uom=active_bom.yield_uom,
                    to_uom=product.uom,
                )
            except Exception:
                pass

        factor = qty_base / bom_yield_base if bom_yield_base > 0 else Decimal("1")

        materials = []
        for line in active_bom.lines.all():
            mat = WorkOrderMaterial.objects.create(
                work_order=work_order,
                component=line.component,
                quantity_planned=line.quantity * factor,
                uom=line.uom or line.component.uom,
                source="BOM",
                is_outsourced=line.is_outsourced,
                supplier=line.supplier,
                unit_price=line.unit_price,
                document_type=line.document_type,
            )
            materials.append(mat)
        return materials

    # ── TASK-111: Extracted initial artifacts helper ────────────────────────
    @staticmethod
    def _create_initial_artifacts(work_order, *, origin_notes: str, task_meta: dict, user=None):
        """Create initial WorkOrderHistory + OT_CREATION workflow task.

        Called by all three create_* entrypoints to ensure consistent audit trail
        and task creation. Skips task creation for auto-finalize (Express) products.
        """
        WorkOrderHistory.objects.create(
            work_order=work_order,
            stage=work_order.current_stage,
            status=work_order.status,
            notes=origin_notes,
            user=user,
        )

        # Resolve product for auto-finalize check
        product = work_order.product or (
            work_order.sale_line.product if work_order.sale_line else None
        )
        if not (product and product.is_express):
            WorkflowService.create_task(
                task_type="OT_CREATION",
                title=f"Asignación materiales: {work_order.display_id}",
                description=(
                    f"Realizar la asignación de materiales y tercerizados "
                    f"para {work_order.display_id}."
                ),
                content_object=work_order,
                category=Task.Category.TASK,
                data=task_meta,
            )

    @staticmethod
    def _apply_planning_drafts(work_order, mfg_data):
        """
        Applies the optional ``materials_draft`` / ``outsourced_draft`` lists that the
        POS drawer stores inside ``SaleLine.manufacturing_data``.

        Same effect as the operator adding them in wizard steps 4 and 5. Entries that
        point to a product / supplier / UoM that no longer exists are skipped, so a
        stale draft can never block the OT creation.
        """
        if not mfg_data:
            return

        def _uom_for(entry, component):
            uom_id = entry.get("uom_id")
            return UoM.objects.filter(pk=uom_id).first() if uom_id else component.uom

        for entry in mfg_data.get("materials_draft") or []:
            component = Product.objects.filter(pk=entry.get("product_id")).first()
            if component is None:
                continue
            WorkOrderService.add_material(
                work_order,
                component,
                entry.get("quantity") or 1,
                uom=_uom_for(entry, component),
            )

        if not mfg_data.get("outsourced_draft"):
            return

        from contacts.models import Contact

        for entry in mfg_data["outsourced_draft"]:
            component = Product.objects.filter(pk=entry.get("product_id")).first()
            supplier = Contact.objects.filter(pk=entry.get("supplier_id")).first()
            if component is None or supplier is None:
                continue
            WorkOrderService.add_material(
                work_order,
                component,
                entry.get("quantity") or 1,
                uom=_uom_for(entry, component),
                is_outsourced=True,
                supplier=supplier,
                unit_price=entry.get("unit_price") or 0,
                document_type=entry.get("document_type") or "FACTURA",
            )

    @staticmethod
    def _map_manufacturing_data(mfg_data):
        """
        Maps nested manufacturing data from SaleLine to flat stage_data structure
        expected by WorkOrder frontend.
        """
        if not mfg_data:
            return {}

        stage_data = {
            "_version": 1,
            "internal_notes": mfg_data.get("description", ""),
            "product_description": mfg_data.get("product_description", ""),
            "contact_name": mfg_data.get("contact", {}).get("name", "")
            if mfg_data.get("contact")
            else "",
            "contact_id": mfg_data.get("contact", {}).get("id")
            if mfg_data.get("contact")
            else None,
            "contact_tax_id": mfg_data.get("contact", {}).get("tax_id")
            if mfg_data.get("contact")
            else "",
            "folio_enabled": mfg_data.get("folio_enabled", False),
            "folio_start": mfg_data.get("folio_start", ""),
            "design_attachments": mfg_data.get("design_filenames", []),
            # No approval_attachment: the sale never captures the customer's approval;
            # the prepress approval does (and sets the key when a file is attached).
            # Map specs
            "prepress_specs": mfg_data.get("specifications", {}).get("prepress", ""),
            "press_specs": mfg_data.get("specifications", {}).get("press", ""),
            "postpress_specs": mfg_data.get("specifications", {}).get("postpress", ""),
            # Map phases to root keys for serializer to pick up if needed, or just store them
            "phases": mfg_data.get("phases", {}),
            # Missing fields added
            "design_needed": mfg_data.get("design_needed", False),
            "print_type": mfg_data.get("print_type"),
        }
        return stage_data

    # ── Edit-in-place helpers ──────────────────────────────────────────────────

    @staticmethod
    def check_side_effects(work_order) -> dict:
        """Return a dict describing irreversible side-effects for the given OT.

        Used by the restart action (gate) and exposed via the serializer so the
        frontend can decide which CTAs to show in the Identity card.
        """
        from django.contrib.contenttypes.models import ContentType

        from purchasing.models import PurchaseOrder
        from workflow.models import Task

        has_confirmed_pos = (
            work_order.purchase_orders.exclude(status=PurchaseOrder.Status.DRAFT)
            .exclude(status=PurchaseOrder.Status.CANCELLED)
            .exists()
        )

        has_stock_movements = ProductionConsumption.objects.filter(work_order=work_order).exists()

        ct = ContentType.objects.get_for_model(work_order)
        completed_tasks_count = Task.objects.filter(
            content_type=ct,
            object_id=work_order.id,
            status=Task.Status.COMPLETED,
        ).count()

        manually_edited_materials_count = work_order.materials.filter(
            source="MANUAL",
            is_outsourced=False,
        ).count()

        return {
            "has_confirmed_pos": has_confirmed_pos,
            "has_stock_movements": has_stock_movements,
            "completed_tasks_count": completed_tasks_count,
            "manually_edited_materials_count": manually_edited_materials_count,
            "rewind_blockers": WorkOrderService.rewind_blockers(work_order),
            # Per reopenable stage: purchase orders only block reopening the outsourcing.
            "rewind_blockers_by_stage": WorkOrderService._rewind_blockers_by_stage(
                work_order, has_confirmed_pos, has_stock_movements
            ),
        }

    @staticmethod
    @staticmethod
    def _rewind_blockers_by_stage(work_order, has_confirmed_pos, has_stock_movements):
        sequence = WorkOrderService.STAGE_SEQUENCE
        if work_order.current_stage not in sequence:
            return {}
        outsourcing_idx = sequence.index("OUTSOURCING_ASSIGNMENT")
        result = {}
        for idx, stage in enumerate(sequence[: sequence.index(work_order.current_stage)]):
            blockers = []
            if has_confirmed_pos and idx <= outsourcing_idx:
                blockers.append("Existen Órdenes de Compra confirmadas para servicios tercerizados.")
            if has_stock_movements and stage in WorkOrderService._STOCK_BLOCKED_STAGES:
                blockers.append("Existen movimientos de stock asociados a la OT.")
            result[stage] = blockers
        return result

    @staticmethod
    def rewind_blockers(work_order, target_stage=None) -> list[str]:
        """Irreversible effects that make moving the OT back to ``target_stage`` unsafe.

        Completed approval tasks and manually added materials are NOT blockers: the
        rewind resets the former and the latter are plain editable data. Only effects
        that leave the OT's own data (purchase orders, stock) block the move — and the
        purchase orders only when the rewind reopens the outsourcing assignment that
        generated them. Without a target, the deepest rewind is assumed.
        """
        from purchasing.models import PurchaseOrder

        sequence = WorkOrderService.STAGE_SEQUENCE
        reopens_outsourcing = target_stage is None or (
            target_stage in sequence
            and sequence.index(target_stage) <= sequence.index("OUTSOURCING_ASSIGNMENT")
        )
        blockers = []
        if reopens_outsourcing and (
            work_order.purchase_orders.exclude(status=PurchaseOrder.Status.DRAFT)
            .exclude(status=PurchaseOrder.Status.CANCELLED)
            .exists()
        ):
            blockers.append("Existen Órdenes de Compra confirmadas para servicios tercerizados.")
        # Stock movements only make it unsafe to reopen the material-assignment stages.
        # Process stages (PREPRESS, PRESS, POSTPRESS, …) can still be reopened because
        # going back to them does not change material records in any way.
        reopens_material_stage = (
            target_stage is None or target_stage in WorkOrderService._STOCK_BLOCKED_STAGES
        )
        if reopens_material_stage and ProductionConsumption.objects.filter(work_order=work_order).exists():
            blockers.append("Existen movimientos de stock asociados a la OT.")
        return blockers

    @staticmethod
    @transaction.atomic
    def update_volume(work_order, quantity: float, uom_id: int, user=None):
        """Modify quantity + UoM of a DRAFT OT and recalculate BOM materials proportionally.

        Raises ValidationError if the OT is not in DRAFT or has side-effects that
        make the recalculation unsafe.
        """
        if work_order.status != WorkOrder.Status.DRAFT:
            raise ValidationError(
                "El volumen solo puede modificarse mientras la OT está en Borrador."
            )

        if work_order.sale_line_id:
            raise ValidationError(
                'La cantidad se hereda de la Orden de Venta y no puede modificarse aquí. Edite la línea en la OV o use "Crear OT corregida".'
            )

        if ProductionConsumption.objects.filter(work_order=work_order).exists():
            raise ValidationError(
                "Existen movimientos de stock asociados. No se puede modificar el volumen."
            )

        if work_order.purchase_orders.exists():
            raise ValidationError(
                "Existen Órdenes de Compra asociadas. No se puede modificar el volumen."
            )

        from inventory.services import UoMService

        old_quantity = float(
            work_order.stage_data.get("quantity", 0) if work_order.stage_data else 0
        )
        old_uom_id = (work_order.stage_data or {}).get("uom_id")
        old_uom = UoM.objects.filter(pk=old_uom_id).first() if old_uom_id else None
        new_uom = UoM.objects.filter(pk=uom_id).first() if uom_id else None

        # Compare both volumes in the same unit, or 1000 un → 10 cientos scales by 0.01
        new_in_old_uom = float(
            UoMService.convert_quantity(Decimal(str(quantity)), from_uom=new_uom, to_uom=old_uom)
            if old_uom and new_uom
            else quantity
        )

        # Recalculate BOM-sourced materials proportionally
        if old_quantity > 0 and old_quantity != new_in_old_uom:
            ratio = Decimal(str(new_in_old_uom)) / Decimal(str(old_quantity))
            bom_materials = work_order.materials.filter(source="BOM")
            for mat in bom_materials:
                mat.quantity_planned = (mat.quantity_planned * ratio).quantize(Decimal("0.000001"))
                mat.save(update_fields=["quantity_planned"])

        # Update stage_data
        stage_data = dict(work_order.stage_data or {})
        stage_data["quantity"] = quantity
        stage_data["uom_id"] = uom_id
        work_order.stage_data = stage_data
        work_order.save(update_fields=["stage_data"])

        WorkOrderHistory.objects.create(
            work_order=work_order,
            stage=work_order.current_stage,
            status=work_order.status,
            notes=f"Volumen actualizado: {old_quantity} → {quantity}",
            user=user,
        )

    @staticmethod
    @transaction.atomic
    def update_mfg_section(work_order, section: str, payload: dict, user=None):
        """Patch a specific section of stage_data after creation.

        Allowed sections: 'planning', 'prepress', 'press', 'postpress'.
        Volume updates must go through update_volume for BOM recalculation.
        """
        SECTION_KEYS = {
            "planning": ["internal_notes", "contact_id", "contact_name", "contact_tax_id"],
            "prepress": [
                "phases",
                "prepress_specs",
                "specifications",
                "design_needed",
                "folio_enabled",
                "folio_start",
                "print_type",
                "product_description",
                "design_attachments",
            ],
            "press": ["phases", "press_specs", "specifications", "print_type"],
            "postpress": ["phases", "postpress_specs", "specifications"],
        }

        if section not in SECTION_KEYS:
            raise ValidationError(f"Sección no válida: {section}")

        if work_order.status in [WorkOrder.Status.FINISHED, WorkOrder.Status.CANCELLED]:
            raise ValidationError("La OT está cerrada. No se pueden modificar sus datos.")

        STAGE_ORDER = [
            WorkOrder.Stage.MATERIAL_ASSIGNMENT,
            WorkOrder.Stage.MATERIAL_APPROVAL,
            WorkOrder.Stage.OUTSOURCING_ASSIGNMENT,
            WorkOrder.Stage.PREPRESS,
            WorkOrder.Stage.PRESS,
            WorkOrder.Stage.POSTPRESS,
            WorkOrder.Stage.OUTSOURCING_VERIFICATION,
            WorkOrder.Stage.RECTIFICATION,
            WorkOrder.Stage.FINISHED,
        ]

        def stage_index(stage_val):
            try:
                return STAGE_ORDER.index(stage_val)
            except ValueError:
                return -1

        current_idx = stage_index(work_order.current_stage)

        if section == "prepress" and current_idx > stage_index(WorkOrder.Stage.PREPRESS):
            raise ValidationError("La etapa de Pre-Impresión ya ha sido completada.")
        if section == "press" and current_idx > stage_index(WorkOrder.Stage.PRESS):
            raise ValidationError("La etapa de Impresión ya ha sido completada.")
        if section == "postpress" and current_idx > stage_index(WorkOrder.Stage.POSTPRESS):
            raise ValidationError("La etapa de Post-Impresión ya ha sido completada.")

        # Only allow known keys for the section to avoid accidental overwrites
        allowed_keys = SECTION_KEYS[section]
        filtered_payload = {k: v for k, v in payload.items() if k in allowed_keys}

        stage_data = dict(work_order.stage_data or {})
        stage_data.update(filtered_payload)
        work_order.stage_data = stage_data
        work_order.save(update_fields=["stage_data"])

        WorkOrderHistory.objects.create(
            work_order=work_order,
            stage=work_order.current_stage,
            status=work_order.status,
            notes=f'Sección "{section}" actualizada manualmente.',
            user=user,
        )

    @staticmethod
    @transaction.atomic
    def handle_update_attachments(work_order, files, user):
        """
        Processes file attachments after a WorkOrder update.
        Handles design files, approval files, and final photos.
        """
        if not files:
            return

        content_type = ContentType.objects.get_for_model(work_order)

        # 1. Design Files (design_file_0, design_file_1, etc.)
        for key, file_obj in files.items():
            if key.startswith("design_file_"):
                Attachment.objects.create(
                    file=file_obj,
                    original_filename=file_obj.name,
                    content_type=content_type,
                    object_id=work_order.id,
                    user=user,
                )

        # 2. Approval File
        approval_file = files.get("approval_file")
        if approval_file:
            Attachment.objects.create(
                file=approval_file,
                original_filename=approval_file.name,
                content_type=content_type,
                object_id=work_order.id,
                user=user,
            )
            if not work_order.stage_data:
                work_order.stage_data = {}
            work_order.stage_data["approval_attachment"] = approval_file.name
            work_order.save(update_fields=["stage_data"])

        # 3. Final Photo
        final_photo = files.get("final_photo")
        if final_photo:
            Attachment.objects.create(
                file=final_photo,
                original_filename=f"[final_photo] {final_photo.name}",
                content_type=content_type,
                object_id=work_order.id,
                user=user,
            )
            if not work_order.stage_data:
                work_order.stage_data = {}
            work_order.stage_data["final_photo"] = final_photo.name
            work_order.save(update_fields=["stage_data"])

    @staticmethod
    def validate_transition_stock(work_order, next_stage, materials_data):
        """
        Validates stock availability when transitioning from MATERIAL_APPROVAL.
        Raises ValidationError if any component has insufficient stock.
        """
        skip_stages = {"MATERIAL_ASSIGNMENT", "MATERIAL_APPROVAL", "CANCELLED"}
        if work_order.current_stage != "MATERIAL_APPROVAL" or next_stage in skip_stages:
            return

        for m in materials_data:
            if not m.get("is_available", False):
                raise ValidationError(
                    f"No hay suficiente stock para el componente: {m.get('component_name')}. "
                    f"Requerido: {m.get('quantity_planned')} {m.get('uom_name')}, "
                    f"Disponible: {m.get('stock_available')}."
                )

    @staticmethod
    def build_stock_context(work_order):
        """
        Returns (stocks_by_product, products_by_id) for the storable materials of
        this OT. Stocks are aggregated in a single query against the OT warehouse;
        manufacturable components are prefetched with their active BOMs and
        annotated component stock so get_manufacturable_quantity() runs in-memory.
        """
        from django.db.models import Prefetch, Sum

        from inventory.models import Product, Stock
        from production.models import BillOfMaterials

        warehouse = work_order.warehouse
        if not warehouse:
            return {}, {}

        material_qs = work_order.materials.exclude(component__product_type="SERVICE")
        component_ids = list(material_qs.values_list("component_id", flat=True))
        if not component_ids:
            return {}, {}

        rows = (
            Stock.objects.filter(warehouse=warehouse, product_id__in=component_ids)
            .values("product_id")
            .annotate(total=Sum("quantity"))
        )
        stocks = {row["product_id"]: float(row["total"] or 0.0) for row in rows}

        manufacturable_ids = list(
            material_qs.filter(
                component__product_type=Product.Type.MANUFACTURABLE,
                component__requires_advanced_manufacturing=False,
            ).values_list("component_id", flat=True)
        )
        products_by_id = {}
        if manufacturable_ids:
            boms = BillOfMaterials.objects.filter(active=True).prefetch_related(
                Prefetch(
                    "lines__component",
                    queryset=Product.objects.annotate(
                        annotated_current_stock=Sum("stocks__quantity")
                    ),
                ),
                "lines__uom",
                "lines__component__uom",
            )
            products = Product.objects.filter(id__in=manufacturable_ids).prefetch_related(
                Prefetch("boms", queryset=boms)
            )
            products_by_id = {p.id: p for p in products}
        return stocks, products_by_id

    # Keys of stage_data that belong to a production stage; once that stage has started
    # they are frozen. Everything else (contact, description, notes) stays editable.
    _STAGE_DATA_LOCKS = (
        (
            "PREPRESS",
            (
                "prepress_specs",
                "design_needed",
                "folio_enabled",
                "folio_start",
                "design_attachments",
            ),
            "Pre-Impresión",
        ),
        ("PRESS", ("press_specs", "print_type"), "Impresión"),
        ("POSTPRESS", ("postpress_specs",), "Post-Impresión"),
    )

    @staticmethod
    def validate_stage_data_edit(work_order, new_stage_data):
        """Reject changes to stage-owned stage_data once that stage has started.

        Mirrors ``update_mfg_section`` so the generic PATCH can't bypass its locks.
        """
        order = [
            "MATERIAL_ASSIGNMENT",
            "MATERIAL_APPROVAL",
            "OUTSOURCING_ASSIGNMENT",
            "PREPRESS",
            "PRESS",
            "POSTPRESS",
            "OUTSOURCING_VERIFICATION",
            "RECTIFICATION",
            "FINISHED",
        ]
        current = order.index(work_order.current_stage) if work_order.current_stage in order else -1
        old = work_order.stage_data or {}
        phases_old = old.get("phases") or {}
        phases_new = new_stage_data.get("phases") or {}

        for stage, keys, label in WorkOrderService._STAGE_DATA_LOCKS:
            if current < order.index(stage):
                continue
            changed = any(k in new_stage_data and new_stage_data[k] != old.get(k) for k in keys)
            phase_key = stage.lower()
            if phase_key in phases_new and phases_new.get(phase_key) != phases_old.get(phase_key):
                changed = True
            if changed:
                raise ValidationError(f"La etapa de {label} ya ha comenzado.")

    @staticmethod
    def validate_update_payload(work_order, data):
        """Checks of a generic PATCH/PUT: editable OT, identity fields, stage locks."""
        import json

        WorkOrderService.validate_update_allowed(work_order, data.keys())
        raw_stage_data = data.get("stage_data")
        if raw_stage_data:
            parsed = json.loads(raw_stage_data) if isinstance(raw_stage_data, str) else raw_stage_data
            if isinstance(parsed, dict):
                WorkOrderService.validate_stage_data_edit(work_order, parsed)

    @staticmethod
    def validate_update_allowed(work_order, data_keys):
        terminal_stages = {WorkOrder.Stage.FINISHED, WorkOrder.Stage.CANCELLED}
        if work_order.current_stage in terminal_stages:
            raise ValidationError("No se puede editar una OT en etapa Finalizada o Cancelada.")
        immutable = {
            "product",
            "sale_order",
            "sale_line",
            "product_id",
            "sale_order_id",
            "sale_line_id",
        }
        if immutable.intersection(data_keys):
            raise ValidationError(
                'Producto y Orden de Venta no pueden modificarse después de crear la OT. Use "Crear OT corregida" para generar una nueva.'
            )

    @staticmethod
    @transaction.atomic
    def rectify_from_request(work_order, request):
        material_adjustments = request.data.get("material_adjustments", [])
        outsourced_adjustments = request.data.get("outsourced_adjustments", [])
        produced_quantity = request.data.get("produced_quantity")
        notes = request.data.get("notes", "")

        WorkOrderService.rectify_production(
            work_order=work_order,
            material_adjustments=material_adjustments,
            outsourced_adjustments=outsourced_adjustments,
            produced_quantity=produced_quantity,
            user=request.user,
            notes=notes,
        )

    @staticmethod
    def transition_from_request(work_order, request):
        next_stage = request.data.get("next_stage")
        notes = request.data.get("notes", "")
        data = request.data.get("data", {})

        if isinstance(data, str):
            import json
            try:
                data = json.loads(data)
            except Exception:
                data = {}

        if not str(notes or "").strip() and WorkOrderService._is_backward(
            work_order, next_stage
        ):
            raise ValidationError("Indica el motivo para reabrir la etapa.")

        # Validate stage
        stage_match = None
        for choice, label in WorkOrder.Stage.choices:
            if choice == next_stage:
                stage_match = choice
                break

        if not stage_match:
            raise ValidationError(f"Etapa inválida: {next_stage}")

        WorkOrderService.transition_to(
            work_order=work_order,
            next_stage=stage_match,
            user=request.user,
            notes=notes,
            data=data,
            files=request.FILES,
        )

    @staticmethod
    @transaction.atomic
    def restart_work_order(work_order):
        if work_order.status != WorkOrder.Status.DRAFT:
            raise ValidationError("Solo se pueden reiniciar órdenes en Borrador.")

        se = WorkOrderService.check_side_effects(work_order)
        if any(
            [
                se["has_confirmed_pos"],
                se["has_stock_movements"],
                se["completed_tasks_count"],
                se["manually_edited_materials_count"],
            ]
        ):
            raise ValidationError(
                'La OT tiene actividad registrada y no puede reiniciarse. Use "Crear OT corregida" en su lugar.'
            )

        # Capture initial_data before deletion
        initial_data = {
            "sale_order_id": work_order.sale_order_id,
            "sale_order_number": work_order.sale_order.number if work_order.sale_order else None,
            "sale_line_id": work_order.sale_line_id,
            "product_id": work_order.product_id
            or (work_order.sale_line.product_id if work_order.sale_line else None),
            "stage_data": work_order.stage_data,
            "ot_type": "LINKED" if work_order.sale_order_id else "NONE",
        }

        # Cleanup generic relations (same as destroy)
        from django.contrib.contenttypes.models import ContentType

        from workflow.models import Notification, Task

        ct = ContentType.objects.get_for_model(work_order)
        Task.objects.filter(content_type=ct, object_id=work_order.id).delete()
        Notification.objects.filter(content_type=ct, object_id=work_order.id).delete()
        work_order.delete()

        return initial_data

    @staticmethod
    def add_material_from_request(work_order, request):
        product_id = request.data.get("product_id")
        quantity = Decimal(str(request.data.get("quantity")))
        uom_id = request.data.get("uom_id")

        is_outsourced = request.data.get("is_outsourced", False)
        supplier_id = request.data.get("supplier_id")
        unit_price = Decimal(str(request.data.get("unit_price", 0)))
        document_type = request.data.get("document_type", "FACTURA")

        product = Product.objects.get(pk=product_id)
        uom = UoM.objects.get(pk=uom_id) if uom_id else None

        from contacts.models import Contact
        supplier = Contact.objects.get(pk=supplier_id) if supplier_id else None

        WorkOrderService.add_material(
            work_order=work_order,
            component=product,
            quantity=quantity,
            uom=uom,
            is_outsourced=is_outsourced,
            supplier=supplier,
            unit_price=unit_price,
            document_type=document_type,
        )

    @staticmethod
    def remove_material(work_order, material_id):
        material = WorkOrderMaterial.objects.get(pk=material_id, work_order=work_order)
        WorkOrderService._assert_material_not_ordered(material)
        if material.source != "MANUAL":
            raise ValidationError("Solo se pueden eliminar materiales agregados manualmente.")
        material.delete()

    @staticmethod
    def bulk_transition(ids, next_stage, user=None):
        if not ids or not next_stage:
            raise ValidationError("ids y next_stage son requeridos")
        results = {"ok": [], "errors": []}
        for pk in ids:
            try:
                wo = WorkOrder.objects.get(pk=pk)
                # Reopening a stage needs a reason and resets approvals: wizard only.
                if WorkOrderService._is_backward(wo, next_stage):
                    raise ValidationError(
                        "Reabrir una etapa se hace desde la OT, indicando el motivo."
                    )
                with transaction.atomic():
                    WorkOrderService.transition_to(wo, next_stage, user=user)
                results["ok"].append(pk)
            except Exception as e:
                results["errors"].append({"id": pk, "error": str(e)})
        return results

    @staticmethod
    def get_comments_queryset(work_order):
        from django.contrib.contenttypes.models import ContentType

        from workflow.models import Comment

        wo_ct = ContentType.objects.get_for_model(WorkOrder)
        qs = Comment.objects.filter(content_type=wo_ct, object_id=work_order.pk)
        if work_order.sale_order_id:
            from sales.models import SaleOrder
            so_ct = ContentType.objects.get_for_model(SaleOrder)
            so_qs = Comment.objects.filter(content_type=so_ct, object_id=work_order.sale_order_id)
            qs = (qs | so_qs).order_by("created_at")
        else:
            qs = qs.order_by("created_at")
        return qs

    @staticmethod
    def add_comment_from_request(work_order, request):
        text = (request.data.get("text") or "").strip()
        if not text:
            raise ValidationError("text es requerido")

        from workflow.services import WorkflowService
        return WorkflowService.add_comment(
            content_object=work_order,
            user=request.user,
            text=text,
        )

    @staticmethod
    def create_manual_from_request(request):
        import json
        product_id = request.data.get("product_id")
        quantity = Decimal(str(request.data.get("quantity")))
        description = request.data.get("description", "")
        warehouse_id = request.data.get("warehouse_id")
        uom_id = request.data.get("uom_id")
        stage_data = request.data.get("stage_data", {})

        if isinstance(stage_data, str):
            try:
                stage_data = json.loads(stage_data)
            except (json.JSONDecodeError, TypeError):
                stage_data = {}

        product = Product.objects.get(pk=product_id)

        # Validate BOM requirement for Express products/variants
        if product.requires_bom_validation:
            error_msg = f"El producto '{product.name}' es Express y requiere un BOM asignado antes de crear una Orden de Trabajo."
            if product.parent_template:
                error_msg += (
                    " Por favor, asigne un BOM a esta variante desde el formulario de producto."
                )
            raise ValidationError(error_msg)

        warehouse = (
            Warehouse.objects.get(pk=warehouse_id)
            if warehouse_id
            else WorkOrderService._default_warehouse()
        )
        if not uom_id:
            raise ValidationError("La unidad de medida es requerida para fabricaciones manuales.")

        uom = UoM.objects.get(pk=uom_id) if uom_id else None

        return WorkOrderService.create_manual(
            product=product,
            quantity=quantity,
            description=description,
            warehouse=warehouse,
            uom=uom,
            stage_data=stage_data,
        )


class WorkOrderPdfService:
    @staticmethod
    def generate_pdf(work_order, request=None):
        """TASK-203: Generates a PDF using WeasyPrint from an HTML template."""

        from django.template.loader import render_to_string

        try:
            from weasyprint import HTML
        except ImportError:
            raise Exception("WeasyPrint is not installed. Please install it.")

        import base64
        from io import BytesIO

        import qrcode

        base_url = (
            request.build_absolute_uri("/")[:-1] if request else "http://localhost:3000"
        )
        qr = qrcode.QRCode(version=1, box_size=6, border=2)
        qr.add_data(f"{base_url}/production/orders/{work_order.pk}")
        qr.make(fit=True)
        buf = BytesIO()
        qr.make_image(fill_color="black", back_color="white").save(buf, format="PNG")
        qr_base64 = base64.b64encode(buf.getvalue()).decode()

        # Prepare flat stage data for rendering (filtering out None or complex objects if needed)
        flat_stage_data = {}
        stage_data = work_order.canonical_stage_data
        if stage_data:
            for k, v in stage_data.items():
                if k not in ["quantity", "uom_id", "uom_name", "_version"] and v:
                    # Make key readable
                    readable_key = k.replace("_", " ").title()
                    flat_stage_data[readable_key] = v

        quantity = stage_data.get("quantity") if stage_data else 1
        uom_name = stage_data.get("uom_name") if stage_data else ""

        context = {
            "work_order": work_order,
            "materials": work_order.materials.select_related("component", "uom", "supplier").all(),
            "history_log": work_order.stage_history.select_related("user").order_by("-created_at")[
                :5
            ],
            "qr_image": qr_base64,
            "flat_stage_data": flat_stage_data,
            "quantity": quantity,
            "uom_name": uom_name,
        }

        html_string = render_to_string("production/work_order_pdf.html", context)

        # WeasyPrint generation
        html = HTML(string=html_string, base_url=request.build_absolute_uri("/") if request else "")
        pdf_bytes = html.write_pdf()

        return pdf_bytes

    @staticmethod
    @staticmethod
    def get_orders_for_bulk_print(ids):
        if not ids:
            raise ValidationError("ids es requerido")
        orders = list(
            WorkOrder.objects.filter(pk__in=ids).select_related(
                "warehouse", "sale_line__order__customer"
            )
        )
        if not orders:
            raise ValidationError("No se encontraron órdenes")
        return orders

    @staticmethod
    def generate_bulk_pdf(work_orders, request=None):
        """TASK-306: Render multiple OTs into a single PDF document."""
        import base64
        from io import BytesIO

        import qrcode
        from django.template.loader import render_to_string

        try:
            from weasyprint import HTML
        except ImportError:
            raise Exception("WeasyPrint is not installed.")

        contexts = []
        for wo in work_orders:
            try:
                base_url = (
                    request.build_absolute_uri("/")[:-1] if request else "http://localhost:3000"
                )
                qr = qrcode.QRCode(version=1, box_size=6, border=2)
                qr.add_data(f"{base_url}/production/orders/{wo.pk}")
                qr.make(fit=True)
                buf = BytesIO()
                qr.make_image(fill_color="black", back_color="white").save(buf, format="PNG")
                qr_b64 = base64.b64encode(buf.getvalue()).decode()
                stage_data = wo.canonical_stage_data or {}
                contexts.append(
                    {
                        "work_order": wo,
                        "materials": wo.materials.select_related(
                            "component", "uom", "supplier"
                        ).all(),
                        "history_log": wo.stage_history.select_related("user").order_by(
                            "-created_at"
                        )[:3],
                        "qr_image": qr_b64,
                        "flat_stage_data": {},
                        "quantity": stage_data.get("quantity", ""),
                        "uom_name": stage_data.get("uom_name", ""),
                    }
                )
            except Exception:
                continue

        html_string = render_to_string("production/work_order_bulk_pdf.html", {"orders": contexts})
        base = request.build_absolute_uri("/") if request else ""
        return HTML(string=html_string, base_url=base).write_pdf()


class WorkOrderMetricsService:
    @staticmethod
    def get_metrics(from_date=None, to_date=None):
        """TASK-204: Calculate production metrics."""
        import datetime
        from datetime import timedelta

        from django.db.models import Count, ExpressionWrapper, F, Window, fields
        from django.db.models.functions import Lead
        from django.utils import timezone

        from .models import WorkOrder, WorkOrderHistory

        now = timezone.now()
        today = now.date()

        if not from_date:
            from_date = now - timedelta(days=30)
        elif isinstance(from_date, str):
            from_date = datetime.datetime.fromisoformat(from_date.replace("Z", "+00:00"))

        if not to_date:
            to_date = now
        elif isinstance(to_date, str):
            to_date = datetime.datetime.fromisoformat(to_date.replace("Z", "+00:00"))

        # 1. ots_by_stage
        active_ots = (
            WorkOrder.objects.filter(
                status__in=[WorkOrder.Status.DRAFT, WorkOrder.Status.IN_PROGRESS]
            )
            .values("current_stage")
            .annotate(count=Count("id"))
        )
        ots_by_stage = {item["current_stage"]: item["count"] for item in active_ots}

        # 2. overdue_ots
        overdue_ots = WorkOrder.objects.filter(
            status__in=[WorkOrder.Status.DRAFT, WorkOrder.Status.IN_PROGRESS],
            estimated_completion_date__lt=today,
        ).count()

        # 3. throughput in period (finished OTs)
        throughput = WorkOrder.objects.filter(
            status=WorkOrder.Status.FINISHED, created_at__gte=from_date, created_at__lte=to_date
        ).count()

        # 4. avg_time_by_stage
        # We use PostgreSQL Window functions to calculate the time difference between consecutive history records
        history = (
            WorkOrderHistory.objects.filter(created_at__gte=from_date, created_at__lte=to_date)
            .annotate(
                next_time=Window(
                    expression=Lead("created_at"),
                    partition_by=[F("work_order_id")],
                    order_by=F("created_at").asc(),
                )
            )
            .annotate(
                duration=ExpressionWrapper(
                    F("next_time") - F("created_at"), output_field=fields.DurationField()
                )
            )
        )

        avg_time_by_stage = {}
        stage_totals = {}
        stage_counts = {}

        for item in history:
            if item.duration is not None:
                stage = item.stage
                days = item.duration.total_seconds() / 86400.0
                stage_totals[stage] = stage_totals.get(stage, 0) + days
                stage_counts[stage] = stage_counts.get(stage, 0) + 1

        for stage in stage_totals:
            avg_time_by_stage[stage] = round(stage_totals[stage] / stage_counts[stage], 2)

        return {
            "avg_time_by_stage": avg_time_by_stage,
            "ots_by_stage": ots_by_stage,
            "overdue_ots": overdue_ots,
            "throughput_last_30d": throughput,  # Kept name for frontend compatibility
        }
