from core.api.pagination import StandardResultsSetPagination
from core.idempotency import idempotent_endpoint
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from billing.models import Invoice

from .models import AccountingPeriod, F29Declaration, F29Payment, TaxPeriod
from .serializers import (
    AccountingPeriodSerializer,
    F29CalculationRequestSerializer,
    F29DeclarationSerializer,
    F29PaymentSerializer,
    F29RegistrationSerializer,
    TaxPeriodSerializer,
)
from .services import (
    AccountingPeriodService,
    F29CalculationService,
    F29PaymentService,
    TaxPeriodService,
)


class TaxPeriodViewSet(viewsets.ModelViewSet):
    pagination_class = StandardResultsSetPagination
    queryset = TaxPeriod.objects.all()
    serializer_class = TaxPeriodSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["year", "month", "status"]
    ordering_fields = ["year", "month", "status"]
    ordering = ["-year", "-month"]

    @idempotent_endpoint(scope="tax.period.close")
    @action(detail=True, methods=["post"])
    def close(self, request, pk=None):
        """Close a tax period"""
        period = self.get_object()
        try:
            updated_period = TaxPeriodService.close_period(period.year, period.month, request.user)
            serializer = self.get_serializer(updated_period)
            return Response(serializer.data)
        except DjangoValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"])
    def reopen(self, request, pk=None):
        """Reopen a closed tax period"""
        period = self.get_object()
        try:
            updated_period = TaxPeriodService.reopen_period(period.year, period.month, request.user)
            serializer = self.get_serializer(updated_period)
            return Response(serializer.data)
        except DjangoValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["get"])
    def checklist(self, request, pk=None):
        """Get checklist status for a period"""
        period = self.get_object()
        checklist = TaxPeriodService.get_period_status(period.year, month=period.month)
        return Response(checklist)

    @action(detail=False, methods=['get'], permission_classes=[AllowAny])
    def check_closed(self, request):
        ds = request.query_params.get('date')
        if not ds: return Response({'error': 'Date required'}, status=400)
        try:
            from datetime import datetime
            return Response({'is_closed': TaxPeriodService.is_period_closed(datetime.strptime(ds, '%Y-%m-%d').date()), 'date': ds})
        except (ValueError, TypeError):
            return Response({'error': 'Invalid date'}, status=400)


class F29DeclarationViewSet(viewsets.ModelViewSet):
    pagination_class = StandardResultsSetPagination
    queryset = F29Declaration.objects.all()
    serializer_class = F29DeclarationSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["tax_period__year", "tax_period__month", "tax_period__status"]
    ordering_fields = ["tax_period__year", "tax_period__month", "declaration_date"]
    ordering = ["-tax_period__year", "-tax_period__month"]

    def create(self, request, *args, **kwargs):
        from .services_ext import TaxServiceExt
        from django.core.exceptions import ValidationError as DjangoValidationError
        try:
            dec = TaxServiceExt.create_declaration_from_request(request)
            return Response(self.get_serializer(dec).data, status=201)
        except (ValueError, TypeError, DjangoValidationError) as e:
            return Response({'error': str(e)}, status=400)

    @action(detail=False, methods=["post"])
    def calculate(self, request):
        """Calculate F29 values for a period"""
        serializer = F29CalculationRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        year = serializer.validated_data["year"]
        month = serializer.validated_data["month"]

        calc_data = F29CalculationService.calculate_f29_for_period(year, month)
        return Response(calc_data)

    @idempotent_endpoint(scope="tax.f29.register")
    @action(detail=True, methods=["post"])
    def register(self, request, pk=None):
        """Register an F29 declaration officially"""
        declaration = self.get_object()
        serializer = F29RegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            updated_declaration = F29CalculationService.register_declaration(
                declaration.id,
                serializer.validated_data.get("folio_number", ""),
                serializer.validated_data.get("declaration_date"),
                notes=serializer.validated_data.get("notes"),
            )

            result_serializer = self.get_serializer(updated_declaration)
            return Response(result_serializer.data)
        except DjangoValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'])
    def documents(self, request, pk=None):
        from .selectors import TaxSelectorExt
        return Response(TaxSelectorExt.get_declaration_documents(self.get_object()))


class F29PaymentViewSet(viewsets.ModelViewSet):
    pagination_class = StandardResultsSetPagination
    queryset = F29Payment.objects.all()
    serializer_class = F29PaymentSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["declaration", "payment_date", "payment_method"]
    ordering_fields = ["payment_date", "amount"]
    ordering = ["-payment_date"]

    def create(self, request, *args, **kwargs):
        """Create a new tax payment"""
        serializer = self.get_serializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
            payment = F29PaymentService.register_payment(
                serializer.validated_data["declaration"].id, serializer.validated_data, request.user
            )
            return Response(self.get_serializer(payment).data, status=status.HTTP_201_CREATED)
        except DjangoValidationError as e:
            return Response(
                {"error": getattr(e, "detail", str(e))}, status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response({"error": f"Error inesperado: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)


class AccountingPeriodViewSet(viewsets.ModelViewSet):
    pagination_class = StandardResultsSetPagination
    queryset = AccountingPeriod.objects.all()
    serializer_class = AccountingPeriodSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["year", "month", "status"]
    ordering_fields = ["year", "month", "status"]
    ordering = ["-year", "-month"]

    @idempotent_endpoint(scope="tax.period.close")
    @action(detail=True, methods=["post"])
    def close(self, request, pk=None):
        """Close an accounting period"""
        # Check permission
        if not request.user.has_perm("tax.can_close_accounting_period"):
            return Response(
                {"error": "No tiene permisos para cerrar periodos contables."},
                status=status.HTTP_403_FORBIDDEN,
            )

        period = self.get_object()
        try:
            updated_period = AccountingPeriodService.close_period(
                period.year, period.month, request.user
            )
            serializer = self.get_serializer(updated_period)
            return Response(serializer.data)
        except DjangoValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"])
    def reopen(self, request, pk=None):
        """Reopen a closed accounting period"""
        # Check permission
        if not request.user.has_perm("tax.can_reopen_accounting_period"):
            return Response(
                {"error": "No tiene permisos para reabrir periodos contables."},
                status=status.HTTP_403_FORBIDDEN,
            )

        period = self.get_object()
        try:
            updated_period = AccountingPeriodService.reopen_period(
                period.year, period.month, request.user
            )
            serializer = self.get_serializer(updated_period)
            return Response(serializer.data)
        except DjangoValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["get"])
    def status_check(self, request, pk=None):
        """Get status and checklist for an accounting period"""
        period = self.get_object()
        status_data = AccountingPeriodService.get_period_status(period.year, period.month)
        return Response(status_data)

    @action(detail=False, methods=['get'], permission_classes=[AllowAny])
    def check_closed(self, request):
        ds = request.query_params.get('date')
        if not ds: return Response({'error': 'Date required'}, status=400)
        try:
            from datetime import datetime
            return Response({'is_closed': AccountingPeriodService.is_period_closed(datetime.strptime(ds, '%Y-%m-%d').date()), 'date': ds})
        except (ValueError, TypeError):
            return Response({'error': 'Invalid date'}, status=400)
