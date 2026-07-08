import django_filters
from django_filters.rest_framework import FilterSet

from .models import PurchaseReceipt


class PurchaseReceiptFilter(FilterSet):
    date_after = django_filters.DateFilter(field_name="receipt_date", lookup_expr="gte")
    date_before = django_filters.DateFilter(field_name="receipt_date", lookup_expr="lte")
    supplier_name = django_filters.CharFilter(
        field_name="purchase_order__supplier__name", lookup_expr="icontains"
    )
    purchase_order_number = django_filters.CharFilter(
        field_name="purchase_order__number", lookup_expr="icontains"
    )
    warehouse_id = django_filters.NumberFilter(field_name="warehouse_id")
    supplier_id = django_filters.NumberFilter(field_name="purchase_order__supplier_id")
    note_type = django_filters.CharFilter(method="filter_note_type")

    class Meta:
        model = PurchaseReceipt
        fields = [
            "status",
            "date_after",
            "date_before",
            "supplier_name",
            "purchase_order_number",
            "warehouse_id",
            "supplier_id",
            "note_type",
        ]

    def filter_note_type(self, queryset, name, value):
        if value == "normal":
            return queryset.filter(related_note__isnull=True)
        elif value == "debit_note":
            return queryset.filter(related_note__isnull=False)
        return queryset
