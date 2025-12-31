from rest_framework import serializers
from .models import Supplier, PurchaseOrder, PurchaseLine

class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = '__all__'

class PurchaseLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = PurchaseLine
        fields = ['id', 'product', 'quantity', 'unit_cost', 'tax_rate', 'subtotal']

class PurchaseOrderSerializer(serializers.ModelSerializer):
    lines = PurchaseLineSerializer(many=True, read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)

    class Meta:
        model = PurchaseOrder
        fields = '__all__'

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
