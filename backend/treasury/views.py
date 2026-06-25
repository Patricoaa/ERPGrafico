from decimal import Decimal

import django_filters
from celery.result import AsyncResult
from django.core.exceptions import ValidationError
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend, FilterSet
from rest_framework import filters as drf_filters
from rest_framework import serializers as drf_serializers
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from accounting.models import Account
from contacts.models import Contact
from core.api.pagination import StandardResultsSetPagination
from core.mixins import AuditHistoryMixin
from core.idempotency import idempotent_endpoint

from .deletion_service import BankDeletionService

# from .rule_service import RuleService
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

    @action(detail=True, methods=["get"])
    def overview(self, request, pk=None):
        """Centro de Bancos: vista unificada por banco (F5.2)."""
        from .selectors import BankSelector
        bank = self.get_object()
        return Response(BankSelector.get_overview(bank))

    @action(detail=True, methods=["post"])
    def archive(self, request, pk=None):
        """Archivo del banco: ``is_active = False`` (cf. ADR-0037).

        Valida dependencias activas con :class:`BankDeletionService`. Devuelve
        ``409 Conflict`` si el banco tiene préstamos vigentes o cheques
        pendientes.
        """
        bank = self.get_object()
        ok, reason = BankDeletionService.can_archive(bank)
        if not ok:
            return Response({"detail": reason}, status=status.HTTP_409_CONFLICT)
        bank.is_active = False
        bank.save(update_fields=["is_active", "updated_at"])
        return Response(BankSerializer(bank).data)

    @action(detail=True, methods=["post"])
    def restore(self, request, pk=None):
        """Restaura un banco archivado (``is_active = True``)."""
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


class PaymentTerminalDeviceViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    queryset = PaymentTerminalDevice.objects.all().order_by("name")
    serializer_class = PaymentTerminalDeviceSerializer
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

    @action(detail=True, methods=["get"])
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
        payment_method = request.query_params.get("payment_method")

        if payment_method:
            accounts = terminal.get_accounts_for_method(payment_method)
        else:
            accounts = terminal.allowed_treasury_accounts.all()

        serializer = TreasuryAccountSerializer(accounts, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def allowed_payment_methods(self, request, pk=None):
        """
        Retorna métodos de pago permitidos para este terminal.

        Query params:
        - operation: 'sales' or 'purchases' (optional) - filtra por tipo de operación
        """
        terminal = self.get_object()
        operation = request.query_params.get("operation")

        # Obtener métodos de pago permitidos directamente
        methods = terminal.allowed_payment_methods.filter(is_active=True)

        # Filtrar por tipo de operación
        if operation == "sales":
            methods = methods.filter(allow_for_sales=True)
        elif operation == "purchases":
            methods = methods.filter(allow_for_purchases=True)

        serializer = PaymentMethodSerializer(methods, many=True)
        return Response(serializer.data)


class TreasuryMovementViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    queryset = TreasuryMovement.objects.all().order_by("-date", "-created_at")
    serializer_class = TreasuryMovementSerializer
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend]

    def get_queryset(self):
        qs = self.queryset.select_related(
            "account",
            "from_account__account",
            "to_account__account",
            "payment_method_new",
            "reconciled_by",
            "created_by",
            "terminal_batch",
            "contact",
            "invoice__contact",
            "invoice__sale_order__customer",
            "invoice__purchase_order__supplier",
            "sale_order__customer",
            "purchase_order__supplier",
            "journal_entry",
            "card_purchase_group__partner",
            "bank_statement_line__statement",
        )

        # Handle bank filtering (matches movements from/to any account of the bank)
        bank_id = self.request.query_params.get("bank")
        if bank_id:
            from django.db.models import Q

            bank_accounts = TreasuryAccount.objects.filter(bank_id=bank_id).values_list(
                "id", flat=True
            )
            qs = qs.filter(
                Q(from_account_id__in=bank_accounts) | Q(to_account_id__in=bank_accounts)
            )

        # Handle treasury_account filtering (matches either from or to)
        treasury_account = self.request.query_params.get("treasury_account")
        if treasury_account:
            from django.db.models import Q

            qs = qs.filter(Q(from_account_id=treasury_account) | Q(to_account_id=treasury_account))

        # Date filter
        date = self.request.query_params.get("date")
        if date:
            qs = qs.filter(date=date)

        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")
        if date_from:
            qs = qs.filter(date__gte=date_from)
        if date_to:
            qs = qs.filter(date__lte=date_to)

        # Amount range
        amount_min = self.request.query_params.get("amount_min")
        amount_max = self.request.query_params.get("amount_max")
        if amount_min:
            qs = qs.filter(amount__gte=amount_min)
        if amount_max:
            qs = qs.filter(amount__lte=amount_max)

        # Batch filtering (IsNull)
        terminal_batch_isnull = self.request.query_params.get("terminal_batch__isnull")
        if terminal_batch_isnull:
            val = terminal_batch_isnull.lower() == "true"
            qs = qs.filter(terminal_batch__isnull=val)

        # Terminal provider filter (used by batch creation modal): restrict to
        # movements captured through devices owned by this provider. This excludes
        # cash payments and movements from other providers, even if they belong to
        # the same sale order (split payments).
        terminal_provider = self.request.query_params.get("terminal_provider")
        if terminal_provider:
            from django.db.models import Q

            qs = qs.filter(
                Q(terminal_device__provider_id=terminal_provider)
                | Q(payment_method_new__linked_terminal_device__provider_id=terminal_provider),
                payment_method_new__method_type=PaymentMethod.Type.CARD_TERMINAL,
            ).distinct()

        pm = self.request.query_params.get("payment_method_new")
        if pm:
            qs = qs.filter(payment_method_new_id=pm)

        direction = self.request.query_params.get("direction")
        if direction and treasury_account:
            from django.db.models import Q

            if direction == "IN":
                # Inbound movements or Transfers where the selected account is the destination
                qs = qs.filter(
                    Q(movement_type="INBOUND")
                    | Q(movement_type="TRANSFER", to_account_id=treasury_account)
                    | Q(movement_type="ADJUSTMENT", amount__gt=0)  # Adjustments can be positive
                )
            elif direction == "OUT":
                # Outbound movements or Transfers where the selected account is the source
                qs = qs.filter(
                    Q(movement_type="OUTBOUND")
                    | Q(movement_type="TRANSFER", from_account_id=treasury_account)
                    | Q(movement_type="ADJUSTMENT", amount__lt=0)  # Adjustments can be negative
                )

        display_id = self.request.query_params.get("display_id")
        if display_id:
            import re

            match = re.search(r"(\d+)$", display_id)
            if match:
                qs = qs.filter(id=match.group(1))

        search = self.request.query_params.get("search")
        if search:
            from django.db.models import Q

            q = (
                Q(contact__name__icontains=search)
                | Q(contact__tax_id__icontains=search)
                | Q(reference__icontains=search)
                | Q(description__icontains=search)
                | Q(notes__icontains=search)
            )
            if search.isdigit():
                q |= Q(id=search)
            qs = qs.filter(q)

        return qs

    filterset_fields = [
        "is_reconciled",
        "movement_type",
        "payment_method",
        "payment_method_new",
        "contact",
    ]

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

    @idempotent_endpoint(scope="treasury.movement.create")
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            instance = TreasuryService.create_movement(
                movement_type=data.get("movement_type"),
                amount=data.get("amount"),
                created_by=self.request.user,
                date=data.get("date"),
                from_account=data.get("from_account"),
                to_account=data.get("to_account"),
                payment_method=data.get("payment_method", TreasuryMovement.Method.CASH),
                payment_method_new=data.get("payment_method_new"),
                reference=data.get("reference", ""),
                notes=data.get("notes", ""),
                justify_reason=data.get("justify_reason"),
                partner=data.get("contact"),
                invoice=data.get("invoice"),
                sale_order=data.get("sale_order"),
                purchase_order=data.get("purchase_order"),
                pos_session=data.get("pos_session"),
                transaction_number=data.get("transaction_number"),
                is_pending_registration=data.get("is_pending_registration", False),
            )
            return Response(
                TreasuryMovementSerializer(instance).data, status=status.HTTP_201_CREATED
            )
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            import traceback

            traceback.print_exc()
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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
        movement = self.get_object()
        try:
            return Response(
                {
                    "document_type": "TreasuryMovement",
                    "document_id": movement.id,
                    "display_id": movement.display_id,
                    "status": movement.status,
                    "is_cancellable": movement.status == TreasuryMovement.MovementStatus.DRAFT,
                    "warning": "",
                }
            )
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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

    @action(detail=True, methods=["post"])
    def register_return(self, request, pk=None):
        """
        Register payment return.
        Only available for payments linked to DRAFT invoices.
        """
        payment = self.get_object()

        try:
            from treasury.return_services import TreasuryReturnService
            return_payment = TreasuryReturnService.register_payment_return_from_request(request, payment)

            return Response(
                {
                    "message": "Devolución de pago registrada exitosamente",
                    "return_payment_id": return_payment.id,
                    "return_payment": TreasuryMovementSerializer(return_payment).data,
                },
                status=status.HTTP_201_CREATED,
            )
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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
    """ViewSet for managing bank statements"""

    queryset = BankStatement.objects.all().select_related("treasury_account", "imported_by")
    filterset_fields = ["status", "treasury_account"]

    def get_queryset(self):
        qs = super().get_queryset()
        if self.action == "retrieve":
            from django.db.models import Prefetch
            qs = qs.prefetch_related(
                Prefetch("lines", queryset=BankStatementLine.objects.select_related(
                    "reconciled_by", "reconciliation_match", "difference_journal_entry"
                ).prefetch_related(
                    "reconciliation_match__movements__terminal_batch",
                    "reconciliation_match__movements__contact",
                    "matched_movements__terminal_batch",
                    "matched_movements__contact"
                ))
            )
        return qs

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
        """S4.8: Kicks off async auto-match, returns task_id for polling."""
        from .tasks import auto_match_statement_task
        from celery import uuid
        from django.db import transaction

        try:
            threshold = float(request.data.get("confidence_threshold", 90.0))
            task_id = uuid()
            transaction.on_commit(lambda: auto_match_statement_task.apply_async(args=[int(pk), threshold], task_id=task_id))
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

    @action(detail=True, methods=["post"])
    def confirm(self, request, pk=None):
        """Confirm statement (locks it)"""
        try:
            statement = BankStatement.objects.get(id=pk)
            from .services import BankStatementService

            BankStatementService.confirm(statement=statement)
            return Response(BankStatementSerializer(statement).data)

        except BankStatement.DoesNotExist:
            return Response({"error": "Cartola no encontrada"}, status=status.HTTP_404_NOT_FOUND)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


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
        queryset = super().get_queryset()

        # Filter by statement if provided
        statement_id = self.request.query_params.get("statement")
        if statement_id:
            queryset = queryset.filter(statement_id=statement_id)

        # Filter by reconciliation status
        reconciliation_status = self.request.query_params.get(
            "reconciliation_status"
        ) or self.request.query_params.get("reconciliation_state")
        if reconciliation_status:
            if "," in reconciliation_status:
                queryset = queryset.filter(
                    reconciliation_status__in=reconciliation_status.split(",")
                )
            else:
                queryset = queryset.filter(reconciliation_status=reconciliation_status)

        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")
        if date_from:
            queryset = queryset.filter(transaction_date__gte=date_from)
        if date_to:
            queryset = queryset.filter(transaction_date__lte=date_to)

        amount_min = self.request.query_params.get("amount_min")
        amount_max = self.request.query_params.get("amount_max")
        if amount_min:
            from django.db.models import Q

            queryset = queryset.filter(Q(credit__gte=amount_min) | Q(debit__gte=amount_min))
        if amount_max:
            from django.db.models import Q

            queryset = queryset.filter(Q(credit__lte=amount_max) | Q(debit__lte=amount_max))

        search = self.request.query_params.get("search")
        if search:
            from django.db.models import Q

            queryset = queryset.filter(
                Q(description__icontains=search) | Q(reference__icontains=search)
            )

        direction = self.request.query_params.get("direction")
        if direction == "IN":
            queryset = queryset.filter(credit__gt=0)
        elif direction == "OUT":
            queryset = queryset.filter(debit__gt=0)

        return queryset

    @idempotent_endpoint(scope="treasury.reconciliation.match")
    @action(detail=False, methods=["post"])
    def match_group(self, request):
        """Match multiple lines with multiple payments (N:M)"""
        try:
            line_ids = request.data.get("line_ids", [])
            payment_ids = request.data.get("payment_ids", [])

            if not line_ids or not payment_ids:
                return Response(
                    {"error": "line_ids y payment_ids requeridos"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            difference_reason = request.data.get("difference_reason")
            notes = request.data.get("notes")
            group = MatchingService.create_match_group(
                line_ids, payment_ids, request.user, difference_reason, notes
            )
            return Response({"message": "Grupo creado", "group_id": group.id})
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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

    @action(detail=True, methods=["post"])
    def confirm(self, request, pk=None):
        """Confirm a matched line (MATCHED -> RECONCILED)"""
        try:
            line = self.get_object()

            # Check for difference adjustment
            difference_type = request.data.get("difference_type")
            notes = request.data.get("notes", "")
            accounting_date = request.data.get("accounting_date")

            if difference_type and line.difference_amount != 0:
                DifferenceService.create_difference_adjustment(
                    line, difference_type, request.user, notes, accounting_date
                )

            confirmed_line = MatchingService.confirm_match(pk, request.user)
            return Response(BankStatementLineSerializer(confirmed_line).data)

        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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
        """Always returns the global settings singleton."""
        settings, _ = ReconciliationSettings.objects.get_or_create(treasury_account=None)
        return Response(ReconciliationSettingsSerializer(settings).data)


class POSSessionViewSet(viewsets.ModelViewSet):
    """ViewSet for POS Session Management (Apertura/Cierre de Caja)"""

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
        """Get the current open session for the requesting user"""
        try:
            session = POSSession.objects.filter(user=request.user, status="OPEN").first()
            if session:
                return Response(POSSessionSerializer(session).data)
            return Response({"session": None})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=["post"])
    def open_session(self, request):
        """Open a new POS session (Abrir Caja)"""
        try:
            session = POSService.open_session(
                user=request.user,
                terminal_id=request.data.get("terminal_id"),
                treasury_account_id=request.data.get("treasury_account_id"),
                opening_balance=Decimal(str(request.data.get("opening_balance", "0"))),
                fund_source_id=request.data.get("fund_source_id"),
                justify_reason=request.data.get("justify_reason"),
                justify_target_id=request.data.get("justify_target_id"),
                notes=request.data.get("notes", ""),
            )
            return Response(POSSessionSerializer(session).data, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response(
                {"error": str(e.message) if hasattr(e, "message") else str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=["post"])
    def close_session(self, request, pk=None):
        """Close a POS session with cash audit (Cierre de Caja / Arqueo)"""
        session = self.get_object()
        try:
            session, audit = POSService.close_session(
                session=session,
                actual_cash=Decimal(str(request.data.get("actual_cash", "0"))),
                notes=request.data.get("notes", ""),
                justify_reason=request.data.get("justify_reason", "UNKNOWN"),
                justify_target_id=request.data.get("justify_target_id"),
                withdrawal_amount=Decimal(str(request.data.get("withdrawal_amount", "0"))),
                cash_destination_id=request.data.get("cash_destination_id"),
                user=request.user,
            )
            return Response(
                {
                    "session": POSSessionSerializer(session).data,
                    "audit": POSSessionAuditSerializer(audit).data,
                    "message": "Caja cerrada correctamente",
                }
            )
        except ValidationError as e:
            return Response(
                {"error": str(e.message) if hasattr(e, "message") else str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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

    @action(detail=True, methods=["post"])
    def register_manual_movement(self, request, pk=None):
        """
        Registers a manual cash movement (withdrawal or inflow) for this session.
        Supporting hardcoded types: PARTNER_WITHDRAWAL, THEFT, OTHER_IN, OTHER_OUT
        """
        try:
            from .pos_service import POSService

            session = self.get_object()
            POSService.register_manual_movement_from_request(request, session)

            return Response(
                {
                    "session": POSSessionSerializer(session).data,
                    "message": "Movimiento registrado correctamente",
                }
            )

        except Exception as e:
            import traceback

            traceback.print_exc()
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CheckViewSet(viewsets.ModelViewSet):
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
            deposit_account = TreasuryAccount.objects.get(pk=request.data["deposit_account"])
            check = CheckService.deposit(check, deposit_account, created_by=request.user)
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
        """
        Retorna estadísticas generales de tesorería (Saldos por tipo de cuenta).
        """
        bank_balance = sum(
            a.current_balance
            for a in TreasuryAccount.objects.filter(account_type=TreasuryAccount.Type.BANK)
        )
        cash_balance = sum(
            a.current_balance
            for a in TreasuryAccount.objects.filter(account_type=TreasuryAccount.Type.CASH)
        )

        return Response(
            {
                "bank_total": bank_balance,
                "cash_total": cash_balance,
                "total_available": bank_balance + cash_balance,
            }
        )

    @action(detail=False, methods=["get"])
    def accounts(self, request):
        """
        Retorna la lista de cuentas con sus saldos actuales.
        """
        accounts = TreasuryAccount.objects.all().order_by("account_type", "name")
        from .serializers import TreasuryAccountSerializer

        serializer = TreasuryAccountSerializer(accounts, many=True)
        return Response(serializer.data)

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
        """
        Lista consolidada de flujos de efectivo.
        Query params:
        - flow_type: 'all', 'third_party', 'internal' (default: 'all')
        - date_from, date_to, treasury_account
        """
        from datetime import datetime
        from .selectors import TreasuryDashboardSelector
        from .serializers import CashFlowSerializer

        flow_type = request.query_params.get("flow_type", "all")
        date_from_str = request.query_params.get("date_from")
        date_to_str = request.query_params.get("date_to")
        treasury_account_id = request.query_params.get("treasury_account")

        date_from = datetime.fromisoformat(date_from_str).date() if date_from_str else None
        date_to = datetime.fromisoformat(date_to_str).date() if date_to_str else None

        results = TreasuryDashboardSelector.get_cash_flows(
            flow_type=flow_type,
            date_from=date_from,
            date_to=date_to,
            treasury_account_id=treasury_account_id,
        )

        serializer = CashFlowSerializer(results, many=True)
        return Response(serializer.data)

    @idempotent_endpoint(scope="treasury.transfer.register")
    @action(detail=False, methods=["post"])
    def register_transfer(self, request):
        """
        Registra un traspaso interno entre cuentas.
        """
        from datetime import datetime

        from_acc_id = request.data.get("from_account_id")
        to_acc_id = request.data.get("to_account_id")
        amount = Decimal(str(request.data.get("amount", 0)))
        notes = request.data.get("notes", "")
        date_str = request.data.get("date")

        if not from_acc_id or not to_acc_id or amount <= 0:
            return Response({"error": "Datos incompletos"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            from_acc = TreasuryAccount.objects.get(pk=from_acc_id)
            to_acc = TreasuryAccount.objects.get(pk=to_acc_id)

            movement = TreasuryService.register_internal_transfer(
                from_account=from_acc,
                to_account=to_acc,
                amount=amount,
                created_by=request.user,
                notes=notes,
                date=datetime.fromisoformat(date_str) if date_str else None,
            )

            return Response({"message": "Traspaso registrado correctamente", "id": movement.id})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class TerminalBatchViewSet(viewsets.ModelViewSet):
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

    @action(detail=False, methods=["post"])
    def generate_invoice(self, request):
        """
        Generate supplier invoice for settled batches.
        """
        try:
            provider_id = request.data.get("provider_id")
            year = int(request.data.get("year"))
            month = int(request.data.get("month"))
            provider = PaymentTerminalProvider.objects.get(pk=provider_id)

            invoice = TerminalBatchService.generate_monthly_invoice(
                provider=provider,
                year=year,
                month=month,
                user=request.user,
                number=request.data.get("number"),
                date=request.data.get("date"),
                document_attachment=request.FILES.get("document_attachment"),
            )

            if not invoice:
                return Response(
                    {"message": "No hay lotes liquidados para facturar en este mes."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            return Response(
                {
                    "message": "Factura generada exitosamente",
                    "invoice_id": invoice.id,
                    "number": invoice.number,
                },
                status=status.HTTP_201_CREATED,
            )

        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


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

        from .loan_provisioning import get_or_create_loan_treasury_account

        # El write serializer expone `liability_account` apuntando a
        # `Account` (cuenta contable), no a `TreasuryAccount`. Aquí
        # resolvemos/creamos la wrapper LOAN correspondiente y la
        # inyectamos en `validated_data` para que el `save()` del
        # ModelSerializer asigne la FK correcta del modelo.
        validated = serializer.validated_data
        accounting_account = validated.get("liability_account")
        if accounting_account is not None:
            # Necesitamos `loan.lender` para resolver; pero todavía no
            # tenemos `loan`. Usamos el `lender` validado directamente.
            from .models import Bank

            lender = validated.get("lender")
            if not isinstance(lender, Bank):
                lender = Bank.objects.get(pk=lender)
            try:
                ta = get_or_create_loan_treasury_account(
                    bank=lender,
                    accounting_account=accounting_account,
                    currency=validated.get("currency", "CLP"),
                )
            except DjangoValidationError as e:
                # Si la cuenta contable ya está usada por otro tipo de TA,
                # devolvemos 400 con detalle legible.
                msg = (
                    e.message_dict
                    if hasattr(e, "message_dict")
                    else (e.messages if hasattr(e, "messages") else [str(e)])
                )
                raise drf_serializers.ValidationError({"liability_account": msg})
            validated["liability_account"] = ta

        try:
            loan = serializer.save(created_by=self.request.user)
        except DjangoValidationError as e:
            raise drf_serializers.ValidationError(
                e.message_dict if hasattr(e, "message_dict") else e.messages
            )

        # Devolver el objeto hidratado al serializer de lectura.
        self._just_created = loan

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

    @action(detail=True, methods=["post"])
    def disburse(self, request, pk=None):
        from decimal import Decimal

        from .loan_service import LoanService

        loan = self.get_object()
        payload = DisburseLoanActionSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        v = payload.validated_data
        try:
            loan = LoanService.disburse(
                loan,
                date=v.get("date"),
                opening_fee_override=(
                    Decimal(str(v["opening_fee"])) if v.get("opening_fee") is not None else None
                ),
                stamp_tax_override=(
                    Decimal(str(v["stamp_tax"])) if v.get("stamp_tax") is not None else None
                ),
                commission_expense_account=v.get("commission_expense_account"),
                stamp_tax_expense_account=v.get("stamp_tax_expense_account"),
                created_by=request.user,
            )
        except ValidationError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        # Refrescar para invalidar el prefetch de installments.
        loan.refresh_from_db()
        return Response(self.get_serializer(loan).data)

    @action(detail=True, methods=["post"])
    def prepay(self, request, pk=None):
        from .loan_service import LoanService
        from .models import TreasuryAccount

        loan = self.get_object()
        payload = PrepayLoanActionSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        v = payload.validated_data
        try:
            payment_account = TreasuryAccount.objects.get(pk=v["payment_account"])
        except TreasuryAccount.DoesNotExist:
            return Response(
                {"detail": "payment_account no existe."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        interest_exp = v.get("interest_expense_account")
        insurance_exp = v.get("insurance_expense_account")
        try:
            loan = LoanService.prepay(
                loan,
                payment_account=payment_account,
                interest_expense_account=interest_exp,
                insurance_expense_account=insurance_exp,
                date=v.get("date"),
                created_by=request.user,
                insurance_amount=v.get("insurance_amount"),
                tax_amount=v.get("tax_amount"),
                penalty_amount=v.get("penalty_amount"),
            )
        except ValidationError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        loan.refresh_from_db()
        return Response(self.get_serializer(loan).data)

    @action(detail=True, methods=["get"])
    def schedule(self, request, pk=None):
        """Preview de la tabla de amortización SIN persistir."""
        loan = self.get_object()
        if loan.installments.exists():
            return Response(
                {"detail": "El crédito ya tiene una tabla generada. Use GET amortization_table."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from .loan_service import LoanService
        data = LoanService.preview_schedule(loan=loan)
        return Response(data)

    @action(detail=True, methods=["get"])
    def amortization_table(self, request, pk=None):
        loan = self.get_object()
        return Response(self.get_serializer(loan).data)


class CreditLineViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
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

    @action(detail=True, methods=["post"])
    def pay(self, request, pk=None):
        from .loan_service import LoanService

        installment = self.get_object()
        try:
            installment = LoanService.pay_installment_from_request(request, installment)
        except ValidationError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
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

    @action(detail=True, methods=["post"])
    def pay(self, request, pk=None):
        from .card_service import CardService
        from .models import TreasuryAccount

        stmt = self.get_object()
        payload = PayStatementActionSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        v = payload.validated_data
        try:
            payment_account = TreasuryAccount.objects.get(pk=v["payment_account"])
        except TreasuryAccount.DoesNotExist:
            return Response(
                {"detail": "payment_account no existe."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            stmt = CardService.pay_statement(
                stmt,
                payment_account=payment_account,
                amount=v.get("amount"),
                date=v.get("date"),
                created_by=request.user,
            )
        except ValidationError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        stmt.refresh_from_db()
        return Response(self.get_serializer(stmt).data)

    @action(detail=True, methods=["post"], url_path="apply-charges")
    def apply_charges(self, request, pk=None):
        from .card_service import CardService

        stmt = self.get_object()
        payload = ApplyChargesActionSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        v = payload.validated_data
        interest_exp = None
        fees_exp = None
        if v.get("interest_expense_account"):
            try:
                interest_exp = Account.objects.get(pk=v["interest_expense_account"])
            except Account.DoesNotExist:
                return Response(
                    {"detail": "interest_expense_account no existe."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        if v.get("fees_expense_account"):
            try:
                fees_exp = Account.objects.get(pk=v["fees_expense_account"])
            except Account.DoesNotExist:
                return Response(
                    {"detail": "fees_expense_account no existe."},
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
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        stmt.refresh_from_db()
        return Response(self.get_serializer(stmt).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        """Anula el estado de cuenta: revierte la facturación de cargos/cuotas
        y marca como CANCELED. Solo disponible si no está pagado."""
        from .card_service import CardService

        stmt = self.get_object()
        if stmt.status == "PAID":
            return Response(
                {"detail": "No se puede anular un estado de cuenta pagado."},
                status=status.HTTP_400_BAD_REQUEST,
            )
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

    @action(detail=True, methods=["post"], url_path="reapply-charges")
    def reapply_charges(self, request, pk=None):
        """Reversa el cargo actual y vuelve a imputarlo (Gap 1.4)."""
        from .card_service import CardService

        stmt = self.get_object()
        payload = ApplyChargesActionSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        v = payload.validated_data
        interest_exp = None
        fees_exp = None
        if v.get("interest_expense_account"):
            try:
                interest_exp = Account.objects.get(pk=v["interest_expense_account"])
            except Account.DoesNotExist:
                return Response(
                    {"detail": "interest_expense_account no existe."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        if v.get("fees_expense_account"):
            try:
                fees_exp = Account.objects.get(pk=v["fees_expense_account"])
            except Account.DoesNotExist:
                return Response(
                    {"detail": "fees_expense_account no existe."},
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
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        stmt.refresh_from_db()
        return Response(self.get_serializer(stmt).data)

    @action(detail=False, methods=["get"], url_path="unbilled-charges")
    def unbilled_charges(self, request):
        """Lista cargos no facturados de una tarjeta de crédito."""
        from datetime import date as _date_type
        from .models import TreasuryAccount
        from .selectors import CardSelector

        card_account_id = request.query_params.get("card_account")
        if not card_account_id:
            return Response(
                {"detail": "card_account es requerido."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            card_account = TreasuryAccount.objects.get(pk=card_account_id)
        except TreasuryAccount.DoesNotExist:
            return Response(
                {"detail": "card_account no existe."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if card_account.account_type != TreasuryAccount.Type.CREDIT_CARD:
            return Response(
                {"detail": "La cuenta debe ser de tipo Tarjeta de Crédito."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cut_off_date_str = request.query_params.get("cut_off_date")
        cut_off_date = _date_type.fromisoformat(cut_off_date_str) if cut_off_date_str else None

        data = CardSelector.get_unbilled_charges_data(card_account, cut_off_date)
        return Response(data)

    @action(detail=False, methods=["post"], url_path="add-charge")
    def add_charge(self, request):
        """Agrega un cargo no facturado a una tarjeta de crédito."""
        from .card_service import CardService
        try:
            data = CardService.add_unbilled_charge_from_payload(request.data, request.user)
            return Response(data, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["post"], url_path="update-charge")
    def update_charge(self, request):
        """Actualiza un cargo pendiente no facturado."""
        from .models import CardPendingCharge
        from .serializers import CardPendingChargeSerializer

        charge_id = request.data.get("id")
        if not charge_id:
            return Response(
                {"detail": "id del cargo es requerido."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            charge = CardPendingCharge.objects.get(pk=charge_id, is_billed=False)
        except CardPendingCharge.DoesNotExist:
            return Response(
                {"detail": "Cargo pendiente no encontrado o ya facturado."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = CardPendingChargeSerializer(
            charge,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        if serializer.is_valid():
            serializer.save()
            data = serializer.data
            return Response(
                {
                    "id": data["id"],
                    "amount": str(data["amount"]),
                    "date": data["date"].isoformat()
                    if hasattr(data["date"], "isoformat")
                    else data["date"],
                    "charge_type": data["charge_type"],
                    "charge_type_display": data["charge_type_display"],
                    "description": data.get("description", ""),
                    "reference": "",
                    "source": "pending",
                    "from_account_name": None,
                    "partner_name": None,
                }
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["post"], url_path="delete-charge")
    def delete_charge(self, request):
        """Elimina un cargo pendiente no facturado."""
        from .models import CardPendingCharge

        charge_id = request.data.get("id")
        if not charge_id:
            return Response(
                {"detail": "id del cargo es requerido."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            charge = CardPendingCharge.objects.get(pk=charge_id, is_billed=False)
        except CardPendingCharge.DoesNotExist:
            return Response(
                {"detail": "Cargo pendiente no encontrado o ya facturado."},
                status=status.HTTP_404_NOT_FOUND,
            )

        charge.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["post"], url_path="bill-charges")
    def bill_charges(self, request):
        """Factura los cargos no facturados de una tarjeta de crédito."""
        from .card_service import CardService
        try:
            result = CardService.bill_charges_from_payload(request.data, request.user)
            return Response(result, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["get"], url_path="analytics")
    def analytics(self, request):
        """Retorna analytics consolidados de TC para el hub de gestión.

        Query params:
          - card_account (opcional): filtrar por cuenta específica.
          - months (opcional, default 12): ventana de meses históricos.
          - granularity (opcional, default 'month'): agrupación temporal
            ('day', 'month', 'year') para payment_performance.
        """
        from .card_analytics import CardAnalyticsService
        from .models import TreasuryAccount

        card_account_id = request.query_params.get("card_account")
        months_str = request.query_params.get("months", "12")
        months = max(1, int(months_str)) if months_str.isdigit() else 12
        granularity = request.query_params.get("granularity", "month")

        card_account = None
        if card_account_id:
            try:
                card_account = TreasuryAccount.objects.get(pk=card_account_id)
            except TreasuryAccount.DoesNotExist:
                return Response(
                    {"detail": "card_account no existe."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        data = CardAnalyticsService.get_consolidated_hub_data(
            card_account=card_account,
            months=months,
            granularity=granularity,
        )
        return Response(data)

    @action(detail=True, methods=["get"], url_path="charges")
    def charges(self, request, pk=None):
        """Retorna cargos facturados en este statement (movimientos + cuotas + pendientes)."""
        from django.db.models import CharField, IntegerField, OuterRef, Subquery

        from .models import CardPendingCharge, CardPurchaseInstallment, TreasuryMovement
        from .serializers import CardPendingChargeSerializer, TreasuryMovementSerializer

        stmt = self.get_object()
        movements = (
            TreasuryMovement.objects.filter(
                billed_in_statement=stmt,
            )
            .select_related("card_purchase_group", "card_purchase_group__partner")
            .order_by("-date", "-id")
        )
        pending = CardPendingCharge.objects.filter(
            billed_in_statement=stmt,
        ).order_by("-date", "-id")
        installments = (
            CardPurchaseInstallment.objects.filter(
                billed_in_statement=stmt,
            )
            .select_related("card_purchase_group", "card_purchase_group__partner")
            .order_by("-due_date", "-id")
        )

        po_subq = Subquery(
            TreasuryMovement.objects.filter(
                card_purchase_group=OuterRef("card_purchase_group"),
                movement_type=TreasuryMovement.Type.OUTBOUND,
            ).values("purchase_order_id")[:1],
            output_field=IntegerField(),
        )
        po_number_subq = Subquery(
            TreasuryMovement.objects.filter(
                card_purchase_group=OuterRef("card_purchase_group"),
                movement_type=TreasuryMovement.Type.OUTBOUND,
            ).values("purchase_order__number")[:1],
            output_field=CharField(max_length=20),
        )
        installments = installments.annotate(po_id=po_subq, po_display_number=po_number_subq)

        installments_data = [
            {
                "id": inst.id,
                "number": inst.number,
                "due_date": inst.due_date.isoformat(),
                "principal_amount": str(inst.principal_amount),
                "group_uuid": str(inst.card_purchase_group.uuid)
                if inst.card_purchase_group
                else None,
                "group_display_id": inst.card_purchase_group.display_id
                if inst.card_purchase_group
                else None,
                "partner_name": (
                    inst.card_purchase_group.partner.name
                    if inst.card_purchase_group and inst.card_purchase_group.partner
                    else None
                ),
                "total_installments": inst.card_purchase_group.installments
                if inst.card_purchase_group
                else None,
                "purchase_order_id": inst.po_id,
                "purchase_order_display_id": f"OCS-{inst.po_display_number}"
                if inst.po_display_number
                else None,
            }
            for inst in installments
        ]
        return Response(
            {
                "movements": TreasuryMovementSerializer(movements, many=True).data,
                "pending_charges": CardPendingChargeSerializer(pending, many=True).data,
                "installments": installments_data,
            }
        )

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
