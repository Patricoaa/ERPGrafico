from rest_framework import serializers
from .models import Customer, SaleOrder, SaleLine

class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = '__all__'

class SaleLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = SaleLine
        fields = ['id', 'description', 'quantity', 'unit_price', 'tax_rate', 'subtotal']

class SaleOrderSerializer(serializers.ModelSerializer):
    lines = SaleLineSerializer(many=True, read_only=True)
    customer_name = serializers.CharField(source='customer.name', read_only=True)

    class Meta:
        model = SaleOrder
        fields = '__all__'

class CreateSaleOrderSerializer(serializers.ModelSerializer):
    """
    Serializer to handle nested creation of lines
    """
    lines = SaleLineSerializer(many=True)

    class Meta:
        model = SaleOrder
        fields = ['customer', 'notes', 'lines']

    def create(self, validated_data):
        lines_data = validated_data.pop('lines')
        order = SaleOrder.objects.create(**validated_data)
        
        total_net = 0
        total_tax = 0
        
        for line_data in lines_data:
            line = SaleLine.objects.create(order=order, **line_data)
            # Simple tax calc
            line_net = line.subtotal
            line_tax = line_net * (line.tax_rate / 100)
            
            total_net += line_net
            total_tax += line_tax

        order.total_net = total_net
        order.total_tax = total_tax
        order.total = total_net + total_tax
        order.save()
        
        return order
