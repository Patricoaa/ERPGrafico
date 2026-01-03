from django_filters import rest_framework as filters
from .models import Product

class ProductFilter(filters.FilterSet):
    attribute_value = filters.CharFilter(field_name="attribute_values__value", lookup_expr='iexact')
    attribute_id = filters.NumberFilter(field_name="attribute_values__id")
    category = filters.NumberFilter(field_name="category__id")
    is_parent = filters.BooleanFilter(field_name="variant_of", lookup_expr='isnull')

    class Meta:
        model = Product
        fields = ['product_type', 'category', 'variant_of']
