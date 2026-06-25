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
            order_id = serializer.validated_data["order_id"]
            order_type = serializer.validated_data["order_type"]
            dte_type = serializer.validated_data["dte_type"]
            payment_method = serializer.validated_data["payment_method"]

            try:
                if order_type == "sale":
                    order = SaleOrder.objects.get(id=order_id)
                    invoice = BillingService.create_sale_invoice(order, dte_type, payment_method)
                else:
                    order = PurchaseOrder.objects.get(id=order_id)
                    supplier_invoice_number = serializer.validated_data.get(
                        "supplier_invoice_number", ""
                    )
                    document_attachment = serializer.validated_data.get("document_attachment")
                    issue_date = serializer.validated_data.get("issue_date")
                    status_val = serializer.validated_data.get("status", Invoice.Status.POSTED)
                    invoice = BillingService.create_purchase_bill(
                        order,
                        supplier_invoice_number,
                        dte_type=dte_type,
                        document_attachment=document_attachment,
                        date=issue_date,
                        status=status_val,
                    )

                return Response(InvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)
            except (SaleOrder.DoesNotExist, PurchaseOrder.DoesNotExist):
                return Response({"error": "Order not found"}, status=status.HTTP_404_NOT_FOUND)
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

    @staticmethod
    def _parse_pos_checkout_params(request):
        """Extract and coerce all POS checkout parameters from the multipart request."""
        data = request.data
        is_pending_registration = data.get("is_pending_registration", False)
        if isinstance(is_pending_registration, str):
            is_pending_registration = is_pending_registration.lower() == "true"

        payment_is_pending = data.get("payment_is_pending", False)
        if isinstance(payment_is_pending, str):
            payment_is_pending = payment_is_pending.lower() == "true"

        installments = data.get("installments")
        if installments is not None:
            try:
                installments = int(installments)
            except (ValueError, TypeError):
                installments = 1
        else:
            installments = 1

        immediate_lines = data.get("immediate_lines")
        if isinstance(immediate_lines, str):
            import json
            try:
                immediate_lines = json.loads(immediate_lines)
            except Exception:
                pass

        line_files = {}
        for key, file_obj in request.FILES.items():
            if key.startswith("line_"):
                parts = key.split("_")
                if len(parts) >= 3:
                    try:
                        line_idx = int(parts[1])
                        file_type = parts[2]
                        if line_idx not in line_files:
                            line_files[line_idx] = {"design": [], "approval": None}
                        if file_type == "design":
                            line_files[line_idx]["design"].append(file_obj)
                        elif file_type == "approval":
                            line_files[line_idx]["approval"] = file_obj
                    except (ValueError, IndexError):
                        continue

        direct_credit_approval = data.get("direct_credit_approval", False)
        if isinstance(direct_credit_approval, str):
            direct_credit_approval = direct_credit_approval.lower() == "true"

        check_bank_id = data.get("check_bank_id")
        if check_bank_id:
            check_bank_id = int(check_bank_id)

        return {
            "order_data": data.get("order_data"),
            "dte_type": data.get("dte_type"),
            "payment_method": data.get("payment_method"),
            "payment_method_id": data.get("payment_method_id"),
            "transaction_number": data.get("transaction_number"),
            "is_pending_registration": is_pending_registration,
            "payment_is_pending": payment_is_pending,
            "document_number": data.get("document_number") or data.get("document_reference"),
            "document_date": data.get("document_date"),
            "document_attachment": request.FILES.get("document_attachment"),
            "amount": data.get("amount"),
            "installments": installments,
            "treasury_account_id": data.get("treasury_account_id"),
            "payment_type": data.get("payment_type", "INBOUND"),
            "pos_session_id": data.get("pos_session_id"),
            "delivery_type": data.get("delivery_type", "IMMEDIATE"),
            "delivery_date": data.get("delivery_date"),
            "immediate_lines": immediate_lines,
            "line_files": line_files,
            "direct_credit_approval": direct_credit_approval,
            "check_number": data.get("check_number") or data.get("transaction_number"),
            "check_bank_id": check_bank_id,
            "check_issue_date": data.get("check_issue_date"),
            "check_due_date": data.get("check_due_date"),
            "checkbook_id": data.get("checkbook_id"),
            "credit_approval_task_id": data.get("credit_approval_task_id"),
            "draft_id": data.get("draft_id"),
            "user": request.user,
        }

    @idempotent_endpoint(scope="billing.pos.checkout")
    @action(detail=False, methods=["post"])
    def pos_checkout(self, request):
        params = self._parse_pos_checkout_params(request)

        if not all([params["order_data"], params["dte_type"], params["payment_method"]]):
            return Response({"error": "Missing data"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            invoice = BillingService.pos_checkout(
                params["order_data"],
                params["dte_type"],
                params["payment_method"],
                transaction_number=params["transaction_number"],
                is_pending_registration=params["is_pending_registration"],
                payment_is_pending=params["payment_is_pending"],
                amount=params["amount"],
                installments=params["installments"],
                treasury_account_id=params["treasury_account_id"],
                document_number=params["document_number"],
                document_date=params["document_date"],
                document_attachment=params["document_attachment"],
                delivery_type=params["delivery_type"],
                delivery_date=params["delivery_date"],
                immediate_lines=params["immediate_lines"],
                payment_type=params["payment_type"],
                line_files=params["line_files"],
                pos_session_id=params["pos_session_id"],
                payment_method_id=params["payment_method_id"],
                user=params["user"],
                credit_approval_task_id=params["credit_approval_task_id"],
                draft_id=params["draft_id"],
                direct_credit_approval=params["direct_credit_approval"],
                check_number=params["check_number"],
                check_bank_id=params["check_bank_id"],
                check_issue_date=params["check_issue_date"],
                check_due_date=params["check_due_date"],
                checkbook_id=params["checkbook_id"],
            )
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
        invoice = self.get_object()
        is_purchase_doc = invoice.purchase_order_id is not None or not invoice.is_sale_document()
        impact = {
            "invoice_status": invoice.status,
            "has_folio": bool(invoice.number and invoice.number != "Draft"),
            "is_sale_document": not is_purchase_doc,
            "journal_entry_status": invoice.journal_entry.status if invoice.journal_entry else None,
            "payments": [
                {"id": p.id, "amount": str(p.amount), "status": p.status}
                for p in invoice.payments.all()
            ],
            "action": "cancel" if invoice.status == Invoice.Status.DRAFT else "annul",
        }
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
