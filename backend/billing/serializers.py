from rest_framework import serializers
from .models import Invoice
from treasury.serializers import PaymentSerializer
from sales.serializers import SaleOrderSerializer
from purchasing.serializers import PurchaseOrderSerializer
from core.serializers import AttachmentSerializer

class InvoiceSerializer(serializers.ModelSerializer):
    attachments = AttachmentSerializer(many=True, read_only=True)
    dte_type_display = serializers.CharField(source='get_dte_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    payment_method_display = serializers.CharField(source='get_payment_method_display', read_only=True)
    
    sale_order_number = serializers.CharField(source='sale_order.number', read_only=True, allow_null=True)
    purchase_order_number = serializers.CharField(source='purchase_order.number', read_only=True, allow_null=True)
    po_receiving_status = serializers.CharField(source='purchase_order.receiving_status', read_only=True, allow_null=True)
    partner_name = serializers.SerializerMethodField()
    related_documents = serializers.SerializerMethodField()
    related_stock_moves = serializers.SerializerMethodField()
    lines = serializers.SerializerMethodField()
    pending_amount = serializers.SerializerMethodField()
    serialized_payments = serializers.SerializerMethodField()
    adjustments = serializers.SerializerMethodField()
    corrected_invoice = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = '__all__'

    def get_serialized_payments(self, obj):
        return PaymentSerializer(obj.payments.all(), many=True).data

    def get_pending_amount(self, obj):
        total_paid = sum(p.amount for p in obj.payments.all())
        return obj.total - total_paid

    def get_lines(self, obj):
        # 1. Prioritize NoteWorkflow items for NC/ND
        if obj.dte_type in [Invoice.DTEType.NOTA_CREDITO, Invoice.DTEType.NOTA_DEBITO]:
            try:
                if hasattr(obj, 'workflow') and obj.workflow and obj.workflow.selected_items:
                    return obj.workflow.selected_items
            except:
                pass

        # 2. Fallback to order lines
        if obj.sale_order:
            from sales.serializers import SaleLineSerializer
            return SaleLineSerializer(obj.sale_order.lines.all(), many=True).data
        if obj.purchase_order:
            from purchasing.serializers import PurchaseLineSerializer
            return PurchaseLineSerializer(obj.purchase_order.lines.all(), many=True).data
        return []

    def get_related_documents(self, obj):
        if obj.purchase_order:
            # We reuse the logic from PurchaseOrderSerializer efficiently
            # Note: Importing inside method to avoid circular imports
            from purchasing.serializers import PurchaseOrderSerializer
            return PurchaseOrderSerializer().get_related_documents(obj.purchase_order)
        if obj.sale_order:
            from sales.serializers import SaleOrderSerializer
            return SaleOrderSerializer().get_related_documents(obj.sale_order)
        return None

    def get_partner_name(self, obj):
        if obj.sale_order:
            return obj.sale_order.customer.name
        if obj.purchase_order:
            return obj.purchase_order.supplier.name
        if obj.contact:
            return obj.contact.name
        return ""

    def get_related_stock_moves(self, obj):
        if not obj.journal_entry:
            return []
        
        from inventory.models import StockMove
        moves = StockMove.objects.filter(journal_entry=obj.journal_entry)
        
        return [{
            'id': m.id,
            'display_id': f"MOV-{m.id:06d}",
            'date': m.date,
            'product': m.product.name,
            'quantity': m.quantity,
            'warehouse': m.warehouse.name,
            'move_type_display': m.get_move_type_display()
        } for m in moves]

    def get_adjustments(self, obj):
        # Only Facturas/Boletas usually have adjustments (Notes correcting them)
        adjustments = obj.adjustments.all()
        return [{
            'id': a.id,
            'number': a.number,
            'dte_type': a.dte_type,
            'dte_type_display': a.get_dte_type_display(),
            'status': a.status,
            'total': float(a.total),
            'display_id': a.display_id
        } for a in adjustments]

    def get_corrected_invoice(self, obj):
        if not obj.corrected_invoice:
            return None
        return {
            'id': obj.corrected_invoice.id,
            'number': obj.corrected_invoice.number,
            'display_id': obj.corrected_invoice.display_id,
            'dte_type': obj.corrected_invoice.dte_type,
            'dte_type_display': obj.corrected_invoice.get_dte_type_display()
        }

class CreateInvoiceSerializer(serializers.Serializer):
    order_id = serializers.IntegerField()
    order_type = serializers.ChoiceField(choices=['sale', 'purchase'])
    dte_type = serializers.ChoiceField(choices=Invoice.DTEType.choices)
    payment_method = serializers.ChoiceField(choices=Invoice.PaymentMethod.choices, default='CREDIT')
    supplier_invoice_number = serializers.CharField(required=False, allow_blank=True)
    document_attachment = serializers.FileField(required=False, allow_null=True)
    issue_date = serializers.DateField(required=False, allow_null=True)
    status = serializers.ChoiceField(choices=Invoice.Status.choices, default=Invoice.Status.POSTED)

