
import django_filters
from django.core.exceptions import ValidationError
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.api.pagination import StandardResultsSetPagination
from core.api.search import DistinctSearchFilter
from core.mixins import AuditHistoryMixin, NoDestroyModelMixin

from .filters import SaleDeliveryFilter, SaleReturnFilter
from .models import SaleOrder, SaleReturn, SalesSettings
from .selectors import SaleDeliverySelector, SaleOrderSelector
from .serializers import (
    CreateSaleOrderSerializer,
    SaleDeliverySerializer,
    SaleOrderSerializer,
    SaleReturnSerializer,
    SalesSettingsSerializer,
)
from .services import SalesService


class SalesSettingsViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    queryset = SalesSettings.objects.all()
    serializer_class = SalesSettingsSerializer

    def get_permissions(self):
        if self.action == "current" and self.request.method == "GET":
            return [IsAuthenticated()]
        return super().get_permissions()

    @action(detail=False, methods=["get", "put", "patch"])
    def current(self, request):
        obj, _ = SalesSettings.objects.get_or_create(pk=1)
        from .services import SalesSettingsService

        data = SalesSettingsService.get_or_update_current_settings(
            obj, request.data, request.method, self.get_serializer
        )
        return Response(data)


from core.api.permissions import StandardizedModelPermissions
from core.idempotency import idempotent_endpoint


class SaleOrderFilterSet(django_filters.FilterSet):
    customer_name = django_filters.CharFilter(field_name="customer__name", lookup_expr="icontains")
    date_after = django_filters.DateFilter(field_name="date", lookup_expr="gte")
    date_before = django_filters.DateFilter(field_name="date", lookup_expr="lte")
    total_min = django_filters.NumberFilter(field_name="total", lookup_expr="gte")
    total_max = django_filters.NumberFilter(field_name="total", lookup_expr="lte")
    number = django_filters.CharFilter(field_name="number", lookup_expr="icontains")
    product_name = django_filters.CharFilter(method="filter_product_name")
    delivery_status = django_filters.CharFilter(field_name="delivery_status")
    origin_status = django_filters.CharFilter(method="filter_origin_status")
    billing_status = django_filters.CharFilter(method="filter_billing_status")
    payment_status = django_filters.CharFilter(method="filter_payment_status")
    production_status = django_filters.CharFilter(method="filter_production_status")

    class Meta:
        model = SaleOrder
        fields = [
            "customer_name",
            "date_after",
            "date_before",
            "total_min",
            "total_max",
            "number",
            "product_name",
            "delivery_status",
            "origin_status",
            "billing_status",
            "payment_status",
            "production_status",
        ]

    def filter_product_name(self, queryset, name, value):
        return queryset.filter(lines__product__name__icontains=value).distinct()

    def filter_origin_status(self, queryset, name, value):
        if value == "success":
            return queryset.exclude(status__in=["DRAFT", "CANCELLED"])
        elif value == "neutral":
            return queryset.filter(status="DRAFT")
        elif value == "destructive":
            return queryset.filter(status="CANCELLED")
        return queryset

    def filter_billing_status(self, queryset, name, value):
        values = value.split(",") if value else []
        invoiced = queryset.filter(
            invoices__status="POSTED",
        ).exclude(invoices__number="").distinct()
        not_invoiced = queryset.exclude(
            id__in=invoiced.values("id")
        ).distinct()

        if "success" in values and "pending" not in values:
            return invoiced
        if "pending" in values and "success" not in values:
            return not_invoiced
        return queryset

    def filter_payment_status(self, queryset, name, value):
        # ADR-0084: el pago es un eje derivado del saldo, no un estado de la OV
        from core.payment_status import filter_by_payment_status

        return filter_by_payment_status(queryset.exclude(status="CANCELLED"), value)

    def filter_production_status(self, queryset, name, value):
        if value == "none":
            return queryset.filter(work_orders__isnull=True)
        elif value == "in_progress":
            return queryset.filter(work_orders__status__in=["DRAFT", "IN_PROGRESS"]).distinct()
        elif value == "finished":
            return (
                queryset.exclude(work_orders__isnull=True)
                .exclude(work_orders__status__in=["DRAFT", "IN_PROGRESS"])
                .distinct()
            )
        return queryset


