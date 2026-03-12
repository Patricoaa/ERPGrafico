from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.core.exceptions import ValidationError

from billing.note_workflow import NoteWorkflow
from billing.note_checkout_service import NoteCheckoutService
from billing.note_serializers import (
    NoteWorkflowSerializer,
    InitNoteWorkflowSerializer,
    SelectItemsSerializer,
    ProcessLogisticsSerializer,
    RegisterDocumentSerializer,
    CompleteWorkflowSerializer,
    CancelWorkflowSerializer,
    FullNoteCheckoutSerializer
)
from core.mixins import AuditHistoryMixin


class NoteWorkflowViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    """
    ViewSet for Note Workflow (Credit/Debit Note multi-stage checkout)
    
    Endpoints:
    - POST /note-workflows/init/ - Initialize new workflow
    - POST /note-workflows/{id}/select-items/ - Select products (Stage 2)
    - POST /note-workflows/{id}/process-logistics/ - Process logistics (Stage 3)
    - POST /note-workflows/{id}/skip-logistics/ - Skip logistics if not needed
    - POST /note-workflows/{id}/register-document/ - Register DTE (Stage 4)
    - POST /note-workflows/{id}/complete/ - Complete workflow (Stage 5)
    - POST /note-workflows/{id}/cancel/ - Cancel workflow
    """
    
    queryset = NoteWorkflow.objects.select_related(
        'invoice',
        'corrected_invoice',
        'sale_order',
        'purchase_order',
        'created_by'
    ).all()
    serializer_class = NoteWorkflowSerializer
    
    def get_queryset(self):
        """Filter by order if provided"""
        queryset = super().get_queryset()
        
        sale_order_id = self.request.query_params.get('sale_order_id')
        purchase_order_id = self.request.query_params.get('purchase_order_id')
        stage = self.request.query_params.get('stage')
        
        if sale_order_id:
            queryset = queryset.filter(sale_order_id=sale_order_id)
        if purchase_order_id:
            queryset = queryset.filter(purchase_order_id=purchase_order_id)
        if stage:
            queryset = queryset.filter(current_stage=stage)
        
        return queryset
    
    @action(detail=False, methods=['post'])
    def init(self, request):
        """
        Initialize a new note workflow
        
        POST /billing/note-workflows/init/
        Body: {
            "corrected_invoice_id": 123,
            "note_type": "NOTA_CREDITO",
            "reason": "Devolución de mercadería defectuosa"
        }
        """
        serializer = InitNoteWorkflowSerializer(data=request.data)
        
        if serializer.is_valid():
            try:
                workflow = NoteCheckoutService.init_note_workflow(
                    corrected_invoice_id=serializer.validated_data['corrected_invoice_id'],
                    note_type=serializer.validated_data['note_type'],
                    reason=serializer.validated_data.get('reason', ''),
                    created_by=request.user
                )
                
                return Response(
                    NoteWorkflowSerializer(workflow).data,
                    status=status.HTTP_201_CREATED
                )
            except ValidationError as e:
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
            except Exception as e:
                import traceback
                traceback.print_exc()
                return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'], url_path='select-items')
    def select_items(self, request, pk=None):
        """
        Select items/products for the note
        
        POST /billing/note-workflows/{id}/select-items/
        Body: {
            "selected_items": [
                {
                    "product_id": 456,
                    "quantity": 5,
                    "reason": "Producto dañado",
                    "unit_price": 1000,
                    "tax_amount": 190
                }
            ]
        }
        """
        workflow = self.get_object()
        
        serializer = SelectItemsSerializer(data={
            'workflow_id': workflow.id,
            'selected_items': request.data.get('selected_items', [])
        })
        
        if serializer.is_valid():
            try:
                updated_workflow = NoteCheckoutService.select_items(
                    workflow_id=workflow.id,
                    selected_items=serializer.validated_data['selected_items']
                )
                
                return Response(NoteWorkflowSerializer(updated_workflow).data)
            except ValidationError as e:
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
            except Exception as e:
                import traceback
                traceback.print_exc()
                return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'], url_path='process-logistics')
    def process_logistics(self, request, pk=None):
        """
        Process logistics (stock movements)
        
        POST /billing/note-workflows/{id}/process-logistics/
        Body: {
            "warehouse_id": 1,
            "date": "2026-01-22",
            "notes": "Recibido en bodega principal"
        }
        """
        workflow = self.get_object()
        
        serializer = ProcessLogisticsSerializer(data={
            'workflow_id': workflow.id,
            **request.data
        })
        
        if serializer.is_valid():
            try:
                updated_workflow = NoteCheckoutService.process_logistics(
                    workflow_id=workflow.id,
                    warehouse_id=serializer.validated_data['warehouse_id'],
                    date=serializer.validated_data['date'],
                    delivery_type=serializer.validated_data.get('delivery_type', 'IMMEDIATE'),
                    line_data=serializer.validated_data.get('line_data'),
                    notes=serializer.validated_data.get('notes', '')
                )
                
                return Response(NoteWorkflowSerializer(updated_workflow).data)
            except ValidationError as e:
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
            except Exception as e:
                import traceback
                traceback.print_exc()
                return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'], url_path='skip-logistics')
    def skip_logistics(self, request, pk=None):
        """
        Skip logistics stage if no stockable items
        
        POST /billing/note-workflows/{id}/skip-logistics/
        """
        workflow = self.get_object()
        
        try:
            updated_workflow = NoteCheckoutService.skip_logistics(workflow_id=workflow.id)
            return Response(NoteWorkflowSerializer(updated_workflow).data)
        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['post'], url_path='register-document')
    def register_document(self, request, pk=None):
        """
        Register document (DTE folio and accounting)
        
        POST /billing/note-workflows/{id}/register-document/
        Body (multipart/form-data): {
            "document_number": "NC-12345",
            "document_date": "2026-01-22",
            "document_attachment": <file>,
            "is_pending": false
        }
        """
        workflow = self.get_object()
        
        # Flatten QueryDict if needed
        data = request.data.dict() if hasattr(request.data, 'dict') else request.data
        
        serializer = RegisterDocumentSerializer(data={
            'workflow_id': workflow.id,
            **data
        })
        
        if serializer.is_valid():
            try:
                updated_workflow = NoteCheckoutService.register_document(
                    workflow_id=workflow.id,
                    document_number=serializer.validated_data['document_number'],
                    document_date=serializer.validated_data.get('document_date'),
                    document_attachment=request.FILES.get('document_attachment'),
                    is_pending=serializer.validated_data.get('is_pending', False)
                )
                
                return Response(NoteWorkflowSerializer(updated_workflow).data)
            except ValidationError as e:
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
            except Exception as e:
                import traceback
                traceback.print_exc()
                return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
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
        
        serializer = CompleteWorkflowSerializer(data={
            'workflow_id': workflow.id,
            **request.data
        })
        
        if serializer.is_valid():
            try:
                updated_workflow = NoteCheckoutService.complete_workflow(
                    workflow_id=workflow.id,
                    payment_data=serializer.validated_data.get('payment_data')
                )
                
                return Response(NoteWorkflowSerializer(updated_workflow).data)
            except ValidationError as e:
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
            except Exception as e:
                import traceback
                traceback.print_exc()
                return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """
        Cancel workflow
        
        POST /billing/note-workflows/{id}/cancel/
        Body: {
            "reason": "Cliente retiró solicitud"
        }
        """
        workflow = self.get_object()
        
        serializer = CancelWorkflowSerializer(data={
            'workflow_id': workflow.id,
            **request.data
        })
        
        if serializer.is_valid():
            try:
                updated_workflow = NoteCheckoutService.cancel_workflow(
                    workflow_id=workflow.id,
                    reason=serializer.validated_data.get('reason', '')
                )
                
                return Response(NoteWorkflowSerializer(updated_workflow).data)
            except ValidationError as e:
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
            except Exception as e:
                import traceback
                traceback.print_exc()
                return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'], url_path='checkout')
    def checkout(self, request):
        """
        Atomic checkout for Notes.
        POST /billing/note-workflows/checkout/
        """
        import json
        
        # Handle FormData parsing for JSON fields
        data = request.data.dict() if hasattr(request.data, 'dict') else request.data.copy()
        
        # Parse JSON fields if they are strings (Multipart/form-data)
        for field in ['selected_items', 'logistics_data', 'registration_data', 'payment_data']:
            if field in data and isinstance(data[field], str):
                try:
                    data[field] = json.loads(data[field])
                except json.JSONDecodeError:
                    pass
        
        serializer = FullNoteCheckoutSerializer(data=data)
        
        if serializer.is_valid():
            try:
                workflow = NoteCheckoutService.process_full_checkout(
                    original_invoice_id=serializer.validated_data['original_invoice_id'],
                    note_type=serializer.validated_data['note_type'],
                    selected_items=serializer.validated_data['selected_items'],
                    registration_data=serializer.validated_data['registration_data'],
                    logistics_data=serializer.validated_data.get('logistics_data'),
                    payment_data=serializer.validated_data.get('payment_data'),
                    reason=serializer.validated_data.get('reason', ''),
                    document_attachment=request.FILES.get('document_attachment'),
                    created_by=request.user
                )
                return Response(NoteWorkflowSerializer(workflow).data, status=status.HTTP_201_CREATED)
            except ValidationError as e:
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
            except Exception as e:
                import traceback
                traceback.print_exc()
                return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
