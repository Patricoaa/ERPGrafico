from rest_framework import serializers
from .models import (
    Product, ProductCategory, Warehouse, StockMove, UoM, UoMCategory, PricingRule,
    CustomFieldTemplate, ProductCustomField
)
from production.models import BillOfMaterials, BillOfMaterialsLine
from production.serializers import BillOfMaterialsSerializer

class ProductCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductCategory
        fields = ['id', 'name', 'prefix', 'icon', 'parent', 'asset_account', 'income_account', 'expense_account']

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


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    uom_name = serializers.CharField(source='uom.name', read_only=True)
    sale_uom_name = serializers.CharField(source='sale_uom.name', read_only=True)
    purchase_uom_name = serializers.CharField(source='purchase_uom.name', read_only=True)
    
    current_stock = serializers.SerializerMethodField()
    effective_price = serializers.SerializerMethodField()
    last_purchase_price = serializers.SerializerMethodField()
    manufacturable_quantity = serializers.SerializerMethodField()
    
    # Manufacturing fields: Support multiple BOMs
    boms = BillOfMaterialsSerializer(many=True, required=False)
    product_custom_fields = ProductCustomFieldSerializer(many=True, required=False)
    
    class Meta:
        model = Product
        fields = '__all__'

    def to_internal_value(self, data):
        # Handle JSON strings and multiple values for list fields when using multipart/form-data
        import json
        from django.http import QueryDict
        
        # Convert QueryDict to a dict that preserves lists for our specific fields
        if isinstance(data, QueryDict):
            ret = data.dict()  # Start with standard dict (last-value)
            for field in ['boms', 'product_custom_fields', 'allowed_sale_uoms']:
                if field in data:
                    ret[field] = data.getlist(field)
        else:
            ret = data.copy() if hasattr(data, 'copy') else data
        
        # Process the list fields (handle JSON strings if necessary)
        for field in ['boms', 'product_custom_fields', 'allowed_sale_uoms']:
            if field in ret:
                raw_value = ret[field]
                
                if isinstance(raw_value, list):
                    processed_list = []
                    for item in raw_value:
                        if isinstance(item, str):
                            try:
                                # Try to parse as JSON (for BOMs or nested objects)
                                processed_list.append(json.loads(item))
                            except (ValueError, TypeError):
                                # If it's a simple ID string, it will be handled by the field itself or we can cast to int
                                # Casting to int is safer for Many-to-Many IDs
                                if field == 'allowed_sale_uoms' and item.isdigit():
                                    processed_list.append(int(item))
                                else:
                                    processed_list.append(item)
                        else:
                            processed_list.append(item)
                    ret[field] = processed_list
                elif isinstance(raw_value, str):
                    try:
                        ret[field] = json.loads(raw_value)
                    except (ValueError, TypeError):
                        if field == 'allowed_sale_uoms' and raw_value.isdigit():
                            ret[field] = [int(raw_value)]
                        
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

    def get_manufacturable_quantity(self, obj):
        """Return the calculated manufacturable quantity for MANUFACTURABLE products."""
        qty = obj.get_manufacturable_quantity()
        return float(qty) if qty is not None else None

    def validate(self, data):
        # Fallback for base UoM if missing but others are present
        if not data.get('uom'):
            fallback = data.get('sale_uom') or data.get('purchase_uom')
            if fallback:
                data['uom'] = fallback
        return data

    def create(self, validated_data):
        boms_data = validated_data.pop('boms', [])
        pcf_data = validated_data.pop('product_custom_fields', [])
        allowed_sale_uoms = validated_data.pop('allowed_sale_uoms', [])
        
        product = Product.objects.create(**validated_data)
        
        if allowed_sale_uoms:
            product.allowed_sale_uoms.set(allowed_sale_uoms)
        
        for bom_data in boms_data:
            lines_data = bom_data.pop('lines', [])
            bom = BillOfMaterials.objects.create(product=product, **bom_data)
            for line_data in lines_data:
                line_data.pop('id', None)
                BillOfMaterialsLine.objects.create(bom=bom, **line_data)
            
        for pcf in pcf_data:
            ProductCustomField.objects.create(product=product, **pcf)
            
        return product

    def update(self, instance, validated_data):
        boms_data = validated_data.pop('boms', None)
        pcf_data = validated_data.pop('product_custom_fields', None)
        allowed_sale_uoms = validated_data.pop('allowed_sale_uoms', None)
        
        product = super().update(instance, validated_data)
        
        if allowed_sale_uoms is not None:
            product.allowed_sale_uoms.set(allowed_sale_uoms)
        
        if boms_data is not None:
            # Simple sync: Delete missing BOMs, update existing ones, create new ones.
            # However, for nested data in DRF, it's safer to either match by ID or 
            # replace if it's a manageable list. Considering users might just want to 
            # overwrite/sync the whole set of BOMs for a product.
            existing_boms = {b.id: b for b in instance.boms.all()}
            incoming_ids = [b.get('id') for b in boms_data if b.get('id')]
            
            # Delete removed ones
            for bom_id, bom_obj in existing_boms.items():
                if bom_id not in incoming_ids:
                    bom_obj.delete()
            
            for bom_item in boms_data:
                bom_id = bom_item.get('id')
                lines_data = bom_item.pop('lines', [])
                bom_item.pop('id', None) # Remove ID if present to avoid conflicts
                
                if bom_id and bom_id in existing_boms:
                    # Update existing
                    bom = existing_boms[bom_id]
                    for attr, value in bom_item.items():
                        setattr(bom, attr, value)
                    bom.save()
                    
                    # Update lines (replace all)
                    bom.lines.all().delete()
                    for line_data in lines_data:
                        line_data.pop('id', None)
                        BillOfMaterialsLine.objects.create(bom=bom, **line_data)
                else:
                    # Create new
                    bom = BillOfMaterials.objects.create(product=instance, **bom_item)
                    for line_data in lines_data:
                        line_data.pop('id', None)
                        BillOfMaterialsLine.objects.create(bom=bom, **line_data)
                
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
