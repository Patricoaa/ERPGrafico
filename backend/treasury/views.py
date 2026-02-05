from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from django.utils import timezone
from .models import (Payment, TreasuryAccount, BankStatement, BankStatementLine, 
                     ReconciliationRule, POSTerminal, CashMovement, 
                     CashDifference, POSSession, POSSessionAudit)
from .serializers import (
    PaymentSerializer, TreasuryAccountSerializer,
    BankStatementSerializer, BankStatementListSerializer,
    BankStatementLineSerializer, ReconciliationRuleSerializer,
    POSTerminalSerializer,
    CashMovementSerializer, CashDifferenceSerializer,
    POSSessionSerializer, POSSessionAuditSerializer
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

    def get_queryset(self):
        qs = super().get_queryset()
        
        # Filter by physical status if requested
        is_physical = self.request.query_params.get('is_physical')
        if is_physical is not None:
            qs = qs.filter(is_physical=is_physical.lower() == 'true')
            
        return qs


class POSTerminalViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing POS Terminals.
    Supports filtering by active status via `?active_only=true` query param.
    """
    queryset = POSTerminal.objects.select_related('default_treasury_account').prefetch_related('allowed_treasury_accounts').all()
    serializer_class = POSTerminalSerializer
    
    def get_queryset(self):
        qs = super().get_queryset()
        
        # Filter by active status if requested
        if self.request.query_params.get('active_only') == 'true':
            qs = qs.filter(is_active=True)
        
        return qs.order_by('code')

    def destroy(self, request, *args, **kwargs):
        """
        Custom destroy to handle protected terminals (with sessions).
        """
        from django.db.models.deletion import ProtectedError
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response({
                "error": "No se puede eliminar el terminal porque tiene sesiones asociadas.",
                "detail": "Para deshabilitar el terminal, use la opción 'Desactivar' en su lugar."
            }, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['get'])
    def available_accounts(self, request, pk=None):
        """
        Retorna cuentas de tesorería disponibles para este terminal,
        opcionalmente filtradas por método de pago.
        
        Query params:
        - payment_method: 'CASH', 'CARD', 'TRANSFER' (optional)
        
        Returns:
            list[TreasuryAccount]: Cuentas permitidas, opcionalmente filtradas
        """
        terminal = self.get_object()
        payment_method = request.query_params.get('payment_method')
        
        if payment_method:
            accounts = terminal.get_accounts_for_method(payment_method)
        else:
            accounts = terminal.allowed_treasury_accounts.all()
        
        serializer = TreasuryAccountSerializer(accounts, many=True)
        return Response(serializer.data)



class CashMovementViewSet(viewsets.ModelViewSet):
    """
    ViewSet for tracking cash movements between accounts and POS sessions.
    """
    queryset = CashMovement.objects.all().order_by('-date')
    serializer_class = CashMovementSerializer
    filterset_fields = ['movement_type', 'status', 'from_account', 'to_account', 'pos_session']

    def perform_create(self, serializer):
        from .services import TreasuryService
        
        # Validar y crear mediante servicio para asegurar contabilidad
        data = serializer.validated_data
        movement = TreasuryService.create_cash_movement(
            movement_type=data.get('movement_type'),
            amount=data.get('amount'),
            created_by=self.request.user,
            from_account=data.get('from_account'),
            to_account=data.get('to_account'),
            pos_session=data.get('pos_session'),
            notes=data.get('notes', ''),
            date=data.get('date')
        )
        return movement


class CashDifferenceViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing cash differences that require supervisor approval.
    """
    queryset = CashDifference.objects.all().order_by('-reported_at')
    serializer_class = CashDifferenceSerializer
    filterset_fields = ['status', 'reason', 'pos_session_audit']

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """
        Approve the cash difference and trigger accounting entry via POSDifferenceService.
        """
        try:
            from .difference_service import POSDifferenceService
            difference = POSDifferenceService.approve_difference(
                difference_id=self.get_object().id,
                approved_by_user=request.user,
                notes=request.data.get('notes', '')
            )
            return Response(CashDifferenceSerializer(difference).data)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



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
                'message': 'Cartola importada exitosamente',
                'statement': BankStatementSerializer(result['statement']).data,
                'total_lines': result['total_lines'],
                'warnings': result['warnings']
            }, status=status.HTTP_201_CREATED)
        
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({'error': f'Error al importar cartola: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
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
                return Response({'error': 'Cartola ya confirmada'}, status=status.HTTP_400_BAD_REQUEST)
            
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
            return Response({'error': 'Cartola no encontrada'}, status=status.HTTP_404_NOT_FOUND)
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
            
            difference_reason = request.data.get('difference_reason')
            notes = request.data.get('notes')
            group = MatchingService.create_match_group(line_ids, payment_ids, request.user, difference_reason, notes)
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
                return Response({'error': 'No se pueden excluir movimientos de una cartola confirmada'}, status=status.HTTP_400_BAD_REQUEST)
            
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
            card_provider_id = request.data.get('card_provider_id')
            
            if difference_type and line.difference_amount != 0:
                DifferenceService.create_difference_adjustment(
                    line, difference_type, request.user, notes, card_provider_id
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


class CardBillingViewSet(viewsets.ViewSet):
    """ViewSet for Card Payment Billing and Dashboard"""
    
    @action(detail=False, methods=['get'])
    def dashboard(self, request):
        """Dashboard data for card commissions and invoicing"""
        try:
            from django.utils import timezone
            year = int(request.query_params.get('year', timezone.now().year))
            month = int(request.query_params.get('month', timezone.now().month))
            
            providers = CardPaymentProvider.objects.filter(is_active=True)
            data = []
            
            for provider in providers:
                settlements = DailySettlement.objects.filter(
                    provider=provider,
                    settlement_date__year=year,
                    settlement_date__month=month
                ).order_by('settlement_date')
                
                # Fetch monthly invoice if any settlement has one
                invoice = None
                settlement_with_invoice = settlements.filter(monthly_invoice__isnull=False).first()
                if settlement_with_invoice:
                    invoice = settlement_with_invoice.monthly_invoice
                
                provider_data = {
                    'provider_id': provider.id,
                    'provider_name': provider.name,
                    'supplier_name': provider.supplier.name,
                    'total_gross': sum(s.total_gross for s in settlements),
                    'total_commission': sum(s.total_commission for s in settlements),
                    'total_vat': sum(s.total_vat for s in settlements),
                    'total_net': sum(s.total_net for s in settlements),
                    'settlements_count': settlements.count(),
                    'invoice_id': invoice.id if invoice else None,
                    'invoice_number': invoice.number if invoice else None,
                    'invoice_status': invoice.status if invoice else 'PENDING',
                    'details': DailySettlementSerializer(settlements, many=True).data
                }
                data.append(provider_data)
                
            return Response(data)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'])
    def generate_invoice(self, request):
        """Manually trigger monthly invoice generation"""
        try:
            provider_id = request.data.get('provider_id')
            year = int(request.data.get('year'))
            month = int(request.data.get('month'))
            
            from .card_invoice_service import CardInvoiceService
            provider = CardPaymentProvider.objects.get(id=provider_id)
            
            invoice = CardInvoiceService.generate_monthly_invoice(provider, year, month, request.user)
            
            if invoice:
                return Response({
                    'message': 'Factura generada con éxito',
                    'invoice_id': invoice.id
                })
            else:
                return Response({
                    'error': 'No hay liquidaciones pendientes para este periodo'
                }, status=status.HTTP_400_BAD_REQUEST)
                
        except CardPaymentProvider.DoesNotExist:
            return Response({'error': 'Proveedor no encontrado'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class POSSessionViewSet(viewsets.ModelViewSet):
    """ViewSet for POS Session Management (Apertura/Cierre de Caja)"""
    
    queryset = POSSession.objects.all().select_related('treasury_account', 'user', 'closed_by')
    serializer_class = POSSessionSerializer
    filterset_fields = ['status', 'treasury_account', 'user']
    
    @action(detail=False, methods=['get'])
    def current(self, request):
        """Get the current open session for the requesting user"""
        try:
            if session:
                return Response(POSSessionSerializer(session).data)
            return Response({'session': None})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['post'])
    def open_session(self, request):
        """Open a new POS session (Abrir Caja)"""
        try:
            from decimal import Decimal
            
            terminal_id = request.data.get('terminal_id')
            treasury_account_id = request.data.get('treasury_account_id')  # Legacy fallback
            opening_balance = Decimal(str(request.data.get('opening_balance', '0')))
            
            # Check if user already has an open session
            existing = POSSession.objects.filter(user=request.user, status='OPEN').first()
            if existing:
                return Response({
                    'error': 'Ya tiene una sesión abierta',
                    'session_id': existing.id
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # New flow: Use terminal
            if terminal_id:
                try:
                    terminal = POSTerminal.objects.select_related('default_treasury_account').get(
                        id=terminal_id,
                        is_active=True
                    )
                except POSTerminal.DoesNotExist:
                    return Response({
                        'error': 'Terminal no encontrado o inactivo'
                    }, status=status.HTTP_404_NOT_FOUND)
                
                # Create session with terminal
                session = POSSession.objects.create(
                    terminal=terminal,
                    treasury_account=terminal.default_treasury_account,  # Maintain legacy field
                    user=request.user,
                    opening_balance=opening_balance,
                    status='OPEN'
                )
            
            # Legacy flow: Direct treasury account (deprecated)
            elif treasury_account_id:
                try:
                    treasury_account = TreasuryAccount.objects.get(id=treasury_account_id)
                except TreasuryAccount.DoesNotExist:
                    return Response({
                        'error': 'Caja no encontrada'
                    }, status=status.HTTP_404_NOT_FOUND)
                
                session = POSSession.objects.create(
                    treasury_account=treasury_account,
                    terminal=None,  # No terminal in legacy mode
                    user=request.user,
                    opening_balance=opening_balance,
                    status='OPEN'
                )
            
            else:
                return Response({
                    'error': 'Debe especificar terminal_id o treasury_account_id'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Track Physical Cash Withdrawal for fund if source provided
            fund_source_id = request.data.get('fund_source_id')
            if fund_source_id:
                try:
                    fund_source = TreasuryAccount.objects.get(id=fund_source_id)
                    book_balance = fund_source.account.balance
                    diff = opening_balance - book_balance
                    
                    if diff != 0:
                        justify_reason = request.data.get('justify_reason', 'UNKNOWN')
                        justify_target_id = request.data.get('justify_target_id')
                        
                        notes = f"Ajuste de Apertura POS #{session.id}. Fondo reportado: {opening_balance}, Saldo libros: {book_balance}"
                        if request.data.get('notes'):
                            notes += f" - {request.data.get('notes')}"

                        pos_treasury_obj = session.treasury_account or (session.terminal.default_treasury_account if session.terminal and session.terminal.default_treasury_account else None)
                        
                        from_account = None
                        to_account = None
                        movement_type = 'ADJUSTMENT' # Generic adjustment for opening

                        if diff < 0: # Deficit
                            movement_type = 'WITHDRAWAL'
                            from_account = pos_treasury_obj
                            if justify_reason == 'TRANSFER' and justify_target_id:
                                try: to_account = TreasuryAccount.objects.get(id=justify_target_id)
                                except: pass
                        else: # Surplus
                            movement_type = 'DEPOSIT'
                            to_account = pos_treasury_obj
                            if justify_reason == 'TRANSFER':
                                from_account = fund_source

                        TreasuryService.create_cash_movement(
                            movement_type=movement_type,
                            amount=abs(diff),
                            created_by=request.user,
                            from_account=from_account,
                            to_account=to_account,
                            pos_session=session,
                            notes=f"{notes} ({justify_reason})",
                            justify_reason=justify_reason,
                            journal_entry_desc=f"Ajuste de Apertura POS ({justify_reason}) - Sesión #{session.id}"
                        )
                             
                except TreasuryAccount.DoesNotExist:
                    print(f"WARNING: Fund source {fund_source_id} not found")
                except Exception as e:
                    print(f"ERROR processing fund source: {e}")

            return Response(POSSessionSerializer(session).data, status=status.HTTP_201_CREATED)
        
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['post'])
    def close_session(self, request, pk=None):
        """Close a POS session with cash audit (Cierre de Caja / Arqueo)"""
        try:
            from decimal import Decimal
            from django.utils import timezone
            
            session = self.get_object()
            
            if session.status == 'CLOSED':
                return Response({'error': 'Esta sesión ya está cerrada'}, status=status.HTTP_400_BAD_REQUEST)
            
            actual_cash = Decimal(str(request.data.get('actual_cash', '0')))
            notes = request.data.get('notes', '')
            
            # Calculate totals from payments in this session
            # For now, use the stored totals (which would be updated by checkout service)
            expected_cash = session.expected_cash
            difference = actual_cash - expected_cash
            
            # Create audit record
            audit = POSSessionAudit.objects.create(
                session=session,
                expected_amount=expected_cash,
                actual_amount=actual_cash,
                difference=difference,
                notes=notes
            )
            
            # Handle Cash Differences (Accounting Adjustment or Approval Workflow)
            if difference != 0:
                from accounting.models import AccountingSettings
                settings = AccountingSettings.objects.first()
                threshold = settings.pos_cash_difference_approval_threshold if settings else Decimal('5000')
                justify_reason = request.data.get('justify_reason', 'UNKNOWN')
                justify_target_id = request.data.get('justify_target_id')
                
                requires_approval = abs(difference) > threshold
                
                # Create the CashDifference record for traceability
                diff_record = CashDifference.objects.create(
                    pos_session_audit=audit,
                    amount=difference,
                    reason=justify_reason,
                    status='PENDING' if requires_approval else 'APPROVED',
                    reported_by=request.user,
                    reporter_notes=notes,
                    transfer_target_id=justify_target_id if justify_reason == 'TRANSFER' else None
                )
                
                if requires_approval:
                    audit.requires_approval = True
                    audit.save()
                else:
                    # Automatic adjustment via TreasuryService
                    pos_treasury_acc = session.treasury_account or (session.terminal.default_treasury_account if session.terminal else None)
                    from_account = None
                    to_account = None
                    
                    if difference < 0: # Deficit
                        from_account = pos_treasury_acc
                        if justify_reason == 'TRANSFER' and justify_target_id:
                            try: to_account = TreasuryAccount.objects.get(id=justify_target_id)
                            except: pass
                    else: # Surplus
                        to_account = pos_treasury_acc
                        if justify_reason == 'TRANSFER' and justify_target_id:
                            try: from_account = TreasuryAccount.objects.get(id=justify_target_id)
                            except: pass

                    movement = TreasuryService.create_cash_movement(
                        movement_type='TRANSFER' if justify_reason == 'TRANSFER' else ('WITHDRAWAL' if difference < 0 else 'DEPOSIT'),
                        amount=abs(difference),
                        created_by=request.user,
                        from_account=from_account,
                        to_account=to_account,
                        pos_session=session,
                        notes=f"Ajuste al Cierre: {notes or 'Sin observaciones'}",
                        justify_reason=justify_reason,
                        journal_entry_desc=f"{'Sobrante' if difference > 0 else 'Faltante'} de Caja ({justify_reason}) - Sesión #{session.id}"
                    )
                    
                    if movement.journal_entry:
                        audit.journal_entry = movement.journal_entry
                        audit.save()
                        diff_record.journal_entry = movement.journal_entry
                        diff_record.save()

            # New: Track Physical Cash Deposit (Withdrawal from POS to safe/bank)
            withdrawal_amount = request.data.get('withdrawal_amount')
            if withdrawal_amount is not None:
                withdrawal_amount = Decimal(str(withdrawal_amount))
            else:
                withdrawal_amount = actual_cash

            cash_destination_id = request.data.get('cash_destination_id')
            if withdrawal_amount > 0 and cash_destination_id:
                try:
                    to_account = TreasuryAccount.objects.get(id=cash_destination_id)
                    pos_treasury_obj = session.treasury_account or (session.terminal.default_treasury_account if session.terminal else None)
                    
                    TreasuryService.create_cash_movement(
                        movement_type='DEPOSIT',
                        from_account=pos_treasury_obj,
                        to_account=to_account,
                        amount=withdrawal_amount,
                        pos_session=session,
                        created_by=request.user,
                        notes=f"Depósito de cierre sesión #{session.id}",
                        journal_entry_desc=f"Depósito de Cierre POS - Sesión #{session.id}"
                    )
                except TreasuryAccount.DoesNotExist:
                    print(f"WARNING: TreasuryAccount {cash_destination_id} not found for deposit")

            # Clean up draft carts for this session
            from sales.draft_cart_service import DraftCartService
            DraftCartService.cleanup_on_session_close(session.id)

            # Close session
            session.status = 'CLOSED'
            session.closed_at = timezone.now()
            session.closed_by = request.user
            session.save()
            
            return Response({
                'session': POSSessionSerializer(session).data,
                'audit': POSSessionAuditSerializer(audit).data,
                'message': 'Caja cerrada correctamente'
            })
        
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['get'])
    def summary(self, request, pk=None):
        """Get detailed summary of sales in this session (X/Z Report data)"""
        try:
            session = self.get_object()
            from django.db.models import Sum, F
            from .models import Payment
            
            # Basic totals from the session model (denormalized for performance)
            totals = {
                'session_id': session.id,
                'opening_balance': session.opening_balance,
                'total_cash_sales': session.total_cash_sales,
                'total_card_sales': session.total_card_sales,
                'total_transfer_sales': session.total_transfer_sales,
                'total_credit_sales': session.total_credit_sales,
                'expected_cash': session.expected_cash,
                'total_sales': (
                    session.total_cash_sales + 
                    session.total_card_sales + 
                    session.total_transfer_sales + 
                    session.total_credit_sales
                )
            }
            
            # Advanced Stats: Sales by Category
            # We traverse: Session -> Payments -> Invoices -> Lines -> Product -> Category
            # Note: This assumes 1 Payment ~= 1 Sale. For split payments, this might overcount or need weighting.
            # For POS, typically 1 Invoice = 1 Payment, so reliable enough for X Report.
            
            sales_by_category = {}
            
            # Get all invoices paid in this session
            # We filter payments in this session that have an invoice
            payments = session.payments.filter(invoice__isnull=False).select_related('invoice')
            invoices = {p.invoice for p in payments}
            
            for invoice in invoices:
                # Get lines for this invoice
                # POS Invoices are always linked to a SaleOrder
                lines = []
                if invoice.sale_order:
                    lines = invoice.sale_order.lines.all().select_related('product', 'product__category')
                
                for line in lines:
                    category_name = "Sin Categoría"
                    if line.product and line.product.category:
                        # category can be an ID or object depending on how it's serialized/mapped, 
                        # but ORM gives object.
                        category_name = line.product.category.name
                    
                    if category_name not in sales_by_category:
                        sales_by_category[category_name] = 0
                    
                    # Add line total (price * quantity)
                    # We should use line.total (net) or total (gross). POS usually shows Gross sales.
                    # SaleLine has 'total' (net) and tax calculation is on Order level usually.
                    # Let's check SaleLine model if needed, but 'total' is usually there.
                    # For X report, Gross is often better. SaleLine usually stores unit_price * qty.
                    # Let's use whatever 'total' is available or calculate it.
                    # Assuming line.total is net, and we want gross... this might be complex without tax info on line.
                    # For now, let's just use line.total (Net) as a proxy or if it includes tax.
                    # Actually, for POS X report, typically you want GROSS sales.
                    # If SaleLine has tax included price...
                    
                    # Safe fallback
                    amount = line.total if hasattr(line, 'total') else (line.quantity * line.unit_price)
                    sales_by_category[category_name] += (amount or 0)
            
            # Format category data for frontend
            category_data = [
                {'name': k, 'value': v} for k, v in sales_by_category.items()
            ]
            category_data.sort(key=lambda x: x['value'], reverse=True)
            
            return Response({
                **totals,
                'sales_by_category': category_data
            })
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    def register_manual_movement(self, request, pk=None):
        """
        Registers a manual cash movement (withdrawal or inflow) for this session.
        Supporting hardcoded types: PARTNER_WITHDRAWAL, THEFT, OTHER_IN, OTHER_OUT
        """
        try:
            from decimal import Decimal
            from django.db import transaction
            from accounting.models import AccountingSettings, JournalEntry, JournalItem
            from accounting.services import JournalEntryService
            from django.utils import timezone
            
            session = self.get_object()
            if session.status != 'OPEN':
                return Response({'error': 'La sesión no está abierta'}, status=status.HTTP_400_BAD_REQUEST)
            
            move_type = request.data.get('type')  # PARTNER_WITHDRAWAL, THEFT, OTHER_IN, OTHER_OUT
            amount = Decimal(str(request.data.get('amount', '0')))
            notes = request.data.get('notes', '')
            
            if amount <= 0:
                return Response({'error': 'El monto debe ser mayor a cero'}, status=status.HTTP_400_BAD_REQUEST)
            
            settings = AccountingSettings.objects.first()
            if not settings:
                return Response({'error': 'Configuración contable no encontrada'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Added TRANSFER support
            if move_type == 'TRANSFER':
                target_account_id = request.data.get('target_account_id')
                if not target_account_id:
                    return Response({'error': 'Debe especificar la cuenta de destino para transferencias'}, status=status.HTTP_400_BAD_REQUEST)
                
                try:
                    target_obj = TreasuryAccount.objects.get(id=target_account_id)
                except TreasuryAccount.DoesNotExist:
                     return Response({'error': 'Cuenta de destino no encontrada'}, status=status.HTTP_400_BAD_REQUEST)
                
                config = {
                     'account': target_obj.account, # Use the accounting account of the target
                     'is_inflow': False, # It is an outflow from THIS session's cash (Money OUT)
                     'label': f'Traspaso a {target_obj.name}'
                }
                
                # Verify self transfer
                # We need session treasury account logic first
                treasury_account = session.treasury_account.account if session.treasury_account else (
                    session.terminal.default_treasury_account.account if session.terminal else None
                )
                
                if treasury_account == config['account']:
                     return Response({'error': 'No puede transferir a la misma cuenta de origen'}, status=status.HTTP_400_BAD_REQUEST)

            else:
                # Existing logic for hardcoded types
                mapping = {
                    'PARTNER_WITHDRAWAL': {
                        'account': settings.pos_partner_withdrawal_account,
                        'is_inflow': False,
                        'label': 'Retiro Socio'
                    },
                    'THEFT': {
                        'account': settings.pos_theft_account,
                        'is_inflow': False,
                        'label': 'Robo / Pérdida'
                    },
                    'TIP': {
                        'account': settings.pos_tip_account,
                        'is_inflow': True,
                        'label': 'Propina'
                    },
                    'ROUNDING': {
                        # We use the specific POS rounding account if available
                        'account': settings.pos_rounding_adjustment_account or settings.rounding_adjustment_account,
                        'is_inflow': False, # Manual rounding usually implies a small loss/discount but could be inflow.
                        # For simplification in manual register, we assume outflow (discount/small deficit).
                        'label': 'Redondeo'
                    },
                    'OTHER_IN': {
                        'account': settings.pos_other_inflow_account,
                        'is_inflow': True,
                        'label': 'Otro Ingreso'
                    },
                    'OTHER_OUT': {
                        'account': settings.pos_other_outflow_account,
                        'is_inflow': False,
                        'label': 'Otro Egreso'
                    }
                }
                
                config = mapping.get(move_type)
                if not config:
                    return Response({'error': 'Tipo de movimiento inválido'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Restriction: Cannot withdraw more than what is available in cash
            if not config['is_inflow'] and amount > session.expected_cash:
                return Response({
                    'error': f'Saldo insuficiente en efectivo. Máximo disponible para retiro: ${session.expected_cash:,.0f}'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            target_account = config['account']
            if not target_account:
                return Response({'error': f'Cuenta contable no configurada para {config["label"]}'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Treasury account for the session
            if move_type != 'TRANSFER': # already calculated above for transfer
                 treasury_account = session.treasury_account.account if session.treasury_account else (
                    session.terminal.default_treasury_account.account if session.terminal else None
                )
            
            if not treasury_account:
                 return Response({'error': 'No se pudo determinar la cuenta de tesorería para esta sesión'}, status=status.HTTP_400_BAD_REQUEST)

            with transaction.atomic():
                session_treasury_obj = session.treasury_account or session.terminal.default_treasury_account
                from_account = None
                to_account = None
                is_inflow = move_type in ['OTHER_IN', 'TIP']
                
                if is_inflow:
                    to_account = session_treasury_obj
                    session.total_other_cash_inflow += amount
                elif move_type == 'TRANSFER':
                    from_account = session_treasury_obj
                    to_account = TreasuryAccount.objects.get(id=request.data.get('target_account_id'))
                    session.total_other_cash_outflow += amount
                else: # Outflow
                    from_account = session_treasury_obj
                    session.total_other_cash_outflow += amount

                movement = TreasuryService.create_cash_movement(
                    movement_type='TRANSFER' if move_type == 'TRANSFER' else ('DEPOSIT' if is_inflow else 'WITHDRAWAL'),
                    amount=amount,
                    created_by=request.user,
                    from_account=from_account,
                    to_account=to_account,
                    pos_session=session,
                    notes=notes,
                    justify_reason=move_type,
                    journal_entry_desc=f"Movimiento Manual POS ({move_type}) - {notes}"
                )
                session.save()
            
            from .serializers import POSSessionSerializer
            return Response({
                'session': POSSessionSerializer(session).data,
                'message': f'Movimiento de {config["label"]} registrado correctamente'
            })
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
