from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Invoice
from .serializers import InvoiceSerializer, CreateInvoiceSerializer
from .services import BillingService
from sales.models import SaleOrder
from purchasing.models import PurchaseOrder
from django.core.exceptions import ValidationError

class InvoiceViewSet(viewsets.ModelViewSet):
    queryset = Invoice.objects.all().order_by('-date', '-id')
    serializer_class = InvoiceSerializer

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

    @action(detail=False, methods=['post'])
    def pos_checkout(self, request):
        print(f"DEBUG: pos_checkout request data: {request.data}")
        order_data = request.data.get('order_data')
        dte_type = request.data.get('dte_type')
        payment_method = request.data.get('payment_method')
        transaction_number = request.data.get('transaction_number')
        is_pending_registration = request.data.get('is_pending_registration', False)
        if isinstance(is_pending_registration, str):
            is_pending_registration = is_pending_registration.lower() == 'true'
        document_number = request.data.get('document_number') or request.data.get('document_reference')
        document_date = request.data.get('document_date')
        document_attachment = request.FILES.get('document_attachment')
        amount = request.data.get('amount')
        treasury_account_id = request.data.get('treasury_account_id')
        
        # New delivery parameters
        delivery_type = request.data.get('delivery_type', 'IMMEDIATE')
        delivery_date = request.data.get('delivery_date')
        delivery_notes = request.data.get('delivery_notes', '')

        if not all([order_data, dte_type, payment_method]):
            return Response({'error': 'Missing data'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            invoice = BillingService.pos_checkout(
                order_data, dte_type, payment_method, 
                transaction_number=transaction_number,
                is_pending_registration=is_pending_registration,
                amount=amount,
                treasury_account_id=treasury_account_id,
                document_number=document_number,
                document_date=document_date,
                document_attachment=document_attachment,
                delivery_type=delivery_type,
                delivery_date=delivery_date,
                delivery_notes=delivery_notes
            )
            return Response(InvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            print(f"DEBUG: pos_checkout ValidationError: {e}")
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    def annul(self, request, pk=None):
        invoice = self.get_object()
        try:
            BillingService.annul_invoice(invoice)
            return Response(InvoiceSerializer(invoice).data)
        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