class SaleOrderViewSet(NoDestroyModelMixin, viewsets.ModelViewSet, AuditHistoryMixin):
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        return SaleOrderSelector.get_base_queryset()
    permission_classes = [StandardizedModelPermissions]
    filter_backends = [DjangoFilterBackend, DistinctSearchFilter, filters.OrderingFilter]
    filterset_class = SaleOrderFilterSet
    search_fields = ["customer__name", "customer__tax_id", "number", "lines__product__name"]
    # Server ordering of the list (ADR-0087 lote 2b): `?ordering=<key>,id`. Without it, the
    # selector's "-date,-id" order is kept.
    ordering_fields = ["id", "number", "date", "customer__name", "total"]

    @action(detail=False, methods=["get"], url_path="analytics")
    def analytics(self, request):
        """Figures over the whole filtered list (same filters and search as the list endpoint)."""
        from .analytics import SaleOrderAnalyticsService

        queryset = self.filter_queryset(SaleOrderSelector.get_analytics_queryset()).order_by()
        granularity = request.query_params.get("granularity", "month")
        return Response(SaleOrderAnalyticsService.compute(queryset, granularity=granularity))

    def get_serializer_class(self):
        if self.action == "create":
            return CreateSaleOrderSerializer
        if self.action in ["update", "partial_update"]:
            return CreateSaleOrderSerializer
        return SaleOrderSerializer

    @idempotent_endpoint(scope="sales.order.create")
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        from django.core.exceptions import ValidationError
        try:
            order = SalesService.create_sale_order_from_pos(
                user=request.user,
                data=request.data,
                files=request.FILES,
                serializer=serializer
            )
            return Response(SaleOrderSerializer(order).data, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            msg = e.messages[0] if hasattr(e, "messages") and e.messages else str(e)
            return Response({"error": msg}, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        try:
            SalesService.validate_editable(instance)
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        try:
            SalesService.validate_editable(instance)
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if not request.user.is_staff:
            return Response(
                {"error": "Solo administradores pueden purgar documentos cancelados."},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            SalesService.validate_purge(instance)
        except ValidationError as e:
            msg = e.messages[0] if getattr(e, "messages", None) else str(e)
            return Response({"error": msg}, status=status.HTTP_400_BAD_REQUEST)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["get"])
    def cancel_impact(self, request, pk=None):
        """Preview what will happen when cancelling this order."""
        from .selectors import SaleOrderSelector

        order = self.get_object()
        impact = SaleOrderSelector.get_cancel_impact(order)
        return Response(impact)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        """Cancel a sale order (soft if DRAFT, full annul if CONFIRMED)."""
        order = self.get_object()
        reason = request.data.get("reason", "")
        try:
            order = SalesService.cancel_sale_order(order, user=request.user, reason=reason)
            return Response(SaleOrderSerializer(order).data)
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @idempotent_endpoint(scope="sales.order.confirm")
    @action(detail=True, methods=["post"])
    def confirm(self, request, pk=None):
        order = self.get_object()
        try:
            SalesService.confirm_sale(order)
            return Response(SaleOrderSerializer(order).data)
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @idempotent_endpoint(scope="sales.order.dispatch")
    @action(detail=True, methods=["post"], url_path="dispatch")
    def dispatch_order(self, request, pk=None):
        order = self.get_object()
        try:
            delivery = SalesService.dispatch_order_by_id(
                order=order,
                warehouse_id=request.data.get("warehouse_id"),
                delivery_date=request.data.get("delivery_date"),
            )
            return Response(SaleDeliverySerializer(delivery).data, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=["post"])
    def partial_dispatch(self, request, pk=None):
        order = self.get_object()
        try:
            delivery = SalesService.partial_dispatch_from_request(order, request.data)
            return Response(SaleDeliverySerializer(delivery).data, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=["get"])
    def deliveries(self, request, pk=None):
        """List all deliveries for this order"""
        order = self.get_object()
        deliveries = order.deliveries.all()
        return Response(SaleDeliverySerializer(deliveries, many=True).data)

    @action(detail=True, methods=["post"])
    def register_note(self, request, pk=None):
        order = self.get_object()
        try:
            invoice = SalesService.register_note_from_request(request, order)
            from billing.serializers import InvoiceSerializer
            return Response(InvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=["post"])
    def register_merchandise_return(self, request, pk=None):
        order = self.get_object()
        try:
            from sales.return_services import SalesReturnService

            return_delivery = SalesReturnService.register_merchandise_return_from_request(request, order)
            return Response(
                {
                    "message": "Devolución registrada exitosamente",
                    "return_delivery_id": return_delivery.id,
                    "return_delivery": SaleDeliverySerializer(return_delivery).data,
                },
                status=status.HTTP_201_CREATED,
            )
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=["get"], url_path="filter-suggestions")
    def filter_suggestions(self, request):
        q = request.query_params.get("q", "").strip()
        if len(q) < 2:
            return Response([])
        return Response(SaleOrderSelector.get_customer_name_suggestions(q))

    @action(detail=False, methods=["get"])
    def credit_history(self, request):
        history = SaleOrderSelector.get_credit_history_queryset()
        page = self.paginate_queryset(history)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(history[:100], many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def annul(self, request, pk=None):
        order = self.get_object()
        force = request.data.get("force", False)
        reason = request.data.get("reason", "")
        try:
            from core.services.document import DocumentRegistry

            DocumentRegistry.for_instance(order).cancel(
                order,
                user=request.user,
                reason=reason,
                force=force,
            )
            return Response(SaleOrderSerializer(order).data)
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=["post"])
    def write_off(self, request, pk=None):
        """Castigate the debt of this specific Sale Order."""
        order = self.get_object()
        from django.core.exceptions import ValidationError
        try:
            entry, balance = SalesService.write_off(order)
            return Response(
                {
                    "message": f"Documento {order.number} castigado.",
                    "journal_entry": entry.display_id,
                    "amount": str(balance),
                }
            )
        except ValidationError as e:
            msg = e.messages[0] if hasattr(e, "messages") and e.messages else str(e)
            return Response({"error": msg}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": f"Error interno: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=["get", "post"], url_path="comments")
    def comments(self, request, pk=None):
        from workflow.serializers import CommentSerializer
        order = self.get_object()
        if request.method == "GET":
            qs = SalesService.get_comments_queryset(order)
            return Response(CommentSerializer(qs, many=True).data)
        try:
            comment = SalesService.add_comment_from_request(order, request)
            return Response(CommentSerializer(comment).data, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class SaleDeliveryViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    pagination_class = StandardResultsSetPagination
    serializer_class = SaleDeliverySerializer
    # ADR-0090: la lista de entregas es una vista documental propia (orden por columna).
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = SaleDeliveryFilter
    search_fields = [
        "number",
        "sale_order__customer__name",
        "sale_order__number",
    ]
    ordering_fields = [
        "number",
        "delivery_date",
        "total_cost",
        "status",
        "sale_order__customer__name",
    ]
    ordering = ["-delivery_date", "-id"]

    def get_queryset(self):
        return SaleDeliverySelector.get_base_queryset()

    @action(detail=True, methods=["post"])
    def annul(self, request, pk=None):
        delivery = self.get_object()
        reason = request.data.get("reason", "")
        try:
            delivery = SalesService.annul_delivery(delivery, user=request.user, reason=reason)
            return Response(SaleDeliverySerializer(delivery).data)
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class SaleReturnViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    pagination_class = StandardResultsSetPagination
    queryset = (
        SaleReturn.objects.select_related("sale_order__customer", "warehouse")
        .prefetch_related("lines__product", "lines__uom")
        .all()
    )
    serializer_class = SaleReturnSerializer
    # ADR-0090: la lista de devoluciones es una vista documental propia (filtros + orden).
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = SaleReturnFilter
    search_fields = ["number", "sale_order__customer__name", "sale_order__number"]
    ordering_fields = ["number", "date", "total_cost", "status", "sale_order__customer__name"]
    ordering = ["-date", "-id"]

    @action(detail=True, methods=["post"])
    def annul(self, request, pk=None):
        doc = self.get_object()
        try:
            from sales.return_services import ReturnService

            ReturnService.annul_return(doc.id)
            return Response(SaleReturnSerializer(doc).data)
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            import traceback

            traceback.print_exc()
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
