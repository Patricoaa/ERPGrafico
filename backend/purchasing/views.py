import django_filters
from django.core.exceptions import ValidationError
from django_filters.rest_framework import DjangoFilterBackend, FilterSet
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.api.pagination import StandardResultsSetPagination
from core.api.search import DistinctSearchFilter
from core.idempotency import idempotent_endpoint
from core.mixins import AuditHistoryMixin, NoDestroyModelMixin

from .filters import PurchaseReceiptFilter, PurchaseReturnFilter
from .models import PurchaseOrder, PurchaseReturn
from .return_services import PurchaseReturnService
from .selectors import PurchaseOrderSelector, PurchaseReceiptSelector
from .serializers import (
    PurchaseOrderSerializer,
    PurchaseReceiptSerializer,
    PurchaseReturnSerializer,
    WritePurchaseOrderSerializer,
)
from .services import PurchasingService


class PurchaseOrderFilterSet(FilterSet):
    date_after = django_filters.DateFilter(field_name="date", lookup_expr="gte")
    date_before = django_filters.DateFilter(field_name="date", lookup_expr="lte")
    receiving_status = django_filters.CharFilter(field_name="receiving_status")
    receipt_date_after = django_filters.DateFilter(field_name="receipt_date", lookup_expr="gte")
    receipt_date_before = django_filters.DateFilter(field_name="receipt_date", lookup_expr="lte")
    total_min = django_filters.NumberFilter(field_name="total", lookup_expr="gte")
    total_max = django_filters.NumberFilter(field_name="total", lookup_expr="lte")
    created_at_after = django_filters.DateFilter(field_name="created_at", lookup_expr="date__gte")
    created_at_before = django_filters.DateFilter(field_name="created_at", lookup_expr="date__lte")

    supplier_name = django_filters.CharFilter(field_name="supplier__name", lookup_expr="icontains")
    number = django_filters.CharFilter(field_name="number", lookup_expr="icontains")
    product_name = django_filters.CharFilter(method="filter_product_name")

    origin_status = django_filters.CharFilter(method="filter_origin_status")
    billing_status = django_filters.CharFilter(method="filter_billing_status")
    treasury_status = django_filters.CharFilter(method="filter_treasury_status")

    class Meta:
        model = PurchaseOrder
        fields = [
            "status",
            "date_after",
            "date_before",
            "receiving_status",
            "receipt_date_after",
            "receipt_date_before",
            "total_min",
            "total_max",
            "origin_status",
            "billing_status",
            "treasury_status",
            "created_at_after",
            "created_at_before",
            "supplier_name",
            "number",
            "product_name",
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
        if value == "success":
            return (
                queryset.filter(
                    invoices__status="POSTED",
                )
                .exclude(invoices__number="")
                .distinct()
            )
        elif value == "neutral":
            return queryset.exclude(
                id__in=queryset.filter(
                    invoices__status="POSTED",
                )
                .exclude(invoices__number="")
                .values("id")
            ).distinct()
        return queryset

    def filter_treasury_status(self, queryset, name, value):
        # ADR-0084: el pago es un eje derivado del saldo, no un estado de la OC
        from core.payment_status import filter_by_payment_status

        return filter_by_payment_status(queryset.exclude(status="CANCELLED"), value)


class PurchaseOrderViewSet(NoDestroyModelMixin, viewsets.ModelViewSet, AuditHistoryMixin):
    def get_queryset(self):
        return PurchaseOrderSelector.get_base_queryset()
    pagination_class = StandardResultsSetPagination
    # DistinctSearchFilter: searching by product name joins the lines (one row per matching line).
    filter_backends = [DjangoFilterBackend, DistinctSearchFilter, filters.OrderingFilter]
    filterset_class = PurchaseOrderFilterSet
    search_fields = ["supplier__name", "supplier__tax_id", "number", "lines__product__name"]
    # Server ordering (ADR-0087 lote 2c): `?ordering=<key>,id`; without it, newest first (the model
    # has no Meta.ordering and an unordered queryset pages unstably).
    ordering_fields = ["id", "number", "date", "supplier__name", "receipt_date", "total"]
    ordering = ["-date", "-id"]

    @action(detail=False, methods=["get"], url_path="analytics")
    def analytics(self, request):
        """Figures over the whole filtered list (same filters and search as the list endpoint)."""
        from .analytics import PurchaseOrderAnalyticsService

        queryset = self.filter_queryset(PurchaseOrderSelector.get_analytics_queryset()).order_by()
        granularity = request.query_params.get("granularity", "month")
        return Response(PurchaseOrderAnalyticsService.compute(queryset, granularity=granularity))

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return WritePurchaseOrderSerializer
        return PurchaseOrderSerializer

    def update(self, request, *args, **kwargs):
        try:
            PurchasingService.validate_editable(self.get_object())
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        try:
            PurchasingService.validate_editable(self.get_object())
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        try:
            PurchasingService.validate_can_purge(self.get_object(), request.user)
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["get"])
    def cancel_impact(self, request, pk=None):
        """Preview what will happen when cancelling this purchase order."""
        impact = PurchaseOrderSelector.get_cancel_impact(self.get_object())
        return Response(impact)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        """Cancel a purchase order (soft if DRAFT, full annul if CONFIRMED)."""
        order = self.get_object()
        reason = request.data.get("reason", "")
        try:
            order = PurchasingService.cancel_purchase_order(order, user=request.user, reason=reason)
            return Response(PurchaseOrderSerializer(order).data)
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @idempotent_endpoint(scope="purchasing.order.confirm")
    @action(detail=True, methods=["post"])
    def confirm(self, request, pk=None):
        order = self.get_object()
        try:
            PurchasingService.confirm_purchase(order, user=request.user)
            return Response(PurchaseOrderSerializer(order).data)
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"])
    def receive(self, request, pk=None):
        order = self.get_object()
        try:
            receipt = PurchasingService.receive_order_from_request(order, request.data)
            return Response(PurchaseReceiptSerializer(receipt).data, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @idempotent_endpoint(scope="purchasing.order.receive")
    @action(detail=True, methods=["post"])
    def partial_receive(self, request, pk=None):
        order = self.get_object()
        try:
            receipt = PurchasingService.partial_receive_from_request(order, request.data)
            return Response(PurchaseReceiptSerializer(receipt).data, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(PurchaseReceiptSerializer(receipts, many=True).data)

    @action(detail=True, methods=["post"])
    def partial_return(self, request, pk=None):
        order = self.get_object()
        try:
            receipt = PurchasingService.partial_return_from_request(order, request.data)
            return Response(PurchaseReceiptSerializer(receipt).data, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=["post"])
    def register_note(self, request, pk=None):
        order = self.get_object()
        try:
            invoice = PurchasingService.register_note_from_request(request, order)
            from billing.serializers import InvoiceSerializer
            return Response(InvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @idempotent_endpoint(scope="purchasing.order.checkout")
    @action(detail=False, methods=["post"])
    def purchase_checkout(self, request):
        try:
            result = PurchasingService.purchase_checkout_from_request(request)
            return Response(PurchasingService.purchase_checkout_response(result), status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=["post"])
    def annul(self, request, pk=None):
        order = self.get_object()
        force = request.data.get("force", False)
        reason = request.data.get("reason", "")
        try:
            from core.services.document import DocumentRegistry

            DocumentRegistry.for_instance(order).cancel(
                order, user=request.user, reason=reason, force=force
            )
            return Response(PurchaseOrderSerializer(order).data)
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class PurchaseReceiptViewSet(NoDestroyModelMixin, viewsets.ModelViewSet, AuditHistoryMixin):
    serializer_class = PurchaseReceiptSerializer
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_class = PurchaseReceiptFilter
    search_fields = [
        "number",
        "purchase_order__supplier__name",
        "purchase_order__number",
    ]

    def get_queryset(self):
        return PurchaseReceiptSelector.get_base_queryset()

    @action(detail=True, methods=["post"])
    def annul(self, request, pk=None):
        receipt = self.get_object()
        reason = request.data.get("reason", "")
        try:
            receipt = PurchasingService.annul_receipt(receipt, user=request.user, reason=reason)
            return Response(PurchaseReceiptSerializer(receipt).data)
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class PurchaseReturnViewSet(NoDestroyModelMixin, viewsets.ModelViewSet, AuditHistoryMixin):
    def get_queryset(self):
        return PurchaseReturn.objects.select_related(
            "purchase_order__supplier", "warehouse"
        ).prefetch_related(
            "lines__product", "lines__uom", "lines__stock_move"
        ).all()
    serializer_class = PurchaseReturnSerializer
    pagination_class = StandardResultsSetPagination
    # ADR-0090: la lista de devoluciones de compra es una vista documental propia (filtros + orden).
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = PurchaseReturnFilter
    search_fields = ["number", "purchase_order__supplier__name", "purchase_order__number"]
    ordering_fields = ["number", "date", "total_cost", "status", "purchase_order__supplier__name"]
    ordering = ["-date", "-id"]

    @action(detail=True, methods=["post"])
    def annul(self, request, pk=None):
        doc = self.get_object()
        try:
            PurchaseReturnService.annul_return(doc.id)
            return Response(PurchaseReturnSerializer(doc).data)
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            import traceback

            traceback.print_exc()
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
