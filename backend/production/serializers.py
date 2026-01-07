from rest_framework import serializers
from .models import WorkOrder, ProductionConsumption, BillOfMaterials, BillOfMaterialsLine

class ProductionConsumptionSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)
    
    class Meta:
        model = ProductionConsumption
        fields = '__all__'

    def validate(self, data):
        product = data.get('product')
        if product and not product.uom:
            raise serializers.ValidationError(
                f"El producto '{product.name}' no tiene una Unidad de Medida (UoM) asignada."
            )
        return data

class WorkOrderSerializer(serializers.ModelSerializer):
    consumptions = ProductionConsumptionSerializer(many=True, read_only=True)
    sale_order_number = serializers.CharField(source='sale_order.number', read_only=True, allow_null=True)
    product_info = serializers.ReadOnlyField()
    
    class Meta:
        model = WorkOrder
        fields = '__all__'

class BillOfMaterialsLineSerializer(serializers.ModelSerializer):
    component_code = serializers.CharField(source='component.code', read_only=True)
    component_name = serializers.CharField(source='component.name', read_only=True)
    
    class Meta:
        model = BillOfMaterialsLine
        fields = '__all__'

    def validate(self, data):
        component = data.get('component')
        if component and not component.uom:
            raise serializers.ValidationError(
                f"El componente '{component.name}' no tiene una Unidad de Medida (UoM) asignada."
            )
        return data

class BillOfMaterialsSerializer(serializers.ModelSerializer):
    lines = BillOfMaterialsLineSerializer(many=True, read_only=True)
    product_code = serializers.CharField(source='product.code', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    
    class Meta:
        model = BillOfMaterials
        fields = '__all__'

    def validate(self, data):
        product = data.get('product')
        if product and not product.uom:
            raise serializers.ValidationError(
                f"El producto '{product.name}' no tiene una Unidad de Medida (UoM) asignada."
            )
        return data
