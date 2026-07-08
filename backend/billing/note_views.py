from core.api.pagination import StandardResultsSetPagination
from django.core.exceptions import ValidationError
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from billing.note_checkout_service import NoteCheckoutService
from billing.note_workflow import NoteWorkflow
from billing.note_serializers import (
    CompleteWorkflowSerializer,
    FullNoteCheckoutSerializer,
    NoteWorkflowSerializer,
)
from billing.selectors import NoteWorkflowSelector
from core.mixins import AuditHistoryMixin


class NoteWorkflowViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    pagination_class = StandardResultsSetPagination
    queryset = NoteWorkflow.objects.none()
    serializer_class = NoteWorkflowSerializer

    def get_queryset(self):
        return NoteWorkflowSelector.get_queryset_from_request(self, self.request)

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
        data = NoteCheckoutService.parse_formdata_json(request.data)
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
