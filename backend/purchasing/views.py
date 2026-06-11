from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import PurchaseOrder, PurchaseReceipt, PurchaseReturn
from .serializers import PurchaseOrderSerializer, WritePurchaseOrderSerializer, PurchaseReceiptSerializer, PurchaseReturnSerializer
from .services import PurchasingService
from .return_services import PurchaseReturnService
from inventory.models import Warehouse
from django.core.exceptions import ValidationError
from decimal import Decimal

from core.mixins import BulkImportMixin
from core.mixins import AuditHistoryMixin
from django_filters.rest_framework import DjangoFilterBackend, FilterSet
import django_filters

class PurchaseOrderFilterSet(FilterSet):
    date_after = django_filters.DateFilter(field_name='date', lookup_expr='gte')
    date_before = django_filters.DateFilter(field_name='date', lookup_expr='lte')

    class Meta:
        model = PurchaseOrder
        fields = ['status', 'date_after', 'date_before']

class PurchaseOrderViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    queryset = PurchaseOrder.objects.all()
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_class = PurchaseOrderFilterSet
    search_fields = ['supplier__name', 'supplier__tax_id', 'display_id']

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return WritePurchaseOrderSerializer
        return PurchaseOrderSerializer

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.status != 'DRAFT':
            return Response({'error': 'Solo se pueden editar órdenes en estado Borrador.'}, status=status.HTTP_400_BAD_REQUEST)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.status != 'DRAFT':
            return Response({'error': 'Solo se pueden editar órdenes en estado Borrador.'}, status=status.HTTP_400_BAD_REQUEST)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if not request.user.is_staff:
            return Response(
                {'error': 'Solo administradores pueden purgar documentos cancelados.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            PurchasingService.validate_purge(instance)
        except ValidationError as e:
            msg = e.messages[0] if getattr(e, 'messages', None) else str(e)
            return Response({'error': msg}, status=status.HTTP_400_BAD_REQUEST)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['get'])
    def cancel_impact(self, request, pk=None):
        """Preview what will happen when cancelling this purchase order."""
        order = self.get_object()
        action_kind = 'soft_cancel' if order.status == 'DRAFT' else 'full_annul'
        impact = {
            'order_status': order.status,
            'invoices': [
                {'id': inv.id, 'display_id': inv.display_id, 'status': inv.status}
                for inv in order.invoices.all()
            ],
            'receipts': [
                {'id': r.id, 'status': r.status}
                for r in order.receipts.all()
            ],
            'payments': [
                {'id': p.id, 'amount': str(p.amount), 'status': p.status if hasattr(p, 'status') else 'POSTED'}
                for p in order.payments.all()
            ],
            'has_confirmed_receipts': order.receipts.filter(status='CONFIRMED').exists(),
            'has_posted_payments': order.payments.filter(journal_entry__status='POSTED').exists(),
            'requires_reason': action_kind == 'full_annul',
            'action': action_kind,
        }
        return Response(impact)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel a purchase order (soft if DRAFT, full annul if CONFIRMED)."""
        order = self.get_object()
        reason = request.data.get('reason', '')
        try:
            order = PurchasingService.cancel_purchase_order(order, user=request.user, reason=reason)
            return Response(PurchaseOrderSerializer(order).data)
        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        order = self.get_object()
        if order.status == 'DRAFT':
            from core.services.document import DocumentRegistry
            DocumentRegistry.for_instance(order).confirm(order, user=request.user)
            return Response({'status': 'confirmed'})
        return Response({'error': 'Order not in draft'}, status=400)

    @action(detail=True, methods=['post'])
    def receive(self, request, pk=None):
        order = self.get_object()
        try:
            warehouse_id = request.data.get('warehouse_id')
            receipt_date = request.data.get('receipt_date')
            
            warehouse = order.warehouse
            if warehouse_id:
                warehouse = Warehouse.objects.get(pk=warehouse_id)
            
            receipt = PurchasingService.receive_order(
                order=order,
                warehouse=warehouse,
                receipt_date=receipt_date,
                delivery_reference=request.data.get('delivery_reference', ''),
                notes=request.data.get('notes', '')
            )
            
            return Response(
                PurchaseReceiptSerializer(receipt).data,
                status=status.HTTP_201_CREATED
            )
        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    def partial_receive(self, request, pk=None):
        order = self.get_object()
        try:
            warehouse_id = request.data.get('warehouse_id')
            receipt_date = request.data.get('receipt_date')
            line_data = request.data.get('line_data', []) # List of dicts
            
            warehouse = order.warehouse
            if warehouse_id:
                warehouse = Warehouse.objects.get(pk=warehouse_id)
            
            receipt = PurchasingService.partial_receive(
                order=order,
                warehouse=warehouse,
                line_data=line_data,
                receipt_date=receipt_date,
                delivery_reference=request.data.get('delivery_reference', ''),
                notes=request.data.get('notes', '')
            )
            
            return Response(
                PurchaseReceiptSerializer(receipt).data,
                status=status.HTTP_201_CREATED
            )
        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(PurchaseReceiptSerializer(receipts, many=True).data)

    @action(detail=True, methods=['post'])
    def partial_return(self, request, pk=None):
        order = self.get_object()
        try:
            warehouse_id = request.data.get('warehouse_id')
            receipt_date = request.data.get('receipt_date')
            line_data = request.data.get('line_data', [])
            
            warehouse = order.warehouse
            if warehouse_id:
                warehouse = Warehouse.objects.get(pk=warehouse_id)
            
            receipt = PurchasingService.partial_return(
                order=order,
                warehouse=warehouse,
                line_data=line_data,
                receipt_date=receipt_date,
                delivery_reference=request.data.get('delivery_reference', ''),
                notes=request.data.get('notes', '')
            )
            
            return Response(
                PurchaseReceiptSerializer(receipt).data,
                status=status.HTTP_201_CREATED
            )
        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    def register_note(self, request, pk=None):
        order = self.get_object()
        
        # Manually handle multipart/form-data requiring json parsing for complex fields
        data = request.data.dict() if hasattr(request.data, 'dict') else request.data.copy()
        
        # If accessing via multipart, lists might be strings
        if 'return_items' in data and isinstance(data['return_items'], str):
            import json
            try:
                data['return_items'] = json.loads(data['return_items'])
            except:
                pass
                
        from .serializers import NoteCreationSerializer
        serializer = NoteCreationSerializer(data=data)
        
        if serializer.is_valid():
            try:
                val = serializer.validated_data
                invoice = PurchasingService.create_note(
                    order=order,
                    note_type=val['note_type'],
                    amount_net=val['amount_net'],
                    amount_tax=val['amount_tax'],
                    document_number=val['document_number'],
                    document_attachment=request.FILES.get('document_attachment'),
                    return_items=val.get('return_items'),
                    original_invoice_id=val.get('original_invoice_id'),
                    date=val.get('document_date')
                )
                
                from billing.serializers import InvoiceSerializer
                return Response(InvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)
            except ValidationError as e:
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
            except Exception as e:
                import traceback
                traceback.print_exc()
                return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def purchase_checkout(self, request):
        """
        Unified purchase checkout endpoint.
        Handles: Order creation/confirmation -> Bill registration -> Payment -> Receipt
        """
        try:
            # Extract data from request
            order_data = request.data.get('order_data')
            if isinstance(order_data, str):
                import json
                order_data = json.loads(order_data)
            
            # Parse receipt_data if it's a string
            receipt_data = request.data.get('receipt_data')
            if isinstance(receipt_data, str):
                import json
                receipt_data = json.loads(receipt_data)
            
            # Check-specific params (paymentMethodCardSelector sends check# as transaction_number)
            check_number = request.data.get('check_number') or request.data.get('transaction_number')
            check_bank_id = request.data.get('check_bank_id')
            if check_bank_id:
                check_bank_id = int(check_bank_id)
            check_issue_date = request.data.get('check_issue_date')
            check_due_date = request.data.get('check_due_date')
            checkbook_id = request.data.get('checkbook_id')

            installments_raw = request.data.get('installments', 1)
            try:
                installments = int(installments_raw) if installments_raw is not None else 1
            except (ValueError, TypeError):
                installments = 1

            result = PurchasingService.purchase_checkout(
                order_data=order_data,
                dte_type=request.data.get('dte_type', 'FACTURA'),
                document_number=request.data.get('document_number', ''),
                document_date=request.data.get('document_date'),
                document_attachment=request.FILES.get('document_attachment'),
                payment_method=request.data.get('payment_method', 'CREDIT'),
                amount=request.data.get('amount'),
                installments=installments,
                treasury_account_id=request.data.get('treasury_account_id'),
                transaction_number=request.data.get('transaction_number'),
                payment_is_pending=request.data.get('payment_is_pending', 'false').lower() == 'true',
                payment_method_id=request.data.get('payment_method_id'),
                check_number=check_number,
                check_bank_id=check_bank_id,
                check_issue_date=check_issue_date,
                check_due_date=check_due_date,
                checkbook_id=checkbook_id,
                user=request.user,
                receipt_type=request.data.get('receipt_type', 'IMMEDIATE'),
                receipt_data=receipt_data
            )

            # Create HUB tasks for the completed purchase order
            from workflow.services import WorkflowService
            WorkflowService.sync_hub_tasks(result['order'])
            
            # Serialize response
            from billing.serializers import InvoiceSerializer
            from treasury.serializers import TreasuryMovementSerializer
            from .serializers import PurchaseReceiptSerializer
            
            response_data = {
                'order': PurchaseOrderSerializer(result['order']).data,
                'invoice': InvoiceSerializer(result['invoice']).data if result['invoice'] else None,
                'payment': TreasuryMovementSerializer(result['payment']).data if result['payment'] else None,
                'receipt': PurchaseReceiptSerializer(result['receipt']).data if result['receipt'] else None
            }
            
            return Response(response_data, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    def annul(self, request, pk=None):
        order = self.get_object()
        force = request.data.get('force', False)
        reason = request.data.get('reason', '')
        try:
            from core.services.document import DocumentRegistry
            DocumentRegistry.for_instance(order).cancel(order, user=request.user, reason=reason, force=force)
            return Response(PurchaseOrderSerializer(order).data)
        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class PurchaseReceiptViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    queryset = PurchaseReceipt.objects.all()
    serializer_class = PurchaseReceiptSerializer

    @action(detail=True, methods=['post'])
    def annul(self, request, pk=None):
        receipt = self.get_object()
        reason = request.data.get('reason', '')
        try:
            receipt = PurchasingService.annul_receipt(receipt, user=request.user, reason=reason)
            return Response(PurchaseReceiptSerializer(receipt).data)
        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class PurchaseReturnViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    queryset = PurchaseReturn.objects.all()
    serializer_class = PurchaseReturnSerializer

    @action(detail=True, methods=['post'])
    def annul(self, request, pk=None):
        doc = self.get_object()
        try:
            PurchaseReturnService.annul_return(doc.id)
            return Response(PurchaseReturnSerializer(doc).data)
        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

