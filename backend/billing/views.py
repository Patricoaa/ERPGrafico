import django_filters
from django.core.exceptions import ValidationError
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters as drf_filters
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.api.pagination import StandardResultsSetPagination
from core.idempotency import idempotent_endpoint
from core.mixins import AuditHistoryMixin, EditPolicyMixin, NoDestroyModelMixin

from .invoice_from_lines import InvoiceFromLinesService
from .models import Invoice
from .selectors import InvoiceableLinesSelector
from .serializers import (
    CreateInvoiceSerializer,
    InvoiceFromLinesSerializer,
    InvoiceListSerializer,
    InvoiceSerializer,
    InvoiceWriteSerializer,
)
from .services import BillingService


class InvoiceFilterSet(django_filters.FilterSet):
    date_from = django_filters.DateFilter(field_name="date", lookup_expr="gte")
    date_to = django_filters.DateFilter(field_name="date", lookup_expr="lte")
    total_min = django_filters.NumberFilter(field_name="total", lookup_expr="gte")
    total_max = django_filters.NumberFilter(field_name="total", lookup_expr="lte")
    number = django_filters.CharFilter(field_name="number", lookup_expr="icontains")
    partner_name = django_filters.CharFilter(field_name="contact__name", lookup_expr="icontains")
    # ADR-0084: el pago es un eje derivado del saldo (UNPAID · PARTIAL · PAID), no un estado
    payment_status = django_filters.CharFilter(method="filter_payment_status")

    def filter_payment_status(self, queryset, name, value):
        from core.payment_status import filter_by_payment_status

        return filter_by_payment_status(
            queryset, value, prefetch=("payments__allocations", "payment_allocations__treasury_movement")
        )

    class Meta:
        model = Invoice
        fields = {
            "dte_type": ["exact", "in"],
            "sale_order": ["exact", "isnull"],
            "purchase_order": ["exact", "isnull"],
            "status": ["exact", "in"],
            "contact": ["exact"],
        }


class InvoiceViewSet(NoDestroyModelMixin, EditPolicyMixin, viewsets.ModelViewSet, AuditHistoryMixin):
    serializer_class = InvoiceSerializer
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, drf_filters.SearchFilter]
    filterset_class = InvoiceFilterSet
    search_fields = [
        "contact__name",
        "contact__tax_id",
        "purchase_order__supplier__name",
        "purchase_order__supplier__tax_id",
        "sale_order__customer__name",
        "sale_order__customer__tax_id",
    ]
    action_permissions = {
        "confirm": "billing.confirm_invoice",
        "annul": "billing.annul_invoice",
        "cancel": "billing.cancel_invoice",
        "process_logistics": "sales.dispatch_saleorder",
        # Creation → None (add_* by method is correct)
        "create_from_order": None,
        "from_lines": None,
        "pos_checkout": None,
        "request_credit": None,
    }

    def get_queryset(self):
        from .selectors import InvoiceSelectorExt
        return InvoiceSelectorExt.get_queryset_from_request(self, self.request)

    def get_serializer_class(self):
        if self.action == "list":
            return InvoiceListSerializer
        if self.action in ["create", "update", "partial_update"]:
            return InvoiceWriteSerializer
        return InvoiceSerializer

    @idempotent_endpoint(scope="billing.invoice.create")
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)

    @action(detail=False, methods=["post"])
    def create_from_order(self, request):
        serializer = CreateInvoiceSerializer(data=request.data)
        if serializer.is_valid():
            try:
                invoice = BillingService.create_invoice_from_payload(serializer.validated_data)
                return Response(InvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)
            except ValidationError as e:
                return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
            except Exception as e:
                return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @idempotent_endpoint(scope="billing.invoice.from_lines")
    @action(detail=False, methods=["post"], url_path="from-lines")
    def from_lines(self, request):
        """Factura parcial / multi-orden por cantidad (ADR-0081)."""
        serializer = InvoiceFromLinesSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            invoice = InvoiceFromLinesService.create(**serializer.validated_data)
        except ValidationError as e:
            return Response({"error": " ".join(e.messages)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(InvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"], url_path="invoiceable-lines")
    def invoiceable_lines(self, request):
        """Líneas pendientes de facturar con sus entregas (ADR-0081)."""
        params = request.query_params
        order_ids = [int(x) for x in params.get("orders", "").split(",") if x.strip().isdigit()]
        data = InvoiceableLinesSelector.list(
            params.get("side", "sale"), partner_id=params.get("partner"), order_ids=order_ids or None
        )
        return Response(data)

    @action(detail=True, methods=["post"])
    def confirm(self, request, pk=None):
        instance = self.get_object()
        number = request.data.get("number")
        date = request.data.get("date")
        document_attachment = request.FILES.get("document_attachment")

        try:
            invoice = BillingService.confirm_invoice(
                instance, number, document_attachment, date=date
            )
            return Response(InvoiceSerializer(invoice).data)
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def check_folio(self, request):
        try:
            res = BillingService.check_folio_from_request(request)
            return Response(res)
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @idempotent_endpoint(scope="billing.pos.checkout")
    @action(detail=False, methods=["post"])
    def pos_checkout(self, request):
        try:
            invoice = BillingService.pos_checkout_from_request(request)
            return Response(InvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            msg = e.messages[0] if hasattr(e, "messages") and e.messages else str(e)
            return Response({"error": msg}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            import traceback

            traceback.print_exc()
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=["post"])
    def request_credit(self, request):
        try:
            task = BillingService.request_credit_approval(
                order_data=request.data.get("order_data"),
                amount=request.data.get("amount"),
                payment_method=request.data.get("payment_method"),
                full_request_data=request.data,
                requesting_user=request.user,
            )
            return Response({"task_id": task.id}, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            msg = e.messages[0] if hasattr(e, "messages") and e.messages else str(e)
            return Response({"error": msg}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=["post"])
    def annul(self, request, pk=None):
        invoice = self.get_object()
        force = request.data.get("force", False)
        if isinstance(force, str):
            force = force.lower() == "true"
        reason = request.data.get("reason", "")

        try:
            invoice = BillingService.annul_invoice(
                invoice, force=force, user=request.user, reason=reason
            )
            return Response(InvoiceSerializer(invoice).data)
        except ValidationError as e:
            msg = e.messages[0] if hasattr(e, "messages") and e.messages else str(e)
            return Response({"error": msg}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        invoice = self.get_object()
        reason = request.data.get("reason", "")
        try:
            invoice = BillingService.cancel_invoice(invoice, user=request.user, reason=reason)
            return Response(InvoiceSerializer(invoice).data)
        except ValidationError as e:
            msg = e.messages[0] if hasattr(e, "messages") and e.messages else str(e)
            return Response({"error": msg}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=["get"])
    def cancel_impact(self, request, pk=None):
        """Preview what will happen when cancelling/annulling this invoice."""
        from .selectors import InvoiceSelectorExt

        invoice = self.get_object()
        impact = InvoiceSelectorExt.get_cancel_impact(invoice)
        return Response(impact)

    @action(detail=True, methods=["post"])
    def process_logistics(self, request, pk=None):
        """
        Executes logistics (returns or supplemental dispatches) for an invoice.
        """
        from .note_checkout_service import NoteCheckoutService

        try:
            doc = NoteCheckoutService.process_logistics_from_request(request, pk)
            return Response(
                {
                    "message": "Logística procesada correctamente",
                    "document_id": doc.id,
                    "display_id": doc.display_id,
                }
            )
        except ValidationError as e:
            msg = e.messages[0] if hasattr(e, "messages") and e.messages else str(e)
            return Response({"error": msg}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
