from rest_framework import serializers
from .models import Supplier, PurchaseOrder, PurchaseLine, PurchaseReceipt, PurchaseReceiptLine
from treasury.serializers import PaymentSerializer


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = '__all__'

class PurchaseLineSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    quantity_pending = serializers.ReadOnlyField()
    
    class Meta:
        model = PurchaseLine
        fields = ['id', 'product', 'product_name', 'quantity', 'unit_cost', 'tax_rate', 'subtotal', 'quantity_received', 'quantity_pending']

class PurchaseOrderSerializer(serializers.ModelSerializer):
    lines = PurchaseLineSerializer(many=True, read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)
    total_paid = serializers.SerializerMethodField()
    pending_amount = serializers.SerializerMethodField()
    serialized_payments = PaymentSerializer(source='payments', many=True, read_only=True)

    class Meta:
        model = PurchaseOrder
        fields = '__all__'

    def get_total_paid(self, obj):
        return sum(p.amount for p in obj.payments.all())

    def get_pending_amount(self, obj):
        return obj.total - self.get_total_paid(obj)

class CreatePurchaseOrderSerializer(serializers.ModelSerializer):
    lines = PurchaseLineSerializer(many=True)

    class Meta:
        model = PurchaseOrder
        fields = ['id', 'supplier', 'warehouse', 'notes', 'lines', 'supplier_reference', 'payment_method']
        read_only_fields = ['id']

    def create(self, validated_data):
        lines_data = validated_data.pop('lines')
        order = PurchaseOrder.objects.create(**validated_data)
        
        total_net = 0
        total_tax = 0
        
        for line_data in lines_data:
            line = PurchaseLine.objects.create(order=order, **line_data)
            line_net = line.subtotal
            line_tax = line_net * (line.tax_rate / 100)
            
            total_net += line_net
            total_tax += line_tax

        order.total_net = total_net
        order.total_tax = total_tax
        order.total = total_net + total_tax
        order.save()
        
        return order

class PurchaseReceiptLineSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_code = serializers.CharField(source='product.code', read_only=True)
    
    class Meta:
        model = PurchaseReceiptLine
        fields = '__all__'

class PurchaseReceiptSerializer(serializers.ModelSerializer):
    lines = PurchaseReceiptLineSerializer(many=True, read_only=True)
    purchase_order_number = serializers.CharField(source='purchase_order.number', read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)
    
    class Meta:
        model = PurchaseReceipt
        fields = '__all__'
