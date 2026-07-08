import django_filters
from django_filters.rest_framework import FilterSet

from .models import SaleDelivery


class SaleDeliveryFilter(FilterSet):
    date_after = django_filters.DateFilter(field_name="delivery_date", lookup_expr="gte")
    date_before = django_filters.DateFilter(field_name="delivery_date", lookup_expr="lte")
    customer_name = django_filters.CharFilter(
        field_name="sale_order__customer__name", lookup_expr="icontains"
    )
    sale_order_number = django_filters.CharFilter(
        field_name="sale_order__number", lookup_expr="icontains"
    )
    warehouse_id = django_filters.NumberFilter(field_name="warehouse_id")
    customer_id = django_filters.NumberFilter(field_name="sale_order__customer_id")
    note_type = django_filters.CharFilter(method="filter_note_type")

    class Meta:
        model = SaleDelivery
        fields = [
            "status",
            "date_after",
            "date_before",
            "customer_name",
            "sale_order_number",
            "warehouse_id",
            "customer_id",
            "note_type",
        ]

    def filter_note_type(self, queryset, name, value):
        if value == "normal":
            return queryset.filter(related_note__isnull=True)
        elif value == "debit_note":
            return queryset.filter(related_note__isnull=False)
        return queryset
