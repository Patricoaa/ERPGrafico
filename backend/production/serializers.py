from rest_framework import serializers
from .models import WorkOrder, ProductionConsumption, BillOfMaterials, BillOfMaterialsLine, WorkOrderMaterial, WorkOrderHistory
from core.serializers import AttachmentSerializer

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
    stock_available = serializers.SerializerMethodField()
    is_available = serializers.SerializerMethodField()
    component_cost = serializers.DecimalField(source='component.cost_price', read_only=True, max_digits=12, decimal_places=2)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    purchase_order_number = serializers.CharField(source='purchase_line.order.number', read_only=True)
    purchase_order_receiving_status = serializers.CharField(source='purchase_line.order.receiving_status', read_only=True)
    purchase_order_id = serializers.IntegerField(source='purchase_line.order.id', read_only=True)
    total_cost = serializers.SerializerMethodField()
    
    class Meta:
        model = WorkOrderMaterial
        fields = '__all__'

    def get_stock_available(self, obj):
        component = obj.component
        if component.product_type == 'SERVICE':
            return 999999 # Practically infinite
            
        if component.product_type == 'MANUFACTURABLE' and not component.requires_advanced_manufacturing:
            # Express manufacturable: calculate what can be made
            return component.get_manufacturable_quantity() or 0.0
            
        # Standard storable or advanced manufacturable: check warehouse stock
        from django.db.models import Sum
        warehouse = obj.work_order.warehouse
        if not warehouse:
            return 0.0
            
        # Simplified: sum moves for this product in this warehouse
        stock = component.stock_moves.filter(warehouse=warehouse).aggregate(total=Sum('quantity'))['total'] or 0.0
        
        # Convert to the UoM used in the OT material line for display consistency
        from inventory.services import UoMService
        try:
             # Logic from services.convert_quantity: converts FROM base TO line uom
             # component stock is always in base uom
             if component.uom and obj.uom and component.uom != obj.uom:
                 stock = UoMService.convert_quantity(stock, component.uom, obj.uom)
        except:
             pass
             
        return float(stock)

    def get_is_available(self, obj):
        quantity_planned = float(obj.quantity_planned)
        stock_available = self.get_stock_available(obj)
        return stock_available >= quantity_planned

    def get_total_cost(self, obj):
        from decimal import Decimal
        from inventory.services import UoMService
        
        qty = obj.quantity_planned
        component = obj.component
        
        # Convert quantity from Material Line UoM to Component Base UoM if they differ
        # component.cost_price is always per Base UoM
        if obj.uom and component.uom and obj.uom != component.uom:
            try:
                qty = UoMService.convert_quantity(obj.quantity_planned, obj.uom, component.uom)
            except:
                pass
                
        total = qty * component.cost_price
        return float(total)

