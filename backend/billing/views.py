import django_filters
from django.core.exceptions import ValidationError
from django.db.models import Prefetch
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters as drf_filters
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.api.pagination import StandardResultsSetPagination
from core.mixins import AuditHistoryMixin, NoDestroyModelMixin
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


class InvoiceViewSet(NoDestroyModelMixin, viewsets.ModelViewSet, AuditHistoryMixin):
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

    def get_queryset(self):
        from treasury.models import PaymentAllocation, TreasuryMovement
        from inventory.models import StockMove

        return (
            Invoice.objects.all()
            # FKs directas — JOIN en SQL (O(1))
            .select_related(
                "sale_order__customer",
                "sale_order__pos_session",
                "purchase_order__supplier",
                "contact",
                "journal_entry",
                "corrected_invoice",
            )
            # Relaciones inversas — queries separadas cacheadas en RAM
            .prefetch_related(
                # Pagos directos sobre la factura
                Prefetch(
                    "payments",
                    queryset=TreasuryMovement.objects.select_related(
                        "payment_method_ref", "account"
                    ),
                ),
                # Allocaciones parciales con su movimiento de tesorería
                Prefetch(
                    "payment_allocations",
                    queryset=PaymentAllocation.objects.select_related("treasury_movement__payment_method_ref"),
                ),
                # Archivos adjuntos
                "attachments",
                # Notas correctoras (NC/ND que apuntan a esta factura)
                "adjustments",
                # Devoluciones de venta y sus líneas + stock move
                "sale_returns__lines__stock_move",
                # Devoluciones de compra y sus líneas + stock move
                "purchase_returns__lines__stock_move",
                # Entregas suplementarias (ND venta) y sus líneas + stock move
                "sale_deliveries__lines__stock_move",
                # Recepciones suplementarias (ND compra) y sus líneas + stock move
                "purchase_receipts__lines__stock_move",
                # Órdenes de trabajo vinculadas
                "work_orders",
                # Líneas de nota de crédito/débito de venta
                "note_sale_lines",
                # Líneas de nota de crédito/débito de compra
                "note_purchase_lines",
                # Workflow de notas (para NC/ND con selected_items)
                "workflow",
                # Líneas de la orden de venta (fallback)
                "sale_order__lines__product",
                # Líneas de la orden de compra (fallback)
                "purchase_order__lines__product",
                # Moves vinculados al JE de la factura
                Prefetch(
                    "journal_entry__stockmove_set",
                    queryset=StockMove.objects.select_related("product", "warehouse"),
                    to_attr="prefetched_stock_moves",
                ),
            )
            .order_by("-date", "-id")
        )

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
