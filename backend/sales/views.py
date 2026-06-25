from decimal import Decimal

import django_filters
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.api.search import DistinctSearchFilter
from core.mixins import AuditHistoryMixin
from inventory.models import Warehouse

from .models import SaleDelivery, SaleOrder, SaleReturn, SalesSettings
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
        obj = SalesSettings.get_solo()
        if not obj:
            obj = SalesSettings.objects.create()

        from .services import SalesSettingsService

        if request.method == "GET":
            serializer = self.get_serializer(obj)
            data = serializer.data
            data.update(SalesSettingsService.get_accounting_settings_data())
            return Response(data)

        sales_fields = {k: v for k, v in request.data.items() if k not in SalesSettingsService.ACCOUNTING_SETTINGS_FIELDS}
        accounting_fields = {k: v for k, v in request.data.items() if k in SalesSettingsService.ACCOUNTING_SETTINGS_FIELDS}

        if sales_fields:
            serializer = self.get_serializer(obj, data=sales_fields, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()

        if accounting_fields:
            SalesSettingsService.update_accounting_settings(accounting_fields)

        serializer = self.get_serializer(obj)
        data = serializer.data
        data.update(SalesSettingsService.get_accounting_settings_data())
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
        if value == "success":
            return (
                queryset.filter(invoices__status__in=["POSTED", "PAID"])
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

    def filter_payment_status(self, queryset, name, value):
        if value == "success":
            return queryset.filter(status="PAID")
        elif value == "active":
            return queryset.filter(payments__isnull=False).exclude(status="PAID").distinct()
        elif value == "neutral":
            return queryset.filter(
                payments__isnull=True, status__in=["DRAFT", "CONFIRMED", "INVOICED"]
            )
        return queryset

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


class SaleOrderViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    queryset = SaleOrder.objects.all().order_by("-date", "-id")
    permission_classes = [StandardizedModelPermissions]
    filter_backends = [DjangoFilterBackend, DistinctSearchFilter]
    filterset_class = SaleOrderFilterSet
    search_fields = ["customer__name", "customer__tax_id", "number", "lines__product__name"]

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
        if instance.status != "DRAFT":
            return Response(
                {"error": "Solo se pueden editar notas de venta en estado Borrador."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.status != "DRAFT":
            return Response(
                {"error": "Solo se pueden editar notas de venta en estado Borrador."},
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
            SalesService.validate_purge(instance)
        except ValidationError as e:
            msg = e.messages[0] if getattr(e, "messages", None) else str(e)
            return Response({"error": msg}, status=status.HTTP_400_BAD_REQUEST)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["get"])
    def cancel_impact(self, request, pk=None):
        """Preview what will happen when cancelling this order."""
        order = self.get_object()
        action_kind = "soft_cancel" if order.status == "DRAFT" else "full_annul"
        impact = {
            "order_status": order.status,
            "invoices": [
                {"id": inv.id, "display_id": inv.display_id, "status": inv.status}
                for inv in order.invoices.all()
            ],
            "deliveries": [{"id": d.id, "status": d.status} for d in order.deliveries.all()],
            "payments": [
                {
                    "id": p.id,
                    "amount": str(p.amount),
                    "status": p.status if hasattr(p, "status") else "POSTED",
                }
                for p in order.payments.all()
            ],
            "work_orders": [
                {"id": w.id, "number": w.number, "status": w.status, "stage": w.current_stage}
                for w in order.work_orders.exclude(status="CANCELLED")
            ],
            "has_confirmed_deliveries": order.deliveries.filter(status="CONFIRMED").exists(),
            "has_posted_payments": order.payments.filter(journal_entry__status="POSTED").exists(),
            "has_folio_invoices": order.invoices.exclude(number="")
            .exclude(number="Draft")
            .exclude(number__isnull=True)
            .exists(),
            "requires_reason": action_kind == "full_annul",
            "action": action_kind,
        }
        from tax.services import AccountingPeriodService, TaxPeriodService

        today = timezone.now().date()
        impact["period_open"] = not (
            TaxPeriodService.is_period_closed(today)
            or AccountingPeriodService.is_period_closed(today)
        )
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

    @action(detail=True, methods=["post"], url_path="dispatch")
    def dispatch_order(self, request, pk=None):
        """Dispatch complete order"""
        order = self.get_object()
        try:
            warehouse_id = request.data.get("warehouse_id")
            delivery_date = request.data.get("delivery_date")

            warehouse = Warehouse.objects.get(pk=warehouse_id)

            delivery = SalesService.dispatch_order(
                order=order, warehouse=warehouse, delivery_date=delivery_date
            )

            return Response(SaleDeliverySerializer(delivery).data, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=["post"])
    def partial_dispatch(self, request, pk=None):
        """Dispatch specific quantities of products"""

        order = self.get_object()
        try:
            warehouse_id = request.data.get("warehouse_id")
            delivery_date = request.data.get("delivery_date")
            # Support both old and new format for safer transition
            line_quantities = request.data.get("line_quantities")
            if line_quantities and isinstance(line_quantities, dict):
                line_data = [{"line_id": int(k), "quantity": v} for k, v in line_quantities.items()]
            else:
                line_data = request.data.get("line_data", [])

            warehouse = Warehouse.objects.get(pk=warehouse_id)

            delivery = SalesService.partial_dispatch(
                order=order, warehouse=warehouse, line_data=line_data, delivery_date=delivery_date
            )

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
        print(f"DEBUG: register_note reached for order {pk}")
        order = self.get_object()

        # Manually handle multipart/form-data requiring json parsing for complex fields
        data = request.data.dict() if hasattr(request.data, "dict") else request.data.copy()

        # If accessing via multipart, lists might be strings
        if "return_items" in data and isinstance(data["return_items"], str):
            import json

            try:
                data["return_items"] = json.loads(data["return_items"])
            except Exception as e:
                print(f"DEBUG: Error parsing return_items: {e}")
                pass

        print(f"DEBUG: data['return_items'] type: {type(data.get('return_items'))}")
        print(f"DEBUG: data['return_items'] value: {data.get('return_items')}")

        from purchasing.serializers import NoteCreationSerializer

        serializer = NoteCreationSerializer(data=data)

        if serializer.is_valid():
            try:
                val = serializer.validated_data
                invoice = SalesService.create_note(
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
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"])
    def register_merchandise_return(self, request, pk=None):
        """
        Register merchandise return for a sale order.
        Only available for DRAFT invoices.
        """
        order = self.get_object()

        return_items = request.data.get("return_items", [])
        warehouse_id = request.data.get("warehouse_id")
        notes = request.data.get("notes", "")

        if not warehouse_id:
            return Response(
                {"error": "Se requiere especificar la bodega."}, status=status.HTTP_400_BAD_REQUEST
            )

        if not return_items:
            return Response(
                {"error": "Debe especificar al menos un producto a devolver."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            from sales.return_services import SalesReturnService

            warehouse = Warehouse.objects.get(id=warehouse_id)

            return_delivery = SalesReturnService.register_merchandise_return(
                order, return_items, warehouse, notes
            )

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
            import traceback

            traceback.print_exc()
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=["get"], url_path="filter-suggestions")
    def filter_suggestions(self, request):
        q = request.query_params.get("q", "").strip()
        if len(q) < 2:
            return Response([])
        names = (
            SaleOrder.objects.filter(customer__name__icontains=q)
            .values_list("customer__name", flat=True)
            .distinct()
            .order_by("customer__name")[:10]
        )
        return Response(list(names))

    @action(detail=False, methods=["get"])
    def credit_history(self, request):
        """
        Global history of credit assignments across all customers.
        """
        history = SaleOrder.objects.filter(credit_assignment_origin__isnull=False).order_by(
            "-date", "-created_at"
        )

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
        """TASK-307: Unified comment feed for an NV (includes linked OT comments)."""
        from django.contrib.contenttypes.models import ContentType

        from production.models import WorkOrder
        from workflow.models import Comment
        from workflow.serializers import CommentSerializer

        order = self.get_object()
        so_ct = ContentType.objects.get_for_model(SaleOrder)

        if request.method == "GET":
            qs = Comment.objects.filter(content_type=so_ct, object_id=order.pk)

            # Fetch comments from all related WorkOrders
            production_orders = order.production_orders.all()
            if production_orders.exists():
                wo_ct = ContentType.objects.get_for_model(WorkOrder)
                wo_qs = Comment.objects.filter(
                    content_type=wo_ct, object_id__in=production_orders.values_list("pk", flat=True)
                )
                qs = (qs | wo_qs).order_by("created_at")
            else:
                qs = qs.order_by("created_at")

            serializer = CommentSerializer(qs, many=True)
            return Response(serializer.data)

        text = (request.data.get("text") or "").strip()
        if not text:
            return Response({"error": "text es requerido"}, status=status.HTTP_400_BAD_REQUEST)
        comment = Comment.objects.create(
            content_type=so_ct,
            object_id=order.pk,
            user=request.user,
            text=text,
        )
        return Response(CommentSerializer(comment).data, status=status.HTTP_201_CREATED)


class SaleDeliveryViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    queryset = SaleDelivery.objects.all()
    serializer_class = SaleDeliverySerializer

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
    queryset = SaleReturn.objects.all()
    serializer_class = SaleReturnSerializer

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
