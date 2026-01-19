from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Payment, TreasuryAccount
from .serializers import PaymentSerializer, TreasuryAccountSerializer
from .services import TreasuryService
from contacts.models import Contact
from decimal import Decimal
from accounting.models import Account

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

    @action(detail=True, methods=['post'])
    def register_return(self, request, pk=None):
        """
        Register payment return.
        Only available for payments linked to DRAFT invoices.
        """
        payment = self.get_object()
        
        amount = request.data.get('amount')
        reason = request.data.get('reason', '')
        treasury_account_id = request.data.get('treasury_account_id')
        
        if not amount:
            return Response(
                {'error': 'Debe especificar el monto a devolver.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from treasury.return_services import TreasuryReturnService
            amount_decimal = Decimal(str(amount))
            
            return_payment = TreasuryReturnService.register_payment_return(
                payment, amount_decimal, reason=reason, treasury_account_id=treasury_account_id
            )
            
            return Response({
                'message': 'Devolución de pago registrada exitosamente',
                'return_payment_id': return_payment.id,
                'return_payment': PaymentSerializer(return_payment).data
            }, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

