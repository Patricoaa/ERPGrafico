from django.utils import timezone
from rest_framework import serializers

from contacts.models import Contact
from core.serializers.mixins import FrozenFieldsField, IsEditableField

from .models import (
    AFP,
    Absence,
    Employee,
    EmployeeConceptAmount,
    EmployeeMovement,
    GlobalHRSettings,
    LoanInstallment,
    Payroll,
    PayrollAllocation,
    PayrollConcept,
    PayrollItem,
    PayrollPayment,
)


def _validate_assignable_employee(serializer, employee):
    """Empleados archivados no reciben nuevos anticipos ni inasistencias (ADR-0154)."""
    current = getattr(serializer.instance, "employee_id", None)
    if not employee.is_active and employee.pk != current:
        raise serializers.ValidationError(
            "El empleado está archivado; restáuralo para registrar movimientos nuevos."
        )
    return employee


_LOAN_TERM_FIELDS = ("rate", "installments_count", "first_installment_month")


def _validate_loan_terms(terms: dict) -> None:
    errors = {}
    if terms["rate"] is not None and terms["rate"] < 0:
        errors["rate"] = "La tasa no puede ser negativa."
    if terms["installments_count"] is not None and terms["installments_count"] < 1:
        errors["installments_count"] = "El préstamo requiere al menos una cuota."
    if terms["first_installment_month"] is not None and not 1 <= terms["first_installment_month"] <= 12:
        errors["first_installment_month"] = "El mes debe estar entre 1 y 12."
    if errors:
        raise serializers.ValidationError(errors)


class GlobalHRSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = GlobalHRSettings
        fields = "__all__"


class AFPSerializer(serializers.ModelSerializer):
    class Meta:
        model = AFP
        fields = "__all__"


class PayrollConceptSerializer(serializers.ModelSerializer):
    frozen_fields = FrozenFieldsField()
    category_display = serializers.CharField(source="get_category_display", read_only=True)
    formula_type_display = serializers.CharField(source="get_formula_type_display", read_only=True)
    account_code = serializers.CharField(source="account.code", read_only=True)
    account_name = serializers.CharField(source="account.name", read_only=True)

    class Meta:
        model = PayrollConcept
        fields = [
            "frozen_fields",
            "id",
            "name",
            "category",
            "category_display",
            "account",
            "account_code",
            "account_name",
            "formula_type",
            "formula_type_display",
            "formula",
            "default_amount",
            "is_system",
            "is_active",
        ]


# --- Employee ---


class ContactMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contact
        fields = ["id", "name", "tax_id", "display_id", "phone", "email", "is_partner"]


class EmployeeConceptAmountSerializer(serializers.ModelSerializer):
    concept_name = serializers.CharField(source="concept.name", read_only=True)

    class Meta:
        model = EmployeeConceptAmount
        fields = ["id", "employee", "concept", "concept_name", "amount"]
        read_only_fields = ["employee"]


class EmployeeSerializer(serializers.ModelSerializer):
    contact_detail = ContactMiniSerializer(source="contact", read_only=True)
    afp_detail = AFPSerializer(source="afp", read_only=True)
    display_id = serializers.CharField(read_only=True)
    salud_type_display = serializers.CharField(source="get_salud_type_display", read_only=True)
    contract_type_display = serializers.CharField(
        source="get_contract_type_display", read_only=True
    )
    jornada_type_display = serializers.CharField(source="get_jornada_type_display", read_only=True)
    asignacion_familiar_display = serializers.CharField(
        source="get_asignacion_familiar_display", read_only=True
    )
    concept_amounts = EmployeeConceptAmountSerializer(many=True, required=False)

    class Meta:
        model = Employee
        fields = [
            "id",
            "code",
            "display_id",
            "contact",
            "contact_detail",
            "position",
            "department",
            "start_date",
            "end_date",
            "is_active",
            "contract_type",
            "contract_type_display",
            "base_salary",
            "afp",
            "afp_detail",
            "salud_type",
            "salud_type_display",
            "isapre_amount_uf",
            "jornada_type",
            "jornada_type_display",
            "jornada_hours",
            "trabajo_pesado",
            "trabajo_agricola",
            "gratificacion",
            "dias_pactados",
            "asignacion_familiar",
            "asignacion_familiar_display",
            "cargas_familiares",
            "concept_amounts",
        ]
        read_only_fields = ["id", "code", "display_id", "created_at", "updated_at"]

    def create(self, validated_data):
        from .services import EmployeeService

        return EmployeeService.create_employee(validated_data)

    def update(self, instance, validated_data):
        from .services import EmployeeService
        return EmployeeService.update_employee(instance, validated_data)


