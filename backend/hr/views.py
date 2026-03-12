from decimal import Decimal
from django.db import transaction, models
from django.db.models import Sum
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.core.exceptions import ValidationError
from django_filters.rest_framework import DjangoFilterBackend
import django_filters
from .models import GlobalHRSettings, AFP, PayrollConcept, Employee, Payroll, PayrollItem, EmployeeConceptAmount, Absence, SalaryAdvance, PayrollPayment
from .serializers import (
    GlobalHRSettingsSerializer,
    AFPSerializer,
    PayrollConceptSerializer,
    EmployeeSerializer,
    PayrollListSerializer,
    PayrollDetailSerializer,
    PayrollItemSerializer,
    EmployeeConceptAmountSerializer,
    AbsenceSerializer,
    SalaryAdvanceSerializer,
    PayrollPaymentSerializer,
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


# --- Absence ---

class AbsenceFilter(django_filters.FilterSet):
    employee = django_filters.NumberFilter(field_name='employee__id')
    start_date = django_filters.DateFromToRangeFilter()
    absence_type = django_filters.CharFilter()

    class Meta:
        model = Absence
        fields = ['employee', 'absence_type', 'start_date']

class AbsenceViewSet(viewsets.ModelViewSet):
    queryset = Absence.objects.select_related('employee', 'employee__contact').all()
    serializer_class = AbsenceSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_class = AbsenceFilter


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
    def create_draft_payrolls(self, request):
        """Dispara manualmente la creación de liquidaciones borrador para el mes actual."""
        from .tasks import create_monthly_draft_payrolls
        result = create_monthly_draft_payrolls.delay()
        return Response({
            'detail': 'Tarea iniciada. Las liquidaciones borrador serán creadas en breve.',
            'task_id': result.id,
        }, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=['post'])
    def pay_previred(self, request, pk=None):
        """Registra el pago de obligaciones Previred (descuentos legales + aportes empleador)."""
        from .models import PayrollConcept
        payroll = self.get_object()
        if payroll.status != Payroll.Status.POSTED:
            return Response({'detail': 'Solo se puede pagar Previred de liquidaciones contabilizadas.'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Calculate total Previred (Employee + Employer)
        previred_total = payroll.items.filter(
            concept__category__in=[
                PayrollConcept.Category.DESCUENTO_LEGAL_TRABAJADOR,
                PayrollConcept.Category.DESCUENTO_LEGAL_EMPLEADOR
            ]
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')

        # Check existing payments
        paid_previred = PayrollPayment.objects.filter(
            payroll=payroll, 
            payment_type=PayrollPayment.PaymentType.PREVIRED
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
        
        remaining_previred = previred_total - paid_previred

        if remaining_previred <= 0:
            return Response({'detail': 'Las obligaciones de Previred ya están pagadas en su totalidad.'}, status=status.HTTP_400_BAD_REQUEST)

        payment_date = request.data.get('documentDate') or request.data.get('date') or timezone.now().date().isoformat()
        notes = request.data.get('notes', '')
        
        from treasury.services import TreasuryService
        from treasury.models import TreasuryAccount, PaymentMethod, TreasuryMovement

        treasury_account_id = request.data.get('treasury_account_id')
        payment_method_id = request.data.get('payment_method_new')
        
        if not treasury_account_id:
            return Response({'detail': 'Se requiere la cuenta de tesorería (treasury_account_id).'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            treasury_account = TreasuryAccount.objects.get(pk=int(treasury_account_id))
        except (TreasuryAccount.DoesNotExist, ValueError):
            return Response({'detail': 'Cuenta de tesorería no encontrada.'}, status=status.HTTP_400_BAD_REQUEST)

        payment_method_obj = None
        if payment_method_id:
            try:
                payment_method_obj = PaymentMethod.objects.get(pk=int(payment_method_id))
            except (PaymentMethod.DoesNotExist, ValueError):
                pass

        with transaction.atomic():
            movement = TreasuryService.create_movement(
                amount=remaining_previred,
                movement_type=TreasuryMovement.Type.OUTBOUND,
                payment_method=request.data.get('paymentMethod', TreasuryMovement.Method.TRANSFER),
                payment_method_new=payment_method_obj,
                from_account=treasury_account,
                date=payment_date,
                partner=payroll.employee.contact,
                payroll=payroll,
                payroll_payment_type=TreasuryMovement.PayrollPaymentType.PREVIRED,
                reference=f"Pago Previred {payroll.display_id} - {payroll.period_label}",
                notes=notes,
                transaction_number=request.data.get('transaction_number'),
                is_pending_registration=request.data.get('is_pending_registration', False),
                created_by=request.user
            )

            payment = PayrollPayment.objects.create(
                payroll=payroll,
                payment_type=PayrollPayment.PaymentType.PREVIRED,
                amount=remaining_previred,
                date=payment_date,
                notes=notes,
                journal_entry=movement.journal_entry
            )

        return Response(PayrollPaymentSerializer(payment).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def pay_salary(self, request, pk=None):
        """Registra el pago del sueldo líquido al trabajador."""
        payroll = self.get_object()
        if payroll.status != Payroll.Status.POSTED:
            return Response({'detail': 'Solo se puede registrar pago de liquidaciones contabilizadas.'}, status=status.HTTP_400_BAD_REQUEST)
        # Calculate what's actually pending:
        # Net Salary - Advances - Previous Salary Payments
        total_advances = payroll.advances.aggregate(total=Sum('amount'))['total'] or Decimal('0')
        paid_salary = PayrollPayment.objects.filter(
            payroll=payroll, 
            payment_type=PayrollPayment.PaymentType.SALARIO
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
        
        remaining_salary = payroll.net_salary - total_advances - paid_salary

        if remaining_salary <= 0:
            return Response({'detail': 'El sueldo líquido ya ha sido pagado en su totalidad (incluyendo anticipos).'}, status=status.HTTP_400_BAD_REQUEST)

        settings, _ = GlobalHRSettings.objects.get_or_create(pk=1)
        if not settings.account_remuneraciones_por_pagar:
            return Response({'detail': 'Falta configurar la cuenta Remuneraciones por Pagar en ajustes globales.'}, status=status.HTTP_400_BAD_REQUEST)
        payment_date = request.data.get('documentDate') or request.data.get('date') or timezone.now().date().isoformat()
        notes = request.data.get('notes', '')
        
        from treasury.services import TreasuryService
        from treasury.models import TreasuryAccount, PaymentMethod, TreasuryMovement

        treasury_account_id = request.data.get('treasury_account_id')
        payment_method_id = request.data.get('payment_method_new')

        if not treasury_account_id:
            return Response({'detail': 'Se requiere la cuenta de tesorería (treasury_account_id).'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            treasury_account = TreasuryAccount.objects.get(pk=int(treasury_account_id))
        except (TreasuryAccount.DoesNotExist, ValueError):
            return Response({'detail': 'Cuenta de tesorería no encontrada.'}, status=status.HTTP_400_BAD_REQUEST)

        payment_method_obj = None
        if payment_method_id:
            try:
                payment_method_obj = PaymentMethod.objects.get(pk=int(payment_method_id))
            except (PaymentMethod.DoesNotExist, ValueError):
                pass

        with transaction.atomic():
            movement = TreasuryService.create_movement(
                amount=remaining_salary,
                movement_type=TreasuryMovement.Type.OUTBOUND,
                payment_method=request.data.get('paymentMethod', TreasuryMovement.Method.TRANSFER),
                payment_method_new=payment_method_obj,
                from_account=treasury_account,
                date=payment_date,
                partner=payroll.employee.contact,
                payroll=payroll,
                payroll_payment_type=TreasuryMovement.PayrollPaymentType.SALARY,
                reference=f"Pago Sueldo {payroll.display_id} - {payroll.period_label}",
                notes=notes,
                transaction_number=request.data.get('transaction_number'),
                is_pending_registration=request.data.get('is_pending_registration', False),
                created_by=request.user
            )

            payment = PayrollPayment.objects.create(
                payroll=payroll,
                payment_type=PayrollPayment.PaymentType.SALARIO,
                amount=remaining_salary,
                date=payment_date,
                notes=notes,
                journal_entry=movement.journal_entry
            )
        return Response(PayrollPaymentSerializer(payment).data, status=status.HTTP_201_CREATED)

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


# --- Salary Advances ---

class SalaryAdvanceFilter(django_filters.FilterSet):
    employee = django_filters.NumberFilter(field_name='employee__id')
    payroll = django_filters.NumberFilter(field_name='payroll__id')
    is_discounted = django_filters.BooleanFilter()

    class Meta:
        model = SalaryAdvance
        fields = ['employee', 'payroll', 'is_discounted']


class SalaryAdvanceViewSet(viewsets.ModelViewSet):
    queryset = SalaryAdvance.objects.select_related('employee', 'employee__contact', 'payroll').all()
    serializer_class = SalaryAdvanceSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_class = SalaryAdvanceFilter

    def perform_create(self, serializer):
        from treasury.services import TreasuryService
        from treasury.models import TreasuryMovement

        # The advance itself is saved first
        # We ensure amount and date are taken from request if provided (e.g. from PaymentDialog)
        request_data = self.request.data
        if 'amount' in request_data:
            from decimal import Decimal
            try:
                serializer.validated_data['amount'] = Decimal(str(request_data['amount']))
            except (ValueError, TypeError):
                pass
        if 'date' in request_data:
            serializer.validated_data['date'] = request_data['date']
            
        advance = serializer.save()

        # Check if we have payment details in the request data
        payment_method = request_data.get('payment_method_new')
        treasury_account_id = request_data.get('treasury_account_id')

        if payment_method and treasury_account_id:
            from treasury.models import TreasuryAccount, PaymentMethod
            try:
                treasury_account = TreasuryAccount.objects.get(pk=int(treasury_account_id))
            except (TreasuryAccount.DoesNotExist, ValueError):
                return

            payment_method_obj = None
            try:
                payment_method_obj = PaymentMethod.objects.get(pk=int(payment_method))
            except (PaymentMethod.DoesNotExist, ValueError):
                pass

            with transaction.atomic():
                movement = TreasuryService.create_movement(
                    amount=advance.amount,
                    movement_type=TreasuryMovement.Type.OUTBOUND,
                    from_account=treasury_account,
                    payment_method=request_data.get('paymentMethod', TreasuryMovement.Method.CASH),
                    payment_method_new=payment_method_obj,
                    transaction_number=request_data.get('transaction_number'),
                    reference=f"Anticipo de sueldo: {advance.employee.contact.name} - {advance.date}",
                    date=advance.date,
                    partner=advance.employee.contact,
                    payroll=advance.payroll,
                    payroll_payment_type=TreasuryMovement.PayrollPaymentType.ADVANCE,
                    created_by=self.request.user
                )
                if movement and movement.journal_entry:
                    advance.journal_entry = movement.journal_entry
                    advance.save()
                # We could link the movement to the advance if we add a field, 
                # but the treasury engine already links to payroll if provided.
                # For an advance, it's often a pre-payroll payment.


# --- Payroll Payments ---

class PayrollPaymentFilter(django_filters.FilterSet):
    payroll = django_filters.NumberFilter(field_name='payroll__id')
    payment_type = django_filters.CharFilter()

    class Meta:
        model = PayrollPayment
        fields = ['payroll', 'payment_type']


class PayrollPaymentViewSet(viewsets.ModelViewSet):
    queryset = PayrollPayment.objects.select_related('payroll', 'payroll__employee', 'payroll__employee__contact').all()
    serializer_class = PayrollPaymentSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_class = PayrollPaymentFilter
