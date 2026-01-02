from rest_framework import serializers
from .models import Product, ProductCategory, Warehouse, StockMove, ProductAttribute, ProductAttributeValue

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

class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    current_stock = serializers.SerializerMethodField()
    attribute_values = ProductAttributeValueSerializer(many=True, read_only=True)
    variants_count = serializers.IntegerField(source='variants.count', read_only=True)
    
    class Meta:
        model = Product
        fields = '__all__'

    def get_current_stock(self, obj):
        # Calculate stock based on sum of moves
        from django.db.models import Sum
        return obj.moves.aggregate(total=Sum('quantity'))['total'] or 0.0

class WarehouseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Warehouse
        fields = '__all__'

class StockMoveSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)

    class Meta:
        model = StockMove
        fields = '__all__'
