from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Invoice
from .serializers import InvoiceSerializer, CreateInvoiceSerializer
from .services import BillingService
from sales.models import SaleOrder
from purchasing.models import PurchaseOrder
from django.core.exceptions import ValidationError
from core.mixins import AuditHistoryMixin

class InvoiceViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    queryset = Invoice.objects.all().order_by('-date', '-id')
    serializer_class = InvoiceSerializer
    filterset_fields = {
        'dte_type': ['exact', 'in'],
        'sale_order': ['exact', 'isnull'],
        'purchase_order': ['exact', 'isnull'],
        'status': ['exact', 'in'],
        'contact': ['exact'],
    }

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        BillingService.delete_invoice(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['post'])
    def create_from_order(self, request):
        serializer = CreateInvoiceSerializer(data=request.data)
        if serializer.is_valid():
            order_id = serializer.validated_data['order_id']
            order_type = serializer.validated_data['order_type']
            dte_type = serializer.validated_data['dte_type']
            payment_method = serializer.validated_data['payment_method']
            
            try:
                if order_type == 'sale':
                    order = SaleOrder.objects.get(id=order_id)
                    invoice = BillingService.create_sale_invoice(order, dte_type, payment_method)
                else:
                    order = PurchaseOrder.objects.get(id=order_id)
                    supplier_invoice_number = serializer.validated_data.get('supplier_invoice_number', '')
                    document_attachment = serializer.validated_data.get('document_attachment')
                    issue_date = serializer.validated_data.get('issue_date')
                    status_val = serializer.validated_data.get('status', Invoice.Status.POSTED)
                    invoice = BillingService.create_purchase_bill(
                        order, 
                        supplier_invoice_number, 
                        dte_type=dte_type,
                        document_attachment=document_attachment,
                        date=issue_date,
                        status=status_val
                    )
                
                return Response(InvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)
            except (SaleOrder.DoesNotExist, PurchaseOrder.DoesNotExist):
                return Response({'error': 'Order not found'}, status=status.HTTP_404_NOT_FOUND)
            except ValidationError as e:
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
            except Exception as e:
                return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        instance = self.get_object()
        number = request.data.get('number')
        document_attachment = request.FILES.get('document_attachment')
        
        try:
            invoice = BillingService.confirm_invoice(instance, number, document_attachment)
            return Response(InvoiceSerializer(invoice).data)
        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def check_folio(self, request):
        """
        Validates folio uniqueness in real-time.
        
        Query params:
        - number: Folio number to check
        - dte_type: Document type (BOLETA, FACTURA, etc.)
        - exclude_id (optional): Invoice ID to exclude from check (for editing)
        
        Response:
        {
            "is_unique": true/false,
            "message": "...",
            "existing_invoice": {...} (if not unique)
        }
        """
        number = request.query_params.get('number')
        dte_type = request.query_params.get('dte_type')
        exclude_id = request.query_params.get('exclude_id')
        
        if not number or not dte_type:
            return Response({
                'error': 'Missing required parameters: number and dte_type'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Skip validation for empty or draft numbers
        if not number or number == 'Draft' or number.strip() == '':
            return Response({
                'is_unique': True,
                'message': 'OK'
            })
        
        # Build query
        query = Invoice.objects.filter(number=number, dte_type=dte_type)
        
        if exclude_id:
            query = query.exclude(id=exclude_id)
        
        # For sales documents, check only sale orders
        # For purchase documents, we would need supplier_id (not implemented here for simplicity)
        query = query.filter(sale_order__isnull=False)
        
        existing = query.first()
        
        if existing:
            return Response({
                'is_unique': False,
                'message': f'El folio {number} ya ha sido utilizado en otro documento de venta.',
                'existing_invoice': {
                    'id': existing.id,
                    'number': existing.number,
                    'date': existing.date.isoformat() if existing.date else None,
                    'customer_name': existing.sale_order.customer.name if existing.sale_order else None,
                    'total': float(existing.total)
                }
            })
        
        return Response({
            'is_unique': True,
            'message': 'Folio disponible'
        })

    @action(detail=False, methods=['post'])
    def pos_checkout(self, request):
        print(f"DEBUG: pos_checkout request data: {request.data}")
        order_data = request.data.get('order_data')
        dte_type = request.data.get('dte_type')
        payment_method = request.data.get('payment_method')
        payment_method_id = request.data.get('payment_method_id')
        transaction_number = request.data.get('transaction_number')
        is_pending_registration = request.data.get('is_pending_registration', False)
        if isinstance(is_pending_registration, str):
            is_pending_registration = is_pending_registration.lower() == 'true'
        
        payment_is_pending = request.data.get('payment_is_pending', False)
        if isinstance(payment_is_pending, str):
            payment_is_pending = payment_is_pending.lower() == 'true'

        document_number = request.data.get('document_number') or request.data.get('document_reference')
        document_date = request.data.get('document_date')
        document_attachment = request.FILES.get('document_attachment')
        amount = request.data.get('amount')
        treasury_account_id = request.data.get('treasury_account_id')
        payment_type = request.data.get('payment_type', 'INBOUND')
        pos_session_id = request.data.get('pos_session_id')
        
        # New delivery parameters
        delivery_type = request.data.get('delivery_type', 'IMMEDIATE')
        delivery_date = request.data.get('delivery_date')
        delivery_notes = request.data.get('delivery_notes', '')
        immediate_lines = request.data.get('immediate_lines')
        if isinstance(immediate_lines, str):
            import json
            try:
                immediate_lines = json.loads(immediate_lines)
            except:
                pass
        line_files = {} # keyed by line_idx
        for key, file_obj in request.FILES.items():
            if key.startswith('line_'):
                parts = key.split('_')
                if len(parts) >= 3: # line_0_design_0 or line_0_approval
                    try:
                        line_idx = int(parts[1])
                        file_type = parts[2] # 'design' or 'approval'
                        
                        if line_idx not in line_files:
                            line_files[line_idx] = {'design': [], 'approval': None}
                        
                        if file_type == 'design':
                            line_files[line_idx]['design'].append(file_obj)
                        elif file_type == 'approval':
                            line_files[line_idx]['approval'] = file_obj
                    except (ValueError, IndexError):
                        continue

        if not all([order_data, dte_type, payment_method]):
            return Response({'error': 'Missing data'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            invoice = BillingService.pos_checkout(
                order_data, dte_type, payment_method, 
                transaction_number=transaction_number,
                is_pending_registration=is_pending_registration,
                payment_is_pending=payment_is_pending,
                amount=amount,
                treasury_account_id=treasury_account_id,
                document_number=document_number,
                document_date=document_date,
                document_attachment=document_attachment,
                delivery_type=delivery_type,
                delivery_date=delivery_date,
                delivery_notes=delivery_notes,
                immediate_lines=immediate_lines,
                payment_type=payment_type,
                line_files=line_files,
                pos_session_id=pos_session_id,
                payment_method_id=payment_method_id,
                user=request.user,
                credit_approval_task_id=request.data.get('credit_approval_task_id'),
                draft_id=request.data.get('draft_id')
            )
            return Response(InvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            msg = e.messages[0] if hasattr(e, 'messages') and e.messages else str(e)
            print(f"DEBUG: pos_checkout ValidationError: {msg}")
            return Response({'error': msg}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


    @action(detail=False, methods=['post'])
    def request_credit(self, request):
        """
        Creates an approval request task for a POS sale that exceeds the customer's credit limit.
        """
        try:
            order_data = request.data.get('order_data')
            amount = request.data.get('amount')
            payment_method = request.data.get('payment_method')
            
            task = BillingService.request_credit_approval(
                order_data=order_data,
                amount=amount,
                payment_method=payment_method,
                full_request_data=request.data,
                requesting_user=request.user
            )
            return Response({'task_id': task.id}, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            msg = e.messages[0] if hasattr(e, 'messages') and e.messages else str(e)
            return Response({'error': msg}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    def annul(self, request, pk=None):
        # ... (keep existing)
        invoice = self.get_object()
        force = request.data.get('force', False)
        if isinstance(force, str):
            force = force.lower() == 'true'
            
        try:
            BillingService.annul_invoice(invoice, force=force)
            return Response(InvoiceSerializer(invoice).data)
        except ValidationError as e:
            msg = e.messages[0] if hasattr(e, 'messages') and e.messages else str(e)
            return Response({'error': msg}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    def process_logistics(self, request, pk=None):
        """
        Executes logistics (returns or supplemental dispatches) for an invoice.
        """
        from .note_checkout_service import NoteCheckoutService
        warehouse_id = request.data.get('warehouse_id')
        date = request.data.get('date')
        line_data = request.data.get('line_data')
        notes = request.data.get('notes', '')

        if not all([warehouse_id, date, line_data]):
            return Response({'error': 'Faltan datos requeridos (bodega, fecha o líneas)'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            doc = NoteCheckoutService.process_logistics_from_invoice(
                invoice_id=pk,
                warehouse_id=warehouse_id,
                date=date,
                line_data=line_data,
                notes=notes
            )
            return Response({
                'message': 'Logística procesada correctamente',
                'document_id': doc.id,
                'display_id': doc.display_id
            })
        except ValidationError as e:
            msg = e.messages[0] if hasattr(e, 'messages') and e.messages else str(e)
            return Response({'error': msg}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
