from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from .models import TaxPeriod, F29Declaration, F29Payment, AccountingPeriod
from .serializers import (
    TaxPeriodSerializer, F29DeclarationSerializer, F29PaymentSerializer,
    F29CalculationRequestSerializer, F29RegistrationSerializer, AccountingPeriodSerializer
)
from .services import F29CalculationService, TaxPeriodService, F29PaymentService, AccountingPeriodService
from billing.models import Invoice


class TaxPeriodViewSet(viewsets.ModelViewSet):
    queryset = TaxPeriod.objects.all()
    serializer_class = TaxPeriodSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['year', 'month', 'status']
    ordering_fields = ['year', 'month', 'status']
    ordering = ['-year', '-month']

    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        """Close a tax period"""
        period = self.get_object()
        try:
            updated_period = TaxPeriodService.close_period(
                period.year,
                period.month,
                request.user
            )
            serializer = self.get_serializer(updated_period)
            return Response(serializer.data)
        except DjangoValidationError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'])
    def reopen(self, request, pk=None):
        """Reopen a closed tax period"""
        period = self.get_object()
        try:
            updated_period = TaxPeriodService.reopen_period(
                period.year,
                period.month,
                request.user
            )
            serializer = self.get_serializer(updated_period)
            return Response(serializer.data)
        except DjangoValidationError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['get'])
    def checklist(self, request, pk=None):
        """Get checklist status for a period"""
        period = self.get_object()
        checklist = TaxPeriodService.get_period_status(period.year, period.month)
        return Response(checklist)


class F29DeclarationViewSet(viewsets.ModelViewSet):
    queryset = F29Declaration.objects.all()
    serializer_class = F29DeclarationSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['tax_period__year', 'tax_period__month', 'tax_period__status']
    ordering_fields = ['tax_period__year', 'tax_period__month', 'declaration_date']
    ordering = ['-tax_period__year', '-tax_period__month']

    def create(self, request, *args, **kwargs):
        """
        Create or update an F29 declaration.
        Handles tax_period_year and tax_period_month from the request.
        """
        year = request.data.get('tax_period_year')
        month = request.data.get('tax_period_month')
        
        if not year or not month:
            # Fallback to current year/month if not provided
            now = timezone.now()
            year = year or now.year
            month = month or now.month

        try:
            # The service handles finding/creating the TaxPeriod and calculation
            declaration = F29CalculationService.create_or_update_declaration(
                year=int(year),
                month=int(month),
                manual_fields=request.data
            )
            serializer = self.get_serializer(declaration)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except (ValueError, TypeError) as e:
            return Response(
                {'error': f"Año o mes inválidos: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        except DjangoValidationError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['post'])
    def calculate(self, request):
        """Calculate F29 values for a period"""
        serializer = F29CalculationRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        year = serializer.validated_data['year']
        month = serializer.validated_data['month']
        
        calc_data = F29CalculationService.calculate_f29_for_period(year, month)
        return Response(calc_data)

    @action(detail=True, methods=['post'])
    def register(self, request, pk=None):
        """Register an F29 declaration officially"""
        declaration = self.get_object()
        serializer = F29RegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        try:
            updated_declaration = F29CalculationService.register_declaration(
                declaration.id,
                serializer.validated_data.get('folio_number', ''),
                serializer.validated_data.get('declaration_date')
            )
            
            # Update notes if provided
            if 'notes' in serializer.validated_data:
                updated_declaration.notes = serializer.validated_data['notes']
                updated_declaration.save()
            
            result_serializer = self.get_serializer(updated_declaration)
            return Response(result_serializer.data)
        except DjangoValidationError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['get'])
    def documents(self, request, pk=None):
        """Get all invoices included in this declaration"""
        from billing.serializers import InvoiceSerializer
        from datetime import date
        
        declaration = self.get_object()
        period = declaration.tax_period
        
        # Calculate date range
        start_date = date(period.year, period.month, 1)
        if period.month == 12:
            end_date = date(period.year + 1, 1, 1)
        else:
            end_date = date(period.year, period.month + 1, 1)
        
        # Get all invoices in period
        invoices = Invoice.objects.filter(
            date__gte=start_date,
            date__lt=end_date,
            status=Invoice.Status.POSTED
        ).order_by('date', 'id')
        
        serializer = InvoiceSerializer(invoices, many=True)
        return Response(serializer.data)


class F29PaymentViewSet(viewsets.ModelViewSet):
    queryset = F29Payment.objects.all()
    serializer_class = F29PaymentSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['declaration', 'payment_date', 'payment_method']
    ordering_fields = ['payment_date', 'amount']
    ordering = ['-payment_date']

    def create(self, request, *args, **kwargs):
        """Create a new tax payment"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        try:
            payment = F29PaymentService.register_payment(
                serializer.validated_data['declaration'].id,
                serializer.validated_data,
                request.user
            )
            result_serializer = self.get_serializer(payment)
            return Response(
                result_serializer.data,
                status=status.HTTP_201_CREATED
            )
        except DjangoValidationError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class AccountingPeriodViewSet(viewsets.ModelViewSet):
    queryset = AccountingPeriod.objects.all()
    serializer_class = AccountingPeriodSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['year', 'month', 'status']
    ordering_fields = ['year', 'month', 'status']
    ordering = ['-year', '-month']

    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        """Close an accounting period"""
        # Check permission
        if not request.user.has_perm('tax.can_close_accounting_period'):
            return Response(
                {'error': 'No tiene permisos para cerrar periodos contables.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        period = self.get_object()
        try:
            updated_period = AccountingPeriodService.close_period(
                period.year,
                period.month,
                request.user
            )
            serializer = self.get_serializer(updated_period)
            return Response(serializer.data)
        except DjangoValidationError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'])
    def reopen(self, request, pk=None):
        """Reopen a closed accounting period"""
        # Check permission
        if not request.user.has_perm('tax.can_reopen_accounting_period'):
            return Response(
                {'error': 'No tiene permisos para reabrir periodos contables.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        period = self.get_object()
        try:
            updated_period = AccountingPeriodService.reopen_period(
                period.year,
                period.month,
                request.user
            )
            serializer = self.get_serializer(updated_period)
            return Response(serializer.data)
        except DjangoValidationError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['get'])
    def status_check(self, request, pk=None):
        """Get status and checklist for an accounting period"""
        period = self.get_object()
        status_data = AccountingPeriodService.get_period_status(period.year, period.month)
        return Response(status_data)


