from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import BankJournal, Payment
from .serializers import BankJournalSerializer, PaymentSerializer
from .services import TreasuryService
from sales.models import Customer
from purchasing.models import Supplier
from decimal import Decimal

class BankJournalViewSet(viewsets.ModelViewSet):
    queryset = BankJournal.objects.all()
    serializer_class = BankJournalSerializer

class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer

    @action(detail=False, methods=['post'])
    def register(self, request):
        try:
            journal_id = request.data.get('journal_id')
            amount = Decimal(str(request.data.get('amount')))
            payment_type = request.data.get('payment_type')
            reference = request.data.get('reference', '')
            
            # Partners
            customer_id = request.data.get('customer_id')
            supplier_id = request.data.get('supplier_id')
            
            # Orders
            sale_order_id = request.data.get('sale_order_id')
            purchase_order_id = request.data.get('purchase_order_id')
            
            journal = BankJournal.objects.get(pk=journal_id)
            partner = None
            if customer_id:
                partner = Customer.objects.get(pk=customer_id)
            elif supplier_id:
                partner = Supplier.objects.get(pk=supplier_id)
            
            order = None
            if sale_order_id:
                from sales.models import SaleOrder
                order = SaleOrder.objects.get(pk=sale_order_id)
            elif purchase_order_id:
                from purchasing.models import PurchaseOrder
                order = PurchaseOrder.objects.get(pk=purchase_order_id)
            
            payment = TreasuryService.register_payment(
                journal, amount, payment_type, reference=reference, partner=partner, order=order
            )
            
            return Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
