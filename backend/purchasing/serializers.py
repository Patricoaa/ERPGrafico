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
    id = serializers.IntegerField(required=False) # Helper for updates
    
    class Meta:
        model = PurchaseLine
        fields = ['id', 'product', 'product_name', 'quantity', 'unit_cost', 'tax_rate', 'subtotal', 'quantity_received', 'quantity_pending']
        read_only_fields = ['subtotal', 'quantity_received', 'quantity_pending']

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

class WritePurchaseOrderSerializer(serializers.ModelSerializer):
    lines = PurchaseLineSerializer(many=True)

    class Meta:
        model = PurchaseOrder
        fields = ['id', 'supplier', 'warehouse', 'notes', 'lines', 'supplier_reference', 'payment_method']
        read_only_fields = ['id']

    def create(self, validated_data):
        lines_data = validated_data.pop('lines')
        order = PurchaseOrder.objects.create(**validated_data)
        
        self._save_lines(order, lines_data)
        self._update_totals(order)
        
        return order

    def update(self, instance, validated_data):
        lines_data = validated_data.pop('lines', None)
        
        # Update simple fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
            
        if lines_data is not None:
            self._save_lines(instance, lines_data)
            self._update_totals(instance)
            
        instance.save()
        return instance

    def _save_lines(self, order, lines_data):
        # Current lines mapping
        current_lines = {line.id: line for line in order.lines.all()}
        incoming_line_ids = [item.get('id') for item in lines_data if item.get('id')]
        
        # 1. Delete lines not in request
        for line_id, line in current_lines.items():
            if line_id not in incoming_line_ids:
                line.delete()

        # 2. Create or Update
        for line_data in lines_data:
            line_id = line_data.get('id')
            
            if line_id and line_id in current_lines:
                # Update existing
                line = current_lines[line_id]
                for attr, value in line_data.items():
                    if attr != 'id': 
                        setattr(line, attr, value)
                line.save()
            else:
                # Create new
                if 'id' in line_data:
                    del line_data['id'] # Avoid passing explicit ID for creation
                PurchaseLine.objects.create(order=order, **line_data)

    def _update_totals(self, order):
        total_net = 0
        total_tax = 0
        
        # Refresh lines to calculate total
        for line in order.lines.all(): # .all() hits DB again to get fresh calculated subtotals
            line_net = line.subtotal
            line_tax = line_net * (line.tax_rate / 100)
            
            total_net += line_net
            total_tax += line_tax
            
        order.total_net = total_net
        order.total_tax = total_tax
        order.total = total_net + total_tax
        order.save()

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
