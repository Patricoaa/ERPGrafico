from rest_framework import serializers
from .models import ServiceCategory, ServiceContract, ServiceObligation
from accounting.serializers import AccountSerializer
from contacts.serializers import ContactSerializer
from django.utils import timezone

class ServiceCategorySerializer(serializers.ModelSerializer):
    expense_account_data = AccountSerializer(source='expense_account', read_only=True)
    payable_account_data = AccountSerializer(source='payable_account', read_only=True)

    class Meta:
        model = ServiceCategory
        fields = [
            'id', 'name', 'code', 
            'expense_account', 'expense_account_data',
            'payable_account', 'payable_account_data',
            'requires_provision'
        ]

class ServiceObligationSerializer(serializers.ModelSerializer):
    contract_name = serializers.CharField(source='contract.name', read_only=True)
    supplier_name = serializers.CharField(source='contract.supplier.name', read_only=True)
    is_overdue = serializers.SerializerMethodField()
    days_until_due = serializers.SerializerMethodField()
    invoice_number = serializers.CharField(source='invoice.number', read_only=True)
    payment_code = serializers.CharField(source='payment.code', read_only=True)
    
    class Meta:
        model = ServiceObligation
        fields = [
            'id', 'contract', 'contract_name', 'supplier_name',
            'due_date', 'period_start', 'period_end',
            'amount', 'paid_amount', 'status',
            'invoice', 'invoice_number', 'payment', 'payment_code', 'journal_entry',
            'invoiced_date', 'paid_date', 'notes',
            'is_overdue', 'days_until_due'
        ]
        read_only_fields = ['paid_amount', 'invoiced_date', 'paid_date']

    def get_is_overdue(self, obj):
        return (
            obj.status != ServiceObligation.Status.PAID and 
            obj.due_date < timezone.now().date()
        )

    def get_days_until_due(self, obj):
        delta = obj.due_date - timezone.now().date()
        return delta.days

class ServiceContractSerializer(serializers.ModelSerializer):
    supplier_data = ContactSerializer(source='supplier', read_only=True)
    category_data = ServiceCategorySerializer(source='category', read_only=True)
    next_obligation = serializers.SerializerMethodField()
    total_obligations = serializers.IntegerField(source='obligations.count', read_only=True)
    pending_amount = serializers.SerializerMethodField()

    class Meta:
        model = ServiceContract
        fields = [
            'id', 'contract_number', 'name', 'description',
            'supplier', 'supplier_data',
            'category', 'category_data',
            'recurrence_type', 'payment_day',
            'base_amount', 'is_amount_variable',
            'start_date', 'end_date', 'auto_renew', 'renewal_notice_days',
            'status',
            'expense_account', 'payable_account',
            'contract_file',
            'next_obligation', 'total_obligations', 'pending_amount',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['contract_number', 'created_at', 'updated_at']

    def validate(self, data):
        if data.get('end_date') and data.get('start_date') and data['end_date'] < data['start_date']:
            raise serializers.ValidationError({"end_date": "La fecha de término debe ser posterior al inicio."})
        return data

    def get_next_obligation(self, obj):
        next_ob = obj.obligations.filter(
            status=ServiceObligation.Status.PENDING
        ).order_by('due_date').first()
        if next_ob:
            return ServiceObligationSerializer(next_ob).data
        return None

    def get_pending_amount(self, obj):
        return sum(
            ob.amount - ob.paid_amount 
            for ob in obj.obligations.filter(status__in=['PENDING', 'OVERDUE', 'INVOICED'])
        )

class ServiceInvoiceRegistrationSerializer(serializers.Serializer):
    invoice_number = serializers.CharField(max_length=50, allow_blank=True)
    invoice_date = serializers.DateField()
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    dte_type = serializers.CharField(max_length=20, default='FACTURA') # FACTURA, BOLETA
    status = serializers.CharField(max_length=20, default='POSTED')
    document_attachment = serializers.FileField(required=False, allow_null=True)

    def validate(self, data):
        if data.get('status') != 'DRAFT' and data['dte_type'] == 'FACTURA' and not data.get('document_attachment'):
            raise serializers.ValidationError({"document_attachment": "El adjunto es obligatorio para Facturas."})
        return data

class ServicePaymentRegistrationSerializer(serializers.Serializer):
    payment_method = serializers.CharField(max_length=50)
    treasury_account_id = serializers.IntegerField()
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    reference = serializers.CharField(max_length=100, required=False, allow_blank=True)
    transaction_date = serializers.DateField(default=timezone.now)