class WorkOrderSerializer(serializers.ModelSerializer):
    consumptions = ProductionConsumptionSerializer(many=True, read_only=True)
    materials = WorkOrderMaterialSerializer(many=True, read_only=True)
    stage_history = WorkOrderHistorySerializer(many=True, read_only=True)
    sale_order_number = serializers.CharField(source='sale_order.number', read_only=True, allow_null=True)
    sale_order_date = serializers.DateField(source='sale_order.date', read_only=True, allow_null=True)
    sale_order_delivery_date = serializers.DateField(source='sale_order.delivery_date', read_only=True, allow_null=True)
    product_description = serializers.SerializerMethodField()
    sale_customer_name = serializers.SerializerMethodField()
    sale_customer_rut = serializers.SerializerMethodField()
    product_info = serializers.ReadOnlyField()
    main_product_id = serializers.SerializerMethodField()
    production_progress = serializers.SerializerMethodField()
    outsourcing_status = serializers.SerializerMethodField()
    attachments = AttachmentSerializer(many=True, read_only=True)
    is_cancellable = serializers.ReadOnlyField()
    cancellation_limit_stage = serializers.ReadOnlyField()
    
    # Metadata helpers
    requires_prepress = serializers.SerializerMethodField()
    requires_press = serializers.SerializerMethodField()
    requires_postpress = serializers.SerializerMethodField()
    checkout_files = serializers.SerializerMethodField()

    def get_product_description(self, obj):
        if obj.stage_data and obj.stage_data.get('product_description'):
            return obj.stage_data.get('product_description')
        return ""

    def get_sale_customer_name(self, obj):
        # 1. Prefer override from stage_data (set via Manufacturing Dialog)
        if obj.stage_data and obj.stage_data.get('contact_name'):
            return obj.stage_data.get('contact_name')
        # 2. Fallback to Sale Order customer
        if obj.sale_order and obj.sale_order.customer:
            return obj.sale_order.customer.name
        return "Manual / Interno"

    def get_sale_order_client_name(self, obj):
        if obj.sale_order and obj.sale_order.customer:
            return obj.sale_order.customer.name
        return None

    def get_sale_customer_rut(self, obj):
        if obj.stage_data and obj.stage_data.get('contact_tax_id'):
            return obj.stage_data.get('contact_tax_id')
        if obj.sale_order and obj.sale_order.customer:
            return obj.sale_order.customer.tax_id
        return ""

    def get_requires_prepress(self, obj):
        # 1. Try stage_data (specific for this order)
        if obj.stage_data and 'phases' in obj.stage_data:
            return obj.stage_data['phases'].get('prepress', False)
        # 2. Fallback to product default
        if obj.sale_line and obj.sale_line.product:
            return obj.sale_line.product.mfg_enable_prepress
        return False

    def get_requires_press(self, obj):
        if obj.stage_data and 'phases' in obj.stage_data:
            return obj.stage_data['phases'].get('press', False)
        if obj.sale_line and obj.sale_line.product:
            return obj.sale_line.product.mfg_enable_press
        return False

    def get_requires_postpress(self, obj):
        if obj.stage_data and 'phases' in obj.stage_data:
            return obj.stage_data['phases'].get('postpress', False)
        if obj.sale_line and obj.sale_line.product:
            return obj.sale_line.product.mfg_enable_postpress
        return False

    def get_main_product_id(self, obj):
        if obj.sale_line and obj.sale_line.product_id:
            return obj.sale_line.product_id
        if obj.product_id:
            return obj.product_id
        return None
    
    def get_production_progress(self, obj):
        if obj.status == WorkOrder.Status.FINISHED:
            return 100
        if obj.status == WorkOrder.Status.CANCELLED:
            return 0
        
        # Progression based on stages
        weights = {
            WorkOrder.Stage.MATERIAL_ASSIGNMENT.value: 0,
            WorkOrder.Stage.MATERIAL_APPROVAL.value: 15,
            WorkOrder.Stage.OUTSOURCING_ASSIGNMENT.value: 30,
            WorkOrder.Stage.PREPRESS.value: 45,
            WorkOrder.Stage.PRESS.value: 60,
            WorkOrder.Stage.POSTPRESS.value: 75,
            WorkOrder.Stage.OUTSOURCING_VERIFICATION.value: 90,
            WorkOrder.Stage.FINISHED.value: 100,
            WorkOrder.Stage.CANCELLED.value: 0
        }
        return weights.get(obj.current_stage, 0)
    
    def get_outsourcing_status(self, obj):
        mats = obj.materials.all()
        if not mats.exists():
            return 'none'
        
        outsourced = mats.filter(is_outsourced=True)
        if not outsourced.exists():
            return 'none'
        
        if outsourced.count() == mats.count():
            return 'full'
        return 'partial'

    def get_checkout_files(self, obj):
        files = []
        if not obj.sale_order and not obj.sale_line:
            return files

        from core.models import Attachment
        from django.contrib.contenttypes.models import ContentType
        from sales.models import SaleOrder, SaleLine
        
        # 1. From Sale Order
        if obj.sale_order:
            ct = ContentType.objects.get_for_model(SaleOrder)
            files.extend(list(Attachment.objects.filter(
                content_type=ct,
                object_id=obj.sale_order.id
            )))
            
        # 2. From Sale Line (where manufacturing specs usually live)
        if obj.sale_line:
            ct_line = ContentType.objects.get_for_model(SaleLine)
            files.extend(list(Attachment.objects.filter(
                content_type=ct_line,
                object_id=obj.sale_line.id
            )))

        return AttachmentSerializer(files, many=True).data
    
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
    product_internal_code = serializers.CharField(source='product.internal_code', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    category_name = serializers.CharField(source='product.category.name', read_only=True)
    lines_count = serializers.SerializerMethodField()
    total_cost = serializers.SerializerMethodField()
    
    class Meta:
        model = BillOfMaterials
        fields = '__all__'
    
    def get_lines_count(self, obj):
        return obj.lines.count()
    
    def get_total_cost(self, obj):
        from decimal import Decimal
        from inventory.services import UoMService
        total = Decimal('0.00')
        for line in obj.lines.all():
            qty = line.quantity
            # Convert quantity from BOM Line UoM to Component Base UoM if they differ
            if line.uom and line.component.uom and line.uom != line.component.uom:
                try:
                    qty = UoMService.convert_quantity(line.quantity, line.uom, line.component.uom)
                except Exception:
                    # In case of error (e.g. incompatible categories), use original quantity
                    pass
            total += qty * line.component.cost_price
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
