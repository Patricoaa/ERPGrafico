from django_filters import rest_framework as filters

from .analytics import StockMoveAnalyticsService
from .models import Product, StockMove, UoM


class ProductFilter(filters.FilterSet):
    category = filters.NumberFilter(field_name="category__id")

    class Meta:
        model = Product
        fields = {
            "product_type": ["exact", "in"],
            "category": ["exact"],
            "can_be_sold": ["exact"],
            "can_be_purchased": ["exact"],
            "parent_template": ["exact", "isnull"],
            "has_variants": ["exact"],
            "track_inventory": ["exact"],
        }


class UoMFilter(filters.FilterSet):
    class Meta:
        model = UoM
        fields = ["category", "is_active"]


class StockMoveFilter(filters.FilterSet):
    product_id = filters.NumberFilter(field_name="product__id")
    source_location_id = filters.NumberFilter(field_name="source_location__id")
    destination_location_id = filters.NumberFilter(field_name="destination_location__id")
    product_name = filters.CharFilter(field_name="product__name", lookup_expr="icontains")
    date_from = filters.DateFilter(field_name="date", lookup_expr="gte")
    date_to = filters.DateFilter(field_name="date", lookup_expr="lte")
    direction = filters.ChoiceFilter(method="filter_direction", choices=StockMoveAnalyticsService.DIRECTIONS)

    class Meta:
        model = StockMove
        fields = ["product_id", "source_location_id", "destination_location_id", "product_name", "date_from", "date_to", "direction"]

    def filter_direction(self, queryset, name, value):
        if not value:
            return queryset
        return queryset.annotate(
            _direction=StockMoveAnalyticsService._direction_annotation()
        ).filter(_direction=value)
