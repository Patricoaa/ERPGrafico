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
                    invoice = BillingService.create_purchase_bill(order, supplier_invoice_number)
                
                return Response(InvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)
            except (SaleOrder.DoesNotExist, PurchaseOrder.DoesNotExist):
                return Response({'error': 'Order not found'}, status=status.HTTP_404_NOT_FOUND)
            except ValidationError as e:
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
            except Exception as e:
                return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def pos_checkout(self, request):
        print(f"DEBUG: pos_checkout request data: {request.data}")
        order_data = request.data.get('order_data')
        dte_type = request.data.get('dte_type')
        payment_method = request.data.get('payment_method')
        transaction_number = request.data.get('transaction_number')
        is_pending_registration = request.data.get('is_pending_registration', False)
        amount = request.data.get('amount')
        
        if not all([order_data, dte_type, payment_method]):
            return Response({'error': 'Missing data'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            invoice = BillingService.pos_checkout(
                order_data, dte_type, payment_method, 
                transaction_number=transaction_number,
                is_pending_registration=is_pending_registration,
                amount=amount
            )
            return Response(InvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            print(f"DEBUG: pos_checkout ValidationError: {e}")
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            print(f"DEBUG: pos_checkout Exception: {e}")
            import traceback
            traceback.print_exc()
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
