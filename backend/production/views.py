import logging

from rest_framework import filters, status, viewsets

logger = logging.getLogger(__name__)
import django_filters
from django_filters.rest_framework import DjangoFilterBackend, FilterSet
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import (
    BillOfMaterials,
    WorkOrder,
    WorkOrderMaterial,
)


class WorkOrderFilterSet(FilterSet):
    due_date_after = django_filters.DateFilter(
        field_name="estimated_completion_date", lookup_expr="gte"
    )
    due_date_before = django_filters.DateFilter(
        field_name="estimated_completion_date", lookup_expr="lte"
    )
    my_tasks = django_filters.BooleanFilter(method="filter_my_tasks")

    class Meta:
        model = WorkOrder
        fields = ["status", "due_date_after", "due_date_before"]

    def filter_my_tasks(self, queryset, name, value):
        if value and self.request and self.request.user.is_authenticated:
            from django.contrib.contenttypes.models import ContentType
            from django.db.models import Q

            from workflow.models import Task

            user = self.request.user
            ct = ContentType.objects.get_for_model(queryset.model)

            tasks = Task.objects.filter(
                content_type=ct, status__in=[Task.Status.PENDING, Task.Status.IN_PROGRESS]
            )

            q = Q(assigned_to=user)
            if user.groups.exists():
                q |= Q(assigned_group__in=user.groups.all())

            task_ids = tasks.filter(q).values_list("object_id", flat=True)
            return queryset.filter(id__in=task_ids)
        return queryset


from decimal import Decimal

from django.contrib.contenttypes.models import ContentType
from django.db.models import Q, Sum
from django.http import HttpResponse

from core.mixins import AuditHistoryMixin
from core.models import Attachment
from inventory.models import Product, UoM, Warehouse

from .serializers import (
    BillOfMaterialsSerializer,
    WorkOrderSerializer,
)
from .services import WorkOrderMetricsService, WorkOrderPdfService, WorkOrderService


class WorkOrderViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_class = WorkOrderFilterSet
    search_fields = [
        "description",
        "number",
        "product__name",
        "product__code",
        "sale_order__customer__name",
        "sale_order__customer__tax_id",
        "related_contact__name",
        "related_contact__tax_id",
    ]
    queryset = WorkOrder.objects.select_related(
        "sale_order", "sale_order__customer", "related_contact", "product", "sale_line", "warehouse"
    ).prefetch_related(
        "materials",
        "materials__component",
        "materials__uom",
        "materials__purchase_line",
        "consumptions",
        "stage_history",
        "attachments",
    )
    serializer_class = WorkOrderSerializer

    def _build_stock_context(self, work_order):
        """
        Returns a dict {product_id: stock_float} for all storable materials in this OT,
        computed in a single aggregated query against the OT's warehouse.
        """
        from inventory.models import StockMove

        warehouse = work_order.warehouse
        if not warehouse:
            return {}

        component_ids = list(
            work_order.materials.exclude(component__product_type="SERVICE").values_list(
                "component_id", flat=True
            )
        )
        if not component_ids:
            return {}

        rows = (
            StockMove.objects.filter(warehouse=warehouse, product_id__in=component_ids)
            .values("product_id")
            .annotate(total=Sum("quantity"))
        )
        return {row["product_id"]: float(row["total"] or 0.0) for row in rows}

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        context = self.get_serializer_context()
        context["stocks_by_product"] = self._build_stock_context(instance)
        serializer = self.get_serializer(instance, context=context)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        """TASK-202: Delegate all creation logic to WorkOrderService.

        Keeps this view <= 20 LOC. Branch decisions (manual vs sale-linked vs
        fallback) live in WorkOrderService.create_from_request_payload().
        """
        try:
            work_order = WorkOrderService.create_from_request_payload(
                request.data, request.FILES, request.user
            )
            if work_order is not None:
                return Response(
                    WorkOrderSerializer(work_order).data, status=status.HTTP_201_CREATED
                )
            # Fallback: no recognised payload -> standard DRF create
            return super().create(request, *args, **kwargs)
        except Exception as e:
            logger.exception("Error creating WorkOrder")
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, *args, **kwargs):
        """
        Overridden update to handle file attachments.
        Identity fields (product, sale_order, sale_line) are immutable post-creation.
        Terminal stages (FINISHED, CANCELLED) block all edits.
        """
        instance = self.get_object()
        terminal_stages = {WorkOrder.Stage.FINISHED, WorkOrder.Stage.CANCELLED}
        if instance.current_stage in terminal_stages:
            return Response(
                {"error": "No se puede editar una OT en etapa Finalizada o Cancelada."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        immutable = {
            "product",
            "sale_order",
            "sale_line",
            "product_id",
            "sale_order_id",
            "sale_line_id",
        }
        if immutable.intersection(request.data.keys()):
            return Response(
                {
                    "error": 'Producto y Nota de Venta no pueden modificarse después de crear la OT. Use "Crear OT corregida" para generar una nueva.'
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        response = super().update(request, *args, **kwargs)

        if response.status_code == 200:
            try:
                WorkOrderService.handle_update_attachments(
                    self.get_object(), request.FILES, request.user
                )
            except Exception:
                logger.exception("Error attaching files in update for WorkOrder %s", instance.pk)

        return response

    def destroy(self, request, *args, **kwargs):
        """
        Overridden to allow deletion only in early stages and without linked documents.
        """
        instance = self.get_object()

        # 1. Stage restriction: Only allow in MATERIAL_ASSIGNMENT
        if instance.current_stage != WorkOrder.Stage.MATERIAL_ASSIGNMENT:
            return Response(
                {
                    "error": "Solo se pueden eliminar órdenes en etapa de Asignación de Materiales. Para otras etapas, use la opción Anular."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 2. Document restriction: Check for linked POs
        if instance.purchase_orders.exists():
            return Response(
                {
                    "error": "No se puede eliminar una orden con Órdenes de Compra generadas. Anule la OT en su lugar."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 3. Cleanup: Delete associated Tasks and Notifications
        # Since these are GenericForeignKey, CASCADE doesn't happen automatically
        from workflow.models import Notification, Task

        content_type = ContentType.objects.get_for_model(instance)

        Task.objects.filter(content_type=content_type, object_id=instance.id).delete()
        Notification.objects.filter(content_type=content_type, object_id=instance.id).delete()

        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["post"])
    def annul(self, request, pk=None):
        """Annul an OT and reverse its effects"""
        work_order = self.get_object()
        try:
            notes = request.data.get("notes", "") or request.data.get("reason", "")
            WorkOrderService.annul_work_order(work_order=work_order, user=request.user, notes=notes)
            return Response(WorkOrderSerializer(work_order).data)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"])
    def rectify(self, request, pk=None):
        """
        Declare real quantities consumed and produced before finalizing the OT.
        Must be called while the OT is in RECTIFICATION stage.

        Body:
            material_adjustments: list of {material_id, actual_quantity}  (optional)
            produced_quantity: number  (only for manual OTs with track_inventory=True)
            notes: string  (optional)
        """
        work_order = self.get_object()
        try:
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
            work_order.refresh_from_db()
            return Response(WorkOrderSerializer(work_order).data)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"])
    def transition(self, request, pk=None):
        """Transition OT to next stage with optional data"""
        work_order = self.get_object()
        try:
            next_stage = request.data.get("next_stage")
            notes = request.data.get("notes", "")
            data = request.data.get("data", {})

            if isinstance(data, str):
                import json
                try:
                    data = json.loads(data)
                except Exception:
                    data = {}

            # Validate stage
            stage_match = None
            for choice, label in WorkOrder.Stage.choices:
                if choice == next_stage:
                    stage_match = choice
                    break

            if not stage_match:
                return Response(
                    {"error": f"Etapa inválida: {next_stage}"}, status=status.HTTP_400_BAD_REQUEST
                )

            # Validate stock availability via service
            ctx = self.get_serializer_context()
            ctx["stocks_by_product"] = self._build_stock_context(work_order)
            serializer = WorkOrderSerializer(work_order, context=ctx)
            WorkOrderService.validate_transition_stock(
                work_order, next_stage, serializer.data.get("materials", [])
            )

            WorkOrderService.transition_to(
                work_order=work_order,
                next_stage=stage_match,
                user=request.user,
                notes=notes,
                data=data,
                files=request.FILES,
            )

            return Response(WorkOrderSerializer(work_order).data)
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"])
    def duplicate(self, request, pk=None):
        """TASK-302: Duplicate a Work Order"""
        work_order = self.get_object()
        try:
            new_wo = WorkOrderService.duplicate(work_order=work_order, user=request.user)
            return Response(WorkOrderSerializer(new_wo).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.exception("Error duplicating WorkOrder")
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["patch"], url_path="update_section")
    def update_section(self, request, pk=None):
        """Patch a named section of MFG_CONFIG data after OT creation."""
        work_order = self.get_object()
        section = request.data.get("section")
        payload = request.data.get("payload", {})
        if not section or not isinstance(payload, dict):
            return Response(
                {"error": "Se requiere section y payload."}, status=status.HTTP_400_BAD_REQUEST
            )
        try:
            if section == "volume":
                quantity = float(payload.get("quantity", 0))
                uom_id = int(payload.get("uom_id", 0))
                WorkOrderService.update_volume(work_order, quantity, uom_id, user=request.user)
            else:
                WorkOrderService.update_mfg_section(work_order, section, payload, user=request.user)
            return Response(WorkOrderSerializer(work_order).data)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"], url_path="restart")
    def restart(self, request, pk=None):
        """Delete a clean DRAFT OT and return its creation defaults.

        The frontend uses the returned initial_data to reopen the wizard pre-filled.
        Fails if the OT has any side-effects (POs, stock movements, completed tasks).
        """
        work_order = self.get_object()

        if work_order.status != WorkOrder.Status.DRAFT:
            return Response(
                {"error": "Solo se pueden reiniciar órdenes en Borrador."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        se = WorkOrderService.check_side_effects(work_order)
        if any(
            [
                se["has_confirmed_pos"],
                se["has_stock_movements"],
                se["completed_tasks_count"],
                se["manually_edited_materials_count"],
            ]
        ):
            return Response(
                {
                    "error": 'La OT tiene actividad registrada y no puede reiniciarse. Use "Crear OT corregida" en su lugar.',
                    "side_effects": se,
                },
                status=status.HTTP_409_CONFLICT,
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

        return Response({"initial_data": initial_data}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"])
    def metrics(self, request):
        """TASK-204: Production Metrics Endpoint"""
        from_date = request.query_params.get("from")
        to_date = request.query_params.get("to")
        try:
            data = WorkOrderMetricsService.get_metrics(from_date, to_date)
            return Response(data)
        except Exception as e:
            logger.exception("Error calculating metrics")
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["get"])
    def print_pdf(self, request, pk=None):
        """TASK-203: Generate a PDF for the Work Order using WeasyPrint"""
        work_order = self.get_object()

        try:
            pdf_bytes = WorkOrderPdfService.generate_pdf(work_order, request)
            filename = f"OT-{work_order.number}.pdf"
            response = HttpResponse(pdf_bytes, content_type="application/pdf")
            response["Content-Disposition"] = f'inline; filename="{filename}"'
            return response
        except Exception as e:
            logger.exception("Error generating PDF")
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=["post"])
    def add_material(self, request, pk=None):
        """Add a material manually to the Work Order"""
        work_order = self.get_object()
        try:
            product_id = request.data.get("product_id")
            quantity = Decimal(str(request.data.get("quantity")))
            uom_id = request.data.get("uom_id")

            # New fields
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

            return Response(WorkOrderSerializer(work_order).data)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"])
    def update_material(self, request, pk=None):
        """Update a manually added material"""
        work_order = self.get_object()
        try:
            material_id = request.data.get("material_id")
            quantity = Decimal(str(request.data.get("quantity")))
            uom_id = request.data.get("uom_id")

            material = WorkOrderMaterial.objects.get(pk=material_id, work_order=work_order)
            material.quantity_planned = quantity
            if uom_id:
                material.uom_id = uom_id

            # New fields
            if "is_outsourced" in request.data:
                material.is_outsourced = request.data.get("is_outsourced")
            if "supplier_id" in request.data:
                material.supplier_id = request.data.get("supplier_id")
            if "unit_price" in request.data:
                material.unit_price = Decimal(str(request.data.get("unit_price", 0)))
            if "document_type" in request.data:
                material.document_type = request.data.get("document_type")

            material.save()

            return Response(WorkOrderSerializer(work_order).data)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"])
    def remove_material(self, request, pk=None):
        """Remove a manually added material"""
        work_order = self.get_object()
        try:
            material_id = request.data.get("material_id")
            material = WorkOrderMaterial.objects.get(pk=material_id, work_order=work_order)

            if material.source != "MANUAL":
                return Response(
                    {"error": "Solo se pueden eliminar materiales agregados manualmente."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            material.delete()
            return Response(WorkOrderSerializer(work_order).data)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["post"], url_path="bulk_transition")
    def bulk_transition(self, request):
        """TASK-306: Advance multiple OTs to the same next stage."""
        ids = request.data.get("ids", [])
        next_stage = request.data.get("next_stage")
        if not ids or not next_stage:
            return Response(
                {"error": "ids y next_stage son requeridos"}, status=status.HTTP_400_BAD_REQUEST
            )
        results = {"ok": [], "errors": []}
        for pk in ids:
            try:
                wo = WorkOrder.objects.get(pk=pk)
                WorkOrderService.transition_to(wo, next_stage)
                results["ok"].append(pk)
            except Exception as e:
                results["errors"].append({"id": pk, "error": str(e)})
        return Response(results)

    @action(detail=False, methods=["post"], url_path="bulk_print")
    def bulk_print(self, request):
        """TASK-306: Print a merged PDF for multiple OTs."""
        ids = request.data.get("ids", [])
        if not ids:
            return Response({"error": "ids es requerido"}, status=status.HTTP_400_BAD_REQUEST)
        orders = WorkOrder.objects.filter(pk__in=ids).select_related(
            "warehouse", "sale_line__order__customer"
        )
        if not orders.exists():
            return Response(
                {"error": "No se encontraron órdenes"}, status=status.HTTP_404_NOT_FOUND
            )
        try:
            merged = WorkOrderPdfService.generate_bulk_pdf(list(orders))
            response = HttpResponse(merged, content_type="application/pdf")
            response["Content-Disposition"] = f'attachment; filename="ots_bulk_{len(ids)}.pdf"'
            return response
        except Exception as e:
            logger.exception("Error generating bulk PDF")
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=["get", "post"], url_path="comments")
    def comments(self, request, pk=None):
        """TASK-307: Unified comment feed for an OT (includes linked NV comments)."""
        from django.contrib.contenttypes.models import ContentType

        from workflow.models import Comment
        from workflow.serializers import CommentSerializer

        order = self.get_object()
        wo_ct = ContentType.objects.get_for_model(WorkOrder)

        if request.method == "GET":
            qs = Comment.objects.filter(content_type=wo_ct, object_id=order.pk)
            if order.sale_order_id:
                from sales.models import SaleOrder

                so_ct = ContentType.objects.get_for_model(SaleOrder)
                so_qs = Comment.objects.filter(content_type=so_ct, object_id=order.sale_order_id)
                qs = (qs | so_qs).order_by("created_at")
            serializer = CommentSerializer(qs, many=True)
            return Response(serializer.data)

        text = (request.data.get("text") or "").strip()
        if not text:
            return Response({"error": "text es requerido"}, status=status.HTTP_400_BAD_REQUEST)
        comment = Comment.objects.create(
            content_type=wo_ct,
            object_id=order.pk,
            user=request.user,
            text=text,
        )
        return Response(CommentSerializer(comment).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"])
    def create_manual(self, request):
        """Create a manual OT"""
        try:
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
                return Response({"error": error_msg}, status=status.HTTP_400_BAD_REQUEST)

            warehouse = (
                Warehouse.objects.get(pk=warehouse_id)
                if warehouse_id
                else Warehouse.objects.first()
            )
            if not uom_id:
                return Response(
                    {"error": "La unidad de medida es requerida para fabricaciones manuales."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            uom = UoM.objects.get(pk=uom_id) if uom_id else None

            work_order = WorkOrderService.create_manual(
                product=product,
                quantity=quantity,
                description=description,
                warehouse=warehouse,
                uom=uom,
                stage_data=stage_data,
            )

            return Response(WorkOrderSerializer(work_order).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class BillOfMaterialsViewSet(viewsets.ModelViewSet):
    queryset = BillOfMaterials.objects.all()
    serializer_class = BillOfMaterialsSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["active"]
    search_fields = ["name", "product__name", "product__code"]

    def get_queryset(self):
        queryset = super().get_queryset()
        product_id = self.request.query_params.get("product_id")
        parent_id = self.request.query_params.get("parent_id")

        if product_id:
            queryset = queryset.filter(product_id=product_id)
        elif parent_id:
            queryset = queryset.filter(
                Q(product_id=parent_id) | Q(product__parent_template_id=parent_id)
            )

        return queryset.select_related("product", "product__parent_template")

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
