from .models import Product, StockMove

class ProductFilter(filters.FilterSet):
    category = filters.NumberFilter(field_name="category__id")

    class Meta:
        model = Product
        fields = ['product_type', 'category']

class StockMoveFilter(filters.FilterSet):
    product_id = filters.NumberFilter(field_name="product__id")
    warehouse_id = filters.NumberFilter(field_name="warehouse__id")

    class Meta:
        model = StockMove
        fields = ['product_id', 'warehouse_id', 'move_type']
