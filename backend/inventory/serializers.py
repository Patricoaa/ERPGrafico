from rest_framework import serializers
from .models import (
    Product, ProductCategory, Warehouse, StockMove, UoM, UoMCategory, PricingRule,
    CustomFieldTemplate, ProductCustomField,
    Subscription, ProductAttribute, ProductAttributeValue
)
from production.models import BillOfMaterials, BillOfMaterialsLine
# BillOfMaterialsSerializer will be imported locally to avoid circular dependencies
from core.serializers import AttachmentSerializer
from .services import ProductService

class ProductAttributeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductAttribute
        fields = ['id', 'name', 'created_at']

class ProductAttributeValueSerializer(serializers.ModelSerializer):
    attribute_name = serializers.CharField(source='attribute.name', read_only=True)
    
    class Meta:
        model = ProductAttributeValue
        fields = ['id', 'attribute', 'attribute_name', 'value']

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
    product_code = serializers.CharField(source='product.code', read_only=True)
    product_internal_code = serializers.CharField(source='product.internal_code', read_only=True)
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
    product = serializers.PrimaryKeyRelatedField(queryset=Product.objects.all(), required=False)
    
    class Meta:
        model = ProductCustomField
        fields = ['id', 'template', 'template_data', 'order']




class SubscriptionSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_code = serializers.CharField(source='product.code', read_only=True)
    product_internal_code = serializers.CharField(source='product.internal_code', read_only=True)
    category_name = serializers.CharField(source='product.category.name', read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    recurrence_display = serializers.CharField(source='get_recurrence_period_display', read_only=True)
    
    class Meta:
        model = Subscription
        fields = [
            'id', 'product', 'supplier', 'product_name', 'product_code', 
            'product_internal_code', 'category_name', 'supplier_name',
            'start_date', 'end_date', 'next_payment_date', 'amount', 
            'currency', 'status', 'status_display', 'notes', 
            'recurrence_period', 'recurrence_display', 'created_at', 'updated_at'
        ]


class ProductSimpleSerializer(serializers.ModelSerializer):
    """Simplified product serializer for nested lists to avoid recursion"""
    attribute_values_data = ProductAttributeValueSerializer(source='attribute_values', many=True, read_only=True)
    is_favorite = serializers.SerializerMethodField()

    def get_is_favorite(self, obj):
        return getattr(obj, 'is_favorite', False)

    uom_name = serializers.CharField(source='uom.name', read_only=True)
    uom_category = serializers.SerializerMethodField()
    image_thumbnail = serializers.SerializerMethodField()
    
    def get_uom_category(self, obj):
        if not obj.uom:
            return None
        return obj.uom.category_id

    def get_image_thumbnail(self, obj):
        if obj.image and hasattr(obj, 'image_thumbnail'):
            try:
                return self.context['request'].build_absolute_uri(obj.image_thumbnail.url) if self.context.get('request') else obj.image_thumbnail.url
            except Exception:
                return None
        return None

    class Meta:
        model = Product
        fields = [
            'id', 'internal_code', 'name', 'variant_display_name', 
            'sale_price', 'cost_price', 'is_favorite', 'attribute_values', 'attribute_values_data',
            'product_type', 'requires_advanced_manufacturing', 'uom', 'uom_name', 'uom_category', 'image', 'image_thumbnail'
        ]

class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    uom_name = serializers.CharField(source='uom.name', read_only=True)
    uom_category = serializers.SerializerMethodField()
    sale_uom_name = serializers.CharField(source='sale_uom.name', read_only=True)
    purchase_uom_name = serializers.CharField(source='purchase_uom.name', read_only=True)
    receiving_warehouse_name = serializers.CharField(source='receiving_warehouse.name', read_only=True)
    subscription_supplier_name = serializers.CharField(source='subscription_supplier.name', read_only=True)
    preferred_supplier_name = serializers.CharField(source='preferred_supplier.name', read_only=True)
    is_favorite = serializers.SerializerMethodField()
    
    def get_is_favorite(self, obj):
        return getattr(obj, 'is_favorite', False)

    def get_uom_category(self, obj):
        if not obj.uom:
            return None
        return obj.uom.category_id
    # Variants fields
    variants = serializers.SerializerMethodField()
    variants_count = serializers.IntegerField(read_only=True)
    attribute_values_data = ProductAttributeValueSerializer(source='attribute_values', many=True, read_only=True)
    
    current_stock = serializers.SerializerMethodField()
    effective_price = serializers.SerializerMethodField()
    last_purchase_price = serializers.SerializerMethodField()
    manufacturable_quantity = serializers.SerializerMethodField()
    bom_cost = serializers.SerializerMethodField()
    
    # BOM validation fields
    has_active_bom = serializers.SerializerMethodField()
    active_bom_id = serializers.SerializerMethodField()
    requires_bom_validation = serializers.SerializerMethodField()
    
    qty_reserved = serializers.SerializerMethodField()
    qty_available = serializers.SerializerMethodField()
    
    # Manufacturing fields: Support multiple BOMs
    boms = serializers.SerializerMethodField()
    product_custom_fields = ProductCustomFieldSerializer(many=True, required=False)
    attachments = AttachmentSerializer(many=True, read_only=True)
    available_uoms = serializers.SerializerMethodField()
    variant_generation_selection = serializers.JSONField(write_only=True, required=False)
    
    image_thumbnail = serializers.SerializerMethodField()
    image_catalog = serializers.SerializerMethodField()
    
    def get_image_thumbnail(self, obj):
        if obj.image and hasattr(obj, 'image_thumbnail'):
            try:
                return self.context['request'].build_absolute_uri(obj.image_thumbnail.url) if self.context.get('request') else obj.image_thumbnail.url
            except Exception:
                return None
        return None

    def get_image_catalog(self, obj):
        if obj.image and hasattr(obj, 'image_catalog'):
            try:
                return self.context['request'].build_absolute_uri(obj.image_catalog.url) if self.context.get('request') else obj.image_catalog.url
            except Exception:
                return None
        return None
    
    def get_boms(self, obj):
        from production.serializers import BillOfMaterialsSerializer
        return BillOfMaterialsSerializer(obj.boms.all(), many=True).data

    class Meta:
        model = Product
        fields = [
            'id', 'internal_code', 'code', 'name', 'category', 'product_type', 'image', 'image_thumbnail', 'image_catalog',
            'has_bom', 'requires_advanced_manufacturing',
            'mfg_auto_finalize', 'mfg_enable_prepress', 'mfg_enable_press',
            'mfg_enable_postpress', 'mfg_prepress_design', 'mfg_prepress_specs',
            'mfg_prepress_folio', 'mfg_press_offset', 'mfg_press_digital',
            'mfg_press_special', 'mfg_postpress_finishing', 'mfg_postpress_binding',
            'recurrence_period', 'renewal_notice_days',
            'is_variable_amount', 'is_dynamic_pricing', 'track_inventory', 'can_be_sold', 'can_be_purchased',
            'uom', 'sale_uom', 'purchase_uom', 'allowed_sale_uoms', 'receiving_warehouse',
            'sale_price', 'sale_price_gross', 'cost_price', 'is_favorite', 'active', 'income_account', 'expense_account',
            'preferred_supplier', 'preferred_supplier_name',
            'category_name', 'uom_name', 'uom_category', 'sale_uom_name', 'purchase_uom_name',
            'receiving_warehouse_name', 'current_stock', 'effective_price', 'last_purchase_price',
            'manufacturable_quantity', 'bom_cost', 'qty_reserved', 'qty_available',
            'boms', 'product_custom_fields',
            # Subscription Fields
            'subscription_supplier', 'subscription_supplier_name', 'subscription_amount', 'subscription_start_date',
            'auto_activate_subscription', 'default_invoice_type', 'is_indefinite', 'contract_end_date',
            'payment_day_type', 'payment_day', 'payment_interval_days',
            'attachments', 'available_uoms',
            # Variant Fields
            'has_variants', 'variants_count', 'parent_template', 'attribute_values', 'attribute_values_data',
            'variant_display_name', 'variants', 'variant_generation_selection',
            # BOM validation fields
            'has_active_bom', 'active_bom_id', 'requires_bom_validation'
        ]

    def get_variants(self, obj):
        # Use prefetched variants if available to avoid N+1 queries
        if hasattr(obj, '_prefetched_objects_cache') and 'variants' in obj._prefetched_objects_cache:
            variants = [v for v in obj.variants.all() if v.active]
        else:
            variants = obj.variants.filter(active=True)
        
        return ProductSimpleSerializer(variants, many=True).data

    def get_uom_category(self, obj):
        return obj.uom.category_id if obj.uom else None

    def to_internal_value(self, data):
        # Handle JSON strings and multiple values for list fields when using multipart/form-data
        import json
        from django.http import QueryDict
        
        # Convert QueryDict to a dict that preserves lists for our specific fields
        if isinstance(data, QueryDict):
            ret = data.dict()  # Start with standard dict (last-value)
            for field in ['boms', 'product_custom_fields', 'allowed_sale_uoms', 'attribute_values', 'variant_updates', 'variant_generation_selection']:
                if field in data:
                    ret[field] = data.getlist(field)
        else:
            ret = data.copy() if hasattr(data, 'copy') else data
        
        # Process the list fields (handle JSON strings if necessary)
        for field in ['boms', 'product_custom_fields', 'allowed_sale_uoms', 'attribute_values', 'variant_updates', 'variant_generation_selection']:
            if field in ret:
                raw_value = ret[field]
                
                if isinstance(raw_value, list):
                    processed_list = []
                    for item in raw_value:
                        if isinstance(item, str):
                            try:
                                # Try to parse as JSON (for BOMs or nested objects)
                                parsed_item = json.loads(item)
                                if isinstance(parsed_item, list):
                                    processed_list.extend(parsed_item)
                                else:
                                    processed_list.append(parsed_item)
                            except (ValueError, TypeError):
                                # If it's a simple ID string, it will be handled by the field itself or we can cast to int
                                # Casting to int is safer for Many-to-Many IDs
                                if (field == 'allowed_sale_uoms' or field == 'attribute_values') and item.isdigit():
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
                        if (field == 'allowed_sale_uoms' or field == 'attribute_values') and raw_value.isdigit():
                            ret[field] = [int(raw_value)]
                        
        return super().to_internal_value(ret)

    def get_current_stock(self, obj):
        # Use annotated value if available from the ViewSet
        if hasattr(obj, 'annotated_current_stock'):
            return float(obj.annotated_current_stock or 0.0)
        
        # Fallback to aggregate if not annotated (e.g. in direct detail access)
        from django.db.models import Sum
        return obj.stock_moves.aggregate(total=Sum('quantity'))['total'] or 0.0

    def get_effective_price(self, obj):
        from .services import PricingService
        return PricingService.get_product_price(obj, 1)

    def get_qty_reserved(self, obj):
        request = self.context.get('request')
        exclude_id = request.query_params.get('exclude_draft_id') if request else None
        return float(obj.get_qty_reserved(exclude_id))

    def get_qty_available(self, obj):
        request = self.context.get('request')
        exclude_id = request.query_params.get('exclude_draft_id') if request else None
        return float(obj.get_qty_available(exclude_id))

    def get_last_purchase_price(self, obj):
        from purchasing.models import PurchaseLine
        last_line = PurchaseLine.objects.filter(product=obj).order_by('-order__date', '-id').first()
        return float(last_line.unit_cost) if last_line else 0.0

    def get_manufacturable_quantity(self, obj):
        """Return the calculated manufacturable quantity for MANUFACTURABLE products."""
        qty = obj.get_manufacturable_quantity()
        return float(qty) if qty is not None else None

    def get_bom_cost(self, obj):
        """Returns the total cost from the active BoM."""
        return float(obj.get_bom_cost())
    
    def get_has_active_bom(self, obj):
        return obj.has_active_bom()
    
    def get_active_bom_id(self, obj):
        active_bom = obj.boms.filter(active=True).first()
        return active_bom.id if active_bom else None
    
    def get_requires_bom_validation(self, obj):
        return obj.requires_bom_validation

    def get_available_uoms(self, obj):
        if not obj.uom:
            return []
        from .services import UoMService
        uoms = UoMService.get_allowed_uoms_for_context(obj, 'bom')
        return UoMSerializer(uoms, many=True).data

    def validate(self, data):
        # Fallback for base UoM if missing but others are present
        if not data.get('uom'):
            fallback = data.get('sale_uom') or data.get('purchase_uom')
            if fallback:
                data['uom'] = fallback
        
        uom = data.get('uom')
        if uom:
            uom_category = uom.category
            
            # Validate sale_uom
            sale_uom = data.get('sale_uom')
            if sale_uom and sale_uom.category != uom_category:
                raise serializers.ValidationError({
                    "sale_uom": f"La unidad de venta ({sale_uom.name}) debe pertenecer a la misma categoría que la unidad de stock ({uom.category.name})."
                })
            
            # Validate purchase_uom
            purchase_uom = data.get('purchase_uom')
            if purchase_uom and purchase_uom.category != uom_category:
                raise serializers.ValidationError({
                    "purchase_uom": f"La unidad de compra ({purchase_uom.name}) debe pertenecer a la misma categoría que la unidad de stock ({uom.category.name})."
                })
            
            # Validate allowed_sale_uoms
            allowed_sale_uoms = data.get('allowed_sale_uoms')
            if allowed_sale_uoms:
                for a_uom in allowed_sale_uoms:
                    if a_uom.category != uom_category:
                        raise serializers.ValidationError({
                            "allowed_sale_uoms": f"La unidad '{a_uom.name}' no pertenece a la categoría '{uom.category.name}' de la unidad base."
                        })
        
        return data

    def create(self, validated_data):
        boms_data = validated_data.pop('boms', [])
        pcf_data = validated_data.pop('product_custom_fields', [])
        allowed_sale_uoms = validated_data.pop('allowed_sale_uoms', [])
        attribute_values = validated_data.pop('attribute_values', [])
        variant_generation_selection = validated_data.pop('variant_generation_selection', None)
        
        product = Product.objects.create(**validated_data)
        
        if allowed_sale_uoms:
            product.allowed_sale_uoms.set(allowed_sale_uoms)
            
        if attribute_values:
            product.attribute_values.set(attribute_values)
        
        for bom_data in boms_data:
            lines_data = bom_data.pop('lines', [])
            bom = BillOfMaterials.objects.create(product=product, **bom_data)
            for line_data in lines_data:
                line_data.pop('id', None)
                BillOfMaterialsLine.objects.create(bom=bom, **line_data)
            
        for pcf in pcf_data:
            ProductCustomField.objects.create(product=product, **pcf)
        
        # Handle initial variant generation
        if variant_generation_selection and product.has_variants:
            ProductService.generate_variants(product, variant_generation_selection)
            
        return product

    def update(self, instance, validated_data):
        boms_data = validated_data.pop('boms', None) # If None, don't touch
        pcf_data = validated_data.pop('product_custom_fields', None)
        allowed_sale_uoms = validated_data.pop('allowed_sale_uoms', None)
        attribute_values = validated_data.pop('attribute_values', None)
        variant_updates = validated_data.pop('variant_updates', None)
        
        # Standard update
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        if allowed_sale_uoms is not None:
            instance.allowed_sale_uoms.set(allowed_sale_uoms)
            
        if attribute_values is not None:
            instance.attribute_values.set(attribute_values)
        
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
        
                
        if variant_updates:
            for update_data in variant_updates:
                variant_id = update_data.get('id')
                if not variant_id:
                    continue
                
                try:
                    variant_product = Product.objects.get(id=variant_id, parent_template=instance)
                    
                    # Fields we allow to update via variant_updates
                    for field in ['sale_price', 'code', 'has_bom', 'product_type']:
                        if field in update_data:
                            setattr(variant_product, field, update_data[field])
                    
                    # Force has_bom for variants as per user requirement
                    variant_product.has_bom = True
                    variant_product.product_type = Product.Type.MANUFACTURABLE
                    
                    # Special handlings
                    if 'sale_uom' in update_data:
                        uom_id = update_data['sale_uom']
                        if uom_id:
                            variant_product.sale_uom_id = uom_id
                        else:
                            variant_product.sale_uom = None

                    # Handle BOM cloning
                    copy_bom_from_id = update_data.get('copy_bom_from')
                    if copy_bom_from_id:
                        from production.models import BillOfMaterials, BillOfMaterialsLine
                        try:
                            # source_product could be the template or another variant
                            source_product = Product.objects.get(id=copy_bom_from_id)
                            source_bom = source_product.boms.filter(active=True).first()
                            
                            if source_bom:
                                # Overwrite existing BOMs for this variant
                                variant_product.boms.all().delete()
                                
                                # Clone BOM
                                new_bom = BillOfMaterials.objects.create(
                                    product=variant_product,
                                    name=source_bom.name,
                                    active=True,
                                    yield_quantity=source_bom.yield_quantity,
                                    yield_uom=source_bom.yield_uom
                                )
                                # Clone Lines
                                for line in source_bom.lines.all():
                                    BillOfMaterialsLine.objects.create(
                                        bom=new_bom,
                                        component=line.component,
                                        quantity=line.quantity,
                                        uom=line.uom,
                                        is_outsourced=line.is_outsourced,
                                        supplier=line.supplier,
                                        unit_price=line.unit_price,
                                        document_type=line.document_type
                                    )
                                variant_product.has_bom = True
                                # If variant wasn't manufacturable, make it so
                                if variant_product.product_type != Product.Type.MANUFACTURABLE:
                                    variant_product.product_type = Product.Type.MANUFACTURABLE

                        except Product.DoesNotExist:
                            pass

                    variant_product.save()
                except Product.DoesNotExist:
                    pass

        return instance


class WarehouseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Warehouse
        fields = '__all__'

class StockMoveSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_code = serializers.CharField(source='product.code', read_only=True)
    uom_name = serializers.CharField(source='uom.name', read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)
    product_internal_code = serializers.CharField(source='product.internal_code', read_only=True)
    product_code = serializers.CharField(source='product.code', read_only=True)
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


