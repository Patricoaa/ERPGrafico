from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError
from .models import (TreasuryMovement, TreasuryAccount, BankStatement, BankStatementLine, 
                     ReconciliationRule, POSTerminal, TerminalBatch,
                     POSSession, POSSessionAudit, Bank, PaymentMethod,
                     PaymentTerminalProvider, PaymentTerminalDevice)
from .serializers import (
    TreasuryMovementSerializer, TreasuryAccountSerializer,
    BankStatementSerializer, BankStatementListSerializer,
    BankStatementLineSerializer, ReconciliationRuleSerializer,
    POSTerminalSerializer,
    POSSessionSerializer, POSSessionAuditSerializer,
    BankSerializer, PaymentMethodSerializer, TerminalBatchSerializer,
    PaymentTerminalProviderSerializer, PaymentTerminalDeviceSerializer
)
from .services import TreasuryService, TerminalBatchService
from .pos_service import POSService
from .reconciliation_service import ReconciliationService
from .matching_service import MatchingService
from .rule_service import RuleService
from .difference_service import DifferenceService
from .reports_service import ReportsService
from contacts.models import Contact
from decimal import Decimal
from accounting.models import Account
from core.mixins import AuditHistoryMixin


class BankViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    queryset = Bank.objects.all().order_by('name')
    serializer_class = BankSerializer


class PaymentMethodViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    queryset = PaymentMethod.objects.all().order_by('name')
    serializer_class = PaymentMethodSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        treasury_account = self.request.query_params.get('treasury_account')
        if treasury_account:
            qs = qs.filter(treasury_account_id=treasury_account)

        for_sales = self.request.query_params.get('for_sales')
        if for_sales == 'true':
            qs = qs.filter(allow_for_sales=True)

        for_purchases = self.request.query_params.get('for_purchases')
        if for_purchases == 'true':
            qs = qs.filter(allow_for_purchases=True)

        method_type = self.request.query_params.get('method_type')
        if method_type:
            qs = qs.filter(method_type=method_type)

        return qs

    def _check_integrated(self, instance):
        if instance.is_integrated:
            return Response(
                {'detail': 'Los métodos de pago integrados (CARD_TERMINAL con dispositivo) son gestionados por el sistema. Modifique el dispositivo o proveedor en su lugar.'},
                status=status.HTTP_403_FORBIDDEN,
            )

    def update(self, request, *args, **kwargs):
        err = self._check_integrated(self.get_object())
        if err: return err
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        err = self._check_integrated(self.get_object())
        if err: return err
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        err = self._check_integrated(self.get_object())
        if err: return err
        return super().destroy(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save()

    def perform_update(self, serializer):
        serializer.save()


class TreasuryAccountViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    queryset = TreasuryAccount.objects.all().order_by('account_type', 'name')
    serializer_class = TreasuryAccountSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        exclude_id = self.request.query_params.get('exclude_id')
        if exclude_id:
            qs = qs.exclude(id=exclude_id)
        return qs

    def _check_system_managed(self, instance):
        if instance.account_type in TreasuryAccount._NON_CASH_EQUIVALENT_TYPES:
            return Response(
                {'detail': f'Las cuentas de tipo {instance.get_account_type_display()} son gestionadas por el sistema (vinculadas a un proveedor de terminal). Modifique el proveedor en su lugar.'},
                status=status.HTTP_403_FORBIDDEN,
            )

    def update(self, request, *args, **kwargs):
        err = self._check_system_managed(self.get_object())
        if err: return err
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        err = self._check_system_managed(self.get_object())
        if err: return err
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        err = self._check_system_managed(self.get_object())
        if err: return err
        return super().destroy(request, *args, **kwargs)


class PaymentTerminalProviderViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    queryset = PaymentTerminalProvider.objects.all().order_by('name')
    serializer_class = PaymentTerminalProviderSerializer

class PaymentTerminalDeviceViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    queryset = PaymentTerminalDevice.objects.all().order_by('name')
    serializer_class = PaymentTerminalDeviceSerializer
    filterset_fields = ['provider', 'status']

class POSTerminalViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
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
    
    @action(detail=True, methods=['get'])
    def allowed_payment_methods(self, request, pk=None):
        """
        Retorna métodos de pago permitidos para este terminal.
        
        Query params:
        - operation: 'sales' or 'purchases' (optional) - filtra por tipo de operación
        
        Returns:
            list[PaymentMethod]: Métodos de pago permitidos
        """
        terminal = self.get_object()
        operation = request.query_params.get('operation')
        
        # Obtener métodos de pago permitidos directamente
        methods = terminal.allowed_payment_methods.filter(is_active=True)
        
        # Filtrar por tipo de operación
        if operation == 'sales':
            methods = methods.filter(allow_for_sales=True)
        elif operation == 'purchases':
            methods = methods.filter(allow_for_purchases=True)
        
        serializer = PaymentMethodSerializer(methods, many=True)
        return Response(serializer.data)









class TreasuryMovementViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    queryset = TreasuryMovement.objects.all().order_by('-date', '-created_at')
    serializer_class = TreasuryMovementSerializer

    def get_queryset(self):
        qs = self.queryset
        
        # Handle treasury_account filtering (matches either from or to)
        treasury_account = self.request.query_params.get('treasury_account')
        if treasury_account:
            from django.db.models import Q
            qs = qs.filter(Q(from_account_id=treasury_account) | Q(to_account_id=treasury_account))
            
        # Date filter
        date = self.request.query_params.get('date')
        if date:
            qs = qs.filter(date=date)

        # Batch filtering (IsNull)
        terminal_batch_isnull = self.request.query_params.get('terminal_batch__isnull')
        if terminal_batch_isnull:
            val = terminal_batch_isnull.lower() == 'true'
            qs = qs.filter(terminal_batch__isnull=val)

        pm = self.request.query_params.get('payment_method_new')
        if pm:
            qs = qs.filter(payment_method_new_id=pm)

        return qs

    filterset_fields = [
        'is_reconciled', 
        'movement_type', 'payment_method', 'payment_method_new',
        'contact'
    ]

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.journal_entry and instance.journal_entry.status == 'POSTED':
             # We might allow annulment here via delete if that's the intention,
             # but strictly delete is for drafts. Annul is for posted.
             # If user clicks delete, we try delete_movement which checks status.
             pass

        try:
            TreasuryService.delete_movement(instance)
            return Response(status=status.HTTP_204_NO_CONTENT)
        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def perform_update(self, serializer):
        instance = serializer.save()
        # Trigger status update on related documents
        TreasuryService.update_related_document_status(instance)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        
        try:
            instance = TreasuryService.create_movement(
                movement_type=data.get('movement_type'),
                amount=data.get('amount'),
                created_by=self.request.user,
                date=data.get('date'),
                from_account=data.get('from_account'),
                to_account=data.get('to_account'),
                payment_method=data.get('payment_method', TreasuryMovement.Method.CASH),
                payment_method_new=data.get('payment_method_new'),
                reference=data.get('reference', ''),
                notes=data.get('notes', ''),
                justify_reason=data.get('justify_reason'),
                partner=data.get('contact'),
                invoice=data.get('invoice'),
                sale_order=data.get('sale_order'),
                purchase_order=data.get('purchase_order'),
                pos_session=data.get('pos_session'),
                transaction_number=data.get('transaction_number'),
                is_pending_registration=data.get('is_pending_registration', False)
            )
            return Response(TreasuryMovementSerializer(instance).data, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'])
    def register_movement(self, request):
        try:
            movement = TreasuryService.create_movement_from_payload(
                request.data, created_by=request.user
            )
            return Response(TreasuryMovementSerializer(movement).data, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def annul(self, request, pk=None):
        movement = self.get_object()
        try:
            TreasuryService.annul_movement(movement)
            # Since annul_movement deletes the object (in current implementation), we can't return it serialized.
            # Or we return what we had.
            return Response(TreasuryMovementSerializer(movement).data)
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
                'return_payment': TreasuryMovementSerializer(return_payment).data
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
    def dry_run(self, request):
        """
        Validate and parse a bank statement without persisting.
        """
        file = request.FILES.get('file')
        treasury_account_id = request.data.get('treasury_account_id')
        bank_format = request.data.get('bank_format', 'GENERIC_CSV')
        custom_config = request.data.get('custom_config')
        
        if custom_config and isinstance(custom_config, str):
            try:
                import json
                custom_config = json.loads(custom_config)
            except Exception:
                pass
        
        if not file:
            return Response({'error': 'Archivo es requerido'}, status=status.HTTP_400_BAD_REQUEST)
        
        if not treasury_account_id:
            return Response({'error': 'Cuenta de tesorería es requerida'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            result = ReconciliationService.dry_run_import(
                file=file,
                treasury_account_id=treasury_account_id,
                bank_format=bank_format,
                custom_config=custom_config
            )
            return Response(result)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({'error': f'Error al validar cartola: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
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
            
            if statement.status == 'CONFIRMED':
                return Response({'error': 'Cartola ya confirmada'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Validate all lines are reconciled or excluded
            unreconciled = statement.lines.filter(
                reconciliation_status='UNRECONCILED'
            ).count()
            
            if unreconciled > 0:
                return Response({
                    'error': f'{unreconciled} líneas sin reconciliar. Debes reconciliar o excluir todas las líneas.'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            statement.status = 'CONFIRMED'
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
        
        # Filter by reconciliation status
        reconciliation_status = self.request.query_params.get('reconciliation_status') or self.request.query_params.get('reconciliation_state')
        if reconciliation_status:
            queryset = queryset.filter(reconciliation_status=reconciliation_status)
        
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
            exclusion_reason = request.data.get('exclusion_reason')
            exclusion_notes = request.data.get('exclusion_notes', '')

            if not line_ids:
                return Response({'error': 'line_ids requerido'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Check if statement is confirmed
            lines = BankStatementLine.objects.filter(id__in=line_ids).select_related('statement')
            if any(l.statement.status == 'CONFIRMED' for l in lines):
                return Response({'error': 'No se pueden excluir movimientos de una cartola confirmada'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Update state
            BankStatementLine.objects.filter(id__in=line_ids).update(
                reconciliation_status='EXCLUDED',
                exclusion_reason=exclusion_reason,
                exclusion_notes=exclusion_notes
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
        """Reconciliation dashboard metrics — cached 90s"""
        try:
            from core.cache import cache_report
            
            account_id = request.query_params.get('treasury_account')
            
            date_from_str = request.query_params.get('date_from')
            date_to_str = request.query_params.get('date_to')
            
            date_from = date.fromisoformat(date_from_str) if date_from_str else None
            date_to = date.fromisoformat(date_to_str) if date_to_str else None
            
            def _generate():
                return ReportsService.get_reconciliation_dashboard(
                    treasury_account_id=account_id,
                    date_from=date_from,
                    date_to=date_to
                )

            data = cache_report(
                module='treasury',
                endpoint='recon_dashboard',
                params={'account': account_id, 'from': date_from_str, 'to': date_to_str},
                timeout=90,
                generator=_generate,
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





class POSSessionViewSet(viewsets.ModelViewSet):
    """ViewSet for POS Session Management (Apertura/Cierre de Caja)"""
    
    queryset = POSSession.objects.all().select_related('treasury_account', 'user', 'closed_by')
    serializer_class = POSSessionSerializer
    filterset_fields = ['status', 'treasury_account', 'user']
    
    @action(detail=False, methods=['get'])
    def current(self, request):
        """Get the current open session for the requesting user"""
        try:
            session = POSSession.objects.filter(user=request.user, status='OPEN').first()
            if session:
                return Response(POSSessionSerializer(session).data)
            return Response({'session': None})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['post'])
    def open_session(self, request):
        """Open a new POS session (Abrir Caja)"""
        try:
            session = POSService.open_session(
                user=request.user,
                terminal_id=request.data.get('terminal_id'),
                treasury_account_id=request.data.get('treasury_account_id'),
                opening_balance=Decimal(str(request.data.get('opening_balance', '0'))),
                fund_source_id=request.data.get('fund_source_id'),
                justify_reason=request.data.get('justify_reason'),
                justify_target_id=request.data.get('justify_target_id'),
                notes=request.data.get('notes', ''),
            )
            return Response(POSSessionSerializer(session).data, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response({'error': str(e.message) if hasattr(e, 'message') else str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['post'])
    def close_session(self, request, pk=None):
        """Close a POS session with cash audit (Cierre de Caja / Arqueo)"""
        session = self.get_object()
        try:
            session, audit = POSService.close_session(
                session=session,
                actual_cash=Decimal(str(request.data.get('actual_cash', '0'))),
                notes=request.data.get('notes', ''),
                justify_reason=request.data.get('justify_reason', 'UNKNOWN'),
                justify_target_id=request.data.get('justify_target_id'),
                withdrawal_amount=Decimal(str(request.data.get('withdrawal_amount', '0'))),
                cash_destination_id=request.data.get('cash_destination_id'),
                user=request.user,
            )
            return Response({
                'session': POSSessionSerializer(session).data,
                'audit': POSSessionAuditSerializer(audit).data,
                'message': 'Caja cerrada correctamente'
            })
        except ValidationError as e:
            return Response({'error': str(e.message) if hasattr(e, 'message') else str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    @action(detail=True, methods=['get'])
    def summary(self, request, pk=None):
        """Get detailed summary of sales in this session (X/Z Report data)"""
        try:
            session = self.get_object()
            from django.db.models import Sum, F

            
            # Basic totals from the session model (denormalized for performance)
            totals = {
                'session_id': session.id,
                'treasury_account_id': session.treasury_account_id or (session.terminal.default_treasury_account_id if session.terminal else None),
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
            
            # Get all movements in this session that have an invoice
            # We filter movements in this session that have an invoice
            movements_with_invoice = session.movements.filter(invoice__isnull=False).select_related('invoice')
            invoices = {m.invoice for m in movements_with_invoice}

            
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
            
            # Manual Movements
            manual_movements = session.movements.filter(invoice__isnull=True, sale_order__isnull=True, purchase_order__isnull=True).order_by('-created_at')
            manual_movements_data = TreasuryMovementSerializer(manual_movements, many=True).data

            
            return Response({
                **totals,
                'total_manual_inflow': session.total_other_cash_inflow,
                'total_manual_outflow': session.total_other_cash_outflow,
                'manual_movements': manual_movements_data,
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
            
            settings = AccountingSettings.get_solo()
            if not settings:
                return Response({'error': 'Configuración contable no encontrada'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Added TRANSFER support
            is_inflow = request.data.get('is_inflow', False)
            if isinstance(is_inflow, str):
                is_inflow = is_inflow.lower() == 'true'
            else:
                is_inflow = bool(is_inflow)
            
            direction = 'IN' if is_inflow else 'OUT'

            if move_type == 'TRANSFER':
                target_account_id = request.data.get('target_account_id')
                if not target_account_id:
                    return Response({'error': 'Debe especificar la cuenta para traspasos'}, status=status.HTTP_400_BAD_REQUEST)
                
                try:
                    target_obj = TreasuryAccount.objects.get(id=target_account_id)
                except TreasuryAccount.DoesNotExist:
                     return Response({'error': 'Cuenta no encontrada'}, status=status.HTTP_400_BAD_REQUEST)
                
                # Verify self transfer
                treasury_account_obj = session.treasury_account or (
                    session.terminal.default_treasury_account if session.terminal else None
                )
                
                if treasury_account_obj == target_obj:
                     return Response({'error': 'No puede transferir a la misma cuenta de origen'}, status=status.HTTP_400_BAD_REQUEST)

            else:
                # Use unified TreasuryService matching logic
                target_account = TreasuryService._get_reason_account(settings, move_type, direction)
                if not target_account:
                    # Provide a generic label or try to get a mapping label mapping if needed for the error message
                    labels = {
                        'PARTNER_WITHDRAWAL': 'Retiro Socio', 'THEFT': 'Robo / Pérdida', 'TIP': 'Propina', 
                        'ROUNDING': 'Redondeo', 'OTHER_IN': 'Otro Ingreso', 'OTHER_OUT': 'Otro Egreso',
                        'COUNTING_ERROR': 'Error de Conteo', 'SYSTEM_ERROR': 'Error de Sistema', 'CASHBACK': 'Vuelto Incorrecto'
                    }
                    lbl = labels.get(move_type, move_type)
                    return Response({'error': f'Cuenta contable no configurada para {lbl}'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Restriction: Cannot withdraw more than what is available in cash
            if not is_inflow and amount > session.expected_cash:
                return Response({
                    'error': f'Saldo insuficiente en efectivo. Máximo disponible para retiro: ${session.expected_cash:,.0f}'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Treasury account for the session
            treasury_account = session.treasury_account.account if session.treasury_account else (
                session.terminal.default_treasury_account.account if session.terminal else None
            )
            
            if not treasury_account:
                 return Response({'error': 'No se pudo determinar la cuenta de tesorería para esta sesión'}, status=status.HTTP_400_BAD_REQUEST)

            with transaction.atomic():
                session_treasury_obj = session.treasury_account or session.terminal.default_treasury_account
                from_account = None
                to_account = None
                
                if move_type == 'TRANSFER':
                    if is_inflow:
                        from_account = TreasuryAccount.objects.get(id=request.data.get('target_account_id'))
                        to_account = session_treasury_obj
                    else:
                        from_account = session_treasury_obj
                        to_account = TreasuryAccount.objects.get(id=request.data.get('target_account_id'))
                elif is_inflow:
                    to_account = session_treasury_obj
                else: # Outflow
                    from_account = session_treasury_obj

                movement = TreasuryService.create_movement(
                    amount=amount,
                    movement_type=TreasuryMovement.Type.TRANSFER if move_type == 'TRANSFER' else (TreasuryMovement.Type.INBOUND if is_inflow else TreasuryMovement.Type.OUTBOUND),
                    created_by=request.user,
                    from_account=from_account,
                    to_account=to_account,
                    pos_session=session,
                    notes=notes,
                    justify_reason=move_type,
                    reference=f"Movimiento Manual POS ({move_type})"
                )
                
                # Session totals are updated via _update_pos_session in create_movement
                session.refresh_from_db()
            
            from .serializers import POSSessionSerializer
            return Response({
                'session': POSSessionSerializer(session).data,
                'message': 'Movimiento registrado correctamente'
            })
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class TreasuryDashboardViewSet(viewsets.ViewSet):
    """
    Vista consolidada de flujos de efectivo y gestión de tesorería.
    Combina Payments y CashMovements en una sola vista filtrable y provee balances consolidados.
    """
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """
        Retorna estadísticas generales de tesorería (Saldos por tipo de cuenta).
        """
        bank_balance = sum(a.current_balance for a in TreasuryAccount.objects.filter(account_type=TreasuryAccount.Type.BANK))
        cash_balance = sum(a.current_balance for a in TreasuryAccount.objects.filter(account_type=TreasuryAccount.Type.CASH))
        
        return Response({
            'bank_total': bank_balance,
            'cash_total': cash_balance,
            'total_available': bank_balance + cash_balance
        })

    @action(detail=False, methods=['get'])
    def accounts(self, request):
        """
        Retorna la lista de cuentas con sus saldos actuales.
        """
        accounts = TreasuryAccount.objects.all().order_by('account_type', 'name')
        from .serializers import TreasuryAccountSerializer
        serializer = TreasuryAccountSerializer(accounts, many=True)
        return Response(serializer.data)

    def list(self, request):
        """
        Lista consolidada de flujos de efectivo.
        Query params:
        - flow_type: 'all', 'third_party', 'internal' (default: 'all')
        - date_from, date_to, treasury_account
        """
        from datetime import datetime
        from django.db.models import Q
        from .serializers import CashFlowSerializer
        
        flow_type = request.query_params.get('flow_type', 'all')
        date_from_str = request.query_params.get('date_from')
        date_to_str = request.query_params.get('date_to')
        treasury_account_id = request.query_params.get('treasury_account')
        
        date_from = datetime.fromisoformat(date_from_str).date() if date_from_str else None
        date_to = datetime.fromisoformat(date_to_str).date() if date_to_str else None
        
        # Build Query
        query = TreasuryMovement.objects.select_related(
            'treasury_account', 'from_account', 'to_account', 
            'contact', 'invoice__contact'
        ).exclude(journal_entry__status='CANCELLED')
        
        if date_from:
            query = query.filter(date__gte=date_from)
        if date_to:
            query = query.filter(date__lte=date_to)
        
        if treasury_account_id:
            query = query.filter(
                Q(treasury_account_id=treasury_account_id) |
                Q(from_account_id=treasury_account_id) |
                Q(to_account_id=treasury_account_id)
            )
            
        if flow_type == 'third_party':
            # Strictly Inbound/Outbound moves with partners or invoices
            query = query.filter(movement_type__in=['INBOUND', 'OUTBOUND'])
        elif flow_type == 'internal':
            # Transfers, adjustments, etc.
            query = query.filter(movement_type__in=['TRANSFER', 'ADJUSTMENT'])

        results = []
        for mv in query:
            # Determine partner name
            partner_name = None
            if mv.contact:
                partner_name = mv.contact.name
            elif mv.invoice and mv.invoice.contact:
                partner_name = mv.invoice.contact.name
                
            # Determine account name for display
            acc_name = 'N/A'
            if mv.treasury_account:
                acc_name = mv.treasury_account.name
            elif mv.from_account and mv.to_account:
                acc_name = f"{mv.from_account.name} -> {mv.to_account.name}"
            elif mv.from_account:
                acc_name = mv.from_account.name
            elif mv.to_account:
                acc_name = mv.to_account.name

            # Map source as 'PAYMENT' if it has partner/invoice, else 'CASH_MOVEMENT'
            source = 'PAYMENT' if (mv.contact or mv.invoice or mv.sale_order or mv.purchase_order) else 'CASH_MOVEMENT'
            
            results.append({
                'id': mv.id,
                'source': source,
                'type': mv.get_movement_type_display(),
                'date': mv.date,
                'amount': mv.amount,
                'description': mv.notes or mv.reference or f"Movimiento {mv.display_id}",
                'treasury_account_name': acc_name,
                'partner_name': partner_name,
                'reference': mv.display_id,
                'is_internal': mv.movement_type in ['TRANSFER', 'ADJUSTMENT']
            })
            
        results.sort(key=lambda x: x['date'], reverse=True)
        results = results[:50]
        
        serializer = CashFlowSerializer(results, many=True)
        return Response(serializer.data)


    @action(detail=False, methods=['post'])
    def register_transfer(self, request):
        """
        Registra un traspaso interno entre cuentas.
        """
        from_acc_id = request.data.get('from_account_id')
        to_acc_id = request.data.get('to_account_id')
        amount = Decimal(str(request.data.get('amount', 0)))
        notes = request.data.get('notes', '')
        date_str = request.data.get('date')
        
        if not from_acc_id or not to_acc_id or amount <= 0:
            return Response({'error': 'Datos incompletos'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            from_acc = TreasuryAccount.objects.get(pk=from_acc_id)
            to_acc = TreasuryAccount.objects.get(pk=to_acc_id)
            
            movement = TreasuryService.register_internal_transfer(
                from_account=from_acc,
                to_account=to_acc,
                amount=amount,
                created_by=request.user,
                notes=notes,
                date=datetime.fromisoformat(date_str) if date_str else None
            )
            
            return Response({'message': 'Traspaso registrado correctamente', 'id': movement.id})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class TerminalBatchViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing Terminal Batches (Settlements).
    """
    queryset = TerminalBatch.objects.all().order_by('-sales_date', '-created_at')
    serializer_class = TerminalBatchSerializer
    filterset_fields = ['status', 'provider', 'sales_date']
    
    def get_queryset(self):
        qs = super().get_queryset()
        
        # Date range filtering
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        
        if date_from:
            qs = qs.filter(sales_date__gte=date_from)
        if date_to:
            qs = qs.filter(sales_date__lte=date_to)
            
        return qs

    def create(self, request, *args, **kwargs):
        """
        Custom create to use TerminalBatchService.
        """
        try:
            data = request.data
            provider_id = data.get('provider')
            sales_date = data.get('sales_date')
            gross_amount = Decimal(str(data.get('gross_amount')))
            commission_base = Decimal(str(data.get('commission_base', 0)))
            commission_tax = Decimal(str(data.get('commission_tax', 0)))
            net_amount = Decimal(str(data.get('net_amount')))
            terminal_reference = data.get('terminal_reference', '')
            
            provider = PaymentTerminalProvider.objects.get(pk=provider_id)
            movement_ids = data.get('movement_ids', None)
            
            batch = TerminalBatchService.create_batch(
                provider=provider,
                sales_date=sales_date,
                gross_amount=gross_amount,
                commission_base=commission_base,
                commission_tax=commission_tax,
                net_amount=net_amount,
                terminal_reference=terminal_reference,
                user=request.user,
                movement_ids=movement_ids
            )
            
            return Response(TerminalBatchSerializer(batch).data, status=status.HTTP_201_CREATED)
            
        except ValidationError as e:
            import traceback
            print(f"TERMINAL BATCH VALIDATION ERROR: {str(e)}")
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            import traceback
            print(f"TERMINAL BATCH INTERNAL ERROR: {str(e)}")
            traceback.print_exc()
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'])
    def generate_invoice(self, request):
        """
        Generate supplier invoice for settled batches.
        """
        try:
            provider_id = request.data.get('provider_id')
            year = int(request.data.get('year'))
            month = int(request.data.get('month'))
            
            provider = PaymentTerminalProvider.objects.get(pk=provider_id)
            
            invoice = TerminalBatchService.generate_monthly_invoice(
                provider=provider,
                year=year,
                month=month,
                user=request.user,
                number=request.data.get('number'),
                date=request.data.get('date'),
                document_attachment=request.FILES.get('document_attachment')
            )
            
            if not invoice:
                 return Response({'message': 'No hay lotes liquidados para facturar en este mes.'}, status=status.HTTP_404_NOT_FOUND)
            
            return Response({
                'message': 'Factura generada exitosamente',
                'invoice_id': invoice.id,
                'number': invoice.number
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


