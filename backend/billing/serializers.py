from rest_framework import serializers
from .models import Invoice
from sales.serializers import SaleOrderSerializer
from purchasing.serializers import PurchaseOrderSerializer

class InvoiceSerializer(serializers.ModelSerializer):
    dte_type_display = serializers.CharField(source='get_dte_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    payment_method_display = serializers.CharField(source='get_payment_method_display', read_only=True)
    
    sale_order_number = serializers.CharField(source='sale_order.number', read_only=True, allow_null=True)
    purchase_order_number = serializers.CharField(source='purchase_order.number', read_only=True, allow_null=True)
    partner_name = serializers.SerializerMethodField()
    related_documents = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = '__all__'

    def get_related_documents(self, obj):
        if obj.purchase_order:
            # We reuse the logic from PurchaseOrderSerializer efficiently
            # Note: Importing inside method to avoid circular imports
            from purchasing.serializers import PurchaseOrderSerializer
            return PurchaseOrderSerializer().get_related_documents(obj.purchase_order)
        return None

    def get_partner_name(self, obj):
        if obj.sale_order:
            return obj.sale_order.customer.name
        if obj.purchase_order:
            return obj.purchase_order.supplier.name
        return ""

class CreateInvoiceSerializer(serializers.Serializer):
    order_id = serializers.IntegerField()
    order_type = serializers.ChoiceField(choices=['sale', 'purchase'])
    dte_type = serializers.ChoiceField(choices=Invoice.DTEType.choices)
    payment_method = serializers.ChoiceField(choices=Invoice.PaymentMethod.choices, default='CREDIT')
    supplier_invoice_number = serializers.CharField(required=False, allow_blank=True)
    document_attachment = serializers.FileField(required=False, allow_null=True)

