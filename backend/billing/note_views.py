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
from billing.selectors import NoteWorkflowSelector
from core.api.pagination import StandardResultsSetPagination
from core.mixins import AuditHistoryMixin


class NoteWorkflowViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    pagination_class = StandardResultsSetPagination
    queryset = NoteWorkflow.objects.none()
    serializer_class = NoteWorkflowSerializer

    def get_queryset(self):
        return NoteWorkflowSelector.get_queryset_from_request(self, self.request)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        workflow = self.get_object()
        serializer = CompleteWorkflowSerializer(data={"workflow_id": workflow.id, **request.data})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            updated_workflow = NoteCheckoutService.complete_workflow(
                workflow_id=workflow.id, payment_data=serializer.validated_data.get("payment_data")
            )
            return Response(NoteWorkflowSerializer(updated_workflow).data)
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=["post"], url_path="checkout")
    def checkout(self, request):
        serializer = FullNoteCheckoutSerializer(data=NoteCheckoutService.parse_formdata_json(request.data))
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            workflow = NoteCheckoutService.process_full_checkout_from_serializer(
                serializer.validated_data, request
            )
            return Response(NoteWorkflowSerializer(workflow).data, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
