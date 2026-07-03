import logging

from decimal import Decimal

import django_filters
from celery.result import AsyncResult
from django.core.exceptions import ValidationError
from django.http import HttpResponse
from django.utils import timezone

logger = logging.getLogger(__name__)
from django_filters.rest_framework import DjangoFilterBackend, FilterSet
from rest_framework import filters as drf_filters
from rest_framework import serializers as drf_serializers
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounting.models import Account
from contacts.models import Contact
from core.api.pagination import StandardResultsSetPagination
from core.mixins import AuditHistoryMixin
from core.idempotency import idempotent_endpoint

from .deletion_service import BankDeletionService

# from .rule_service import RuleService
from .selectors import BankStatementSelector
from .difference_service import DifferenceService
from .matching_service import MatchingService
from .models import (
    Bank,
    BankStatement,
    BankStatementLine,
    PaymentMethod,
    PaymentTerminalDevice,
    PaymentTerminalProvider,
    POSSession,
    POSTerminal,
    ReconciliationSettings,
    TerminalBatch,
    TreasuryAccount,
    TreasuryMovement,
)
from .pos_service import POSService
from .reconciliation_service import ReconciliationService
from .serializers import (
    ApplyChargesActionSerializer,
    BankLoanSerializer,
    BankLoanWriteSerializer,
    BankSerializer,
    BankStatementLineSerializer,
    BankStatementListSerializer,
    BankStatementSerializer,
    CreditCardStatementSerializer,
    CreditCardStatementWriteSerializer,
    CreditLineSerializer,
    CreditLineWriteSerializer,
    DisburseLoanActionSerializer,
    LoanInstallmentSerializer,
    PayInstallmentActionSerializer,
    PaymentMethodSerializer,
    PaymentTerminalDeviceSerializer,
    PaymentTerminalProviderSerializer,
    PayStatementActionSerializer,
    POSSessionAuditSerializer,
    POSSessionSerializer,
    POSTerminalSerializer,
    PrepayLoanActionSerializer,
    ReconciliationSettingsSerializer,
    TerminalBatchSerializer,
    TreasuryAccountSerializer,
    TreasuryMovementSerializer,
)
from .services import TerminalBatchService, TreasuryService


class BankViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    queryset = Bank.objects.all().order_by("name")
    serializer_class = BankSerializer
    pagination_class = None  # Master data

    @action(detail=True, methods=["get"])
    def overview(self, request, pk=None):
        """Centro de Bancos: vista unificada por banco (F5.2)."""
        from .selectors import BankSelector
        bank = self.get_object()
        return Response(BankSelector.get_overview(bank))

    @action(detail=True, methods=["post"])
    def archive(self, request, pk=None):
        bank = self.get_object()
        ok, reason = BankDeletionService.can_archive(bank)
        if not ok:
            return Response({"detail": reason}, status=status.HTTP_409_CONFLICT)
        bank.is_active = False
        bank.save(update_fields=["is_active", "updated_at"])
        return Response(BankSerializer(bank).data)

    @action(detail=True, methods=["post"])
    def restore(self, request, pk=None):
        bank = self.get_object()
        bank.is_active = True
        bank.save(update_fields=["is_active", "updated_at"])
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
            return Response({"detail": reason}, status=status.HTTP_409_CONFLICT)
        try:
            return super().destroy(request, *args, **kwargs)
        except Exception as exc:  # ProtectedError u otros
            return Response(
                {"detail": str(exc) or "No se puede eliminar el banco."},
                status=status.HTTP_409_CONFLICT,
            )


class PaymentMethodViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    queryset = PaymentMethod.objects.all().order_by("name")
    serializer_class = PaymentMethodSerializer
    pagination_class = None  # Master data

    def get_queryset(self):
        qs = super().get_queryset()
        treasury_account = self.request.query_params.get("treasury_account")
        if treasury_account:
            qs = qs.filter(treasury_account_id=treasury_account)

        for_sales = self.request.query_params.get("for_sales")
        if for_sales == "true":
            qs = qs.filter(allow_for_sales=True)

        for_purchases = self.request.query_params.get("for_purchases")
        if for_purchases == "true":
            qs = qs.filter(allow_for_purchases=True)

        method_type = self.request.query_params.get("method_type")
        if method_type:
            qs = qs.filter(method_type=method_type)

        return qs

    def _check_integrated(self, instance):
        if instance.is_integrated:
            return Response(
                {
                    "detail": "Los métodos de pago integrados (CARD_TERMINAL con dispositivo) son gestionados por el sistema. Modifique el dispositivo o proveedor en su lugar."
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        if instance.bank_provisioned:
            return Response(
                {
                    "detail": "Este método de pago fue creado automáticamente al provisionar el banco. Gestiónelo desde el Centro de Bancos."
                },
                status=status.HTTP_403_FORBIDDEN,
            )

    def update(self, request, *args, **kwargs):
        err = self._check_integrated(self.get_object())
        if err:
            return err
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        err = self._check_integrated(self.get_object())
        if err:
            return err
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        err = self._check_integrated(self.get_object())
        if err:
            return err
        return super().destroy(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save()

    def perform_update(self, serializer):
        serializer.save()


class TreasuryAccountFilterSet(FilterSet):
    name = django_filters.CharFilter(field_name="name", lookup_expr="icontains")
    account_type = django_filters.CharFilter(field_name="account_type", lookup_expr="exact")
    bank_id = django_filters.NumberFilter(field_name="bank__id", lookup_expr="exact")

    class Meta:
        model = TreasuryAccount
        fields = ["name", "account_type", "bank_id"]


class TreasuryAccountViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    queryset = TreasuryAccount.objects.all().order_by("account_type", "name")
    serializer_class = TreasuryAccountSerializer
    pagination_class = None  # Master data
    filter_backends = [DjangoFilterBackend, drf_filters.SearchFilter]
    filterset_class = TreasuryAccountFilterSet
    search_fields = ["name"]

    def get_queryset(self):
        qs = (
            super()
            .get_queryset()
            .select_related("bank", "account")
            .prefetch_related("terminal_providers")
        )
        exclude_id = self.request.query_params.get("exclude_id")
        if exclude_id:
            qs = qs.exclude(id=exclude_id)
        return qs

    def _check_system_managed(self, instance):
        if instance.account_type in TreasuryAccount._NON_CASH_EQUIVALENT_TYPES:
            return Response(
                {
                    "detail": f"Las cuentas de tipo {instance.get_account_type_display()} son gestionadas por el sistema (vinculadas a un proveedor de terminal). Modifique el proveedor en su lugar."
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        if instance.bank_provisioned:
            return Response(
                {
                    "detail": "Esta cuenta fue creada automáticamente al provisionar el banco. Gestiónela desde el Centro de Bancos."
                },
                status=status.HTTP_403_FORBIDDEN,
            )

    def update(self, request, *args, **kwargs):
        err = self._check_system_managed(self.get_object())
        if err:
            return err
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        err = self._check_system_managed(self.get_object())
        if err:
            return err
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        err = self._check_system_managed(self.get_object())
        if err:
            return err
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=["post"])
    def provision(self, request):
        """Asistente de alta: crea una cuenta + sus métodos de pago (auto-provisión)."""
        from .provisioning_service import TreasuryProvisioningService

        try:
            account, _methods = TreasuryProvisioningService.provision_from_payload(
                request.data, created_by=request.user
            )
        except ValidationError as e:
            return Response({"detail": e.messages}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(account).data, status=status.HTTP_201_CREATED)


class PaymentTerminalProviderViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    queryset = PaymentTerminalProvider.objects.all().order_by("name")
    serializer_class = PaymentTerminalProviderSerializer
    pagination_class = None  # Master data


class PaymentTerminalDeviceViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    queryset = PaymentTerminalDevice.objects.all().order_by("name")
    serializer_class = PaymentTerminalDeviceSerializer
    pagination_class = None  # Master data
    filterset_fields = ["provider", "status"]


class POSTerminalViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    """
    ViewSet for managing POS Terminals.
    Supports filtering by active status via `?active_only=true` query param.
    """

    queryset = (
        POSTerminal.objects.select_related("default_treasury_account")
        .prefetch_related("allowed_treasury_accounts")
        .all()
    )
    serializer_class = POSTerminalSerializer
    pagination_class = None  # Master data

    def get_queryset(self):
        qs = super().get_queryset()

        # Filter by active status if requested
        if self.request.query_params.get("active_only") == "true":
            qs = qs.filter(is_active=True)

        return qs.order_by("code")

    def destroy(self, request, *args, **kwargs):
        """
        Custom destroy to handle protected terminals (with sessions).
        """
        from django.db.models.deletion import ProtectedError

        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {
                    "error": "No se puede eliminar el terminal porque tiene sesiones asociadas.",
                    "detail": "Para deshabilitar el terminal, use la opción 'Desactivar' en su lugar.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=['get'])
    def available_accounts(self, request, pk=None):
        terminal = self.get_object()
        pm = request.query_params.get('payment_method')
        accounts = terminal.get_accounts_for_method(pm) if pm else terminal.allowed_treasury_accounts.all()
        return Response(TreasuryAccountSerializer(accounts, many=True).data)

    @action(detail=True, methods=['get'])
    def allowed_payment_methods(self, request, pk=None):
        from .selectors import POSSelector
        terminal = self.get_object()
        op = request.query_params.get('operation')
        methods = POSSelector.get_payment_methods_for_terminal(terminal, operation=op)
        return Response(PaymentMethodSerializer(methods, many=True).data)


class TreasuryMovementViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    queryset = TreasuryMovement.objects.all().order_by("-date", "-created_at")
    serializer_class = TreasuryMovementSerializer
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend]

    def get_queryset(self):
        from .selectors import TreasuryMovementSelector

        return TreasuryMovementSelector.list_treasury_movements(self.queryset, self.request.query_params)
    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if not request.user.is_staff:
            return Response(
                {"error": "Solo administradores pueden purgar documentos cancelados."},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            TreasuryService.validate_purge(instance)
        except ValidationError as e:
            msg = e.messages[0] if getattr(e, "messages", None) else str(e)
            return Response({"error": msg}, status=status.HTTP_400_BAD_REQUEST)
        return super().destroy(request, *args, **kwargs)

    def perform_update(self, serializer):
        instance = serializer.save()
        # Trigger status update on related documents
        TreasuryService.update_related_document_status(instance)

    @idempotent_endpoint(scope='treasury.movement.create')
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            from .services import TreasuryService
            instance = TreasuryService.create_movement_from_request(request, serializer.validated_data)
            return Response(TreasuryMovementSerializer(instance).data, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response({'error': str(e)}, status=400)
        except Exception as e:
            return Response({'error': str(e)}, status=500)

    @idempotent_endpoint(scope="treasury.movement.register")
    @action(detail=False, methods=["post"])
    def register_movement(self, request):
        try:
            movement = TreasuryService.create_movement_from_payload(
                request.data, created_by=request.user
            )
            return Response(
                TreasuryMovementSerializer(movement).data, status=status.HTTP_201_CREATED
            )
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            import traceback

            traceback.print_exc()
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @idempotent_endpoint(scope="treasury.card.purchase")
    @action(detail=False, methods=["post"], url_path="card-purchase")
    def card_purchase(self, request):
        """
        Crea una compra con tarjeta en N cuotas con interés
        explícito opcional (Onda 2, ADR-0043).
        """
        try:
            result = TreasuryService.process_card_purchase_request(request.data, request.user)
            return Response(result, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        movement = self.get_object()
        reason = request.data.get("reason", "")
        try:
            movement = TreasuryService.cancel_movement(movement, user=request.user, reason=reason)
            return Response(TreasuryMovementSerializer(movement).data)
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=["get"])
    def cancel_impact(self, request, pk=None):
        from .selectors import TreasuryMovementSelector
        movement = self.get_object()
        return Response(TreasuryMovementSelector.get_cancel_impact(movement))

    @action(detail=True, methods=["post"])
    def annul(self, request, pk=None):
        movement = self.get_object()
        reason = request.data.get("reason", "")
        treasury_account_id = request.data.get("treasury_account_id")
        amount = request.data.get("amount")
        try:
            amount_dec = Decimal(str(amount)) if amount else None
            movement = TreasuryService.annul_movement(
                movement,
                user=request.user,
                reason=reason,
                treasury_account_id=treasury_account_id,
                amount=amount_dec,
            )
            return Response(TreasuryMovementSerializer(movement).data)
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    def register_return(self, request, pk=None):
        try:
            from treasury.return_services import TreasuryReturnService
            payment = self.get_object()
            rp = TreasuryReturnService.register_payment_return_from_request(request, payment)
            return Response({'message': 'Devolución de pago registrada exitosamente', 'return_payment_id': rp.id, 'return_payment': TreasuryMovementSerializer(rp).data}, status=201)
        except Exception as e:
            return Response({'error': str(e)}, status=400)

    @action(detail=True, methods=["get"])
    def suggestions(self, request, pk=None):
        """Get bank statement line suggestions for this payment"""
        try:
            suggestions = MatchingService.suggest_lines_for_payment(pk)
            return Response({"suggestions": suggestions})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @idempotent_endpoint(scope="treasury.allocation.create")
    @action(detail=True, methods=["post"])
    def allocate(self, request, pk=None):
        """S5.2: Set partial allocations for a payment"""
        movement = self.get_object()

        try:
            from treasury.allocation_service import AllocationService
            created = AllocationService.allocate_from_request(request, movement)
            return Response(
                PaymentAllocationSerializer(created, many=True).data, status=status.HTTP_201_CREATED
            )
        except ValidationError as e:
            err = e.message if hasattr(e, "message") else str(e)
            return Response({"error": err}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=["get"])
    def allocations(self, request, pk=None):
        """S5.2: Get allocations for a payment"""
        try:
            from treasury.allocation_service import AllocationService

            allocs = AllocationService.get_allocations(pk)
            return Response(PaymentAllocationSerializer(allocs, many=True).data)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class BankStatementViewSet(viewsets.ModelViewSet):
    pagination_class = StandardResultsSetPagination
    """ViewSet for managing bank statements"""

    queryset = BankStatement.objects.all().select_related("treasury_account", "imported_by")
    filterset_fields = ["status", "treasury_account"]

    def get_queryset(self):
        return BankStatementSelector.list_bank_statements(self.queryset, self.request.query_params)
    def get_serializer_class(self):
        if self.action == "list":
            return BankStatementListSerializer
        return BankStatementSerializer

    @action(detail=False, methods=["post"])
    def import_statement(self, request):
        try:
            result = ReconciliationService.import_statement_from_request(request)
            return Response(
                {
                    "message": "Cartola importada exitosamente",
                    "statement": BankStatementSerializer(result["statement"]).data,
                    "total_lines": result["total_lines"],
                    "warnings": result["warnings"],
                },
                status=status.HTTP_201_CREATED,
            )
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response(
                {"error": f"Error al importar cartola: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=False, methods=["post"])
    def dry_run(self, request):
        """
        Validate and parse a bank statement without persisting.
        """
        try:
            result = ReconciliationService.dry_run_from_request(request)
            return Response(result)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response(
                {"error": f"Error al validar cartola: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=False, methods=["post"])
    def preview(self, request):
        """
        Generate file preview for column mapping
        """
        file = request.FILES.get("file")
        if not file:
            return Response({"error": "Archivo es requerido"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            data = ReconciliationService.generate_preview(file)
            return Response(data)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["get"])
    def summary(self, request, pk=None):
        """Get summary statistics for a statement"""
        try:
            summary = ReconciliationService.get_statement_summary(pk)
            return Response(summary)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=False, methods=["get"])
    def formats(self, request):
        """Get available bank formats"""
        formats = ReconciliationService.get_available_bank_formats()
        return Response({"formats": formats})

    @action(detail=True, methods=["post"])
    def auto_match(self, request, pk=None):
        from .reconciliation_service import ReconciliationService

        try:
            threshold = float(request.data.get("confidence_threshold", 90.0))
            task_id = ReconciliationService.kickoff_auto_match(int(pk), threshold)
            return Response({"task_id": task_id, "status": "PENDING"})
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=["get"])
    def auto_match_status(self, request, pk=None):
        task_id = request.query_params.get("task_id")
        if not task_id:
            return Response({"error": "task_id requerido"}, status=status.HTTP_400_BAD_REQUEST)
        from .reconciliation_service import ReconciliationService

        data, http_status = ReconciliationService.get_task_status_data(task_id)
        return Response(data, status=http_status)

    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        try:
            from .services import BankStatementService
            stmt = self.get_object()
            BankStatementService.confirm_from_request(request, stmt)
            return Response(BankStatementSerializer(stmt).data)
        except ValueError as e:
            return Response({'error': str(e)}, status=400)
        except Exception as e:
            return Response({'error': str(e)}, status=500)


class BankStatementLineViewSet(viewsets.ModelViewSet):
    """ViewSet for bank statement lines"""

    queryset = BankStatementLine.objects.all().select_related(
        "statement", "reconciled_by", "reconciliation_match", "difference_journal_entry"
    ).prefetch_related(
        "reconciliation_match__movements__terminal_batch",
        "reconciliation_match__movements__contact",
        "matched_movements__terminal_batch",
        "matched_movements__contact"
    )
    serializer_class = BankStatementLineSerializer
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        from .selectors import BankStatementSelector
        return BankStatementSelector.list_statement_lines(super().get_queryset(), self.request.query_params)

    @idempotent_endpoint(scope='treasury.reconciliation.match')
    @action(detail=False, methods=['post'])
    def match_group(self, request):
        try:
            from .matching_service import MatchingService
            group = MatchingService.create_match_group_from_request(request)
            return Response({'message': 'Grupo creado', 'group_id': group.id})
        except ValueError as e:
            return Response({'error': str(e)}, status=400)
        except Exception as e:
            return Response({'error': str(e)}, status=500)

    @action(detail=False, methods=["post"])
    def bulk_exclude(self, request):
        """Exclude multiple lines from reconciliation"""
        try:
            from treasury.services import BankStatementService
            count = BankStatementService.bulk_exclude_from_request(request)
            return Response({"message": f"{count} movimientos excluidos"})
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=["get"])
    def suggestions(self, request, pk=None):
        """Get payment matching suggestions for this line"""
        try:
            limit = int(request.query_params.get("limit", 5))
            suggestions = MatchingService.suggest_matches(pk, limit)
            return Response({"suggestions": suggestions})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=["post"])
    def match(self, request, pk=None):
        """Manually match line with payment"""
        try:
            payment_id = request.data.get("payment_id")
            if not payment_id:
                return Response(
                    {"error": "payment_id requerido"}, status=status.HTTP_400_BAD_REQUEST
                )

            # Wrapper sets up a 1:1 group
            matched_line = MatchingService.manual_match(pk, payment_id, request.user)
            return Response(BankStatementLineSerializer(matched_line).data)

        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        try:
            from .matching_service import MatchingService
            confirmed_line = MatchingService.confirm_match_from_request(request, self.get_object())
            return Response(BankStatementLineSerializer(confirmed_line).data)
        except ValueError as e:
            return Response({'error': str(e)}, status=400)
        except Exception as e:
            return Response({'error': str(e)}, status=500)

    @action(detail=True, methods=["post"])
    def unmatch(self, request, pk=None):
        """Remove match from line"""
        try:
            unmatched_line = MatchingService.unmatch(pk)
            return Response(BankStatementLineSerializer(unmatched_line).data)

        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=["get"])
    def suggested_difference(self, request, pk=None):
        """Get suggested difference type for this line"""
        try:
            line = self.get_object()
            suggestion = DifferenceService.suggest_difference_type(line)
            return Response({"suggestion": suggestion})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ReconciliationSettingsViewSet(viewsets.ModelViewSet):
    """ViewSet for reconciliation settings"""

    queryset = ReconciliationSettings.objects.all().select_related("treasury_account")
    serializer_class = ReconciliationSettingsSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        account_id = self.request.query_params.get("treasury_account")
        if account_id:
            qs = qs.filter(treasury_account_id=account_id)
        return qs

    @action(detail=False, methods=["get"])
    def for_account(self, request):
        from .services import TreasuryService
        settings = TreasuryService.get_or_create_reconciliation_settings()
        return Response(ReconciliationSettingsSerializer(settings).data)


class POSSessionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    """ViewSet for POS Session Management (Apertura/Cierre de Caja)"""

    def get_permissions(self):
        from treasury.api.permissions import IsPOSSessionActive

        permissions = [IsAuthenticated()]
        # current() y open_session() no requieren sesión activa
        if self.action not in ("current", "open_session"):
            permissions.append(IsPOSSessionActive())
        return permissions

    from django.db.models import Prefetch
    queryset = POSSession.objects.all().select_related("treasury_account", "user", "closed_by", "terminal").prefetch_related(
        Prefetch("movements", queryset=TreasuryMovement.objects.select_related(
            "account", "payment_method_new", "contact", "sale_order__customer", "invoice__contact",
            "invoice__sale_order__customer", "purchase_order__supplier", "invoice__purchase_order__supplier",
            "terminal_batch", "journal_entry", "card_purchase_group__partner", "bank_statement_line__statement",
            "reconciled_by", "created_by"
        ))
    )
    serializer_class = POSSessionSerializer
    filterset_fields = ["status", "treasury_account", "user"]

    @action(detail=False, methods=["get"])
    def current(self, request):
        from .selectors import POSSelector
        session = POSSelector.get_current_session(request.user)
        if session:
            return Response(POSSessionSerializer(session).data)
        return Response({"session": None})

    @action(detail=False, methods=["post"])
    def open_session(self, request):
        try:
            from .pos_service import POSService
            session = POSService.open_session_from_request(request)
            return Response(POSSessionSerializer(session).data, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response({'error': str(getattr(e, 'message', e))}, status=400)
        except Exception as e:
            return Response({'error': str(e)}, status=500)
    @action(detail=True, methods=["post"])
    @action(detail=True, methods=['post'])
    def close_session(self, request, pk=None):
        try:
            from .pos_service import POSService
            session, audit = POSService.close_session_from_request(request, self.get_object())
            return Response({'session': POSSessionSerializer(session).data, 'audit': POSSessionAuditSerializer(audit).data, 'message': 'Caja cerrada correctamente'})
        except ValidationError as e:
            return Response({'error': str(getattr(e, 'message', e))}, status=400)
        except Exception as e:
            return Response({'error': str(e)}, status=500)
    @action(detail=True, methods=["get"])
    def summary(self, request, pk=None):
        """Get detailed summary of sales in this session (X/Z Report data)"""
        try:
            from .selectors import POSSelector

            session = self.get_object()
            data = POSSelector.get_summary(session)
            return Response(data)
        except Exception as e:
            import traceback

            traceback.print_exc()
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=["get"])
    def pdf(self, request, pk=None):
        """Generate a downloadable PDF of the X/Z session report."""
        from .pos_report_pdf import render_pos_report_pdf

        session = self.get_object()
        report_type = request.query_params.get("type", "X" if session.status == "OPEN" else "Z").upper()

        audit = None
        if report_type == "Z" and hasattr(session, "audit"):
            audit = session.audit

        try:
            pdf_bytes = render_pos_report_pdf(session, request, report_type, audit)
            filename = f"informe-pos-{report_type}-{session.id}.pdf"
            response = HttpResponse(pdf_bytes, content_type="application/pdf")
            response["Content-Disposition"] = f'inline; filename="{filename}"'
            return response
        except Exception as e:
            logger.exception("Error generating POS report PDF")
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=["post"])
    @action(detail=True, methods=['post'])
    def register_manual_movement(self, request, pk=None):
        try:
            from .pos_service import POSService
            session = self.get_object()
            POSService.register_manual_movement_from_request(request, session)
            return Response({'session': POSSessionSerializer(session).data, 'message': 'Movimiento registrado correctamente'})
        except Exception as e:
            return Response({'error': str(e)}, status=500)
class CheckViewSet(viewsets.ModelViewSet):
    pagination_class = StandardResultsSetPagination
    """CRUD + transiciones de estado para cheques recibidos."""

    from .filters import CheckFilter
    from .models import Check as CheckModel
    from .serializers import CheckSerializer

    serializer_class = CheckSerializer
    filter_backends = [DjangoFilterBackend, drf_filters.SearchFilter]
    filterset_class = CheckFilter
    search_fields = ["check_number", "drawer_name", "counterparty__name", "bank__name", "amount"]

    def get_queryset(self):
        from .models import Check as CheckModel

        qs = CheckModel.objects.select_related(
            "bank", "counterparty", "portfolio_account", "deposit_account"
        )
        return qs.order_by("due_date", "-id")

    def perform_create(self, serializer):
        from .check_service import CheckService

        data = self.request.data
        check = CheckService.receive(
            bank_id=data["bank"],
            check_number=data["check_number"],
            amount=data["amount"],
            issue_date=data["issue_date"],
            due_date=data["due_date"],
            counterparty_id=data.get("counterparty"),
            drawer_name=data.get("drawer_name", ""),
            notes=data.get("notes", ""),
            invoice_id=data.get("invoice"),
            sale_order_id=data.get("sale_order"),
            created_by=self.request.user,
        )
        serializer.instance = check

    @action(detail=True, methods=["post"])
    def deposit(self, request, pk=None):
        from .check_service import CheckService

        check = self.get_object()
        try:
            check = CheckService.deposit(check, request.data["deposit_account"], created_by=request.user)
        except (ValidationError, TreasuryAccount.DoesNotExist, KeyError) as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(check).data)

    @action(detail=True, methods=["post"])
    def clear(self, request, pk=None):
        from .check_service import CheckService

        check = self.get_object()
        try:
            check = CheckService.clear(check)
        except ValidationError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(check).data)

    @action(detail=True, methods=["post"])
    def bounce(self, request, pk=None):
        from .check_service import CheckService

        check = self.get_object()
        try:
            check = CheckService.bounce(
                check, notes=request.data.get("notes", ""), created_by=request.user
            )
        except ValidationError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(check).data)

    @action(detail=True, methods=["post"])
    def void(self, request, pk=None):
        from .check_service import CheckService

        check = self.get_object()
        try:
            check = CheckService.void(check, notes=request.data.get("notes", ""))
        except ValidationError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(check).data)

    @action(detail=False, methods=["get"])
    def portfolio(self, request):
        from .check_service import CheckService

        bank_id = request.query_params.get("bank")
        summary = CheckService.get_portfolio_summary(bank_id=bank_id)
        data = self.get_serializer(summary["checks"], many=True).data
        return Response({"checks": data, "total": summary["total"]})

    @action(detail=False, methods=["get"])
    def in_transit(self, request):
        from .check_service import CheckService

        bank_id = request.query_params.get("bank")
        summary = CheckService.get_in_transit_summary(bank_id=bank_id)
        data = self.get_serializer(summary["checks"], many=True).data
        return Response({"checks": data, "total": summary["total"]})


class TreasuryDashboardViewSet(viewsets.ViewSet):
    """
    Vista consolidada de flujos de efectivo y gestión de tesorería.
    Combina Payments y CashMovements en una sola vista filtrable y provee balances consolidados.
    """

    @action(detail=False, methods=["get"])
    def stats(self, request):
        from .selectors import TreasuryDashboardSelector
        return Response(TreasuryDashboardSelector.get_stats())

    @action(detail=False, methods=["get"])
    def accounts(self, request):
        from .selectors import TreasuryDashboardSelector
        return Response(TreasuryDashboardSelector.list_dashboard_accounts())

    @action(detail=False, methods=["get"])
    def future_maturities(self, request):
        """
        Vencimientos futuros para proyección de flujo de caja (F5.3).
        Query params: days_ahead (default 90), treasury_account (optional).
        """
        from .selectors import TreasuryDashboardSelector

        days = int(request.query_params.get("days_ahead", 90))
        treasury_account_id = request.query_params.get("treasury_account")

        data = TreasuryDashboardSelector.get_future_maturities(
            days=days, treasury_account_id=treasury_account_id
        )
        return Response(data)

    def list(self, request):
        from datetime import date as _date
        from .selectors import TreasuryDashboardSelector
        from .serializers import CashFlowSerializer
        ft = request.query_params.get("flow_type", "all")
        df_str = request.query_params.get("date_from")
        dt_str = request.query_params.get("date_to")
        acc_id = request.query_params.get("treasury_account")
        df = _date.fromisoformat(df_str) if df_str else None
        dt = _date.fromisoformat(dt_str) if dt_str else None
        res = TreasuryDashboardSelector.get_cash_flows(ft, df, dt, acc_id)
        return Response(CashFlowSerializer(res, many=True).data)
    @idempotent_endpoint(scope='treasury.transfer.register')
    @action(detail=False, methods=['post'])
    def register_transfer(self, request):
        try:
            from .services import TreasuryService
            movement = TreasuryService.register_internal_transfer_from_request(request)
            return Response({'message': 'Traspaso registrado correctamente', 'id': movement.id})
        except Exception as e:
            return Response({'error': str(e)}, status=400)


class TerminalBatchViewSet(viewsets.ModelViewSet):
    pagination_class = StandardResultsSetPagination
    """
    ViewSet for managing Terminal Batches (Settlements).
    """

    queryset = TerminalBatch.objects.all().order_by("-sales_date", "-created_at")
    serializer_class = TerminalBatchSerializer
    filterset_fields = ["status", "provider", "sales_date"]

    def get_queryset(self):
        qs = super().get_queryset()

        # Date range filtering
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")

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
            batch = TerminalBatchService.create_batch_from_request(request)
            return Response(TerminalBatchSerializer(batch).data, status=status.HTTP_201_CREATED)

        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            import traceback

            traceback.print_exc()
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'])
    def generate_invoice(self, request):
        try:
            from .services import TerminalBatchService
            invoice = TerminalBatchService.generate_monthly_invoice_from_request(request)
            if not invoice: return Response({'message': 'No hay lotes para facturar.'}, status=404)
            return Response({'message': 'Factura generada', 'invoice_id': invoice.id, 'number': invoice.number}, status=201)
        except Exception as e:
            return Response({'error': str(e)}, status=400)


# ── F2.11: Créditos bancarios (BankLoan + LoanInstallment) ──────────────────


class BankLoanViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    pagination_class = StandardResultsSetPagination
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
    filterset_fields = ["status", "currency", "lender", "amortization_system"]

    def get_queryset(self):
        from .models import BankLoan

        return (
            BankLoan.objects.select_related(
                "lender",
                "disbursement_account",
                "liability_account",
                "created_by",
            )
            .prefetch_related("installments")
            .order_by("-start_date", "-id")
        )

    def get_serializer_class(self):
        from .serializers import BankLoanSerializer

        if self.action in ("create", "update", "partial_update"):
            return BankLoanWriteSerializer
        return BankLoanSerializer

    def perform_create(self, serializer):
        from django.core.exceptions import ValidationError as DjangoValidationError
        from rest_framework.exceptions import ValidationError
        from .loan_service import LoanService
        try:
            self._just_created = LoanService.create_loan_from_request(self.request.user, serializer.validated_data)
        except DjangoValidationError as e:
            raise ValidationError(e.message_dict if hasattr(e, 'message_dict') else e.messages)

    def create(self, request, *args, **kwargs):
        write_serializer = self.get_serializer(data=request.data)
        write_serializer.is_valid(raise_exception=True)
        self.perform_create(write_serializer)
        read_serializer = BankLoanSerializer(self._just_created, context={"request": request})
        return Response(read_serializer.data, status=status.HTTP_201_CREATED)

    def perform_update(self, serializer):
        from django.core.exceptions import ValidationError as DjangoValidationError

        try:
            serializer.save()
        except DjangoValidationError as e:
            raise drf_serializers.ValidationError(
                e.message_dict if hasattr(e, "message_dict") else e.messages
            )

    @action(detail=True, methods=['post'])
    def disburse(self, request, pk=None):
        from .loan_service import LoanService
        payload = DisburseLoanActionSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        try:
            loan = LoanService.disburse_from_request(request, self.get_object(), payload.validated_data)
            return Response(self.get_serializer(loan).data)
        except ValidationError as e:
            return Response({'detail': str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def prepay(self, request, pk=None):
        from .loan_service import LoanService
        payload = PrepayLoanActionSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        try:
            loan = LoanService.prepay_from_request(request, self.get_object(), payload.validated_data)
            return Response(self.get_serializer(loan).data)
        except ValidationError as e:
            return Response({'detail': str(e)}, status=400)

    @action(detail=True, methods=["get"])
    def schedule(self, request, pk=None):
        from .loan_service import LoanService

        loan = self.get_object()
        data = LoanService.preview_schedule(loan=loan)
        return Response(data)

    @action(detail=True, methods=["get"])
    def amortization_table(self, request, pk=None):
        loan = self.get_object()
        return Response(self.get_serializer(loan).data)


class CreditLineViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    pagination_class = StandardResultsSetPagination
    """
    CRUD para Líneas de Crédito (sobregiro) asociadas a cuentas corrientes.

    `used_amount` se calcula desde los TreasuryMovements tipo
    CREDIT_LINE_DRAW/CREDIT_LINE_REPAY.
    """

    from .models import CreditLine as CreditLineModel

    queryset = CreditLineModel.objects.select_related("treasury_account", "created_by").all()
    filterset_fields = ["status", "currency", "treasury_account"]
    search_fields = ["code", "treasury_account__name"]
    ordering_fields = ["credit_limit", "valid_from", "valid_until"]

    def get_queryset(self):
        qs = super().get_queryset()
        treasury_account_id = self.request.query_params.get("treasury_account_id")
        if treasury_account_id:
            qs = qs.filter(treasury_account_id=treasury_account_id)
        bank_id = self.request.query_params.get("bank_id")
        if bank_id:
            qs = qs.filter(treasury_account__bank_id=bank_id)
        return qs

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return CreditLineWriteSerializer
        return CreditLineSerializer

    @action(detail=True, methods=["get"])
    def overview(self, request, pk=None):
        """Detalle enriquecido con movimientos CREDIT_LINE_DRAW/REPAY asociados."""
        credit_line = self.get_object()
        from .serializers import TreasuryMovementSerializer

        movements = credit_line.movements.select_related(
            "from_account",
            "to_account",
            "credit_line",
        ).order_by("-date")[:50]
        return Response(
            {
                "credit_line": CreditLineSerializer(credit_line, context={"request": request}).data,
                "movements": TreasuryMovementSerializer(
                    movements, many=True, context={"request": request}
                ).data,
            }
        )


class LoanInstallmentViewSet(viewsets.ModelViewSet):
    pagination_class = StandardResultsSetPagination
    """Listado y pago de cuotas. Creación/edición no expuestas (se generan
    vía `BankLoan.generate_schedule` y se cierran vía acciones de pago)."""

    from .models import LoanInstallment

    serializer_class = LoanInstallmentSerializer
    filterset_fields = ["status", "loan"]
    http_method_names = ["get", "post", "head", "options"]  # sin PUT/DELETE

    def get_queryset(self):
        from .models import LoanInstallment

        return LoanInstallment.objects.select_related(
            "loan", "loan__lender", "payment_movement"
        ).order_by("loan", "number")

    @action(detail=True, methods=['post'])
    def pay(self, request, pk=None):
        from .loan_service import LoanService
        try:
            inst = LoanService.pay_installment_from_request(request, self.get_object())
            return Response(self.get_serializer(inst).data)
        except ValidationError as e:
            return Response({'detail': str(e)}, status=400)


# ── F3.5: Tarjeta de crédito propia — estados de cuenta ─────────────────────


class CreditCardStatementViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    pagination_class = StandardResultsSetPagination
    """CRUD + acciones de lifecycle para estados de cuenta de tarjeta de crédito propia.

    Acciones custom:
      - POST /card-statements/{id}/pay/          → pagar desde una cuenta bancaria.
      - POST /card-statements/{id}/apply-charges/ → imputar interés/comisiones.
      - POST /card-statements/{id}/cancel/       → anular un statement OPEN.
    """

    from .models import CreditCardStatement

    serializer_class = CreditCardStatementSerializer
    filterset_fields = ["status", "card_account", "period_year", "period_month"]

    def get_queryset(self):
        from .models import CreditCardStatement

        qs = CreditCardStatement.objects.select_related(
            "card_account", "payment_account", "payment_movement", "created_by"
        ).order_by("-period_year", "-period_month", "-id")
        bank_id = self.request.query_params.get("bank")
        if bank_id:
            qs = qs.filter(card_account__bank_id=bank_id)
        return qs

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return CreditCardStatementWriteSerializer
        return CreditCardStatementSerializer

    def perform_create(self, serializer):
        from django.core.exceptions import ValidationError as DjangoValidationError

        try:
            stmt = serializer.save(created_by=self.request.user)
        except DjangoValidationError as e:
            raise drf_serializers.ValidationError(
                e.message_dict if hasattr(e, "message_dict") else e.messages
            )
        self._just_created = stmt

    def create(self, request, *args, **kwargs):
        write_serializer = self.get_serializer(data=request.data)
        write_serializer.is_valid(raise_exception=True)
        self.perform_create(write_serializer)
        read_serializer = CreditCardStatementSerializer(
            self._just_created, context={"request": request}
        )
        return Response(read_serializer.data, status=status.HTTP_201_CREATED)

    def perform_update(self, serializer):
        from django.core.exceptions import ValidationError as DjangoValidationError

        try:
            serializer.save()
        except DjangoValidationError as e:
            raise drf_serializers.ValidationError(
                e.message_dict if hasattr(e, "message_dict") else e.messages
            )

    @action(detail=True, methods=['post'])
    def pay(self, request, pk=None):
        from .card_service import CardService
        try:
            stmt = CardService.pay_statement_from_request(request, self.get_object())
            return Response(self.get_serializer(stmt).data)
        except ValidationError as e:
            return Response({'detail': str(e)}, status=400)

    @action(detail=True, methods=['post'], url_path='apply-charges')
    def apply_charges(self, request, pk=None):
        from .card_service import CardService
        try:
            stmt = CardService.apply_charges_from_request(request, self.get_object())
            return Response(self.get_serializer(stmt).data)
        except ValidationError as e:
            return Response({'detail': str(e)}, status=400)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        from .card_service import CardService

        stmt = self.get_object()
        notes = request.data.get("notes", "")
        try:
            stmt = CardService.reverse_statement(stmt, notes=notes)
        except ValidationError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        stmt.refresh_from_db()
        return Response(self.get_serializer(stmt).data)

    @action(detail=True, methods=["post"], url_path="recalculate")
    def recalculate(self, request, pk=None):
        """Recalcula `billed_amount` agregando los OUTBOUND del período (Gap 1.2)."""
        from .card_service import CardService

        stmt = self.get_object()
        try:
            CardService.recalculate_billed_amount(stmt)
        except ValidationError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        stmt.refresh_from_db()
        return Response(self.get_serializer(stmt).data)

    @action(detail=True, methods=['post'], url_path='reapply-charges')
    def reapply_charges(self, request, pk=None):
        from .card_service import CardService
        try:
            stmt = CardService.reapply_charges_from_request(request, self.get_object())
            return Response(self.get_serializer(stmt).data)
        except ValidationError as e:
            return Response({'detail': str(e)}, status=400)

    @action(detail=False, methods=['get'], url_path='unbilled-charges')
    def unbilled_charges(self, request):
        from datetime import date as _date
        from .selectors import CardSelector
        acc_id = request.query_params.get('card_account')
        if not acc_id: return Response({'detail': 'card_account req.'}, status=400)
        c_date_str = request.query_params.get('cut_off_date')
        c_date = _date.fromisoformat(c_date_str) if c_date_str else None
        return Response(CardSelector.get_unbilled_charges_data(int(acc_id), c_date))

    @action(detail=False, methods=["post"], url_path="add-charge")
    def add_charge(self, request):
        """Agrega un cargo no facturado a una tarjeta de crédito."""
        from .card_service import CardService
        try:
            data = CardService.add_unbilled_charge_from_payload(request.data, request.user)
            return Response(data, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'], url_path='update-charge')
    def update_charge(self, request):
        from .card_service import CardService
        try:
            data = CardService.update_charge_from_request(request)
            return Response({'id': data['id'], 'amount': str(data['amount']), 'date': data['date'], 'charge_type': data['charge_type'], 'charge_type_display': data['charge_type_display'], 'description': data.get('description', ''), 'reference': '', 'source': 'pending', 'from_account_name': None, 'partner_name': None})
        except ValidationError as e:
            return Response({'detail': str(e)}, status=400)

    @action(detail=False, methods=['post'], url_path='delete-charge')
    def delete_charge(self, request):
        from .card_service import CardService
        try:
            CardService.delete_charge_from_request(request)
            return Response(status=204)
        except ValidationError as e:
            return Response({'detail': str(e)}, status=400)

    @action(detail=False, methods=["post"], url_path="bill-charges")
    def bill_charges(self, request):
        """Factura los cargos no facturados de una tarjeta de crédito."""
        from .card_service import CardService
        try:
            result = CardService.bill_charges_from_payload(request.data, request.user)
            return Response(result, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def analytics(self, request):
        from .card_analytics import CardAnalyticsService
        acc_id = request.query_params.get('card_account')
        months = int(request.query_params.get('months', '12'))
        gran = request.query_params.get('granularity', 'month')
        return Response(CardAnalyticsService.get_consolidated_hub_data(acc_id, months, gran))

    @action(detail=True, methods=['get'], url_path='charges')
    def charges(self, request, pk=None):
        from .selectors import CardSelector
        return Response(CardSelector.get_statement_charges(self.get_object()))

    @action(detail=True, methods=["post"], url_path="reverse")
    def reverse(self, request, pk=None):
        """Reversa contablemente cargos + pago y anula el statement
        (Gap 1.6, ADR-0037). Equivalente a `cancel` con limpieza
        contable transaccional. Refresca saldos de la tarjeta y banco."""
        from .card_service import CardService

        stmt = self.get_object()
        notes = request.data.get("notes", "") or ""
        try:
            stmt = CardService.reverse_statement(stmt, notes=notes)
        except ValidationError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        stmt.refresh_from_db()
        return Response(self.get_serializer(stmt).data)
