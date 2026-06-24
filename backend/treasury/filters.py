import django_filters

from .models import Check


class CheckFilter(django_filters.FilterSet):
    check_number = django_filters.CharFilter(lookup_expr="icontains")
    drawer_name = django_filters.CharFilter(lookup_expr="icontains")
    amount = django_filters.NumberFilter(field_name="amount")
    due_date_after = django_filters.DateFilter(field_name="due_date", lookup_expr="gte")
    due_date_before = django_filters.DateFilter(field_name="due_date", lookup_expr="lte")

    class Meta:
        model = Check
        fields = [
            "status",
            "direction",
            "bank",
            "counterparty",
            "check_number",
            "drawer_name",
            "amount",
            "due_date_after",
            "due_date_before",
        ]
