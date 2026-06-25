import django_filters
from django.core.exceptions import ValidationError
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend, FilterSet
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response



from core.api.permissions import StandardizedModelPermissions
from core.api.search import DistinctSearchFilter
from core.idempotency import idempotent_endpoint
from core.mixins import AuditHistoryMixin
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


class PurchaseOrderViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    queryset = PurchaseOrder.objects.all()
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
        if order.status == "DRAFT":
            from core.services.document import DocumentRegistry

            DocumentRegistry.for_instance(order).confirm(order, user=request.user)
            return Response({"status": "confirmed"})
        return Response({"error": "Order not in draft"}, status=400)

    @action(detail=True, methods=["post"])
    def receive(self, request, pk=None):
        order = self.get_object()
        try:
            warehouse_id = request.data.get("warehouse_id")
            receipt_date = request.data.get("receipt_date")

            warehouse = order.warehouse
            if warehouse_id:
                warehouse = Warehouse.objects.get(pk=warehouse_id)

            receipt = PurchasingService.receive_order(
                order=order,
                warehouse=warehouse,
                receipt_date=receipt_date,
                delivery_reference=request.data.get("delivery_reference", ""),
                notes=request.data.get("notes", ""),
            )

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
            warehouse = order.warehouse
            if warehouse_id := request.data.get("warehouse_id"):
                warehouse = Warehouse.objects.get(pk=warehouse_id)

            receipt = PurchasingService.partial_receive(
                order=order,
                warehouse=warehouse,
                line_data=request.data.get("line_data", []),
                receipt_date=request.data.get("receipt_date"),
                delivery_reference=request.data.get("delivery_reference", ""),
                notes=request.data.get("notes", ""),
            )
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
            warehouse_id = request.data.get("warehouse_id")
            receipt_date = request.data.get("receipt_date")
            line_data = request.data.get("line_data", [])

            warehouse = order.warehouse
            if warehouse_id:
                warehouse = Warehouse.objects.get(pk=warehouse_id)

            receipt = PurchasingService.partial_return(
                order=order,
                warehouse=warehouse,
                line_data=line_data,
                receipt_date=receipt_date,
                delivery_reference=request.data.get("delivery_reference", ""),
                notes=request.data.get("notes", ""),
            )

            return Response(PurchaseReceiptSerializer(receipt).data, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @staticmethod
    def _parse_register_note(request):
        data = request.data.dict() if hasattr(request.data, "dict") else request.data.copy()
        if "return_items" in data and isinstance(data["return_items"], str):
            import json
            try:
                data["return_items"] = json.loads(data["return_items"])
            except Exception:
                pass
        return data

    @action(detail=True, methods=["post"])
    def register_note(self, request, pk=None):
        order = self.get_object()
        data = self._parse_register_note(request)
        from .serializers import NoteCreationSerializer
        serializer = NoteCreationSerializer(data=data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            val = serializer.validated_data
            invoice = PurchasingService.create_note(
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
            from billing.serializers import InvoiceSerializer
            return Response(InvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @staticmethod
    def _parse_purchase_checkout(request):
        import json
        
        data = request.data
        order_data = data.get("order_data")
        if isinstance(order_data, str):
            order_data = json.loads(order_data)

        receipt_data = data.get("receipt_data")
        if isinstance(receipt_data, str):
            receipt_data = json.loads(receipt_data)

        check_bank_id = data.get("check_bank_id")
        if check_bank_id:
            check_bank_id = int(check_bank_id)

        installments_raw = data.get("installments", 1)
        try:
            installments = int(installments_raw) if installments_raw is not None else 1
        except (ValueError, TypeError):
            installments = 1

        return {
            "order_data": order_data,
            "dte_type": data.get("dte_type", "FACTURA"),
            "document_number": data.get("document_number", ""),
            "document_date": data.get("document_date"),
            "document_attachment": request.FILES.get("document_attachment"),
            "payment_method": data.get("payment_method", "CREDIT"),
            "amount": data.get("amount"),
            "installments": installments,
            "treasury_account_id": data.get("treasury_account_id"),
            "transaction_number": data.get("transaction_number"),
            "payment_is_pending": data.get("payment_is_pending", "false").lower() == "true",
            "payment_method_id": data.get("payment_method_id"),
            "check_number": data.get("check_number") or data.get("transaction_number"),
            "check_bank_id": check_bank_id,
            "check_issue_date": data.get("check_issue_date"),
            "check_due_date": data.get("check_due_date"),
            "checkbook_id": data.get("checkbook_id"),
            "receipt_type": data.get("receipt_type", "IMMEDIATE"),
            "receipt_data": receipt_data,
        }

    @idempotent_endpoint(scope="purchasing.order.checkout")
    @action(detail=False, methods=["post"])
    def purchase_checkout(self, request):
        """Unified purchase checkout endpoint."""
        try:
            params = self._parse_purchase_checkout(request)
            params["user"] = request.user
            result = PurchasingService.purchase_checkout(**params)

            from workflow.services import WorkflowService
            WorkflowService.sync_hub_tasks(result["order"])

            from billing.serializers import InvoiceSerializer
            from treasury.serializers import TreasuryMovementSerializer
            from .serializers import PurchaseReceiptSerializer

            response_data = {
                "order": PurchaseOrderSerializer(result["order"]).data,
                "invoice": InvoiceSerializer(result["invoice"]).data if result["invoice"] else None,
                "payment": TreasuryMovementSerializer(result["payment"]).data if result["payment"] else None,
                "receipt": PurchaseReceiptSerializer(result["receipt"]).data if result["receipt"] else None,
            }
            return Response(response_data, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            import traceback
            traceback.print_exc()
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


class PurchaseReceiptViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    queryset = PurchaseReceipt.objects.all()
    serializer_class = PurchaseReceiptSerializer

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


class PurchaseReturnViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    queryset = PurchaseReturn.objects.all()
    serializer_class = PurchaseReturnSerializer

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
