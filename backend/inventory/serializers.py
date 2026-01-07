from rest_framework import serializers
from .models import Product, ProductCategory, Warehouse, StockMove, ProductAttribute, ProductAttributeValue, UoM, UoMCategory

class ProductCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductCategory
        fields = '__all__'

class ProductAttributeValueSerializer(serializers.ModelSerializer):
    attribute_name = serializers.CharField(source='attribute.name', read_only=True)
    class Meta:
        model = ProductAttributeValue
        fields = ['id', 'attribute', 'attribute_name', 'value']

class ProductAttributeSerializer(serializers.ModelSerializer):
    values = ProductAttributeValueSerializer(many=True, read_only=True)
    class Meta:
        model = ProductAttribute
        fields = ['id', 'name', 'values']

class UoMCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = UoMCategory
        fields = '__all__'

class UoMSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    
    class Meta:
        model = UoM
        fields = '__all__'

class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    uom_name = serializers.CharField(source='uom.name', read_only=True)
    purchase_uom_name = serializers.CharField(source='purchase_uom.name', read_only=True)
    
    current_stock = serializers.SerializerMethodField()
    attribute_values = ProductAttributeValueSerializer(many=True, read_only=True)
    variants_count = serializers.IntegerField(source='variants.count', read_only=True)
    total_stock = serializers.SerializerMethodField()
    
    class Meta:
        model = Product
        fields = '__all__'

    def get_current_stock(self, obj):
        # Calculate stock based on sum of moves for this specific product
        from django.db.models import Sum
        return obj.moves.aggregate(total=Sum('quantity'))['total'] or 0.0

    def get_total_stock(self, obj):
        # For parents, sum all variant moves plus its own moves
        # For variants/simple, it's the same as current_stock
        from django.db.models import Sum, Q
        from .models import StockMove
        
        if obj.variants.exists():
            # Sum moves of this product AND all its variants
            total = StockMove.objects.filter(
                Q(product=obj) | Q(product__variant_of=obj)
            ).aggregate(total=Sum('quantity'))['total'] or 0.0
            return float(total)
        
        return self.get_current_stock(obj)

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
