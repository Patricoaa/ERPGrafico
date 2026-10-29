import logging

from rest_framework import filters, status, viewsets

from core.api.pagination import StandardResultsSetPagination

logger = logging.getLogger(__name__)
import django_filters
from django_filters.rest_framework import DjangoFilterBackend, FilterSet
from rest_framework.decorators import action
from rest_framework.response import Response

from purchasing.models import PurchaseOrder

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

from django.core.exceptions import ValidationError
from django.http import HttpResponse

from core.idempotency import idempotent_endpoint
from core.mixins import AuditHistoryMixin

from .selectors import ProductionSelectorExt
from .serializers import (
    BillOfMaterialsSerializer,
    WorkOrderListSerializer,
    WorkOrderSerializer,
    WorkOrderWriteSerializer,
)
from .services import WorkOrderMetricsService, WorkOrderPdfService, WorkOrderService


def _error_message(exc):
    """Readable text of an error: str() of a Django ValidationError is "['…']"."""
    from rest_framework.exceptions import ValidationError as DRFValidationError

    if isinstance(exc, DRFValidationError):
        detail = exc.detail
        if isinstance(detail, dict):
            return " ".join(
                f"{field}: {' '.join(map(str, msgs)) if isinstance(msgs, list) else msgs}"
                for field, msgs in detail.items()
            )
        if isinstance(detail, list):
            return " ".join(map(str, detail))
        return str(detail)
    if hasattr(exc, "messages"):
        return " ".join(exc.messages)
    return str(exc)


class WorkOrderViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    # deletion-policy: a WorkOrder is annulled (POST annul/), never hard-deleted
    http_method_names = ["get", "post", "put", "patch", "head", "options"]
    pagination_class = StandardResultsSetPagination
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
        "sale_order",
        "sale_order__customer",
        "related_contact",
        "product",
        "product__manufacturing_profile",
        "sale_line",
        "sale_line__product",
        "sale_line__product__manufacturing_profile",
        "warehouse",
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
        # TaskSerializer reads these per task (assignment, approver, evidence, history)
        "tasks__assigned_to",
        "tasks__assigned_group",
        "tasks__created_by",
        "tasks__completed_by",
        "tasks__attachments",
        "tasks__events__user",
    )
    serializer_class = WorkOrderSerializer

    def get_serializer_class(self):
        if self.action == "list":
            return WorkOrderListSerializer
        if self.action in ["create", "update", "partial_update"]:
            return WorkOrderWriteSerializer
        return WorkOrderSerializer

    def _build_stock_context(self, work_order):
        stocks, products_by_id = WorkOrderService.build_stock_context(work_order)
        return {"stocks_by_product": stocks, "products_by_id": products_by_id}

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        context = self.get_serializer_context()
        context.update(self._build_stock_context(instance))
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
            return Response({"error": _error_message(e)}, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        try:
            WorkOrderService.validate_update_payload(instance, request.data)
        except (ValidationError, ValueError) as e:
            return Response({"error": _error_message(e)}, status=status.HTTP_400_BAD_REQUEST)
        before = dict(instance.stage_data or {})
        response = super().update(request, *args, **kwargs)
        if response.status_code == 200:
            WorkOrderService.after_update(self.get_object(), before, request.FILES, request.user)
        return response

    @action(detail=True, methods=["post"])
    def annul(self, request, pk=None):
        """Annul an OT and reverse its effects"""
        work_order = self.get_object()
        notes = request.data.get("notes", "") or request.data.get("reason", "")
        if not (notes or "").strip():
            return Response(
                {"error": "El motivo de anulación es obligatorio."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            WorkOrderService.annul_work_order(work_order=work_order, user=request.user, notes=notes)
        except ValidationError as e:
            return Response({"error": _error_message(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(WorkOrderSerializer(work_order).data)

    @action(detail=True, methods=["get"], url_path="annul_impact")
    def annul_impact(self, request, pk=None):
        """Read-only preview of what an annulment would affect."""
        work_order = self.get_object()
        affected_pos = [
            {"id": po.id, "display_id": po.display_id, "status": po.status}
            for po in work_order.purchase_orders.exclude(
                status=PurchaseOrder.Status.CANCELLED
            )
        ]
        open_tasks_count = work_order.tasks.filter(
            status__in=["PENDING", "IN_PROGRESS"]
        ).count()
        has_consumptions = work_order.consumptions.exists()
        return Response(
            {
                "is_cancellable": work_order.is_cancellable,
                "cancellation_limit_stage": work_order.cancellation_limit_stage,
                "has_consumptions": has_consumptions,
                "purchase_orders_affected": affected_pos,
                "open_tasks_count": open_tasks_count,
            }
        )

    @action(detail=True, methods=["post"])
    def rectify(self, request, pk=None):
        work_order = self.get_object()
        try:
            WorkOrderService.rectify_from_request(work_order, request)
            work_order.refresh_from_db()
            return Response(WorkOrderSerializer(work_order).data)
        except Exception as e:
            return Response({"error": _error_message(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"])
    def transition(self, request, pk=None):
        work_order = self.get_object()
        try:
            WorkOrderService.transition_from_request(work_order, request)
            return Response(WorkOrderSerializer(work_order).data)
        except ValidationError as e:
            return Response({"error": _error_message(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": _error_message(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"])
    def duplicate(self, request, pk=None):
        """TASK-302: Duplicate a Work Order"""
        work_order = self.get_object()
        try:
            new_wo = WorkOrderService.duplicate(work_order=work_order, user=request.user)
            return Response(WorkOrderSerializer(new_wo).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.exception("Error duplicating WorkOrder")
            return Response({"error": _error_message(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"], url_path="remove_attachment")
    def remove_attachment(self, request, pk=None):
        """Remove a design-file attachment from the work order."""
        from core.models import Attachment
        from django.contrib.contenttypes.models import ContentType
        work_order = self.get_object()
        attachment_id = request.data.get("attachment_id")
        if not attachment_id:
            return Response({"error": "attachment_id es requerido."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            ct = ContentType.objects.get_for_model(work_order)
            attachment = Attachment.objects.get(id=attachment_id, content_type=ct, object_id=work_order.id)
            attachment.delete()
            return Response(WorkOrderSerializer(work_order).data)
        except Attachment.DoesNotExist:
            return Response({"error": "Adjunto no encontrado."}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": _error_message(e)}, status=status.HTTP_400_BAD_REQUEST)

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
            return Response({"error": _error_message(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"], url_path="restart")
    def restart(self, request, pk=None):
        work_order = self.get_object()
        try:
            initial_data = WorkOrderService.restart_work_order(work_order)
            return Response({"initial_data": initial_data}, status=status.HTTP_200_OK)
        except ValidationError as e:
            if work_order.status != WorkOrder.Status.DRAFT:
                return Response({"error": _error_message(e)}, status=status.HTTP_400_BAD_REQUEST)
            se = WorkOrderService.check_side_effects(work_order)
            return Response({"error": str(e), "side_effects": se}, status=status.HTTP_409_CONFLICT)
        except Exception as e:
            return Response({"error": _error_message(e)}, status=status.HTTP_400_BAD_REQUEST)

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
            return Response({"error": _error_message(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["get"])
    def print_pdf(self, request, pk=None):
        """TASK-203: Generate a PDF for the Work Order using WeasyPrint"""
        work_order = self.get_object()

        try:
            pdf_bytes = WorkOrderPdfService.generate_pdf(work_order, request)
            from core.prefix_registry import EntityPrefix
            filename = f"{EntityPrefix.WORK_ORDER}-{work_order.number}.pdf"
            response = HttpResponse(pdf_bytes, content_type="application/pdf")
            response["Content-Disposition"] = f'inline; filename="{filename}"'
            return response
        except Exception as e:
            logger.exception("Error generating PDF")
            return Response({"error": _error_message(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=["post"])
    def add_material(self, request, pk=None):
        work_order = self.get_object()
        try:
            WorkOrderService.add_material_from_request(work_order, request)
            return Response(WorkOrderSerializer(work_order).data)
        except Exception as e:
            return Response({"error": _error_message(e)}, status=status.HTTP_400_BAD_REQUEST)

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
                user=request.user,
            )
            return Response(WorkOrderSerializer(work_order).data)
        except WorkOrderMaterial.DoesNotExist:
            return Response({"error": "Material no encontrado en esta orden."}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": _error_message(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"])
    def remove_material(self, request, pk=None):
        work_order = self.get_object()
        try:
            WorkOrderService.remove_material(work_order, request.data.get("material_id"), user=request.user)
            return Response(WorkOrderSerializer(work_order).data)
        except Exception as e:
            return Response({"error": _error_message(e)}, status=status.HTTP_400_BAD_REQUEST)

    @idempotent_endpoint(scope="production.order.bulk_transition")
    @action(detail=False, methods=["post"], url_path="bulk_transition")
    def bulk_transition(self, request):
        try:
            results = WorkOrderService.bulk_transition(
                request.data.get("ids", []), request.data.get("next_stage"), user=request.user
            )
            return Response(results)
        except Exception as e:
            return Response({"error": _error_message(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["post"], url_path="bulk_print")
    def bulk_print(self, request):
        ids = request.data.get("ids", [])
        try:
            orders = WorkOrderPdfService.get_orders_for_bulk_print(ids)
            merged = WorkOrderPdfService.generate_bulk_pdf(orders, request)
            response = HttpResponse(merged, content_type="application/pdf")
            response["Content-Disposition"] = f'attachment; filename="ots_bulk_{len(ids)}.pdf"'
            return response
        except Exception as e:
            logger.exception("Error generating bulk PDF")
            return Response({"error": _error_message(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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
            return Response({"error": _error_message(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": _error_message(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["post"])
    def create_manual(self, request):
        try:
            work_order = WorkOrderService.create_manual_from_request(request)
            return Response(WorkOrderSerializer(work_order).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": _error_message(e)}, status=status.HTTP_400_BAD_REQUEST)


class BillOfMaterialsViewSet(viewsets.ModelViewSet):
    pagination_class = StandardResultsSetPagination
    queryset = BillOfMaterials.objects.all()
    serializer_class = BillOfMaterialsSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["active"]
    search_fields = ["name", "product__name", "product__code"]

    def get_queryset(self):
        return ProductionSelectorExt.get_bom_queryset(self.request)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
