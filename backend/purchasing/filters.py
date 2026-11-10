import django_filters
from django_filters.rest_framework import FilterSet

from .models import PurchaseReceipt, PurchaseReturn


class CharInFilter(django_filters.BaseInFilter, django_filters.CharFilter):
    """Accepts a comma-separated list of values and applies an __in lookup (issue #223)."""


class PurchaseReceiptFilter(FilterSet):
    status = CharInFilter(field_name="status", lookup_expr="in")
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


class PurchaseReturnFilter(FilterSet):
    """ADR-0090: la lista de devoluciones de compra es una vista documental propia,
    así que necesita los mismos filtros que su hermana PurchaseReceiptFilter."""

    status = CharInFilter(field_name="status", lookup_expr="in")
    date_after = django_filters.DateFilter(field_name="date", lookup_expr="gte")
    date_before = django_filters.DateFilter(field_name="date", lookup_expr="lte")
    supplier_name = django_filters.CharFilter(
        field_name="purchase_order__supplier__name", lookup_expr="icontains"
    )
    purchase_order_number = django_filters.CharFilter(
        field_name="purchase_order__number", lookup_expr="icontains"
    )
    warehouse_id = django_filters.NumberFilter(field_name="warehouse_id")
    supplier_id = django_filters.NumberFilter(field_name="purchase_order__supplier_id")

    class Meta:
        model = PurchaseReturn
        fields = [
            "status",
            "date_after",
            "date_before",
            "supplier_name",
            "purchase_order_number",
            "warehouse_id",
            "supplier_id",
        ]
