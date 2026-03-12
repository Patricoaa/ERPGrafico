from rest_framework import serializers
from .models import GlobalHRSettings, AFP, PayrollConcept, Employee, Payroll, PayrollItem, EmployeeConceptAmount, Absence, SalaryAdvance, PayrollPayment
from contacts.models import Contact


class GlobalHRSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = GlobalHRSettings
        fields = '__all__'


class AFPSerializer(serializers.ModelSerializer):
    class Meta:
        model = AFP
        fields = '__all__'


class PayrollConceptSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    formula_type_display = serializers.CharField(source='get_formula_type_display', read_only=True)
    account_code = serializers.CharField(source='account.code', read_only=True)
    account_name = serializers.CharField(source='account.name', read_only=True)

    class Meta:
        model = PayrollConcept
        fields = [
            'id', 'name', 'category', 'category_display',
            'account', 'account_code', 'account_name',
            'formula_type', 'formula_type_display',
            'formula', 'default_amount', 'is_system'
        ]


# --- Employee ---

class ContactMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contact
        fields = ['id', 'name', 'tax_id', 'display_id', 'phone', 'email']


class EmployeeConceptAmountSerializer(serializers.ModelSerializer):
    concept_name = serializers.CharField(source='concept.name', read_only=True)

    class Meta:
        model = EmployeeConceptAmount
        fields = ['id', 'employee', 'concept', 'concept_name', 'amount']


