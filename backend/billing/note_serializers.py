from rest_framework import serializers
from billing.note_workflow import NoteWorkflow
from billing.models import Invoice


class NoteWorkflowSerializer(serializers.ModelSerializer):
    """Serializer for NoteWorkflow with full details"""
    
    invoice_display = serializers.CharField(source='invoice.display_id', read_only=True)
    corrected_invoice_display = serializers.CharField(source='corrected_invoice.display_id', read_only=True)
    corrected_invoice_number = serializers.CharField(source='corrected_invoice.number', read_only=True)
    corrected_invoice_total = serializers.DecimalField(source='corrected_invoice.total', max_digits=12, decimal_places=0, read_only=True)
    
    stage_display = serializers.CharField(source='get_current_stage_display', read_only=True)
    
    # Order information
    order_type = serializers.SerializerMethodField()
    order_id = serializers.SerializerMethodField()
    order_number = serializers.SerializerMethodField()
    
    # Totals from invoice
    total_net = serializers.DecimalField(source='invoice.total_net', max_digits=12, decimal_places=0, read_only=True)
    total_tax = serializers.DecimalField(source='invoice.total_tax', max_digits=12, decimal_places=0, read_only=True)
    total = serializers.DecimalField(source='invoice.total', max_digits=12, decimal_places=0, read_only=True)
    
    # Helper fields
    is_credit_note = serializers.BooleanField(read_only=True)
    is_debit_note = serializers.BooleanField(read_only=True)
    can_advance = serializers.BooleanField(read_only=True)
    total_items = serializers.IntegerField(read_only=True)
    has_stockable_items = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = NoteWorkflow
        fields = [
            'id',
            'invoice',
            'invoice_display',
            'corrected_invoice',
            'corrected_invoice_display',
            'corrected_invoice_number',
            'corrected_invoice_total',
            'sale_order',
            'purchase_order',
            'order_type',
            'order_id',
            'order_number',
            'current_stage',
            'stage_display',
            'requires_logistics',
            'registration_deferred',
            'selected_items',
            'logistics_data',
            'registration_data',
            'payment_data',
            'reason',
            'notes',
            'created_by',
            'created_at',
            'updated_at',
            'total_net',
            'total_tax',
            'total',
            'is_credit_note',
            'is_debit_note',
            'can_advance',
            'total_items',
            'has_stockable_items',
        ]
        read_only_fields = [
            'id',
            'invoice',
            'created_at',
            'updated_at',
            'current_stage',  # Stage transitions handled by service methods
        ]
    
    def get_order_type(self, obj):
        if obj.sale_order:
            return 'sale'
        elif obj.purchase_order:
            return 'purchase'
        return None
    
    def get_order_id(self, obj):
        if obj.sale_order:
            return obj.sale_order.id
        elif obj.purchase_order:
            return obj.purchase_order.id
        return None
    
    def get_order_number(self, obj):
        if obj.sale_order:
            return obj.sale_order.number
        elif obj.purchase_order:
            return obj.purchase_order.number
        return None


class CompleteWorkflowSerializer(serializers.Serializer):
    """Serializer for completing workflow"""
    workflow_id = serializers.IntegerField(required=True)
    payment_data = serializers.DictField(required=False, help_text="Datos de pago (opcional)")


class FullNoteCheckoutSerializer(serializers.Serializer):
    """
    Serializer for the atomic Note Checkout process.
    Receives all data at once and processes it in a single transaction.
    """
    # Base Data
    original_invoice_id = serializers.IntegerField(required=True)
    note_type = serializers.ChoiceField(choices=[Invoice.DTEType.NOTA_CREDITO, Invoice.DTEType.NOTA_DEBITO])
    reason = serializers.CharField(required=False, allow_blank=True)
    
    # Step 1: Items
    selected_items = serializers.ListField(
        child=serializers.DictField(),
        required=True,
        allow_empty=False
    )
    
    # Step 2: Logistics (Optional based on items)
    logistics_data = serializers.DictField(required=False, allow_null=True)
    
    # Step 3: DTE Registration
    # expected keys: document_number, document_date, is_pending
    registration_data = serializers.DictField(required=True)
    
    # Step 4: Payment (Optional)
    payment_data = serializers.DictField(required=False, allow_null=True)
    # expected keys: method, amount, treasury_account_id, transaction_number, is_pending
    
    # document_attachment handled by View (request.FILES)

