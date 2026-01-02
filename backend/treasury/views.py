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

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        TreasuryService.delete_payment(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def create(self, request, *args, **kwargs):
        # Support generic POST /api/treasury/payments/ from frontend
        data = request.data.copy()
        
        # 1. Map payment_method to a default journal if journal is not provided
        if not data.get('journal'):
            journal = BankJournal.objects.first() # Default to first journal
            if journal:
                data['journal'] = journal.id
            else:
                return Response({'error': 'Debe configurar al menos un Diario de Caja/Banco.'}, status=status.HTTP_400_BAD_REQUEST)

        # 2. Extract special fields for the service
        amount = Decimal(str(data.get('amount', '0')))
        payment_type = data.get('payment_type')
        reference = data.get('reference', '')
        sale_order_id = data.get('sale_order')
        purchase_order_id = data.get('purchase_order')
        invoice_id = data.get('invoice')
        transaction_number = data.get('transaction_number')
        is_pending_registration = data.get('is_pending_registration', False)
        
        journal = BankJournal.objects.get(pk=data['journal'])
        
        # Resolve objects
        sale_order = None
        if sale_order_id:
            from sales.models import SaleOrder
            sale_order = SaleOrder.objects.get(pk=sale_order_id)
            
        purchase_order = None
        if purchase_order_id:
            from purchasing.models import PurchaseOrder
            purchase_order = PurchaseOrder.objects.get(pk=purchase_order_id)
            
        invoice = None
        if invoice_id:
            from billing.models import Invoice
            invoice = Invoice.objects.get(pk=invoice_id)

        # Determine Partner
        partner = None
        if sale_order: partner = sale_order.customer
        elif purchase_order: partner = purchase_order.supplier
        elif invoice: partner = invoice.customer or invoice.supplier

        try:
            payment = TreasuryService.register_payment(
                journal=journal,
                amount=amount,
                payment_type=payment_type,
                reference=reference,
                partner=partner,
                invoice=invoice,
                sale_order=sale_order,
                purchase_order=purchase_order,
                transaction_number=transaction_number,
                is_pending_registration=is_pending_registration
            )
            return Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def register(self, request):
        try:
            journal_id = request.data.get('journal_id')
            amount = Decimal(str(request.data.get('amount')))
            payment_type = request.data.get('payment_type')
            reference = request.data.get('reference', '')
            transaction_number = request.data.get('transaction_number')
            is_pending_registration = request.data.get('is_pending_registration', False)
            
            # Partners
            customer_id = request.data.get('customer_id')
            supplier_id = request.data.get('supplier_id')
            
            # Invoices
            invoice_id = request.data.get('invoice_id')
            
            journal = BankJournal.objects.get(pk=journal_id)
            partner = None
            if customer_id:
                partner = Customer.objects.get(pk=customer_id)
            elif supplier_id:
                partner = Supplier.objects.get(pk=supplier_id)
            
            invoice = None
            if invoice_id:
                from billing.models import Invoice
                invoice = Invoice.objects.get(pk=invoice_id)
            
            payment = TreasuryService.register_payment(
                journal, amount, payment_type, reference=reference, partner=partner, invoice=invoice,
                transaction_number=transaction_number,
                is_pending_registration=is_pending_registration
            )
            
            return Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
