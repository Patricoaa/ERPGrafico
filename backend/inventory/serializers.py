from rest_framework import serializers
from .models import (
    Product, ProductCategory, Warehouse, StockMove, UoM, UoMCategory, PricingRule,
    CustomFieldTemplate, ProductCustomField
)
from production.models import BillOfMaterials, BillOfMaterialsLine

class ProductCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductCategory
        fields = ['id', 'name', 'icon', 'parent', 'asset_account', 'income_account', 'expense_account']

class UoMCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = UoMCategory
        fields = '__all__'

class UoMSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    
    class Meta:
        model = UoM
        fields = '__all__'

class PricingRuleSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    uom_name = serializers.CharField(source='uom.name', read_only=True)
    rule_type_display = serializers.CharField(source='get_rule_type_display', read_only=True)
    operator_display = serializers.CharField(source='get_operator_display', read_only=True)

    class Meta:
        model = PricingRule
        fields = '__all__'

class CustomFieldTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomFieldTemplate
        fields = '__all__'

class ProductCustomFieldSerializer(serializers.ModelSerializer):
    template_data = CustomFieldTemplateSerializer(source='template', read_only=True)
    
    class Meta:
        model = ProductCustomField
        fields = ['id', 'template', 'template_data', 'order']

class BillOfMaterialsLineSerializer(serializers.ModelSerializer):
    component_code = serializers.CharField(source='component.code', read_only=True)
    component_name = serializers.CharField(source='component.name', read_only=True)
    # Note: We use component (ID) for writes
    
    class Meta:
        model = BillOfMaterialsLine
        fields = ['id', 'component', 'component_code', 'component_name', 'quantity', 'unit', 'notes']

class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    uom_name = serializers.CharField(source='uom.name', read_only=True)
    sale_uom_name = serializers.CharField(source='sale_uom.name', read_only=True)
    purchase_uom_name = serializers.CharField(source='purchase_uom.name', read_only=True)
    
    current_stock = serializers.SerializerMethodField()
    effective_price = serializers.SerializerMethodField()
    last_purchase_price = serializers.SerializerMethodField()
    
    # Manufacturing fields
    bom_lines = BillOfMaterialsLineSerializer(many=True, required=False)
    bom_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    product_custom_fields = ProductCustomFieldSerializer(many=True, required=False)
    
    class Meta:
        model = Product
        fields = '__all__'

    def to_internal_value(self, data):
        # Handle JSON strings for list fields when using multipart/form-data
        import json
        ret = data.copy()
        for field in ['bom_lines', 'product_custom_fields', 'allowed_sale_uoms']:
            if field in ret and isinstance(ret[field], str):
                try:
                    ret[field] = json.loads(ret[field])
                except (ValueError, TypeError):
                    pass
        return super().to_internal_value(ret)

    def get_current_stock(self, obj):
        # Calculate stock based on sum of moves for this specific product
        from django.db.models import Sum
        return obj.moves.aggregate(total=Sum('quantity'))['total'] or 0.0

    def get_effective_price(self, obj):
        from .services import PricingService
        return PricingService.get_product_price(obj, 1)

    def get_last_purchase_price(self, obj):
        from purchasing.models import PurchaseLine
        last_line = PurchaseLine.objects.filter(product=obj).order_by('-order__date', '-id').first()
        return float(last_line.unit_cost) if last_line else 0.0

    def create(self, validated_data):
        bom_data = validated_data.pop('bom_lines', [])
        bom_name = validated_data.pop('bom_name', None)
        pcf_data = validated_data.pop('product_custom_fields', [])
        allowed_sale_uoms = validated_data.pop('allowed_sale_uoms', [])
        
        product = Product.objects.create(**validated_data)
        
        if allowed_sale_uoms:
            product.allowed_sale_uoms.set(allowed_sale_uoms)
        
        if bom_data:
            bom_header = BillOfMaterials.objects.create(
                product=product,
                name=bom_name or f"BOM {product.name}",
                active=True
            )
            for line in bom_data:
                BillOfMaterialsLine.objects.create(bom=bom_header, **line)
            
        for pcf in pcf_data:
            ProductCustomField.objects.create(product=product, **pcf)
            
        return product

    def update(self, instance, validated_data):
        bom_data = validated_data.pop('bom_lines', None)
        bom_name = validated_data.pop('bom_name', None)
        pcf_data = validated_data.pop('product_custom_fields', None)
        allowed_sale_uoms = validated_data.pop('allowed_sale_uoms', None)
        
        product = super().update(instance, validated_data)
        
        if allowed_sale_uoms is not None:
            product.allowed_sale_uoms.set(allowed_sale_uoms)
        
        if bom_data is not None:
            # Get or create active BOM
            bom_header = BillOfMaterials.objects.filter(product=instance, active=True).first()
            if not bom_header and (bom_data or bom_name):
                bom_header = BillOfMaterials.objects.create(
                    product=instance,
                    name=bom_name or f"BOM {instance.name}",
                    active=True
                )
            elif bom_header and bom_name:
                bom_header.name = bom_name
                bom_header.save()

            if bom_header:
                # Replace lines
                bom_header.lines.all().delete()
                for line in bom_data:
                    BillOfMaterialsLine.objects.create(bom=bom_header, **line)
                
        if pcf_data is not None:
            # Simple replace strategy
            instance.product_custom_fields.all().delete()
            for pcf in pcf_data:
                ProductCustomField.objects.create(product=instance, **pcf)
                
        return instance

class WarehouseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Warehouse
        fields = '__all__'

class StockMoveSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_code = serializers.CharField(source='product.code', read_only=True)
    uom_name = serializers.CharField(source='product.uom.name', read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)
    move_type_display = serializers.CharField(source='get_move_type_display', read_only=True)
    journal_entry_number = serializers.CharField(source='journal_entry.number', read_only=True, allow_null=True)
    reference_code = serializers.SerializerMethodField()
    related_documents = serializers.SerializerMethodField()
    reference = serializers.SerializerMethodField()
    notes = serializers.SerializerMethodField()

    class Meta:
        model = StockMove
        fields = '__all__'

    def validate(self, data):
        product = data.get('product')
        if product and not product.uom:
            raise serializers.ValidationError(
                f"El producto '{product.name}' no tiene una Unidad de Medida (UoM) asignada."
            )
        return data

    def get_related_documents(self, obj):
        docs = []
        # 1. Check via journal entry
        if obj.journal_entry:
            docs.extend(obj.journal_entry.get_source_documents)
            
        # 2. Check via Purchase Receipt Line
        try:
            if hasattr(obj, 'purchase_receipt_line'):
                pr = obj.purchase_receipt_line.receipt
                po = pr.purchase_order
                if po:
                    po_doc = {
                        'type': 'purchase_order',
                        'id': po.id,
                        'name': str(po),
                        'url': '/purchasing/orders'
                    }
                    docs.append(po_doc)
                    
                    # Add Invoices related to this PO
                    for inv in po.invoices.all():
                        inv_doc = {
                            'type': 'invoice',
                            'id': inv.id,
                            'name': str(inv),
                            'url': f'/billing/purchases'
                        }
                        docs.append(inv_doc)
        except Exception:
            pass

        # 3. Check via Sale Delivery Line
        try:
            if hasattr(obj, 'sale_delivery_line'):
                sd = obj.sale_delivery_line.delivery
                so = sd.sale_order
                if so:
                    so_doc = {
                        'type': 'sale_order',
                        'id': so.id,
                        'name': str(so),
                        'url': '/sales/orders'
                    }
                    docs.append(so_doc)
                    
                    # Add Invoices related to this SO
                    for inv in so.invoices.all():
                        inv_doc = {
                            'type': 'invoice',
                            'id': inv.id,
                            'name': str(inv),
                            'url': f'/billing/sales'
                        }
                        docs.append(inv_doc)
        except Exception:
            pass
        
        # Deduplicate and filter out 'inventory' (self)
        unique_docs = []
        seen = set()
        for d in docs:
            key = (d['type'], d['id'])
            if key not in seen and d['type'] != 'inventory':
                seen.add(key)
                unique_docs.append(d)
                
        return unique_docs

    def get_reference_code(self, obj):
        # Prefer the internal MOV code as requested by the user
        return f"MOV-{str(obj.id).zfill(6)}"

    def get_reference(self, obj):
        # 1. Purchase Receipt
        if hasattr(obj, 'purchase_receipt_line'):
            receipt = getattr(obj.purchase_receipt_line, 'receipt', None)
            return receipt.delivery_reference if receipt else None
        
        # 2. Sale Delivery
        if hasattr(obj, 'sale_delivery_line'):
            delivery = getattr(obj.sale_delivery_line, 'delivery', None)
            if delivery:
                # Use .number as .tracking_number does not exist in the model
                return f"ENT-{delivery.number}"
            
        return None

    def get_notes(self, obj):
        # 1. Purchase Receipt
        if hasattr(obj, 'purchase_receipt_line'):
            receipt = getattr(obj.purchase_receipt_line, 'receipt', None)
            return receipt.notes if receipt else None
            
        # 2. Sale Delivery
        if hasattr(obj, 'sale_delivery_line'):
             delivery = getattr(obj.sale_delivery_line, 'delivery', None)
             return delivery.notes if delivery else None
             
        return None
