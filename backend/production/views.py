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
        if not (value and self.request and self.request.user.is_authenticated): return queryset
        from django.contrib.contenttypes.models import ContentType
        from django.db.models import Q
        from workflow.models import Task
        u = self.request.user
        tasks = Task.objects.filter(content_type=ContentType.objects.get_for_model(queryset.model), status__in=[Task.Status.PENDING, Task.Status.IN_PROGRESS])
        q = Q(assigned_to=u)
        if u.groups.exists(): q |= Q(assigned_group__in=u.groups.all())
        return queryset.filter(id__in=tasks.filter(q).values_list('object_id', flat=True))


from decimal import Decimal

from django.contrib.contenttypes.models import ContentType
from django.db.models import Q, Sum
from django.core.exceptions import ValidationError
from django.http import HttpResponse
from core.mixins import AuditHistoryMixin
from core.idempotency import idempotent_endpoint
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
        "sale_order__attachments",
        "sale_line__attachments",
        "tasks",
    )
    serializer_class = WorkOrderSerializer

    def _build_stock_context(self, work_order):
        return WorkOrderService.build_stock_context(work_order)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        context = self.get_serializer_context()
        context["stocks_by_product"] = self._build_stock_context(instance)
        serializer = self.get_serializer(instance, context=context)
        return Response(serializer.data)

    @idempotent_endpoint(scope="production.order.create")
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
        instance = self.get_object()
        try:
            WorkOrderService.validate_update_allowed(instance, request.data.keys())
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
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
        instance = self.get_object()
        try:
            WorkOrderService.delete_work_order(instance)
            return Response(status=status.HTTP_204_NO_CONTENT)
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

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
        work_order = self.get_object()
        try:
            WorkOrderService.rectify_from_request(work_order, request)
            work_order.refresh_from_db()
            return Response(WorkOrderSerializer(work_order).data)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"])
    def transition(self, request, pk=None):
        work_order = self.get_object()
        try:
            WorkOrderService.transition_from_request(work_order, request)
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
        work_order = self.get_object()
        try:
            initial_data = WorkOrderService.restart_work_order(work_order)
            return Response({"initial_data": initial_data}, status=status.HTTP_200_OK)
        except ValidationError as e:
            if work_order.status != WorkOrder.Status.DRAFT:
                return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
            se = WorkOrderService.check_side_effects(work_order)
            return Response({"error": str(e), "side_effects": se}, status=status.HTTP_409_CONFLICT)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

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
        work_order = self.get_object()
        try:
            WorkOrderService.add_material_from_request(work_order, request)
            return Response(WorkOrderSerializer(work_order).data)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"])
    def update_material(self, request, pk=None):
        """Update a manually added material"""
        work_order = self.get_object()
        try:
            material = WorkOrderService.update_material(
                work_order=work_order,
                material_id=request.data.get("material_id"),
                quantity=Decimal(str(request.data.get("quantity"))),
                uom_id=request.data.get("uom_id") or None,
                is_outsourced=request.data.get("is_outsourced") if "is_outsourced" in request.data else None,
                supplier_id=request.data.get("supplier_id") if "supplier_id" in request.data else None,
                unit_price=Decimal(str(request.data.get("unit_price", 0))) if "unit_price" in request.data else None,
                document_type=request.data.get("document_type") if "document_type" in request.data else None,
            )
            return Response(WorkOrderSerializer(work_order).data)
        except WorkOrderMaterial.DoesNotExist:
            return Response({"error": "Material no encontrado en esta orden."}, status=status.HTTP_404_NOT_FOUND)
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

    @idempotent_endpoint(scope="production.order.bulk_transition")
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
        from workflow.serializers import CommentSerializer
        order = self.get_object()
        if request.method == "GET":
            qs = WorkOrderService.get_comments_queryset(order)
            return Response(CommentSerializer(qs, many=True).data)
        try:
            comment = WorkOrderService.add_comment_from_request(order, request)
            return Response(CommentSerializer(comment).data, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["post"])
    def create_manual(self, request):
        try:
            work_order = WorkOrderService.create_manual_from_request(request)
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
        from django.db.models import Q
        qs = super().get_queryset()
        pid, parent = self.request.query_params.get('product_id'), self.request.query_params.get('parent_id')
        if pid: qs = qs.filter(product_id=pid)
        elif parent: qs = qs.filter(Q(product_id=parent) | Q(product__parent_template_id=parent))
        return qs.select_related('product', 'product__parent_template', 'yield_uom').prefetch_related('lines', 'lines__component', 'lines__component__uom', 'lines__uom', 'lines__supplier')

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
