from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Payment, TreasuryAccount, BankStatement, BankStatementLine, ReconciliationRule
from .serializers import (
    PaymentSerializer, TreasuryAccountSerializer,
    BankStatementSerializer, BankStatementListSerializer,
    BankStatementLineSerializer, ReconciliationRuleSerializer
)
from .services import TreasuryService
from .reconciliation_service import ReconciliationService
from .matching_service import MatchingService
from .rule_service import RuleService
from .difference_service import DifferenceService
from .reports_service import ReportsService
from contacts.models import Contact
from decimal import Decimal
from accounting.models import Account
from core.views import AuditHistoryMixin

class TreasuryAccountViewSet(viewsets.ModelViewSet):
    queryset = TreasuryAccount.objects.all().order_by('account_type', 'name')
    serializer_class = TreasuryAccountSerializer

class PaymentViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    queryset = Payment.objects.all().order_by('-date', '-created_at')
    serializer_class = PaymentSerializer
    filterset_fields = ['is_reconciled', 'treasury_account', 'payment_type', 'contact']

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

        
        # Resolve objects
        sale_order = None
        if sale_order_id:
            from sales.models import SaleOrder
            sale_order = SaleOrder.objects.get(pk=sale_order_id)
            
        purchase_order = None
        if purchase_order_id:
            from purchasing.models import PurchaseOrder
            purchase_order =PurchaseOrder.objects.get(pk=purchase_order_id)
            
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
                document_reference=document_reference
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
                document_reference=document_reference
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
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'])
    def suggestions(self, request, pk=None):
        """Get bank statement line suggestions for this payment"""
        try:
            suggestions = MatchingService.suggest_lines_for_payment(pk)
            return Response({'suggestions': suggestions})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        """Get bank statement line suggestions for this payment"""
        try:
            suggestions = MatchingService.suggest_lines_for_payment(pk)
            return Response({'suggestions': suggestions})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class BankStatementViewSet(viewsets.ModelViewSet):
    """ViewSet for managing bank statements"""
    queryset = BankStatement.objects.all().select_related('treasury_account', 'imported_by')
    
    def get_serializer_class(self):
        if self.action == 'list':
            return BankStatementListSerializer
        return BankStatementSerializer
    
    @action(detail=False, methods=['post'])
    def import_statement(self, request):
        """
        Import a bank statement from file.
        
        Required fields:
        - file: File to import
        - treasury_account_id: ID of treasury account
        - bank_format: Format identifier (BANCO_CHILE_CSV, SCOTIABANK_CSV, etc.)
        
        Optional fields:
        - custom_config: Custom parser configuration (JSON)
        """
        file = request.FILES.get('file')
        treasury_account_id = request.data.get('treasury_account_id')
        bank_format = request.data.get('bank_format', 'GENERIC_CSV')
        custom_config = request.data.get('custom_config')  # Optional JSON
        
        if custom_config and isinstance(custom_config, str):
            try:
                import json
                custom_config = json.loads(custom_config)
            except Exception:
                pass
        
        if not file:
            return Response(
                {'error': 'Archivo es requerido'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not treasury_account_id:
            return Response(
                {'error': 'Cuenta de tesorería es requerida'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        
        try:
            result = ReconciliationService.import_statement(
                file=file,
                treasury_account_id=treasury_account_id,
                bank_format=bank_format,
                user=request.user,
                custom_config=custom_config
            )
            
            return Response({
                'message': 'Extracto importado exitosamente',
                'statement': BankStatementSerializer(result['statement']).data,
                'total_lines': result['total_lines'],
                'warnings': result['warnings']
            }, status=status.HTTP_201_CREATED)
        
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({'error': f'Error al importar extracto: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['post'])
    def preview(self, request):
        """
        Generate file preview for column mapping
        """
        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'Archivo es requerido'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            data = ReconciliationService.generate_preview(file)
            return Response(data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'])
    def summary(self, request, pk=None):
        """Get summary statistics for a statement"""
        try:
            summary = ReconciliationService.get_statement_summary(pk)
            return Response(summary)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=False, methods=['get'])
    def formats(self, request):
        """Get available bank formats"""
        formats = ReconciliationService.get_available_bank_formats()
        return Response({'formats': formats})
    
    @action(detail=True, methods=['post'])
    def auto_match(self, request, pk=None):
        """Auto-match all unreconciled lines in statement"""
        try:
            threshold = float(request.data.get('confidence_threshold', 90.0))
            result = MatchingService.auto_match_statement(pk, threshold)
            return Response(result)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        """Confirm statement (locks it)"""
        try:
            statement = BankStatement.objects.get(id=pk)
            
            if statement.state == 'CONFIRMED':
                return Response({'error': 'Extracto ya confirmado'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Validate all lines are reconciled or excluded
            unreconciled = statement.lines.filter(
                reconciliation_state='UNRECONCILED'
            ).count()
            
            if unreconciled > 0:
                return Response({
                    'error': f'{unreconciled} líneas sin reconciliar. Debes reconciliar o excluir todas las líneas.'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            statement.state = 'CONFIRMED'
            statement.save()
            
            return Response(BankStatementSerializer(statement).data)
            
        except BankStatement.DoesNotExist:
            return Response({'error': 'Extracto no encontrado'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class BankStatementLineViewSet(viewsets.ModelViewSet):
    """ViewSet for bank statement lines"""
    queryset = BankStatementLine.objects.all().select_related('statement', 'matched_payment', 'reconciled_by')
    serializer_class = BankStatementLineSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filter by statement if provided
        statement_id = self.request.query_params.get('statement')
        if statement_id:
            queryset = queryset.filter(statement_id=statement_id)
        
        # Filter by reconciliation state
        reconciliation_state = self.request.query_params.get('reconciliation_state')
        if reconciliation_state:
            queryset = queryset.filter(reconciliation_state=reconciliation_state)
        
        return queryset
    
    @action(detail=False, methods=['post'])
    def match_group(self, request):
        """Match multiple lines with multiple payments (N:M)"""
        try:
            line_ids = request.data.get('line_ids', [])
            payment_ids = request.data.get('payment_ids', [])
            
            if not line_ids or not payment_ids:
                return Response({'error': 'line_ids y payment_ids requeridos'}, status=status.HTTP_400_BAD_REQUEST)
                
            group = MatchingService.create_match_group(line_ids, payment_ids, request.user)
            return Response({'message': 'Grupo creado', 'group_id': group.id})
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'])
    def bulk_exclude(self, request):
        """Exclude multiple lines from reconciliation"""
        try:
            line_ids = request.data.get('line_ids', [])
            if not line_ids:
                return Response({'error': 'line_ids requerido'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Check if statement is confirmed
            lines = BankStatementLine.objects.filter(id__in=line_ids).select_related('statement')
            if any(l.statement.state == 'CONFIRMED' for l in lines):
                return Response({'error': 'No se pueden excluir movimientos de un extracto confirmado'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Update state
            BankStatementLine.objects.filter(id__in=line_ids).update(
                reconciliation_state='EXCLUDED'
            )
            
            return Response({'message': f'{len(line_ids)} movimientos excluidos'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'])
    def suggestions(self, request, pk=None):
        """Get payment matching suggestions for this line"""
        try:
            limit = int(request.query_params.get('limit', 5))
            suggestions = MatchingService.suggest_matches(pk, limit)
            return Response({'suggestions': suggestions})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['post'])
    def match(self, request, pk=None):
        """Manually match line with payment"""
        try:
            payment_id = request.data.get('payment_id')
            if not payment_id:
                return Response({'error': 'payment_id requerido'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Wrapper sets up a 1:1 group
            matched_line = MatchingService.manual_match(pk, payment_id, request.user)
            return Response(BankStatementLineSerializer(matched_line).data)
            
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        """Confirm a matched line (MATCHED -> RECONCILED)"""
        try:
            line = self.get_object()
            
            # Check for difference adjustment
            difference_type = request.data.get('difference_type')
            notes = request.data.get('notes', '')
            
            if difference_type and line.difference_amount != 0:
                DifferenceService.create_difference_adjustment(
                    line, difference_type, request.user, notes
                )
            
            confirmed_line = MatchingService.confirm_match(pk, request.user)
            return Response(BankStatementLineSerializer(confirmed_line).data)
            
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['post'])
    def unmatch(self, request, pk=None):
        """Remove match from line"""
        try:
            unmatched_line = MatchingService.unmatch(pk)
            return Response(BankStatementLineSerializer(unmatched_line).data)
            
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
    @action(detail=True, methods=['get'])
    def suggested_difference(self, request, pk=None):
        """Get suggested difference type for this line"""
        try:
            line = self.get_object()
            suggestion = DifferenceService.suggest_difference_type(line)
            return Response({'suggestion': suggestion})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ReconciliationRuleViewSet(viewsets.ModelViewSet):
    """ViewSet for reconciliation rules"""
    queryset = ReconciliationRule.objects.all().select_related('treasury_account', 'created_by')
    serializer_class = ReconciliationRuleSerializer
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
    
    @action(detail=True, methods=['get'])
    def statistics(self, request, pk=None):
        """Get usage statistics for this rule"""
        stats = RuleService.get_rule_statistics(pk)
        return Response(stats)
    
    @action(detail=False, methods=['post'])
    def create_defaults(self, request):
        """Create default rules for an account"""
        try:
            account_id = request.data.get('treasury_account_id')
            if not account_id:
                return Response({'error': 'treasury_account_id required'}, status=status.HTTP_400_BAD_REQUEST)
            
            account = TreasuryAccount.objects.get(id=account_id)
            RuleService.create_default_rules(account, request.user)
            
            return Response({'message': 'Reglas predeterminadas creadas'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def simulate(self, request):
        """Simulate rule execution"""
        try:
            rule_data = request.data
            account_id = rule_data.get('treasury_account_id')
            if account_id == 'global':
                account_id = None
            
            results = RuleService.simulate_rule(rule_data, account_id)
            return Response({'results': results})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class ReconciliationReportsViewSet(viewsets.ViewSet):
    """ViewSet for reconciliation reports and dashboard"""
    
    @action(detail=False, methods=['get'])
    def dashboard(self, request):
        """Reconciliation dashboard metrics"""
        try:
            account_id = request.query_params.get('treasury_account')
            
            date_from_str = request.query_params.get('date_from')
            date_to_str = request.query_params.get('date_to')
            
            date_from = date.fromisoformat(date_from_str) if date_from_str else None
            date_to = date.fromisoformat(date_to_str) if date_to_str else None
            
            data = ReportsService.get_reconciliation_dashboard(
                treasury_account_id=account_id,
                date_from=date_from,
                date_to=date_to
            )
            return Response(data)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['get'])
    def pending(self, request):
        """Pending reconciliations report"""
        try:
            account_id = request.query_params.get('treasury_account')
            data = ReportsService.get_pending_reconciliations_report(account_id)
            return Response(data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
    @action(detail=False, methods=['get'])
    def history(self, request):
        """Reconciliation history/trend"""
        try:
            account_id = request.query_params.get('treasury_account')
            months = int(request.query_params.get('months', 6))
            data = ReportsService.get_monthly_trend(account_id, months)
            return Response(data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
