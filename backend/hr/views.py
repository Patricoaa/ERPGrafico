from decimal import Decimal
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.core.exceptions import ValidationError
from django_filters.rest_framework import DjangoFilterBackend
import django_filters

from .models import GlobalHRSettings, AFP, PayrollConcept, Employee, Payroll, PayrollItem, EmployeeConceptAmount
from .serializers import (
    GlobalHRSettingsSerializer,
    AFPSerializer,
    PayrollConceptSerializer,
    EmployeeSerializer,
    PayrollListSerializer,
    PayrollDetailSerializer,
    PayrollItemSerializer,
    EmployeeConceptAmountSerializer,
)
from . import services


# --- Global Settings (singleton) ---

class GlobalHRSettingsViewSet(viewsets.ViewSet):
    """Parámetros globales de RRHH Chile."""

    def retrieve(self, request, pk=None):
        obj, _ = GlobalHRSettings.objects.get_or_create(pk=1)
        serializer = GlobalHRSettingsSerializer(obj)
        return Response(serializer.data)

    def partial_update(self, request, pk=None):
        obj, _ = GlobalHRSettings.objects.get_or_create(pk=1)
        serializer = GlobalHRSettingsSerializer(obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def update(self, request, pk=None):
        return self.partial_update(request, pk)

    @action(detail=False, methods=['get', 'patch', 'put'])
    def current(self, request):
        obj, _ = GlobalHRSettings.objects.get_or_create(pk=1)
        if request.method in ['PATCH', 'PUT']:
            serializer = GlobalHRSettingsSerializer(obj, data=request.data, partial=(request.method == 'PATCH'))
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)
        return Response(GlobalHRSettingsSerializer(obj).data)


# --- AFP ---

class AFPViewSet(viewsets.ModelViewSet):
    queryset = AFP.objects.all()
    serializer_class = AFPSerializer
    lookup_field = 'id'


# --- Payroll Concept ---

class PayrollConceptFilter(django_filters.FilterSet):
    category = django_filters.CharFilter()
    is_system = django_filters.BooleanFilter()

    class Meta:
        model = PayrollConcept
        fields = ['category', 'is_system']


class PayrollConceptViewSet(viewsets.ModelViewSet):
    queryset = PayrollConcept.objects.select_related('account').all()
    serializer_class = PayrollConceptSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_class = PayrollConceptFilter


# --- Employee ---

class EmployeeFilter(django_filters.FilterSet):
    status = django_filters.CharFilter(field_name='status')
    contact = django_filters.NumberFilter(field_name='contact__id')

    class Meta:
        model = Employee
        fields = ['status', 'contact']


class EmployeeViewSet(viewsets.ModelViewSet):
    queryset = Employee.objects.select_related('contact', 'afp').all()
    serializer_class = EmployeeSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_class = EmployeeFilter


# --- Payroll ---

class PayrollFilter(django_filters.FilterSet):
    employee = django_filters.NumberFilter(field_name='employee__id')
    period_year = django_filters.NumberFilter()
    period_month = django_filters.NumberFilter()
    status = django_filters.CharFilter()

    class Meta:
        model = Payroll
        fields = ['employee', 'period_year', 'period_month', 'status']


class PayrollViewSet(viewsets.ModelViewSet):
    queryset = Payroll.objects.select_related(
        'employee', 'employee__contact',
        'journal_entry', 'previred_journal_entry'
    ).prefetch_related('items', 'items__concept').all()
    filter_backends = [DjangoFilterBackend]
    filterset_class = PayrollFilter

    def get_serializer_class(self):
        if self.action in ('retrieve', 'create', 'update', 'partial_update'):
            return PayrollDetailSerializer
        return PayrollListSerializer

    def perform_create(self, serializer):
        payroll = serializer.save()
        # Si base_salary es 0, tomamos el del empleado
        if payroll.base_salary == Decimal('0') and payroll.employee.base_salary:
            payroll.base_salary = payroll.employee.base_salary
            payroll.save(update_fields=['base_salary'])
        
        # Generar propuesta inicial automáticamente
        try:
            services.PayrollService.generate_proforma_payroll(payroll=payroll)
        except Exception as e:
            # No bloqueamos la creación si falla la proforma, pero logueamos
            print(f"Error generando proforma automática para payroll {payroll.id}: {e}")

    @action(detail=True, methods=['post'])
    def post_payroll(self, request, pk=None):
        """Contabiliza la liquidación."""
        payroll = self.get_object()
        try:
            payroll = services.post_payroll(payroll)
        except ValidationError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(PayrollDetailSerializer(payroll).data)

    @action(detail=True, methods=['post'])
    def recalculate(self, request, pk=None):
        """Recalcula los totales."""
        payroll = self.get_object()
        payroll.recalculate_totals()
        return Response(PayrollDetailSerializer(payroll).data)

    @action(detail=False, methods=['post'])
    def generate_proforma(self, request):
        """Genera una liquidación pre-calculada para un empleado/período."""
        employee_id = request.data.get('employee')
        year = request.data.get('period_year')
        month = request.data.get('period_month')
        
        if not all([employee_id, year, month]):
            return Response({'detail': 'Faltan parámetros: employee, period_year, period_month'}, status=400)
            
        try:
            payroll = services.PayrollService.generate_proforma_payroll(employee_id, year, month)
            return Response(PayrollDetailSerializer(payroll).data)
        except Exception as e:
            return Response({'detail': str(e)}, status=400)


# --- PayrollItems ---

class PayrollItemViewSet(viewsets.ModelViewSet):
    serializer_class = PayrollItemSerializer

    def get_queryset(self):
        return PayrollItem.objects.filter(payroll_id=self.kwargs.get('payroll_pk')).select_related('concept')

    def perform_create(self, serializer):
        payroll = Payroll.objects.get(pk=self.kwargs['payroll_pk'])
        item = serializer.save(payroll=payroll)
        payroll.recalculate_totals()

    def perform_update(self, serializer):
        item = serializer.save()
        item.payroll.recalculate_totals()

    def perform_destroy(self, instance):
        payroll = instance.payroll
        instance.delete()
        payroll.recalculate_totals()


class EmployeeConceptAmountViewSet(viewsets.ModelViewSet):
    queryset = EmployeeConceptAmount.objects.all()
    serializer_class = EmployeeConceptAmountSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['employee', 'concept']
