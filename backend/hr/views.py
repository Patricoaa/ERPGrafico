
import django_filters
from django.core.exceptions import ValidationError
from django.db import transaction
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.api.pagination import StandardResultsSetPagination
from core.api.permissions import require_perms
from core.edit_policy import annotate_edit_usage, assert_editable
from core.idempotency import idempotent_endpoint
from core.mixins import AuditHistoryMixin as AuditHistory
from core.mixins import EditPolicyMixin

from . import services
from .models import (
    AFP,
    Absence,
    Employee,
    EmployeeConceptAmount,
    GlobalHRSettings,
    Payroll,
    PayrollConcept,
    PayrollItem,
    PayrollPayment,
    SalaryAdvance,
)
from .payroll_pdf import generate_payroll_pdf
from .serializers import (
    AbsenceSerializer,
    AFPSerializer,
    EmployeeConceptAmountSerializer,
    EmployeeSerializer,
    EmployeeWriteSerializer,
    GlobalHRSettingsSerializer,
    PayrollConceptSerializer,
    PayrollDetailSerializer,
    PayrollItemSerializer,
    PayrollListSerializer,
    PayrollPaymentSerializer,
    PayrollWriteSerializer,
    SalaryAdvanceSerializer,
)
from .services import PayrollPaymentService

# --- Global Settings (singleton) ---


class GlobalHRSettingsViewSet(viewsets.ViewSet):
    """Parámetros globales de RRHH Chile."""

    def get_permissions(self):
        perm = "view" if self.request.method in ("GET", "HEAD", "OPTIONS") else "change"
        return [require_perms(f"hr.{perm}_globalhrsettings")()]

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

    @action(detail=False, methods=["get", "patch", "put"])
    def current(self, request):
        obj, _ = GlobalHRSettings.objects.get_or_create(pk=1)
        if request.method in ["PATCH", "PUT"]:
            serializer = GlobalHRSettingsSerializer(
                obj, data=request.data, partial=(request.method == "PATCH")
            )
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)
        return Response(GlobalHRSettingsSerializer(obj).data)


# --- AFP ---