class EmployeeWriteSerializer(serializers.ModelSerializer):
    """Optimized serializer for create and update views."""
    concept_amounts = EmployeeConceptAmountSerializer(many=True, required=False)

    class Meta:
        model = Employee
        fields = [
            "id",
            "code",
            "contact",
            "position",
            "department",
            "start_date",
            "end_date",
            "is_active",
            "contract_type",
            "base_salary",
            "afp",
            "salud_type",
            "isapre_amount_uf",
            "jornada_type",
            "jornada_hours",
            "trabajo_pesado",
            "trabajo_agricola",
            "gratificacion",
            "dias_pactados",
            "asignacion_familiar",
            "cargas_familiares",
            "concept_amounts",
        ]
        read_only_fields = ["id", "code"]

    def validate(self, attrs):
        """`end_date` e `is_active` van juntos: archivar fija el egreso, restaurar lo limpia."""
        instance = self.instance
        is_active = attrs.get("is_active", instance.is_active if instance else True)
        if is_active:
            if attrs.get("end_date") is not None:
                raise serializers.ValidationError(
                    {"end_date": "Un empleado activo no puede tener fecha de egreso."}
                )
            attrs["end_date"] = None
            return attrs
        end_date = attrs.get("end_date") or (instance.end_date if instance else None)
        end_date = end_date or timezone.localdate()
        start_date = attrs.get("start_date", instance.start_date if instance else None)
        if start_date and end_date < start_date:
            raise serializers.ValidationError(
                {"end_date": "La fecha de egreso no puede ser anterior a la de ingreso."}
            )
        attrs["end_date"] = end_date
        return attrs

    def create(self, validated_data):
        from .services import EmployeeService
        return EmployeeService.create_employee(validated_data)

    def update(self, instance, validated_data):
        from .services import EmployeeService
        return EmployeeService.update_employee(instance, validated_data)


class AbsenceSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.contact.name", read_only=True)
    employee_display_id = serializers.CharField(source="employee.display_id", read_only=True)
    absence_type_display = serializers.CharField(source="get_absence_type_display", read_only=True)

    class Meta:
        model = Absence
        fields = [
            "id",
            "employee",
            "employee_name",
            "employee_display_id",
            "absence_type",
            "absence_type_display",
            "start_date",
            "end_date",
            "days",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_employee(self, employee):
        return _validate_assignable_employee(self, employee)


# --- Payroll ---


class PayrollItemSerializer(serializers.ModelSerializer):
    concept_detail = PayrollConceptSerializer(source="concept", read_only=True)
    is_previred = serializers.BooleanField(read_only=True)

    class Meta:
        model = PayrollItem
        fields = [
            "id",
            "payroll",
            "concept",
            "concept_detail",
            "description",
            "amount",
            "is_previred",
        ]
        read_only_fields = ["id"]


class PayrollAllocationSerializer(serializers.ModelSerializer):
    kind = serializers.CharField(source="movement.kind", read_only=True)
    kind_display = serializers.CharField(source="movement.get_kind_display", read_only=True)
    movement_display_id = serializers.CharField(source="movement.display_id", read_only=True)
    movement_date = serializers.DateField(source="movement.date", read_only=True)
    movement_status = serializers.CharField(source="movement.status", read_only=True)
    installment_number = serializers.IntegerField(source="installment.number", read_only=True, default=None)

    class Meta:
        model = PayrollAllocation
        fields = [
            "id", "movement", "payroll", "movement_display_id", "movement_date", "movement_status", "kind", "kind_display",
            "amount", "principal_part", "interest_part", "installment", "installment_number",
        ]
        read_only_fields = fields


class LoanInstallmentSerializer(serializers.ModelSerializer):
    is_allocated = serializers.SerializerMethodField()

    def get_is_allocated(self, obj):
        return bool(obj.allocations.all())

    class Meta:
        model = LoanInstallment
        fields = ["id", "number", "year", "month", "principal", "interest", "amount", "status", "is_allocated"]
        read_only_fields = fields


class EmployeeMovementSerializer(serializers.ModelSerializer):
    """Movimiento con el empleado: pago de remuneración, anticipo o préstamo (ADR-0156)."""

    display_id = serializers.CharField(read_only=True)
    employee_name = serializers.CharField(source="employee.contact.name", read_only=True)
    employee_display_id = serializers.CharField(source="employee.display_id", read_only=True)
    kind_display = serializers.CharField(source="get_kind_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    installments = LoanInstallmentSerializer(many=True, read_only=True)
    allocations = PayrollAllocationSerializer(many=True, read_only=True)
    balance = serializers.DecimalField(max_digits=14, decimal_places=0, read_only=True)
    free_balance = serializers.DecimalField(max_digits=14, decimal_places=0, read_only=True)
    payment_method_name = serializers.SerializerMethodField()
    is_editable = IsEditableField()

    class Meta:
        model = EmployeeMovement
        fields = [
            "id", "display_id", "employee", "employee_name", "employee_display_id", "kind", "kind_display",
            "date", "amount", "notes", "status", "status_display", "journal_entry", "is_editable",
            "rate", "rate_period", "installments_count", "first_installment_year", "first_installment_month",
            "installments", "allocations", "balance", "free_balance", "payment_method_name", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "status", "journal_entry", "created_at", "updated_at"]

    def get_payment_method_name(self, obj):
        try:
            treasury = obj.journal_entry.treasury_movement
            return treasury.payment_method_new.name if treasury.payment_method_new else treasury.get_payment_method_display()
        except Exception:
            return None

    def validate_employee(self, employee):
        return _validate_assignable_employee(self, employee)

    def validate(self, attrs):
        if self.instance is not None:
            if "kind" in attrs and attrs["kind"] != self.instance.kind:
                raise serializers.ValidationError({"kind": "El tipo de un movimiento no se puede cambiar."})
            if self.instance.kind == EmployeeMovement.Kind.LOAN:
                merged = {f: attrs.get(f, getattr(self.instance, f)) for f in _LOAN_TERM_FIELDS}
                _validate_loan_terms(merged)
            return attrs
        kind = attrs.get("kind")
        if kind not in (EmployeeMovement.Kind.ADVANCE, EmployeeMovement.Kind.LOAN):
            raise serializers.ValidationError({"kind": "Solo se crean anticipos y préstamos; el pago se registra desde la liquidación."})
        if kind == EmployeeMovement.Kind.LOAN:
            required = ("rate", "rate_period", "installments_count", "first_installment_year", "first_installment_month")
            missing = {f: "Requerido para préstamos." for f in required if attrs.get(f) is None}
            if missing:
                raise serializers.ValidationError(missing)
            _validate_loan_terms({f: attrs[f] for f in _LOAN_TERM_FIELDS})
        return attrs


class PayrollListSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.contact.name", read_only=True)
    employee_display_id = serializers.CharField(source="employee.display_id", read_only=True)
    display_id = serializers.CharField(read_only=True)
    period_label = serializers.CharField(read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    legal_deductions_worker = serializers.SerializerMethodField()
    employer_contribution = serializers.SerializerMethodField()
    other_deductions = serializers.SerializerMethodField()
    advances_total = serializers.SerializerMethodField()
    previred_paid_amount = serializers.SerializerMethodField()
    remuneration_paid_amount = serializers.SerializerMethodField()
    remuneration_paid_status = serializers.SerializerMethodField()
    previred_paid_status = serializers.SerializerMethodField()
    total_previred = serializers.SerializerMethodField()

    def get_legal_deductions_worker(self, obj):
        return sum(
            item.amount
            for item in obj.items.all()
            if item.concept.category == "DESCUENTO_LEGAL_TRABAJADOR"
        ) or 0

    def get_employer_contribution(self, obj):
        return sum(
            item.amount
            for item in obj.items.all()
            if item.concept.category == "DESCUENTO_LEGAL_EMPLEADOR"
        ) or 0

    def get_other_deductions(self, obj):
        return sum(
            item.amount
            for item in obj.items.all()
            if item.concept.category == "OTRO_DESCUENTO"
        ) or 0

    def get_advances_total(self, obj):
        """Descuentos de anticipo/préstamo asignados a la liquidación (ADR-0156)."""
        return sum(a.amount for a in obj.allocations.all() if a.movement.kind != "PAYMENT" and a.movement.status in ("POSTED", "SETTLED")) or 0

    def get_previred_paid_amount(self, obj):
        from .models import PayrollPayment
        return sum(
            p.amount
            for p in obj.payments.all()
            if p.payment_type == PayrollPayment.PaymentType.PREVIRED
            and p.status == PayrollPayment.Status.POSTED
        ) or 0

    def get_remuneration_paid_amount(self, obj):
        return sum(
            a.amount
            for a in obj.allocations.all()
            if a.movement.kind == "PAYMENT" and a.movement.status == "POSTED"
        ) or 0

    def get_total_previred(self, obj):
        from .models import PayrollConcept
        return sum(
            item.amount
            for item in obj.items.all()
            if item.concept.category in [
                PayrollConcept.Category.DESCUENTO_LEGAL_TRABAJADOR,
                PayrollConcept.Category.DESCUENTO_LEGAL_EMPLEADOR,
            ]
        ) or 0

    def _get_payment_status(self, obj, paid, total):
        if obj.status == "DRAFT":
            return "PENDING"
        if total <= 0:
            return "PAID"
        if paid >= total:
            return "PAID"
        if paid > 0:
            return "PARTIAL"
        return "PENDING"

    def get_remuneration_paid_status(self, obj):
        paid = self.get_remuneration_paid_amount(obj)
        advances = self.get_advances_total(obj)
        total = obj.net_salary - advances
        return self._get_payment_status(obj, paid, total)

    def get_previred_paid_status(self, obj):
        paid = self.get_previred_paid_amount(obj)
        total = self.get_total_previred(obj)
        return self._get_payment_status(obj, paid, total)

    class Meta:
        model = Payroll
        fields = [
            "id",
            "number",
            "display_id",
            "employee",
            "employee_name",
            "employee_display_id",
            "period_year",
            "period_month",
            "period_label",
            "status",
            "status_display",
            "base_salary",
            "agreed_days",
            "absent_days",
            "worked_days",
            "total_haberes",
            "total_descuentos",
            "net_salary",
            "legal_deductions_worker",
            "employer_contribution",
            "other_deductions",
            "advances_total",
            "previred_paid_amount",
            "remuneration_paid_amount",
            "remuneration_paid_status",
            "previred_paid_status",
            "total_previred",
            "journal_entry",
            "previred_journal_entry",
            "created_at",
            "updated_at",
        ]


class PayrollDetailSerializer(serializers.ModelSerializer):
    employee_detail = EmployeeSerializer(source="employee", read_only=True)
    display_id = serializers.CharField(read_only=True)
    period_label = serializers.CharField(read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    items = PayrollItemSerializer(many=True, read_only=True)
    allocations = PayrollAllocationSerializer(many=True, read_only=True)
    balance = serializers.SerializerMethodField()
    cap_warning = serializers.SerializerMethodField()
    is_editable = IsEditableField()

    def get_balance(self, obj):
        from .movement_services import payroll_balance
        return payroll_balance(obj)

    def get_cap_warning(self, obj):
        from .movement_services import EmployeeMovementService
        return EmployeeMovementService.cap_warning(obj)  # una sola liquidación por request (detalle)

    class Meta:
        model = Payroll
        fields = [
            "id",
            "number",
            "display_id",
            "employee",
            "employee_detail",
            "period_year",
            "period_month",
            "period_label",
            "status",
            "status_display",
            "is_editable",
            "base_salary",
            "agreed_days",
            "absent_days",
            "worked_days",
            "total_haberes",
            "total_descuentos",
            "net_salary",
            "journal_entry",
            "previred_journal_entry",
            "items",
            "allocations",
            "balance",
            "cap_warning",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "number",
            "display_id",
            "status",
            "total_haberes",
            "total_descuentos",
            "net_salary",
            "journal_entry",
            "previred_journal_entry",
        ]
        validators = []

    def validate(self, data):
        from .validators import PayrollValidator
        return PayrollValidator.validate_payroll(self.instance, data)

class PayrollWriteSerializer(serializers.ModelSerializer):
    """Optimized serializer for create and update views."""
    class Meta:
        model = Payroll
        fields = [
            "id",
            "number",
            "employee",
            "period_year",
            "period_month",
            "status",
            "base_salary",
            "agreed_days",
            "absent_days",
            "worked_days",
            "notes",
        ]
        read_only_fields = ["id", "number", "status"]
        validators = []

    def validate(self, data):
        from .validators import PayrollValidator
        return PayrollValidator.validate_payroll(self.instance, data)


class PayrollPaymentSerializer(serializers.ModelSerializer):
    payroll_display_id = serializers.CharField(source="payroll.display_id", read_only=True)
    employee_name = serializers.CharField(source="payroll.employee.contact.name", read_only=True)
    payment_type_display = serializers.CharField(source="get_payment_type_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = PayrollPayment
        fields = [
            "id",
            "payroll",
            "payroll_display_id",
            "employee_name",
            "payment_type",
            "payment_type_display",
            "amount",
            "date",
            "notes",
            "status",
            "status_display",
            "journal_entry",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "status", "journal_entry", "created_at", "updated_at"]


class EmployeePayrollPreviewSerializer(serializers.ModelSerializer):
    """
    Serializer strictly for the employee viewing their own payroll.
    Excludes employer contributions from the item list.
    """

    employee_name = serializers.CharField(source="employee.contact.name", read_only=True)
    employee_display_id = serializers.CharField(source="employee.display_id", read_only=True)
    display_id = serializers.CharField(read_only=True)
    period_label = serializers.CharField(read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    # We will filter the items directly in the SerializerMethodField
    items = PayrollItemSerializer(many=True, read_only=True)
    allocations = PayrollAllocationSerializer(many=True, read_only=True)
    payments = PayrollPaymentSerializer(many=True, read_only=True)
    employee_detail = EmployeeSerializer(source="employee", read_only=True)
    is_salary_paid = serializers.SerializerMethodField()
    is_previred_paid = serializers.SerializerMethodField()

    class Meta:
        model = Payroll
        fields = [
            "id",
            "number",
            "display_id",
            "employee",
            "employee_name",
            "employee_display_id",
            "employee_detail",
            "period_year",
            "period_month",
            "period_label",
            "status",
            "status_display",
            "base_salary",
            "agreed_days",
            "absent_days",
            "worked_days",
            "total_haberes",
            "total_descuentos",
            "net_salary",
            "is_salary_paid",
            "is_previred_paid",
            "items",
            "allocations",
            "payments",
            "notes",
            "created_at",
            "updated_at",
        ]

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        # Filter items to exclude employer contributions from the employee's view
        if "items" in ret:
            ret["items"] = [
                item
                for item in ret["items"]
                if item["concept_detail"]["category"]
                != PayrollConcept.Category.DESCUENTO_LEGAL_EMPLEADOR.value
            ]
        return ret

    def get_is_salary_paid(self, obj):
        return any(a.movement.kind == "PAYMENT" and a.movement.status == "POSTED" for a in obj.allocations.all())

    def get_is_previred_paid(self, obj):
        try:
            return any(
                p.payment_type == PayrollPayment.PaymentType.PREVIRED.value
                and p.status == PayrollPayment.Status.POSTED
                for p in obj.payments.all()
            )
        except Exception:
            return False
