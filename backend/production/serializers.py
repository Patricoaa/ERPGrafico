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
    bom = serializers.PrimaryKeyRelatedField(read_only=True)
    
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
    lines = BillOfMaterialsLineSerializer(many=True, required=False)
    product_code = serializers.CharField(source='product.code', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    
    class Meta:
        model = BillOfMaterials
        fields = '__all__'

    def validate(self, data):
        product = data.get('product')
        # product might be None on update if not provided
        if not product and self.instance:
            product = self.instance.product
            
        if product and (product.track_inventory or product.product_type == 'STORABLE') and not product.uom:
            raise serializers.ValidationError(
                f"El producto '{product.name}' debe tener una Unidad de Medida (UoM) asignada porque controla stock."
            )
        return data

    def create(self, validated_data):
        lines_data = validated_data.pop('lines', [])
        bom = BillOfMaterials.objects.create(**validated_data)
        
        for line_data in lines_data:
            BillOfMaterialsLine.objects.create(bom=bom, **line_data)
            
        return bom

    def update(self, instance, validated_data):
        lines_data = validated_data.pop('lines', None)
        
        # Update standard fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Update lines if provided
        if lines_data is not None:
            # Simple strategy: Delete all and recreate to ensure sequence and sync
            instance.lines.all().delete()
            for line_data in lines_data:
                BillOfMaterialsLine.objects.create(bom=instance, **line_data)
                
        return instance
