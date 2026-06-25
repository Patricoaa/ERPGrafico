import django_filters
from django.core.exceptions import ValidationError
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend, FilterSet
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response



from core.api.pagination import StandardResultsSetPagination
from core.api.permissions import StandardizedModelPermissions
from core.api.search import DistinctSearchFilter
from core.idempotency import idempotent_endpoint
from core.mixins import AuditHistoryMixin, NoDestroyModelMixin
from inventory.models import Warehouse

from .models import PurchaseOrder, PurchaseReceipt, PurchaseReturn
from .return_services import PurchaseReturnService
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
                    invoices__status__in=["POSTED", "PAID"],
                )
                .exclude(invoices__number="")
                .distinct()
            )
        elif value == "neutral":
            return queryset.exclude(
                id__in=queryset.filter(
                    invoices__status__in=["POSTED", "PAID"],
                )
                .exclude(invoices__number="")
                .values("id")
            ).distinct()
        return queryset

    def filter_treasury_status(self, queryset, name, value):
        if value == "success":
            return queryset.filter(status="PAID")
        elif value == "active":
            return queryset.filter(payments__isnull=False).exclude(status="PAID").distinct()
        elif value == "neutral":
            return queryset.filter(
                payments__isnull=True, status__in=["DRAFT", "CONFIRMED", "RECEIVED", "INVOICED"]
            )
        return queryset


class PurchaseOrderViewSet(NoDestroyModelMixin, viewsets.ModelViewSet, AuditHistoryMixin):
    def get_queryset(self):
        return PurchaseOrder.objects.select_related(
            "supplier", "warehouse", "work_order", "payment_method_ref"
        ).prefetch_related(
            "payments__invoice",
            "invoices",
            "lines__product",
            "lines__uom",
            "receipts__lines__stock_move__product",
            "receipts__lines__product"
        ).all()
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_class = PurchaseOrderFilterSet
    search_fields = ["supplier__name", "supplier__tax_id", "number", "lines__product__name"]

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return WritePurchaseOrderSerializer
        return PurchaseOrderSerializer

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.status != "DRAFT":
            return Response(
                {"error": "Solo se pueden editar órdenes en estado Borrador."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.status != "DRAFT":
            return Response(
                {"error": "Solo se pueden editar órdenes en estado Borrador."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if not request.user.is_staff:
            return Response(
                {"error": "Solo administradores pueden purgar documentos cancelados."},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            PurchasingService.validate_purge(instance)
        except ValidationError as e:
            msg = e.messages[0] if getattr(e, "messages", None) else str(e)
            return Response({"error": msg}, status=status.HTTP_400_BAD_REQUEST)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["get"])
    def cancel_impact(self, request, pk=None):
        """Preview what will happen when cancelling this purchase order."""
        from .selectors import PurchaseOrderSelector

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
            from workflow.services import WorkflowService
            WorkflowService.sync_hub_tasks(result["order"])
            from billing.serializers import InvoiceSerializer
            from treasury.serializers import TreasuryMovementSerializer
            from .serializers import PurchaseReceiptSerializer

            res = {
                "order": PurchaseOrderSerializer(result["order"]).data,
                "invoice": InvoiceSerializer(result["invoice"]).data if result["invoice"] else None,
                "payment": TreasuryMovementSerializer(result["payment"]).data if result["payment"] else None,
                "receipt": PurchaseReceiptSerializer(result["receipt"]).data if result["receipt"] else None,
            }
            return Response(res, status=status.HTTP_201_CREATED)
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
    def get_queryset(self):
        return PurchaseReceipt.objects.select_related(
            "purchase_order__supplier", "warehouse"
        ).prefetch_related(
            "lines__product"
        ).all()
    serializer_class = PurchaseReceiptSerializer
    pagination_class = StandardResultsSetPagination

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
            "lines__product", "lines__uom"
        ).all()
    serializer_class = PurchaseReturnSerializer
    pagination_class = StandardResultsSetPagination

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
