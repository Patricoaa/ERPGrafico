from rest_framework import serializers
from .models import WorkOrder, ProductionConsumption, BillOfMaterials, BillOfMaterialsLine, WorkOrderMaterial, WorkOrderHistory

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

class WorkOrderHistorySerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.first_name', read_only=True)
    
    class Meta:
        model = WorkOrderHistory
        fields = '__all__'

class WorkOrderMaterialSerializer(serializers.ModelSerializer):
    component_name = serializers.CharField(source='component.name', read_only=True)
    component_code = serializers.CharField(source='component.code', read_only=True)
    uom_name = serializers.CharField(source='uom.name', read_only=True)
    
    class Meta:
        model = WorkOrderMaterial
        fields = '__all__'

class WorkOrderSerializer(serializers.ModelSerializer):
    consumptions = ProductionConsumptionSerializer(many=True, read_only=True)
    materials = WorkOrderMaterialSerializer(many=True, read_only=True)
    history = WorkOrderHistorySerializer(many=True, read_only=True)
    sale_order_number = serializers.CharField(source='sale_order.number', read_only=True, allow_null=True)
    sale_customer_name = serializers.CharField(source='sale_order.customer.name', read_only=True)
    product_info = serializers.ReadOnlyField()
    
    # Metadata helpers
    requires_prepress = serializers.BooleanField(source='sale_line.product.mfg_enable_prepress', read_only=True, default=False)
    requires_press = serializers.BooleanField(source='sale_line.product.mfg_enable_press', read_only=True, default=False)
    requires_postpress = serializers.BooleanField(source='sale_line.product.mfg_enable_postpress', read_only=True, default=False)
    
    class Meta:
        model = WorkOrder
        fields = '__all__'

class BillOfMaterialsLineSerializer(serializers.ModelSerializer):
    component_code = serializers.CharField(source='component.code', read_only=True)
    component_name = serializers.CharField(source='component.name', read_only=True)
    component_cost = serializers.DecimalField(source='component.cost_price', read_only=True, max_digits=12, decimal_places=2)
    uom_name = serializers.CharField(source='uom.name', read_only=True)
    
    class Meta:
        model = BillOfMaterialsLine
        fields = ['id', 'component', 'component_code', 'component_name', 'component_cost', 'quantity', 'uom', 'uom_name', 'notes']

    def validate(self, data):
        component = data.get('component')
        uom = data.get('uom')
        
        # Validate component has base UoM
        if component and not component.uom:
            raise serializers.ValidationError(
                f"El componente '{component.name}' debe tener una UoM base asignada."
            )
            
        # Validate compatibility if both present - BOM allows full category flexibility
        if component and uom:
            from inventory.services import UoMService
            
            if not UoMService.validate_uom_compatibility(component.uom, uom):
                raise serializers.ValidationError({
                    'uom': f"La unidad '{uom.name}' no es compatible con la categoría "
                           f"del componente ('{component.uom.category.name}'). "
                           f"Puede usar cualquier unidad de la misma categoría para mayor flexibilidad."
                })
                
        return data

class BillOfMaterialsSerializer(serializers.ModelSerializer):
    lines = BillOfMaterialsLineSerializer(many=True, required=False)
    product_code = serializers.CharField(source='product.code', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    lines_count = serializers.SerializerMethodField()
    total_cost = serializers.SerializerMethodField()
    
    class Meta:
        model = BillOfMaterials
        fields = '__all__'
    
    def get_lines_count(self, obj):
        return obj.lines.count()
    
    def get_total_cost(self, obj):
        from decimal import Decimal
        total = Decimal('0.00')
        for line in obj.lines.all():
            total += line.quantity * line.component.cost_price
        return float(total)

    def validate(self, data):
        product = data.get('product')
        if not product and self.instance:
            product = self.instance.product
            
        effective_uom = product.uom or product.sale_uom or product.purchase_uom
        if product and product.track_inventory and not effective_uom:
            raise serializers.ValidationError(
                f"El producto '{product.name}' requiere una Unidad de Medida (UoM) porque tiene activado 'Controlar Inventario'. "
                f"Asigne una unidad o desactive el control de inventario en la ficha del producto."
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
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        if lines_data is not None:
            instance.lines.all().delete()
            for line_data in lines_data:
                BillOfMaterialsLine.objects.create(bom=instance, **line_data)
        return instance