class AFPViewSet(viewsets.ModelViewSet):
    queryset = AFP.objects.all()
    serializer_class = AFPSerializer
    pagination_class = None  # Master data
    lookup_field = "id"

    def get_queryset(self):
        if self.action == "list":
            is_active = self.request.query_params.get("is_active")
            if is_active == "all":
                return AFP.objects.all()
            elif is_active == "false":
                return AFP.objects.filter(is_active=False)
            return AFP.objects.filter(is_active=True)
        return super().get_queryset()

    def destroy(self, request, *args, **kwargs):
        return Response(
            {"detail": "Hard delete not allowed for AFPs. Use PATCH is_active=false to archive."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )


# --- Payroll Concept ---


class PayrollConceptFilter(django_filters.FilterSet):
    category = django_filters.CharFilter()
    is_system = django_filters.BooleanFilter()

    class Meta:
        model = PayrollConcept
        fields = ["category", "is_system"]


class PayrollConceptViewSet(EditPolicyMixin, viewsets.ModelViewSet):
    queryset = PayrollConcept.objects.select_related("account").all()
    serializer_class = PayrollConceptSerializer
    pagination_class = None  # Master data
    filter_backends = [DjangoFilterBackend]
    filterset_class = PayrollConceptFilter

    def get_queryset(self):
        if self.action == "list":
            is_active = self.request.query_params.get("is_active")
            qs = PayrollConcept.objects.select_related("account")
            if is_active == "false":
                qs = qs.filter(is_active=False)
            elif is_active != "all":
                qs = qs.filter(is_active=True)
            return annotate_edit_usage(qs)
        return annotate_edit_usage(super().get_queryset())

    def destroy(self, request, *args, **kwargs):
        return Response(
            {"detail": "Hard delete not allowed for PayrollConcepts. Use PATCH is_active=false to archive."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )


# --- Employee ---


class EmployeeFilter(django_filters.FilterSet):
    status = django_filters.CharFilter(field_name="status")
    contact = django_filters.NumberFilter(field_name="contact__id")

    class Meta:
        model = Employee
        fields = ["status", "contact"]


class EmployeeViewSet(AuditHistory, viewsets.ModelViewSet):
    queryset = Employee.objects.select_related("contact", "afp").prefetch_related(
        "concept_amounts__concept"
    ).all()
    serializer_class = EmployeeSerializer
    pagination_class = None  # Master data
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return EmployeeWriteSerializer
        return EmployeeSerializer
    filterset_class = EmployeeFilter
    search_fields = ["contact__name", "contact__tax_id", "position"]


# --- Absence ---


class AbsenceFilter(django_filters.FilterSet):
    employee = django_filters.NumberFilter(field_name="employee__id")
    start_date = django_filters.DateFromToRangeFilter()
    absence_type = django_filters.CharFilter()

    class Meta:
        model = Absence
        fields = ["employee", "absence_type", "start_date"]


class AbsenceViewSet(viewsets.ModelViewSet):
    pagination_class = StandardResultsSetPagination
    queryset = Absence.objects.select_related("employee", "employee__contact").all()
    serializer_class = AbsenceSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_class = AbsenceFilter


# --- Payroll ---


class PayrollFilter(django_filters.FilterSet):
    employee = django_filters.NumberFilter(field_name="employee__id")
    period_year = django_filters.NumberFilter()
    period_month = django_filters.NumberFilter()
    status = django_filters.CharFilter()
    date_from = django_filters.DateFilter(field_name="created_at", lookup_expr="date__gte")
    date_to = django_filters.DateFilter(field_name="created_at", lookup_expr="date__lte")

    class Meta:
        model = Payroll
        fields = ["employee", "period_year", "period_month", "status", "date_from", "date_to"]


class PayrollViewSet(EditPolicyMixin, viewsets.ModelViewSet):
    pagination_class = StandardResultsSetPagination
    def get_queryset(self):
        return (
            Payroll.objects.select_related(
                "employee", "employee__contact", "journal_entry", "previred_journal_entry"
            )
            .prefetch_related("items", "items__concept", "advances", "payments")
            .all()
        )
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_class = PayrollFilter
    search_fields = ["employee__contact__name"]

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return PayrollWriteSerializer
        if self.action == "retrieve":
            return PayrollDetailSerializer
        return PayrollListSerializer

    def perform_create(self, serializer):
        payroll = serializer.save()
        # Inicializar base_salary y generar proforma via servicio
        services.PayrollService.initialize_after_create(payroll=payroll)

    @action(detail=True, methods=["post"])
    def post_payroll(self, request, pk=None):
        """Contabiliza la liquidación."""
        payroll = self.get_object()
        try:
            payroll = services.post_payroll(payroll)
        except ValidationError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(PayrollDetailSerializer(payroll).data)

    @action(detail=True, methods=["post"])
    def recalculate(self, request, pk=None):
        """Recalcula los totales."""
        payroll = self.get_object()
        assert_editable(payroll)
        payroll.recalculate_totals()
        return Response(PayrollDetailSerializer(payroll).data)

    @idempotent_endpoint(scope="hr.payroll.draft")
    @action(detail=False, methods=["post"])
    def create_draft_payrolls(self, request):
        """Dispara manualmente la creación de liquidaciones borrador para el mes actual."""
        from celery import uuid

        from .tasks import create_monthly_draft_payrolls

        task_id = uuid()
        transaction.on_commit(lambda: create_monthly_draft_payrolls.apply_async(task_id=task_id))
        return Response(
            {
                "detail": "Tarea iniciada. Las liquidaciones borrador serán creadas en breve.",
                "task_id": task_id,
            },
            status=status.HTTP_202_ACCEPTED,
        )

    @action(detail=True, methods=["post"])
    def pay_previred(self, request, pk=None):
        try:
            payment = PayrollPaymentService.pay_previred_from_request(request, self.get_object())
        except ValidationError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(PayrollPaymentSerializer(payment).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def pay_salary(self, request, pk=None):
        try:
            payment = PayrollPaymentService.pay_salary_from_request(request, self.get_object())
        except ValidationError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(PayrollPaymentSerializer(payment).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"])
    def generate_proforma(self, request):
        """Genera una liquidación pre-calculada para un empleado/período."""
        employee_id = request.data.get("employee")
        year = request.data.get("period_year")
        month = request.data.get("period_month")

        if not all([employee_id, year, month]):
            return Response(
                {"detail": "Faltan parámetros: employee, period_year, period_month"}, status=400
            )

        try:
            payroll = services.PayrollService.generate_proforma_payroll(employee_id, year, month)
            return Response(PayrollDetailSerializer(payroll).data)
        except Exception as e:
            return Response({"detail": str(e)}, status=400)

    @action(detail=True, methods=["get"])
    def download_pdf(self, request, pk=None):
        from django.http import HttpResponse

        payroll = self.get_object()
        try:
            buffer = generate_payroll_pdf(payroll)
        except ImportError as e:
            return Response({"detail": str(e)}, status=500)

        filename = f"Liquidacion_{payroll.display_id}_{payroll.period_label.replace(' ', '_')}.pdf"
        response = HttpResponse(buffer, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response


# --- PayrollItems ---


class PayrollItemViewSet(EditPolicyMixin, viewsets.ModelViewSet):
    pagination_class = StandardResultsSetPagination
    serializer_class = PayrollItemSerializer

    def get_queryset(self):
        return PayrollItem.objects.filter(payroll_id=self.kwargs.get("payroll_pk")).select_related(
            "concept", "payroll"
        )

    def perform_create(self, serializer):
        payroll = Payroll.objects.get(pk=self.kwargs["payroll_pk"])
        assert_editable(payroll, {"items"})
        serializer.save(payroll=payroll)
        payroll.recalculate_totals()

    def perform_update(self, serializer):
        super().perform_update(serializer)
        serializer.instance.payroll.recalculate_totals()

    def perform_destroy(self, instance):
        payroll = instance.payroll
        super().perform_destroy(instance)
        payroll.recalculate_totals()


class EmployeeConceptAmountViewSet(viewsets.ModelViewSet):
    pagination_class = StandardResultsSetPagination
    queryset = EmployeeConceptAmount.objects.all()
    serializer_class = EmployeeConceptAmountSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["employee", "concept"]


# --- Salary Advances ---


class SalaryAdvanceFilter(django_filters.FilterSet):
    employee = django_filters.NumberFilter(field_name="employee__id")
    payroll = django_filters.NumberFilter(field_name="payroll__id")
    payroll_isnull = django_filters.BooleanFilter(field_name="payroll", lookup_expr="isnull")
    date_from = django_filters.DateFilter(field_name="date", lookup_expr="gte")
    date_to = django_filters.DateFilter(field_name="date", lookup_expr="lte")
    employee_name = django_filters.CharFilter(field_name="employee__contact__name", lookup_expr="icontains")

    class Meta:
        model = SalaryAdvance
        fields = ["employee", "payroll", "payroll_isnull", "status", "date_from", "date_to", "employee_name"]


class SalaryAdvanceViewSet(EditPolicyMixin, viewsets.ModelViewSet):
    pagination_class = StandardResultsSetPagination
    queryset = SalaryAdvance.objects.select_related(
        "employee", "employee__contact", "payroll",
        "journal_entry__treasury_movement__payment_method_new",
    ).all()
    serializer_class = SalaryAdvanceSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_class = SalaryAdvanceFilter

    def perform_create(self, serializer):
        from .services import SalaryAdvanceService

        SalaryAdvanceService.create_advance_from_serializer(
            serializer, self.request.data, self.request.user
        )

    @action(detail=True, methods=["post"])
    def annul(self, request, pk=None):
        from .services import SalaryAdvanceService

        try:
            advance = SalaryAdvanceService.annul_advance(
                self.get_object(), reason=request.data.get("reason", ""), user=request.user
            )
        except ValidationError as e:
            msg = e.messages[0] if getattr(e, "messages", None) else str(e)
            return Response({"detail": msg}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(advance).data)


# --- Payroll Payments ---


class PayrollPaymentFilter(django_filters.FilterSet):
    payroll = django_filters.NumberFilter(field_name="payroll__id")
    payment_type = django_filters.CharFilter()

    class Meta:
        model = PayrollPayment
        fields = ["payroll", "payment_type"]


class PayrollPaymentViewSet(viewsets.ReadOnlyModelViewSet):
    """Payments are created only by PayrollViewSet.pay_salary / pay_previred (ADR-0091)."""

    pagination_class = StandardResultsSetPagination
    queryset = PayrollPayment.objects.select_related(
        "payroll", "payroll__employee", "payroll__employee__contact"
    ).all()
    serializer_class = PayrollPaymentSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_class = PayrollPaymentFilter

    @action(detail=True, methods=["post"])
    def annul(self, request, pk=None):
        try:
            payment = PayrollPaymentService.annul_payment(
                self.get_object(), reason=request.data.get("reason", ""), user=request.user
            )
        except ValidationError as e:
            msg = e.messages[0] if getattr(e, "messages", None) else str(e)
            return Response({"detail": msg}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(payment).data)