class EmployeeSerializer(serializers.ModelSerializer):
    contact_detail = ContactMiniSerializer(source='contact', read_only=True)
    afp_detail = AFPSerializer(source='afp', read_only=True)
    display_id = serializers.CharField(read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    salud_type_display = serializers.CharField(source='get_salud_type_display', read_only=True)
    contract_type_display = serializers.CharField(source='get_contract_type_display', read_only=True)
    jornada_type_display = serializers.CharField(source='get_jornada_type_display', read_only=True)
    asignacion_familiar_display = serializers.CharField(source='get_asignacion_familiar_display', read_only=True)
    concept_amounts = EmployeeConceptAmountSerializer(many=True, required=False)

    class Meta:
        model = Employee
        fields = [
            'id', 'code', 'display_id',
            'contact', 'contact_detail',
            'position', 'department',
            'start_date',
            'status', 'status_display',
            'contract_type', 'contract_type_display',
            'base_salary',
            'afp', 'afp_detail',
            'salud_type', 'salud_type_display',
            'isapre_amount_uf',
            'jornada_type', 'jornada_type_display', 'jornada_hours',
            'trabajo_pesado', 'trabajo_agricola',
            'gratificacion', 'dias_pactados',
            'asignacion_familiar', 'asignacion_familiar_display', 'cargas_familiares',
            'concept_amounts'
        ]
        read_only_fields = ['id', 'code', 'display_id', 'created_at', 'updated_at']

    def _handle_concept_amounts(self, employee, concept_amounts_data):
        if concept_amounts_data is not None:
            # We replace/update the list
            # For simplicity in this logic, we'll sync the list
            existing_ids = []
            for item_data in concept_amounts_data:
                concept = item_data.get('concept')
                amount = item_data.get('amount')
                obj, created = EmployeeConceptAmount.objects.update_or_create(
                    employee=employee,
                    concept=concept,
                    defaults={'amount': amount}
                )
                existing_ids.append(obj.id)
            
            # Remove those not in the new list
            EmployeeConceptAmount.objects.filter(employee=employee).exclude(id__in=existing_ids).delete()

    def create(self, validated_data):
        concept_amounts_data = validated_data.pop('concept_amounts', None)
        employee = super().create(validated_data)
        self._handle_concept_amounts(employee, concept_amounts_data)
        return employee

    def update(self, instance, validated_data):
        concept_amounts_data = validated_data.pop('concept_amounts', None)
        employee = super().update(instance, validated_data)
        self._handle_concept_amounts(employee, concept_amounts_data)
        return employee


class AbsenceSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.contact.name', read_only=True)
    employee_display_id = serializers.CharField(source='employee.display_id', read_only=True)
    absence_type_display = serializers.CharField(source='get_absence_type_display', read_only=True)

    class Meta:
        model = Absence
        fields = [
            'id', 'employee', 'employee_name', 'employee_display_id',
            'absence_type', 'absence_type_display',
            'start_date', 'end_date', 'days', 'notes',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


# --- Payroll ---

class PayrollItemSerializer(serializers.ModelSerializer):
    concept_detail = PayrollConceptSerializer(source='concept', read_only=True)
    is_previred = serializers.BooleanField(read_only=True)

    class Meta:
        model = PayrollItem
        fields = [
            'id', 'payroll',
            'concept', 'concept_detail',
            'description', 'amount',
            'is_previred',
        ]
        read_only_fields = ['id']


class PayrollListSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.contact.name', read_only=True)
    employee_display_id = serializers.CharField(source='employee.display_id', read_only=True)
    display_id = serializers.CharField(read_only=True)
    period_label = serializers.CharField(read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Payroll
        fields = [
            'id', 'number', 'display_id',
            'employee', 'employee_name', 'employee_display_id',
            'period_year', 'period_month', 'period_label',
            'status', 'status_display',
            'base_salary', 'agreed_days', 'absent_days', 'worked_days',
            'total_haberes', 'total_descuentos', 'net_salary',
            'journal_entry', 'previred_journal_entry',
            'created_at', 'updated_at',
        ]


class SalaryAdvanceSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.contact.name', read_only=True)
    employee_display_id = serializers.CharField(source='employee.display_id', read_only=True)
    payroll_display_id = serializers.CharField(source='payroll.display_id', read_only=True)
    payment_method_name = serializers.SerializerMethodField()

    class Meta:
        model = SalaryAdvance
        fields = [
            'id', 'employee', 'employee_name', 'employee_display_id',
            'payroll', 'payroll_display_id',
            'amount', 'date', 'notes', 'is_discounted',
            'journal_entry', 'payment_method_name', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_payment_method_name(self, obj):
        if obj.journal_entry:
            # Try to get the treasury movement associated with this journal entry
            try:
                movement = obj.journal_entry.treasury_movement
                if movement.payment_method_new:
                    return movement.payment_method_new.name
                return movement.get_payment_method_display()
            except:
                pass
        return None


class PayrollDetailSerializer(serializers.ModelSerializer):
    employee_detail = EmployeeSerializer(source='employee', read_only=True)
    display_id = serializers.CharField(read_only=True)
    period_label = serializers.CharField(read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    items = PayrollItemSerializer(many=True, read_only=True)
    advances = SalaryAdvanceSerializer(many=True, read_only=True)

    class Meta:
        model = Payroll
        fields = [
            'id', 'number', 'display_id',
            'employee', 'employee_detail',
            'period_year', 'period_month', 'period_label',
            'status', 'status_display',
            'base_salary', 'agreed_days', 'absent_days', 'worked_days',
            'total_haberes', 'total_descuentos', 'net_salary',
            'journal_entry', 'previred_journal_entry',
            'items', 'advances', 'notes',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'number', 'display_id', 'status', 
            'total_haberes', 'total_descuentos', 'net_salary', 
            'journal_entry', 'previred_journal_entry'
        ]


class PayrollPaymentSerializer(serializers.ModelSerializer):
    payroll_display_id = serializers.CharField(source='payroll.display_id', read_only=True)
    employee_name = serializers.CharField(source='payroll.employee.contact.name', read_only=True)
    payment_type_display = serializers.CharField(source='get_payment_type_display', read_only=True)

    class Meta:
        model = PayrollPayment
        fields = [
            'id', 'payroll', 'payroll_display_id', 'employee_name',
            'payment_type', 'payment_type_display',
            'amount', 'date', 'notes', 'journal_entry',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
