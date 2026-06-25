from core.api.pagination import StandardResultsSetPagination
from django.core.exceptions import ValidationError
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from billing.note_checkout_service import NoteCheckoutService
from billing.note_serializers import (
    CompleteWorkflowSerializer,
    FullNoteCheckoutSerializer,
    NoteWorkflowSerializer,
)
from billing.note_workflow import NoteWorkflow
from core.mixins import AuditHistoryMixin


class NoteWorkflowViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    pagination_class = StandardResultsSetPagination
    """
    ViewSet for Note Workflow (Credit/Debit Note checkout)

    Endpoints:
    - POST /note-workflows/{id}/complete/ - Complete workflow
    - POST /note-workflows/checkout/ - Atomic checkout (all-in-one)
    """

    queryset = NoteWorkflow.objects.select_related(
        "invoice", "corrected_invoice", "sale_order", "purchase_order", "created_by"
    ).all()
    serializer_class = NoteWorkflowSerializer

    def get_queryset(self):
        """Filter by order if provided"""
        queryset = super().get_queryset()

        sale_order_id = self.request.query_params.get("sale_order_id")
        purchase_order_id = self.request.query_params.get("purchase_order_id")
        stage = self.request.query_params.get("stage")

        if sale_order_id:
            queryset = queryset.filter(sale_order_id=sale_order_id)
        if purchase_order_id:
            queryset = queryset.filter(purchase_order_id=purchase_order_id)
        if stage:
            queryset = queryset.filter(current_stage=stage)

        return queryset

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        """
        Complete workflow

        POST /billing/note-workflows/{id}/complete/
        Body: {
            "payment_data": {
                "method": "CREDIT",
                "apply_credit": true
            }
        }
        """
        workflow = self.get_object()

        serializer = CompleteWorkflowSerializer(data={"workflow_id": workflow.id, **request.data})

        if serializer.is_valid():
            try:
                updated_workflow = NoteCheckoutService.complete_workflow(
                    workflow_id=workflow.id,
                    payment_data=serializer.validated_data.get("payment_data"),
                )

                return Response(NoteWorkflowSerializer(updated_workflow).data)
            except ValidationError as e:
                return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
            except Exception as e:
                import traceback

                traceback.print_exc()
                return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["post"], url_path="checkout")
    def checkout(self, request):
        """
        Atomic checkout for Notes.
        POST /billing/note-workflows/checkout/
        """
        import json

        # Handle FormData parsing for JSON fields
        data = request.data.dict() if hasattr(request.data, "dict") else request.data.copy()

        # Parse JSON fields if they are strings (Multipart/form-data)
        for field in ["selected_items", "logistics_data", "registration_data", "payment_data"]:
            if field in data and isinstance(data[field], str):
                try:
                    data[field] = json.loads(data[field])
                except json.JSONDecodeError:
                    pass

        serializer = FullNoteCheckoutSerializer(data=data)

        if serializer.is_valid():
            try:
                workflow = NoteCheckoutService.process_full_checkout(
                    original_invoice_id=serializer.validated_data["original_invoice_id"],
                    note_type=serializer.validated_data["note_type"],
                    selected_items=serializer.validated_data["selected_items"],
                    registration_data=serializer.validated_data["registration_data"],
                    logistics_data=serializer.validated_data.get("logistics_data"),
                    payment_data=serializer.validated_data.get("payment_data"),
                    reason=serializer.validated_data.get("reason", ""),
                    document_attachment=request.FILES.get("document_attachment"),
                    created_by=request.user,
                )
                return Response(
                    NoteWorkflowSerializer(workflow).data, status=status.HTTP_201_CREATED
                )
            except ValidationError as e:
                return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
            except Exception as e:
                import traceback

                traceback.print_exc()
                return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
