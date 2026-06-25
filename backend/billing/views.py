import django_filters
from django.core.exceptions import ValidationError
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters as drf_filters
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.mixins import AuditHistoryMixin
from core.idempotency import idempotent_endpoint
from purchasing.models import PurchaseOrder
from sales.models import SaleOrder

from .models import Invoice
from .serializers import CreateInvoiceSerializer, InvoiceSerializer
from .services import BillingService


class InvoiceFilterSet(django_filters.FilterSet):
    date_from = django_filters.DateFilter(field_name="date", lookup_expr="gte")
    date_to = django_filters.DateFilter(field_name="date", lookup_expr="lte")
    total_min = django_filters.NumberFilter(field_name="total", lookup_expr="gte")
    total_max = django_filters.NumberFilter(field_name="total", lookup_expr="lte")
    number = django_filters.CharFilter(field_name="number", lookup_expr="icontains")
    partner_name = django_filters.CharFilter(field_name="contact__name", lookup_expr="icontains")

    class Meta:
        model = Invoice
        fields = {
            "dte_type": ["exact", "in"],
            "sale_order": ["exact", "isnull"],
            "purchase_order": ["exact", "isnull"],
            "status": ["exact", "in"],
            "contact": ["exact"],
        }


class InvoiceViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    queryset = Invoice.objects.all().order_by("-date", "-id")
    serializer_class = InvoiceSerializer
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

    @idempotent_endpoint(scope="billing.invoice.create")
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.status != "DRAFT":
            return Response(
                {"error": "Solo se pueden editar facturas en estado Borrador."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.status != "DRAFT":
            return Response(
                {"error": "Solo se pueden editar facturas en estado Borrador."},
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
            BillingService.validate_purge(instance)
        except ValidationError as e:
            msg = e.messages[0] if getattr(e, "messages", None) else str(e)
            return Response({"error": msg}, status=status.HTTP_400_BAD_REQUEST)
        return super().destroy(request, *args, **kwargs)

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

    @action(detail=False, methods=["get"])
    def check_folio(self, request):
        """Validates folio uniqueness in real-time."""
        from .selectors import InvoiceSelector

        number = request.query_params.get("number")
        dte_type = request.query_params.get("dte_type")

        if not number or not dte_type:
            return Response(
                {"error": "Missing required parameters: number and dte_type"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        result = InvoiceSelector.check_folio_uniqueness(
            number=number,
            dte_type=dte_type,
            exclude_id=request.query_params.get("exclude_id"),
            contact_id=request.query_params.get("contact_id"),
            is_purchase=request.query_params.get("is_purchase", "false").lower() == "true",
        )
        return Response(result)

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
        """
        Creates an approval request task for a POS sale that exceeds the customer's credit limit.
        """
        try:
            order_data = request.data.get("order_data")
            amount = request.data.get("amount")
            payment_method = request.data.get("payment_method")

            task = BillingService.request_credit_approval(
                order_data=order_data,
                amount=amount,
                payment_method=payment_method,
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
        from .selectors import InvoiceSelector

        invoice = self.get_object()
        impact = InvoiceSelector.get_cancel_impact(invoice)
        return Response(impact)

    @action(detail=True, methods=["post"])
    def process_logistics(self, request, pk=None):
        """
        Executes logistics (returns or supplemental dispatches) for an invoice.
        """
        from .note_checkout_service import NoteCheckoutService

        warehouse_id = request.data.get("warehouse_id")
        date = request.data.get("date")
        line_data = request.data.get("line_data")
        notes = request.data.get("notes", "")

        if not all([warehouse_id, date, line_data]):
            return Response(
                {"error": "Faltan datos requeridos (bodega, fecha o líneas)"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            doc = NoteCheckoutService.process_logistics_from_invoice(
                invoice_id=pk,
                warehouse_id=warehouse_id,
                date=date,
                line_data=line_data,
                notes=notes,
            )
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
