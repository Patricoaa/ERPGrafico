from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Payment, TreasuryAccount
from .serializers import PaymentSerializer, TreasuryAccountSerializer
from .services import TreasuryService
from contacts.models import Contact
from decimal import Decimal
from accounting.models import Account
from django.conf import settings
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from .tuu import TuuClient

class TreasuryAccountViewSet(viewsets.ModelViewSet):
    queryset = TreasuryAccount.objects.all().order_by('account_type', 'name')
    serializer_class = TreasuryAccountSerializer

class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.all().order_by('-date', '-created_at')
    serializer_class = PaymentSerializer

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        TreasuryService.delete_payment(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def create(self, request, *args, **kwargs):
        # Support generic POST /api/treasury/payments/ from frontend
        data = request.data.copy()
        
        # Extract fields
        amount = Decimal(str(data.get('amount', '0')))
        payment_type = data.get('payment_type')
        payment_method = data.get('payment_method', 'CASH')
        treasury_account_id = data.get('treasury_account_id') or data.get('treasury_account')  # New field
        
        reference = data.get('reference', '')
        sale_order_id = data.get('sale_order')
        purchase_order_id = data.get('purchase_order')
        invoice_id = data.get('invoice')
        transaction_number = data.get('transaction_number')
        is_pending_registration = data.get('is_pending_registration', False)
        if isinstance(is_pending_registration, str):
            is_pending_registration = is_pending_registration.lower() == 'true'
        
        # New Document Registration Fields
        dte_type = data.get('dte_type')
        document_reference = data.get('document_reference')
        document_attachment = request.FILES.get('document_attachment')

        
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

        # Determine Partner (Contact)
        partner = None
        if sale_order: partner = sale_order.customer
        elif purchase_order: partner = purchase_order.supplier

        try:
            payment = TreasuryService.register_payment(
                amount=amount,
                payment_type=payment_type,
                payment_method=payment_method,
                treasury_account_id=treasury_account_id,
                reference=reference,
                partner=partner,
                invoice=invoice,
                sale_order=sale_order,
                purchase_order=purchase_order,
                transaction_number=transaction_number,
                is_pending_registration=is_pending_registration,
                dte_type=dte_type,
                document_reference=document_reference,
                document_attachment=document_attachment
            )
            if payment:
                return Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)
            return Response({'message': 'Acción de crédito procesada (documento registrado)'}, status=status.HTTP_200_OK)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def register(self, request):
        try:
            amount = Decimal(str(request.data.get('amount')))
            payment_type = request.data.get('payment_type')
            payment_method = request.data.get('payment_method', 'CASH')
            treasury_account_id = request.data.get('treasury_account_id') or request.data.get('treasury_account')
            reference = request.data.get('reference', '')
            transaction_number = request.data.get('transaction_number')
            is_pending_registration = request.data.get('is_pending_registration', False)
            if isinstance(is_pending_registration, str):
                is_pending_registration = is_pending_registration.lower() == 'true'
            
            # New Document Registration Fields
            dte_type = request.data.get('dte_type')
            document_reference = request.data.get('document_reference')
            document_attachment = request.FILES.get('document_attachment')

            
            # Contact (unified partner)
            contact_id = request.data.get('contact_id')
            
            # Invoices
            invoice_id = request.data.get('invoice_id')
            
            partner = None
            if contact_id:
                partner = Contact.objects.get(pk=contact_id)
            
            invoice = None
            if invoice_id:
                from billing.models import Invoice
                invoice = Invoice.objects.get(pk=invoice_id)

            payment = TreasuryService.register_payment(
                amount=amount,
                payment_type=payment_type,
                payment_method=payment_method,
                treasury_account_id=treasury_account_id,
                reference=reference,
                partner=partner,
                invoice=invoice,
                transaction_number=transaction_number,
                is_pending_registration=is_pending_registration,
                dte_type=dte_type,
                document_reference=document_reference,
                document_attachment=document_attachment
            )
            
            if payment:
                return Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)
            return Response({'message': 'Acción de crédito procesada (documento registrado)'}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def annul(self, request, pk=None):
        payment = self.get_object()
        try:
            TreasuryService.annul_payment(payment)
            return Response(PaymentSerializer(payment).data)
        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class TuuPaymentView(APIView):
    """
    Endpoints for Tuu Remote Payment interaction.
    """

    def post(self, request):
        """
        Initiate a payment on the POS.
        Payload: { "treasury_account_id": int, "amount": int, "order_id": int (optional) }
        """
        account_id = request.data.get('treasury_account_id')
        amount = request.data.get('amount')
        
        if not account_id or not amount:
            return Response({"error": "Missing treasury_account_id or amount"}, status=status.HTTP_400_BAD_REQUEST)

        treasury_account = get_object_or_404(TreasuryAccount, id=account_id)
        
        # Check permissions/configuration
        if not treasury_account.tuu_api_key and not settings.DEBUG:
             # In production, we might enforce API key. 
             # For this implementation, we allow empty key to trigger Mock Mode if TuuClient handles it.
             pass

        client = TuuClient(api_key=treasury_account.tuu_api_key, device_id=treasury_account.tuu_device_id)
        
        result = client.create_payment(amount=amount)
        
        if result['success']:
            return Response(result['data'], status=status.HTTP_200_OK)
        else:
            return Response(result, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class TuuStatusView(APIView):
    """
    Check status of a payment.
    """
    def get(self, request, idempotency_key):
        # We need the API key, so we need to know which treasury account used it.
        # Ideally, we pass it or look it up. For simplicity, we might ask frontend to pass 'treasury_account_id' query param.
        account_id = request.query_params.get('treasury_account_id')
        if not account_id:
            return Response({"error": "Missing treasury_account_id"}, status=status.HTTP_400_BAD_REQUEST)
            
        treasury_account = get_object_or_404(TreasuryAccount, id=account_id)
        client = TuuClient(api_key=treasury_account.tuu_api_key, device_id=treasury_account.tuu_device_id)
        
        result = client.get_status(idempotency_key)
        
        if result['success']:
            return Response(result['data'], status=status.HTTP_200_OK)
        else:
            return Response(result, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
