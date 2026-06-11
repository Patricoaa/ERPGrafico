from rest_framework import viewsets, status, filters as drf_filters, serializers as drf_serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend, FilterSet
import django_filters
from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError
from celery.result import AsyncResult
from .models import (TreasuryMovement, TreasuryAccount, BankStatement, BankStatementLine, 
                     ReconciliationSettings, POSTerminal, TerminalBatch,
                     POSSession, POSSessionAudit, Bank, PaymentMethod,
                     PaymentTerminalProvider, PaymentTerminalDevice)
from .serializers import (
    TreasuryMovementSerializer, TreasuryAccountSerializer,
    BankStatementSerializer, BankStatementListSerializer,
    BankStatementLineSerializer, ReconciliationSettingsSerializer,
    POSTerminalSerializer,
    POSSessionSerializer, POSSessionAuditSerializer,
    BankSerializer, PaymentMethodSerializer, TerminalBatchSerializer,
    PaymentTerminalProviderSerializer, PaymentTerminalDeviceSerializer,
    BankLoanSerializer, BankLoanWriteSerializer, LoanInstallmentSerializer,
    PayInstallmentActionSerializer, PrepayLoanActionSerializer,
    DisburseLoanActionSerializer,
    CreditCardStatementSerializer, CreditCardStatementWriteSerializer,
    PayStatementActionSerializer, ApplyChargesActionSerializer,
)
from .services import TreasuryService, TerminalBatchService
from .deletion_service import BankDeletionService
from .pos_service import POSService
from .reconciliation_service import ReconciliationService
from .matching_service import MatchingService
# from .rule_service import RuleService
from .difference_service import DifferenceService
from .reports_service import ReportsService
from contacts.models import Contact
from decimal import Decimal
from accounting.models import Account
from core.mixins import AuditHistoryMixin
from core.api.pagination import StandardResultsSetPagination


class BankViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    queryset = Bank.objects.all().order_by('name')
    serializer_class = BankSerializer

    @action(detail=True, methods=['get'])
    def overview(self, request, pk=None):
        """Centro de Bancos: vista unificada por banco (F5.2)."""
        from django.db.models import Sum, Q
        from datetime import date, timedelta
        bank = self.get_object()

        # Cuentas de tesorería del banco
        accounts = TreasuryAccount.objects.filter(bank=bank).order_by('account_type', 'name')
        accounts_data = []
        for acc in accounts:
            movements = acc.movements_from.all().aggregate(total=Sum('amount'))['total'] or 0
            movements += acc.movements_to.all().aggregate(total=Sum('amount'))['total'] or 0
            accounts_data.append({
                'id': acc.id,
                'name': acc.name,
                'account_type': acc.account_type,
                'account_type_display': acc.get_account_type_display(),
                'current_balance': float(acc.current_balance),
                'currency': acc.currency,
            })

        # Tarjetas de crédito del banco (cuentas CREDIT_CARD)
        card_accounts = accounts.filter(account_type=TreasuryAccount.Type.CREDIT_CARD)
        from .models import CreditCardStatement
        open_statements = CreditCardStatement.objects.filter(
            card_account__in=card_accounts,
            status__in=[CreditCardStatement.Status.OPEN, CreditCardStatement.Status.OVERDUE],
        ).order_by('due_date')
        card_debt = sum(
            (s.total_to_pay for s in open_statements),
            __import__('decimal').Decimal('0'),
        )

        # Cheques en cartera y propios girados
        from .models import Check
        portfolio_checks = Check.objects.filter(
            bank=bank, direction=Check.Direction.RECEIVED,
            status=Check.Status.IN_PORTFOLIO,
        ).aggregate(total=Sum('amount'))['total'] or 0
        issued_checks = Check.objects.filter(
            bank=bank, direction=Check.Direction.ISSUED,
            status=Check.Status.ISSUED,
        ).aggregate(total=Sum('amount'))['total'] or 0

        # Créditos activos
        from .models import BankLoan, LoanInstallment
        active_loans = BankLoan.objects.filter(
            lender=bank, status=BankLoan.Status.ACTIVE,
        )
        # `outstanding_balance` no es un campo de `BankLoan`: se computa como
        # la suma del `principal_amount` de las cuotas no pagadas ni anuladas
        # (mismo criterio que `BankLoanSerializer.get_outstanding_balance`).
        # Hacemos un único aggregate para evitar N+1.
        total_loan_debt = LoanInstallment.objects.filter(
            loan__in=active_loans,
        ).exclude(
            status__in=[LoanInstallment.Status.PAID, LoanInstallment.Status.CANCELED]
        ).aggregate(
            s=Sum('principal_amount'),
        )['s'] or __import__('decimal').Decimal('0')

        # Próximos vencimientos (cuotas, cheques, tarjetas) — horizonte 30 días
        today = timezone.now().date()
        horizon = today + timedelta(days=30)
        upcoming = []

        # Cuotas de préstamo
        upcoming_installments = LoanInstallment.objects.filter(
            loan__lender=bank,
            loan__status=BankLoan.Status.ACTIVE,
            status__in=[LoanInstallment.Status.PENDING, LoanInstallment.Status.OVERDUE],
            due_date__lte=horizon,
        ).select_related('loan').order_by('due_date')[:20]
        for inst in upcoming_installments:
            upcoming.append({
                'type': 'LOAN_INSTALLMENT',
                'label': f"Cuota #{inst.number} — {inst.loan.display_id}",
                'due_date': inst.due_date.isoformat(),
                'amount': float(inst.total_amount),
                'entity_id': inst.loan.id,
                'display_id': inst.loan.display_id,
            })

        # Cheques recibidos por vencer
        expiring_checks = Check.objects.filter(
            bank=bank, direction=Check.Direction.RECEIVED,
            status=Check.Status.IN_PORTFOLIO,
            due_date__lte=horizon,
        ).order_by('due_date')[:20]
        for ch in expiring_checks:
            upcoming.append({
                'type': 'CHECK',
                'label': f"Cheque {ch.check_number}",
                'due_date': ch.due_date.isoformat(),
                'amount': float(ch.amount),
                'entity_id': ch.id,
                'display_id': ch.display_id,
            })

        # Estados de cuenta de tarjeta por vencer
        upcoming_statements = CreditCardStatement.objects.filter(
            card_account__in=card_accounts,
            status__in=[CreditCardStatement.Status.OPEN, CreditCardStatement.Status.OVERDUE],
            due_date__lte=horizon,
        ).order_by('due_date')[:20]
        for stmt in upcoming_statements:
            upcoming.append({
                'type': 'CARD_STATEMENT',
                'label': f"Estado {stmt.period_month:02d}/{stmt.period_year}",
                'due_date': stmt.due_date.isoformat(),
                'amount': float(stmt.total_to_pay),
                'entity_id': stmt.id,
                'display_id': stmt.display_id,
            })

        upcoming.sort(key=lambda x: x['due_date'])

        return Response({
            'bank': BankSerializer(bank).data,
            'accounts': accounts_data,
            'summary': {
                'total_accounts': len(accounts_data),
                'card_count': card_accounts.count(),
                'card_debt': float(card_debt),
                'portfolio_checks': float(portfolio_checks),
                'issued_checks': float(issued_checks),
                'active_loan_count': active_loans.count(),
                'total_loan_debt': float(total_loan_debt),
            },
            'upcoming_maturities': upcoming,
        })

    @action(detail=True, methods=['post'])
    def archive(self, request, pk=None):
        """Archivo del banco: ``is_active = False`` (cf. ADR-0037).

        Valida dependencias activas con :class:`BankDeletionService`. Devuelve
        ``409 Conflict`` si el banco tiene préstamos vigentes o cheques
        pendientes.
        """
        bank = self.get_object()
        ok, reason = BankDeletionService.can_archive(bank)
        if not ok:
            return Response({'detail': reason}, status=status.HTTP_409_CONFLICT)
        bank.is_active = False
        bank.save(update_fields=['is_active', 'updated_at'])
        return Response(BankSerializer(bank).data)

    @action(detail=True, methods=['post'])
    def restore(self, request, pk=None):
        """Restaura un banco archivado (``is_active = True``)."""
        bank = self.get_object()
        bank.is_active = True
        bank.save(update_fields=['is_active', 'updated_at'])
        return Response(BankSerializer(bank).data)

    def destroy(self, request, *args, **kwargs):
        """Hard delete deshabilitado para usuarios finales.

        Por política (cf. [deletion-policy.md](../../../docs/20-contracts/deletion-policy.md))
        los bancos se archivan, no se borran. Este endpoint existe solo como
        fallback administrativo: captura ``ProtectedError`` y devuelve un
        mensaje legible en ``409 Conflict`` cuando hay dependencias.
        """
        bank = self.get_object()
        ok, reason = BankDeletionService.can_destroy(bank)
        if not ok:
            return Response({'detail': reason}, status=status.HTTP_409_CONFLICT)
        try:
            return super().destroy(request, *args, **kwargs)
        except Exception as exc:  # ProtectedError u otros
            return Response(
                {'detail': str(exc) or 'No se puede eliminar el banco.'},
                status=status.HTTP_409_CONFLICT,
            )


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
        if instance.bank_provisioned:
            return Response(
                {'detail': 'Este método de pago fue creado automáticamente al provisionar el banco. Gestiónelo desde el Centro de Bancos.'},
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


class TreasuryAccountFilterSet(FilterSet):
    name = django_filters.CharFilter(field_name='name', lookup_expr='icontains')
    account_type = django_filters.CharFilter(field_name='account_type', lookup_expr='exact')

    class Meta:
        model = TreasuryAccount
        fields = ['name', 'account_type']


class TreasuryAccountViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    queryset = TreasuryAccount.objects.all().order_by('account_type', 'name')
    serializer_class = TreasuryAccountSerializer
    filter_backends = [DjangoFilterBackend, drf_filters.SearchFilter]
    filterset_class = TreasuryAccountFilterSet
    search_fields = ['name']

    def get_queryset(self):
        qs = super().get_queryset().select_related('bank', 'account').prefetch_related('terminal_providers')
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
        if instance.bank_provisioned:
            return Response(
                {'detail': 'Esta cuenta fue creada automáticamente al provisionar el banco. Gestiónela desde el Centro de Bancos.'},
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

    @action(detail=False, methods=['post'])
    def provision(self, request):
        """Asistente de alta: crea una cuenta + sus métodos de pago (auto-provisión)."""
        from .provisioning_service import TreasuryProvisioningService
        try:
            account, _methods = TreasuryProvisioningService.provision_from_payload(
                request.data, created_by=request.user
            )
        except ValidationError as e:
            return Response({'detail': e.messages}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(account).data, status=status.HTTP_201_CREATED)


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
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, drf_filters.SearchFilter]
    search_fields = ['contact__name', 'contact__tax_id', 'reference', 'description']

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
        
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        if date_from:
            qs = qs.filter(date__gte=date_from)
        if date_to:
            qs = qs.filter(date__lte=date_to)

        # Amount range
        amount_min = self.request.query_params.get('amount_min')
        amount_max = self.request.query_params.get('amount_max')
        if amount_min:
            qs = qs.filter(amount__gte=amount_min)
        if amount_max:
            qs = qs.filter(amount__lte=amount_max)

        # Batch filtering (IsNull)
        terminal_batch_isnull = self.request.query_params.get('terminal_batch__isnull')
        if terminal_batch_isnull:
            val = terminal_batch_isnull.lower() == 'true'
            qs = qs.filter(terminal_batch__isnull=val)

        # Terminal provider filter (used by batch creation modal): restrict to
        # movements captured through devices owned by this provider. This excludes
        # cash payments and movements from other providers, even if they belong to
        # the same sale order (split payments).
        terminal_provider = self.request.query_params.get('terminal_provider')
        if terminal_provider:
            from django.db.models import Q
            qs = qs.filter(
                Q(terminal_device__provider_id=terminal_provider) |
                Q(payment_method_new__linked_terminal_device__provider_id=terminal_provider),
                payment_method_new__method_type=PaymentMethod.Type.CARD_TERMINAL,
            ).distinct()

        pm = self.request.query_params.get('payment_method_new')
        if pm:
            qs = qs.filter(payment_method_new_id=pm)

        direction = self.request.query_params.get('direction')
        if direction and treasury_account:
            from django.db.models import Q
            if direction == 'IN':
                # Inbound movements or Transfers where the selected account is the destination
                qs = qs.filter(
                    Q(movement_type='INBOUND') | 
                    Q(movement_type='TRANSFER', to_account_id=treasury_account) |
                    Q(movement_type='ADJUSTMENT', amount__gt=0) # Adjustments can be positive
                )
            elif direction == 'OUT':
                # Outbound movements or Transfers where the selected account is the source
                qs = qs.filter(
                    Q(movement_type='OUTBOUND') | 
                    Q(movement_type='TRANSFER', from_account_id=treasury_account) |
                    Q(movement_type='ADJUSTMENT', amount__lt=0) # Adjustments can be negative
                )

        return qs

    filterset_fields = [
        'is_reconciled', 
        'movement_type', 'payment_method', 'payment_method_new',
        'contact'
    ]

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if not request.user.is_staff:
            return Response(
                {'error': 'Solo administradores pueden purgar documentos cancelados.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            TreasuryService.validate_purge(instance)
        except ValidationError as e:
            msg = e.messages[0] if getattr(e, 'messages', None) else str(e)
            return Response({'error': msg}, status=status.HTTP_400_BAD_REQUEST)
        return super().destroy(request, *args, **kwargs)

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
            import traceback
            traceback.print_exc()
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
            import traceback
            traceback.print_exc()
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'], url_path='card-purchase')
    def card_purchase(self, request):
        """
        Crea una compra con tarjeta en N cuotas con interés
        explícito opcional (Onda 2, ADR-0043). Si el payload trae
        `installments > 1` o `monthly_rate > 0` y
        `from_account.account_type == CREDIT_CARD`, delega a
        `TreasuryService.create_card_purchase`; en cualquier otro
        caso, 400 con instrucción de usar POST regular.

        Body esperado:
          {
            "amount": "150000.00",
            "from_account": <id de cuenta CREDIT_CARD>,
            "installments": 3,
            "monthly_rate": "0.015",  # opcional
            "date": "2026-06-15",     # opcional, default hoy
            "partner": <id contacto>, # opcional
            "client_reference": "...", # opcional, idempotencia
            "notes": "..."            # opcional
          }

        Devuelve el `CardPurchaseGroup` con sus cuotas (lazy en
        `installments`).
        """
        from .models import CardPurchaseGroup
        from contacts.models import Contact

        data = request.data
        try:
            from_account_id = data.get('from_account')
            if not from_account_id:
                return Response(
                    {'error': 'from_account es requerido.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            try:
                from_account = TreasuryAccount.objects.get(pk=from_account_id)
            except TreasuryAccount.DoesNotExist:
                return Response(
                    {'error': 'from_account no existe.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if from_account.account_type != TreasuryAccount.Type.CREDIT_CARD:
                return Response(
                    {'error': 'card-purchase requiere from_account de tipo CREDIT_CARD.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            partner = None
            partner_id = data.get('partner')
            if partner_id:
                try:
                    partner = Contact.objects.get(pk=partner_id)
                except Contact.DoesNotExist:
                    return Response(
                        {'error': 'partner no existe.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            installments = int(data.get('installments', 1))
            monthly_rate = data.get('monthly_rate', '0') or '0'
            amount = data.get('amount', '0')
            date_value = data.get('date')
            if date_value and isinstance(date_value, str):
                from datetime import date as _date
                date_value = _date.fromisoformat(date_value)

            # Resolve invoice / sale_order / purchase_order for accounting entries
            invoice = None
            invoice_id = data.get('invoice')
            if invoice_id:
                from billing.models import Invoice
                invoice = Invoice.objects.filter(pk=invoice_id).first()

            sale_order = None
            sale_order_id = data.get('sale_order')
            if sale_order_id:
                from sales.models import SaleOrder
                sale_order = SaleOrder.objects.filter(pk=sale_order_id).first()

            purchase_order = None
            purchase_order_id = data.get('purchase_order')
            if purchase_order_id:
                from purchasing.models import PurchaseOrder
                purchase_order = PurchaseOrder.objects.filter(pk=purchase_order_id).first()

            group = TreasuryService.create_card_purchase(
                amount=amount,
                card_account=from_account,
                installments=installments,
                monthly_rate=monthly_rate,
                date=date_value,
                partner=partner,
                invoice=invoice,
                sale_order=sale_order,
                purchase_order=purchase_order,
                client_reference=data.get('client_reference', '') or '',
                notes=data.get('notes', '') or '',
                created_by=request.user,
            )
            # Devolver el grupo + el movimiento del uso + el cronograma
            # de cuotas (ADR-0046). `installments` es ahora el cronograma
            # (filas planas), no N movimientos.
            schedule_data = [
                {
                    'number': inst.number,
                    'due_date': inst.due_date.isoformat(),
                    'principal_amount': str(inst.principal_amount),
                    'is_billed': inst.is_billed,
                }
                for inst in group.schedule.all().order_by('number')
            ]
            use_movement = group.movements.order_by('id').first()
            return Response(
                {
                    'group': {
                        'uuid': str(group.uuid),
                        'display_id': group.display_id,
                        'card_account': from_account.id,
                        'total_amount': str(group.total_amount),
                        'installments': group.installments,
                        'monthly_rate': str(group.monthly_rate),
                        'first_installment_date': group.first_installment_date.isoformat(),
                        'client_reference': group.client_reference,
                        'total_interest': str(group.total_interest),
                        'total_payable': str(group.total_payable),
                    },
                    'movement': (
                        TreasuryMovementSerializer(use_movement).data
                        if use_movement else None
                    ),
                    'installments': schedule_data,
                },
                status=status.HTTP_201_CREATED,
            )
        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        movement = self.get_object()
        reason = request.data.get('reason', '')
        try:
            movement = TreasuryService.cancel_movement(movement, user=request.user, reason=reason)
            return Response(TreasuryMovementSerializer(movement).data)
        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'])
    def cancel_impact(self, request, pk=None):
        movement = self.get_object()
        try:
            return Response({
                'document_type': 'TreasuryMovement',
                'document_id': movement.id,
                'display_id': movement.display_id,
                'status': movement.status,
                'is_cancellable': movement.status == TreasuryMovement.MovementStatus.DRAFT,
                'warning': '',
            })
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    def annul(self, request, pk=None):
        movement = self.get_object()
        reason = request.data.get('reason', '')
        try:
            movement = TreasuryService.annul_movement(movement, user=request.user, reason=reason)
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

    @action(detail=True, methods=['post'])
    def allocate(self, request, pk=None):
        """S5.2: Set partial allocations for a payment"""
        movement = self.get_object()
        allocations_data = request.data.get('allocations')
        
        # Determine if we should validate the sum. For S5, the rule is to allow draft state
        # in some contexts, but usually we validate strict sum. We'll allow a query param.
        # Although the roadmap says 'permisivo', let's default to permissive during the dialog,
        # but the frontend sends them incrementally. Wait, the frontend dialog sends all splits at once.
        validate_sum = request.query_params.get('validate_sum', 'false').lower() == 'true'
        
        if not allocations_data or not isinstance(allocations_data, list):
            return Response(
                {'error': 'Debe proveer una lista de "allocations"'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        try:
            from treasury.allocation_service import AllocationService
            created = AllocationService.allocate(
                movement=movement,
                allocations=allocations_data,
                user=request.user,
                validate_sum=validate_sum
            )
            return Response(
                PaymentAllocationSerializer(created, many=True).data,
                status=status.HTTP_201_CREATED
            )
        except ValidationError as e:
            # e.messages is a list if it comes from django ValidationError
            err = e.message if hasattr(e, 'message') else str(e)
            return Response({'error': err}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'])
    def allocations(self, request, pk=None):
        """S5.2: Get allocations for a payment"""
        try:
            from treasury.allocation_service import AllocationService
            allocs = AllocationService.get_allocations(pk)
            return Response(PaymentAllocationSerializer(allocs, many=True).data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class BankStatementViewSet(viewsets.ModelViewSet):
    """ViewSet for managing bank statements"""
    queryset = BankStatement.objects.all().select_related('treasury_account', 'imported_by')
    filterset_fields = ['status', 'treasury_account']

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
        """S4.8: Kicks off async auto-match, returns task_id for polling."""
        from .tasks import auto_match_statement_task
        try:
            threshold = float(request.data.get('confidence_threshold', 90.0))
            task = auto_match_statement_task.delay(int(pk), threshold)
            return Response({'task_id': task.id, 'status': 'PENDING'})
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'])
    def auto_match_status(self, request, pk=None):
        """S4.8: Poll the progress of an ongoing auto_match task."""
        task_id = request.query_params.get('task_id')
        if not task_id:
            return Response({'error': 'task_id requerido'}, status=status.HTTP_400_BAD_REQUEST)

        task = AsyncResult(task_id)

        if task.state == 'PENDING':
            return Response({'status': 'PENDING', 'processed': 0, 'total': 0, 'matched': 0, 'percent': 0})

        if task.state == 'PROGRESS':
            meta = task.info or {}
            return Response({
                'status': 'PROGRESS',
                'processed': meta.get('processed', 0),
                'total': meta.get('total', 0),
                'matched': meta.get('matched', 0),
                'percent': meta.get('percent', 0),
            })

        if task.state == 'SUCCESS':
            result = task.result or {}
            return Response({
                'status': 'SUCCESS',
                'matched_count': result.get('matched_count', 0),
                'total_unreconciled': result.get('total_unreconciled', 0),
                'percent': 100,
            })

        if task.state == 'FAILURE':
            return Response(
                {'status': 'FAILURE', 'error': str(task.info)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return Response({'status': task.state})

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
    queryset = BankStatementLine.objects.all().select_related('statement', 'reconciled_by')
    serializer_class = BankStatementLineSerializer
    pagination_class = StandardResultsSetPagination
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filter by statement if provided
        statement_id = self.request.query_params.get('statement')
        if statement_id:
            queryset = queryset.filter(statement_id=statement_id)
        
        # Filter by reconciliation status
        reconciliation_status = self.request.query_params.get('reconciliation_status') or self.request.query_params.get('reconciliation_state')
        if reconciliation_status:
            if ',' in reconciliation_status:
                queryset = queryset.filter(reconciliation_status__in=reconciliation_status.split(','))
            else:
                queryset = queryset.filter(reconciliation_status=reconciliation_status)
        
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        if date_from:
            queryset = queryset.filter(transaction_date__gte=date_from)
        if date_to:
            queryset = queryset.filter(transaction_date__lte=date_to)

        amount_min = self.request.query_params.get('amount_min')
        amount_max = self.request.query_params.get('amount_max')
        if amount_min:
            from django.db.models import Q
            queryset = queryset.filter(Q(credit__gte=amount_min) | Q(debit__gte=amount_min))
        if amount_max:
            from django.db.models import Q
            queryset = queryset.filter(Q(credit__lte=amount_max) | Q(debit__lte=amount_max))

        search = self.request.query_params.get('search')
        if search:
            from django.db.models import Q
            queryset = queryset.filter(Q(description__icontains=search) | Q(reference__icontains=search))

        direction = self.request.query_params.get('direction')
        if direction == 'IN':
            queryset = queryset.filter(credit__gt=0)
        elif direction == 'OUT':
            queryset = queryset.filter(debit__gt=0)
        
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
            accounting_date = request.data.get('accounting_date')
            
            if difference_type and line.difference_amount != 0:
                DifferenceService.create_difference_adjustment(
                    line, difference_type, request.user, notes, accounting_date
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


class ReconciliationSettingsViewSet(viewsets.ModelViewSet):
    """ViewSet for reconciliation settings"""
    queryset = ReconciliationSettings.objects.all().select_related('treasury_account')
    serializer_class = ReconciliationSettingsSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        account_id = self.request.query_params.get('treasury_account')
        if account_id:
            qs = qs.filter(treasury_account_id=account_id)
        return qs

    @action(detail=False, methods=['get'])
    def for_account(self, request):
        """Always returns the global settings singleton."""
        settings, _ = ReconciliationSettings.objects.get_or_create(treasury_account=None)
        return Response(ReconciliationSettingsSerializer(settings).data)


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


class CheckViewSet(viewsets.ModelViewSet):
    """CRUD + transiciones de estado para cheques recibidos."""
    from .serializers import CheckSerializer
    from .models import Check as CheckModel

    serializer_class = CheckSerializer
    filterset_fields = ['status', 'direction', 'bank', 'counterparty']

    def get_queryset(self):
        from .models import Check as CheckModel
        qs = CheckModel.objects.select_related(
            'bank', 'counterparty', 'portfolio_account', 'deposit_account'
        )
        due_before = self.request.query_params.get('due_before')
        if due_before:
            qs = qs.filter(due_date__lte=due_before)
        return qs.order_by('due_date', '-id')

    def perform_create(self, serializer):
        from .check_service import CheckService
        data = self.request.data
        check = CheckService.receive(
            bank_id=data['bank'],
            check_number=data['check_number'],
            amount=data['amount'],
            issue_date=data['issue_date'],
            due_date=data['due_date'],
            counterparty_id=data.get('counterparty'),
            drawer_name=data.get('drawer_name', ''),
            notes=data.get('notes', ''),
            invoice_id=data.get('invoice'),
            sale_order_id=data.get('sale_order'),
            created_by=self.request.user,
        )
        serializer.instance = check

    @action(detail=True, methods=['post'])
    def deposit(self, request, pk=None):
        from .check_service import CheckService
        check = self.get_object()
        try:
            deposit_account = TreasuryAccount.objects.get(pk=request.data['deposit_account'])
            check = CheckService.deposit(check, deposit_account, created_by=request.user)
        except (ValidationError, TreasuryAccount.DoesNotExist, KeyError) as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(check).data)

    @action(detail=True, methods=['post'])
    def clear(self, request, pk=None):
        from .check_service import CheckService
        check = self.get_object()
        try:
            check = CheckService.clear(check)
        except ValidationError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(check).data)

    @action(detail=True, methods=['post'])
    def bounce(self, request, pk=None):
        from .check_service import CheckService
        check = self.get_object()
        try:
            check = CheckService.bounce(check, notes=request.data.get('notes', ''), created_by=request.user)
        except ValidationError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(check).data)

    @action(detail=True, methods=['post'])
    def void(self, request, pk=None):
        from .check_service import CheckService
        check = self.get_object()
        try:
            check = CheckService.void(check, notes=request.data.get('notes', ''))
        except ValidationError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(check).data)

    @action(detail=False, methods=['get'])
    def portfolio(self, request):
        from .check_service import CheckService
        bank_id = request.query_params.get('bank')
        summary = CheckService.get_portfolio_summary(bank_id=bank_id)
        data = self.get_serializer(summary['checks'], many=True).data
        return Response({'checks': data, 'total': summary['total']})

    @action(detail=False, methods=['get'])
    def in_transit(self, request):
        from .check_service import CheckService
        bank_id = request.query_params.get('bank')
        summary = CheckService.get_in_transit_summary(bank_id=bank_id)
        data = self.get_serializer(summary['checks'], many=True).data
        return Response({'checks': data, 'total': summary['total']})


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

    @action(detail=False, methods=['get'])
    def future_maturities(self, request):
        """
        Vencimientos futuros para proyección de flujo de caja (F5.3).
        Query params: days_ahead (default 90), treasury_account (optional).
        """
        from datetime import timedelta
        from django.db.models import Sum
        days = int(request.query_params.get('days_ahead', 90))
        today = timezone.now().date()
        horizon = today + timedelta(days=days)
        treasury_account_id = request.query_params.get('treasury_account')

        items = []

        # Cuotas de préstamo pendientes
        installments_qs = LoanInstallment.objects.filter(
            status__in=[LoanInstallment.Status.PENDING, LoanInstallment.Status.OVERDUE],
            due_date__gte=today,
            due_date__lte=horizon,
        ).select_related('loan', 'loan__lender')
        if treasury_account_id:
            installments_qs = installments_qs.filter(
                loan__disbursement_account_id=treasury_account_id
            )
        for inst in installments_qs:
            items.append({
                'type': 'LOAN_INSTALLMENT',
                'direction': 'OUTBOUND',
                'label': f"Cuota #{inst.number} — {inst.loan.display_id}",
                'due_date': inst.due_date.isoformat(),
                'amount': float(inst.total_amount),
                'account_id': inst.loan.disbursement_account_id,
            })

        # Cheques recibidos en cartera por vencer
        checks_qs = Check.objects.filter(
            direction=Check.Direction.RECEIVED,
            status=Check.Status.IN_PORTFOLIO,
            due_date__gte=today,
            due_date__lte=horizon,
        )
        if treasury_account_id:
            checks_qs = checks_qs.filter(deposit_account_id=treasury_account_id)
        for ch in checks_qs:
            items.append({
                'type': 'CHECK_RECEIVED',
                'direction': 'INBOUND',
                'label': f"Cheque {ch.check_number} — {ch.display_id}",
                'due_date': ch.due_date.isoformat(),
                'amount': float(ch.amount),
                'account_id': ch.deposit_account_id,
            })

        # Cheques propios girados por vencer
        issued_checks_qs = Check.objects.filter(
            direction=Check.Direction.ISSUED,
            status=Check.Status.ISSUED,
            due_date__gte=today,
            due_date__lte=horizon,
        )
        if treasury_account_id:
            issued_checks_qs = issued_checks_qs.filter(payment_account_id=treasury_account_id)
        for ch in issued_checks_qs:
            items.append({
                'type': 'CHECK_ISSUED',
                'direction': 'OUTBOUND',
                'label': f"Cheque propio {ch.check_number} — {ch.display_id}",
                'due_date': ch.due_date.isoformat(),
                'amount': float(ch.amount),
                'account_id': ch.payment_account_id,
            })

        # Estados de cuenta de tarjeta por vencer
        statements_qs = CreditCardStatement.objects.filter(
            status__in=[CreditCardStatement.Status.OPEN, CreditCardStatement.Status.OVERDUE],
            due_date__gte=today,
            due_date__lte=horizon,
        ).select_related('card_account')
        if treasury_account_id:
            statements_qs = statements_qs.filter(card_account_id=treasury_account_id)
        for stmt in statements_qs:
            items.append({
                'type': 'CARD_STATEMENT',
                'direction': 'OUTBOUND',
                'label': f"Estado tarjeta {stmt.period_month:02d}/{stmt.period_year} — {stmt.display_id}",
                'due_date': stmt.due_date.isoformat(),
                'amount': float(stmt.total_to_pay),
                'account_id': stmt.card_account_id,
            })

        items.sort(key=lambda x: x['due_date'])

        # Aggregate by month for the projection
        from collections import defaultdict
        monthly = defaultdict(lambda: {'inbound': 0, 'outbound': 0})
        for item in items:
            month_key = item['due_date'][:7]  # YYYY-MM
            if item['direction'] == 'INBOUND':
                monthly[month_key]['inbound'] += item['amount']
            else:
                monthly[month_key]['outbound'] += item['amount']

        return Response({
            'items': items,
            'monthly_summary': [
                {'month': k, 'inbound': v['inbound'], 'outbound': v['outbound'], 'net': v['inbound'] - v['outbound']}
                for k, v in sorted(monthly.items())
            ],
        })

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
            payment_method_id = data.get('payment_method')
            sales_date = data.get('sales_date')
            sales_date_end = data.get('sales_date_end')
            gross_amount = Decimal(str(data.get('gross_amount')))
            commission_base = Decimal(str(data.get('commission_base', 0)))
            commission_tax = Decimal(str(data.get('commission_tax', 0)))
            net_amount = Decimal(str(data.get('net_amount')))
            terminal_reference = data.get('terminal_reference', '')
            
            provider = PaymentTerminalProvider.objects.get(pk=provider_id)
            payment_method = PaymentMethod.objects.get(pk=payment_method_id)
            movement_ids = data.get('movement_ids', None)
            
            batch = TerminalBatchService.create_batch(
                provider=provider,
                payment_method=payment_method,
                sales_date=sales_date,
                sales_date_end=sales_date_end,
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


# ── F2.11: Créditos bancarios (BankLoan + LoanInstallment) ──────────────────


class BankLoanViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    """CRUD + acciones de lifecycle para créditos bancarios (Fase 2).

    Acciones custom:
      - POST /loans/{id}/disburse/  → desembolsar (idempotente si ya ACTIVE).
      - POST /loans/{id}/prepay/    → pago total anticipado.
      - POST /loans/{id}/refinance/ → marca REFINANCED (no paga, sólo cierra).
      - GET  /loans/{id}/schedule/  → preview de tabla de amortización sin
        persistir (útil al registrar el crédito).
      - GET  /loans/{id}/amortization_table/ → tabla persistida con cuotas.
    """
    from .models import BankLoan
    from .serializers import BankLoanSerializer as _BLRead

    serializer_class = BankLoanSerializer
    filterset_fields = ['status', 'currency', 'lender', 'amortization_system']

    def get_queryset(self):
        from .models import BankLoan
        return (BankLoan.objects
                .select_related(
                    'lender', 'disbursement_account', 'liability_account',
                    'created_by',
                )
                .prefetch_related('installments')
                .order_by('-start_date', '-id'))

    def get_serializer_class(self):
        from .serializers import BankLoanSerializer, BankLoanWriteSerializer
        if self.action in ('create', 'update', 'partial_update'):
            return BankLoanWriteSerializer
        return BankLoanSerializer

    def perform_create(self, serializer):
        from .models import BankLoan
        from django.core.exceptions import ValidationError as DjangoValidationError
        from .loan_provisioning import get_or_create_loan_treasury_account

        # El write serializer expone `liability_account` apuntando a
        # `Account` (cuenta contable), no a `TreasuryAccount`. Aquí
        # resolvemos/creamos la wrapper LOAN correspondiente y la
        # inyectamos en `validated_data` para que el `save()` del
        # ModelSerializer asigne la FK correcta del modelo.
        validated = serializer.validated_data
        accounting_account = validated.get('liability_account')
        if accounting_account is not None:
            # Necesitamos `loan.lender` para resolver; pero todavía no
            # tenemos `loan`. Usamos el `lender` validado directamente.
            from .models import Bank
            lender = validated.get('lender')
            if not isinstance(lender, Bank):
                lender = Bank.objects.get(pk=lender)
            try:
                ta = get_or_create_loan_treasury_account(
                    bank=lender,
                    accounting_account=accounting_account,
                    currency=validated.get('currency', 'CLP'),
                )
            except DjangoValidationError as e:
                # Si la cuenta contable ya está usada por otro tipo de TA,
                # devolvemos 400 con detalle legible.
                msg = e.message_dict if hasattr(e, 'message_dict') else (
                    e.messages if hasattr(e, 'messages') else [str(e)]
                )
                raise drf_serializers.ValidationError({'liability_account': msg})
            validated['liability_account'] = ta

        try:
            loan = serializer.save(created_by=self.request.user)
        except DjangoValidationError as e:
            raise drf_serializers.ValidationError(e.message_dict if hasattr(e, 'message_dict') else e.messages)

        # Devolver el objeto hidratado al serializer de lectura.
        self._just_created = loan

    def create(self, request, *args, **kwargs):
        write_serializer = self.get_serializer(data=request.data)
        write_serializer.is_valid(raise_exception=True)
        self.perform_create(write_serializer)
        read_serializer = BankLoanSerializer(self._just_created, context={'request': request})
        return Response(read_serializer.data, status=status.HTTP_201_CREATED)

    def perform_update(self, serializer):
        from django.core.exceptions import ValidationError as DjangoValidationError
        try:
            serializer.save()
        except DjangoValidationError as e:
            raise drf_serializers.ValidationError(e.message_dict if hasattr(e, 'message_dict') else e.messages)

    @action(detail=True, methods=['post'])
    def disburse(self, request, pk=None):
        from .loan_service import LoanService
        from decimal import Decimal
        loan = self.get_object()
        payload = DisburseLoanActionSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        v = payload.validated_data
        try:
            loan = LoanService.disburse(
                loan,
                date=v.get('date'),
                opening_fee_override=(
                    Decimal(str(v['opening_fee'])) if v.get('opening_fee') is not None else None
                ),
                stamp_tax_override=(
                    Decimal(str(v['stamp_tax'])) if v.get('stamp_tax') is not None else None
                ),
                commission_expense_account=v.get('commission_expense_account'),
                stamp_tax_expense_account=v.get('stamp_tax_expense_account'),
                created_by=request.user,
            )
        except ValidationError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        # Refrescar para invalidar el prefetch de installments.
        loan.refresh_from_db()
        return Response(self.get_serializer(loan).data)

    @action(detail=True, methods=['post'])
    def prepay(self, request, pk=None):
        from .loan_service import LoanService
        from .models import TreasuryAccount
        loan = self.get_object()
        payload = PrepayLoanActionSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        v = payload.validated_data
        try:
            payment_account = TreasuryAccount.objects.get(pk=v['payment_account'])
        except TreasuryAccount.DoesNotExist:
            return Response(
                {'detail': 'payment_account no existe.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        interest_exp = v.get('interest_expense_account')
        insurance_exp = v.get('insurance_expense_account')
        try:
            loan = LoanService.prepay(
                loan,
                payment_account=payment_account,
                interest_expense_account=interest_exp,
                insurance_expense_account=insurance_exp,
                date=v.get('date'),
                created_by=request.user,
                insurance_amount=v.get('insurance_amount'),
                tax_amount=v.get('tax_amount'),
                penalty_amount=v.get('penalty_amount'),
            )
        except ValidationError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        loan.refresh_from_db()
        return Response(self.get_serializer(loan).data)

    @action(detail=True, methods=['get'])
    def schedule(self, request, pk=None):
        """Preview de la tabla de amortización SIN persistir."""
        from decimal import Decimal
        from .loan_service import _add_months
        loan = self.get_object()
        if loan.installments.exists():
            return Response(
                {'detail': 'El crédito ya tiene una tabla generada. Use GET amortization_table.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Calcular in-memory (mismo algoritmo que generate_schedule).
        if loan.rate_basis == loan.RateBasis.MONTHLY:
            i = (loan.interest_rate / Decimal('100'))
        else:
            i = (loan.interest_rate / Decimal('100')) / Decimal('12')
        if i <= 0:
            i = Decimal('0')
        n = loan.term_months
        P = loan.principal
        ins = loan.insurance_monthly or Decimal('0')
        # Calcular cuota francesa fija.
        if i == 0:
            C = P / Decimal(n)
        else:
            C = P * i / (Decimal(1) - (Decimal(1) + i) ** (-n))
        rows = []
        balance = P
        for k in range(1, n + 1):
            interest = (balance * i).quantize(Decimal('0.01'))
            principal = (C - interest).quantize(Decimal('0.01'))
            if k == n:  # última cuota: ajuste de redondeo
                principal = balance
            total = principal + interest + ins
            balance = (balance - principal).quantize(Decimal('0.01'))
            rows.append({
                'number': k,
                'due_date': _add_months(loan.first_due_date, k - 1).isoformat(),
                'principal_amount': str(principal),
                'interest_amount': str(interest),
                'insurance_amount': str(ins),
                'total_amount': str(total),
                'outstanding_balance': str(balance),
            })
        return Response({
            'currency': loan.currency,
            'monthly_rate': str(i),
            'installments': rows,
        })

    @action(detail=True, methods=['get'])
    def amortization_table(self, request, pk=None):
        loan = self.get_object()
        return Response(self.get_serializer(loan).data)


class LoanInstallmentViewSet(viewsets.ModelViewSet):
    """Listado y pago de cuotas. Creación/edición no expuestas (se generan
    vía `BankLoan.generate_schedule` y se cierran vía acciones de pago)."""
    from .models import LoanInstallment
    serializer_class = LoanInstallmentSerializer
    filterset_fields = ['status', 'loan']
    http_method_names = ['get', 'post', 'head', 'options']  # sin PUT/DELETE

    def get_queryset(self):
        from .models import LoanInstallment
        return (LoanInstallment.objects
                .select_related('loan', 'loan__lender', 'payment_movement')
                .order_by('loan', 'number'))

    @action(detail=True, methods=['post'])
    def pay(self, request, pk=None):
        from .loan_service import LoanService
        from .models import TreasuryAccount
        from accounting.models import Account
        installment = self.get_object()
        payload = PayInstallmentActionSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        v = payload.validated_data
        try:
            payment_account = TreasuryAccount.objects.get(pk=v['payment_account'])
        except TreasuryAccount.DoesNotExist:
            return Response(
                {'detail': 'payment_account no existe.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        interest_exp = None
        insurance_exp = None
        if v.get('interest_expense_account'):
            try:
                interest_exp = Account.objects.get(pk=v['interest_expense_account'])
            except Account.DoesNotExist:
                return Response(
                    {'detail': 'interest_expense_account no existe.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        if v.get('insurance_expense_account'):
            try:
                insurance_exp = Account.objects.get(pk=v['insurance_expense_account'])
            except Account.DoesNotExist:
                return Response(
                    {'detail': 'insurance_expense_account no existe.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        try:
            installment = LoanService.pay_installment(
                installment.loan,
                installment,
                payment_account=payment_account,
                interest_expense_account=interest_exp,
                insurance_expense_account=insurance_exp,
                date=v.get('date'),
                created_by=request.user,
                principal_amount=v.get('principal_amount'),
                interest_amount=v.get('interest_amount'),
                insurance_amount=v.get('insurance_amount'),
                tax_amount=v.get('tax_amount'),
                penalty_amount=v.get('penalty_amount'),
            )
        except ValidationError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(installment).data)


# ── F3.5: Tarjeta de crédito propia — estados de cuenta ─────────────────────


class CreditCardStatementViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    """CRUD + acciones de lifecycle para estados de cuenta de tarjeta de crédito propia.

    Acciones custom:
      - POST /card-statements/{id}/pay/          → pagar desde una cuenta bancaria.
      - POST /card-statements/{id}/apply-charges/ → imputar interés/comisiones.
      - POST /card-statements/{id}/cancel/       → anular un statement OPEN.
    """
    from .models import CreditCardStatement

    serializer_class = CreditCardStatementSerializer
    filterset_fields = ['status', 'card_account', 'period_year', 'period_month']

    def get_queryset(self):
        from .models import CreditCardStatement
        qs = CreditCardStatement.objects.select_related(
            'card_account', 'payment_account', 'payment_movement', 'created_by'
        ).order_by('-period_year', '-period_month', '-id')
        bank_id = self.request.query_params.get('bank')
        if bank_id:
            qs = qs.filter(card_account__bank_id=bank_id)
        return qs

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return CreditCardStatementWriteSerializer
        return CreditCardStatementSerializer

    def perform_create(self, serializer):
        from django.core.exceptions import ValidationError as DjangoValidationError
        try:
            stmt = serializer.save(created_by=self.request.user)
        except DjangoValidationError as e:
            raise drf_serializers.ValidationError(e.message_dict if hasattr(e, 'message_dict') else e.messages)
        self._just_created = stmt

    def create(self, request, *args, **kwargs):
        write_serializer = self.get_serializer(data=request.data)
        write_serializer.is_valid(raise_exception=True)
        self.perform_create(write_serializer)
        read_serializer = CreditCardStatementSerializer(self._just_created, context={'request': request})
        return Response(read_serializer.data, status=status.HTTP_201_CREATED)

    def perform_update(self, serializer):
        from django.core.exceptions import ValidationError as DjangoValidationError
        try:
            serializer.save()
        except DjangoValidationError as e:
            raise drf_serializers.ValidationError(e.message_dict if hasattr(e, 'message_dict') else e.messages)

    @action(detail=True, methods=['post'])
    def pay(self, request, pk=None):
        from .card_service import CardService
        from .models import TreasuryAccount
        stmt = self.get_object()
        payload = PayStatementActionSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        v = payload.validated_data
        try:
            payment_account = TreasuryAccount.objects.get(pk=v['payment_account'])
        except TreasuryAccount.DoesNotExist:
            return Response(
                {'detail': 'payment_account no existe.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            stmt = CardService.pay_statement(
                stmt,
                payment_account=payment_account,
                amount=v.get('amount'),
                date=v.get('date'),
                created_by=request.user,
            )
        except ValidationError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        stmt.refresh_from_db()
        return Response(self.get_serializer(stmt).data)

    @action(detail=True, methods=['post'], url_path='apply-charges')
    def apply_charges(self, request, pk=None):
        from .card_service import CardService
        from accounting.models import Account
        stmt = self.get_object()
        payload = ApplyChargesActionSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        v = payload.validated_data
        interest_exp = None
        fees_exp = None
        if v.get('interest_expense_account'):
            try:
                interest_exp = Account.objects.get(pk=v['interest_expense_account'])
            except Account.DoesNotExist:
                return Response(
                    {'detail': 'interest_expense_account no existe.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        if v.get('fees_expense_account'):
            try:
                fees_exp = Account.objects.get(pk=v['fees_expense_account'])
            except Account.DoesNotExist:
                return Response(
                    {'detail': 'fees_expense_account no existe.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        try:
            stmt = CardService.apply_charges(
                stmt,
                interest_expense_account=interest_exp,
                fees_expense_account=fees_exp,
                created_by=request.user,
            )
        except ValidationError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        stmt.refresh_from_db()
        return Response(self.get_serializer(stmt).data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Anula el estado de cuenta: revierte la facturación de cargos/cuotas
        y marca como CANCELED. Solo disponible si no está pagado."""
        from .card_service import CardService
        stmt = self.get_object()
        if stmt.status == 'PAID':
            return Response(
                {'detail': 'No se puede anular un estado de cuenta pagado.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        notes = request.data.get('notes', '')
        try:
            stmt = CardService.reverse_statement(stmt, notes=notes)
        except ValidationError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        stmt.refresh_from_db()
        return Response(self.get_serializer(stmt).data)

    @action(detail=True, methods=['post'], url_path='recalculate')
    def recalculate(self, request, pk=None):
        """Recalcula `billed_amount` agregando los OUTBOUND del período (Gap 1.2)."""
        from .card_service import CardService
        stmt = self.get_object()
        try:
            new_amount = CardService.recalculate_billed_amount(stmt)
        except ValidationError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        stmt.refresh_from_db()
        return Response(self.get_serializer(stmt).data)

    @action(detail=True, methods=['post'], url_path='reapply-charges')
    def reapply_charges(self, request, pk=None):
        """Reversa el cargo actual y vuelve a imputarlo (Gap 1.4)."""
        from .card_service import CardService
        from accounting.models import Account
        stmt = self.get_object()
        payload = ApplyChargesActionSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        v = payload.validated_data
        interest_exp = None
        fees_exp = None
        if v.get('interest_expense_account'):
            try:
                interest_exp = Account.objects.get(pk=v['interest_expense_account'])
            except Account.DoesNotExist:
                return Response(
                    {'detail': 'interest_expense_account no existe.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        if v.get('fees_expense_account'):
            try:
                fees_exp = Account.objects.get(pk=v['fees_expense_account'])
            except Account.DoesNotExist:
                return Response(
                    {'detail': 'fees_expense_account no existe.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        try:
            stmt = CardService.reapply_charges(
                stmt,
                interest_expense_account=interest_exp,
                fees_expense_account=fees_exp,
                created_by=request.user,
            )
        except ValidationError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        stmt.refresh_from_db()
        return Response(self.get_serializer(stmt).data)

    @action(detail=False, methods=['get'], url_path='unbilled-charges')
    def unbilled_charges(self, request):
        """Lista cargos no facturados de una tarjeta de crédito."""
        from .card_service import CardService
        from .models import TreasuryAccount, TreasuryMovement
        from datetime import date as _date_type
        from django.db.models import OuterRef, Subquery, IntegerField, CharField

        card_account_id = request.query_params.get('card_account')
        if not card_account_id:
            return Response(
                {'detail': 'card_account es requerido.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            card_account = TreasuryAccount.objects.get(pk=card_account_id)
        except TreasuryAccount.DoesNotExist:
            return Response(
                {'detail': 'card_account no existe.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if card_account.account_type != TreasuryAccount.Type.CREDIT_CARD:
            return Response(
                {'detail': 'La cuenta debe ser de tipo Tarjeta de Crédito.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cut_off_date_str = request.query_params.get('cut_off_date')
        cut_off_date = _date_type.fromisoformat(cut_off_date_str) if cut_off_date_str else None

        pending = CardService.get_pending_charges(card_account, cut_off_date=cut_off_date)
        summary = CardService.get_unbilled_summary(card_account, cut_off_date=cut_off_date)
        installments = CardService.get_unbilled_installments(card_account, cut_off_date=cut_off_date)

        # Anotar purchase_order_id y display_id desde el TreasuryMovement OUTBOUND asociado.
        po_subq = Subquery(
            TreasuryMovement.objects.filter(
                card_purchase_group=OuterRef('card_purchase_group'),
                movement_type=TreasuryMovement.Type.OUTBOUND,
            ).values('purchase_order_id')[:1],
            output_field=IntegerField(),
        )
        po_number_subq = Subquery(
            TreasuryMovement.objects.filter(
                card_purchase_group=OuterRef('card_purchase_group'),
                movement_type=TreasuryMovement.Type.OUTBOUND,
            ).values('purchase_order__number')[:1],
            output_field=CharField(max_length=20),
        )
        installments = installments.annotate(po_id=po_subq, po_display_number=po_number_subq)

        # Próximas cuotas del cronograma (ADR-0046): filas planas.
        installments_data = [
            {
                'id': inst.id,
                'number': inst.number,
                'due_date': inst.due_date.isoformat(),
                'principal_amount': str(inst.principal_amount),
                'group_id': inst.card_purchase_group_id,
                'group_uuid': str(inst.card_purchase_group.uuid),
                'group_display_id': inst.card_purchase_group.display_id,
                'purchase_order_id': inst.po_id,
                'purchase_order_display_id': f"OCS-{inst.po_display_number}" if inst.po_display_number else None,
                'partner_name': (
                    inst.card_purchase_group.partner.name
                    if inst.card_purchase_group.partner else None
                ),
                'total_installments': inst.card_purchase_group.installments,
            }
            for inst in installments
        ]

        # Cargos pendientes (CardPendingCharge) serializados.
        from .serializers import CardPendingChargeSerializer
        charges_data = []

        for p in CardPendingChargeSerializer(pending, many=True).data:
            charges_data.append({
                'id': p['id'],
                'amount': str(p['amount']),
                'date': p['date'].isoformat() if hasattr(p['date'], 'isoformat') else p['date'],
                'charge_type': p['charge_type'],
                'charge_type_display': p['charge_type_display'],
                'description': p.get('description', ''),
                'reference': '',
                'source': 'pending',
                'from_account_name': None,
                'partner_name': None,
            })

        return Response({
            'charges': charges_data,
            'upcoming_installments': installments_data,
            'summary': summary,
        })

    @action(detail=False, methods=['post'], url_path='add-charge')
    def add_charge(self, request):
        """Agrega un cargo no facturado a una tarjeta de crédito."""
        from .card_service import CardService
        from .models import TreasuryAccount
        from datetime import date as _date

        card_account_id = request.data.get('card_account')
        amount = request.data.get('amount')
        charge_type = request.data.get('charge_type', 'OTHER')
        description = request.data.get('description', '')
        date_str = request.data.get('date')

        if not card_account_id:
            return Response(
                {'detail': 'card_account es requerido.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not amount:
            return Response(
                {'detail': 'amount es requerido.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            card_account = TreasuryAccount.objects.get(pk=card_account_id)
        except TreasuryAccount.DoesNotExist:
            return Response(
                {'detail': 'card_account no existe.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        charge_date = None
        if date_str:
            from datetime import date as _date_type
            try:
                charge_date = _date_type.fromisoformat(date_str)
            except ValueError:
                return Response(
                    {'detail': 'Formato de fecha inválido. Use YYYY-MM-DD.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        try:
            movement = CardService.add_unbilled_charge(
                card_account=card_account,
                amount=Decimal(str(amount)),
                charge_type=charge_type,
                description=description,
                date=charge_date,
                created_by=request.user,
            )
        except ValidationError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        from .serializers import CardPendingChargeSerializer
        p = CardPendingChargeSerializer(movement).data
        return Response(
            {
                'id': p['id'],
                'amount': str(p['amount']),
                'date': p['date'].isoformat() if hasattr(p['date'], 'isoformat') else p['date'],
                'charge_type': p['charge_type'],
                'charge_type_display': p['charge_type_display'],
                'description': p.get('description', ''),
                'reference': '',
                'source': 'pending',
                'from_account_name': None,
                'partner_name': None,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=['post'], url_path='bill-charges')
    def bill_charges(self, request):
        """Factura los cargos no facturados de una tarjeta de crédito."""
        from .card_service import CardService
        from .models import TreasuryAccount
        from datetime import date as _date_type

        card_account_id = request.data.get('card_account')
        period_year = request.data.get('period_year')
        period_month = request.data.get('period_month')
        cut_off_date_str = request.data.get('cut_off_date')
        due_date_str = request.data.get('due_date')
        minimum_payment = request.data.get('minimum_payment', '0')
        notes = request.data.get('notes', '')

        if not card_account_id:
            return Response(
                {'detail': 'card_account es requerido.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not period_year or not period_month:
            return Response(
                {'detail': 'period_year y period_month son requeridos.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not cut_off_date_str or not due_date_str:
            return Response(
                {'detail': 'cut_off_date y due_date son requeridos.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            card_account = TreasuryAccount.objects.get(pk=card_account_id)
        except TreasuryAccount.DoesNotExist:
            return Response(
                {'detail': 'card_account no existe.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            cut_off_date = _date_type.fromisoformat(cut_off_date_str)
            due_date = _date_type.fromisoformat(due_date_str)
        except ValueError:
            return Response(
                {'detail': 'Formato de fecha inválido. Use YYYY-MM-DD.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            statement = CardService.bill_unbilled_charges(
                card_account=card_account,
                period_year=int(period_year),
                period_month=int(period_month),
                cut_off_date=cut_off_date,
                due_date=due_date,
                minimum_payment=Decimal(str(minimum_payment)),
                notes=notes,
                created_by=request.user,
            )
        except ValidationError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        from .serializers import CreditCardStatementSerializer
        result = CreditCardStatementSerializer(statement).data
        # Incluir desglose por grupo de compra si está disponible
        breakdown = getattr(statement, '_purchase_group_breakdown', None)
        if breakdown:
            result['purchase_group_breakdown'] = breakdown
        return Response(
            result,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['get'], url_path='charges')
    def charges(self, request, pk=None):
        """Retorna cargos facturados en este statement (movimientos + cuotas + pendientes)."""
        from .models import CardPendingCharge, CardPurchaseInstallment, TreasuryMovement
        from .serializers import CardPendingChargeSerializer, TreasuryMovementSerializer

        stmt = self.get_object()
        movements = TreasuryMovement.objects.filter(
            billed_in_statement=stmt,
        ).select_related('card_purchase_group', 'card_purchase_group__partner').order_by('-date', '-id')
        pending = CardPendingCharge.objects.filter(
            billed_in_statement=stmt,
        ).order_by('-date', '-id')
        installments = CardPurchaseInstallment.objects.filter(
            billed_in_statement=stmt,
        ).select_related('card_purchase_group', 'card_purchase_group__partner').order_by('-due_date', '-id')
        installments_data = [
            {
                'id': inst.id,
                'number': inst.number,
                'due_date': inst.due_date.isoformat(),
                'principal_amount': str(inst.principal_amount),
                'group_uuid': str(inst.card_purchase_group.uuid) if inst.card_purchase_group else None,
                'group_display_id': inst.card_purchase_group.display_id if inst.card_purchase_group else None,
                'partner_name': (
                    inst.card_purchase_group.partner.name
                    if inst.card_purchase_group and inst.card_purchase_group.partner else None
                ),
                'total_installments': inst.card_purchase_group.installments if inst.card_purchase_group else None,
            }
            for inst in installments
        ]
        return Response({
            'movements': TreasuryMovementSerializer(movements, many=True).data,
            'pending_charges': CardPendingChargeSerializer(pending, many=True).data,
            'installments': installments_data,
        })

    @action(detail=True, methods=['post'], url_path='reverse')
    def reverse(self, request, pk=None):
        """Reversa contablemente cargos + pago y anula el statement
        (Gap 1.6, ADR-0037). Equivalente a `cancel` con limpieza
        contable transaccional. Refresca saldos de la tarjeta y banco."""
        from .card_service import CardService
        stmt = self.get_object()
        notes = request.data.get('notes', '') or ''
        try:
            stmt = CardService.reverse_statement(stmt, notes=notes)
        except ValidationError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        stmt.refresh_from_db()
        return Response(self.get_serializer(stmt).data)
