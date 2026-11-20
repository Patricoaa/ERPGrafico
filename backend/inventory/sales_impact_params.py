"""Validación de los parámetros de ``GET /inventory/products/{id}/sales-impact/``."""
from rest_framework import serializers

from sales.models import SaleOrder

from .sales_impact_selector import GRANULARITIES, GROUP_BYS, METRICS, SalesImpactParams


class SalesImpactParamsSerializer(serializers.Serializer):
    metric = serializers.ChoiceField(choices=METRICS, default="net_revenue")
    group_by = serializers.ChoiceField(choices=GROUP_BYS, default="rule")
    granularity = serializers.ChoiceField(choices=GRANULARITIES, default="month")
    date_from = serializers.DateField(required=False)
    date_to = serializers.DateField(required=False)
    channel = serializers.ChoiceField(choices=SaleOrder.Channel.choices, required=False)
    customer = serializers.IntegerField(required=False)
    variant = serializers.IntegerField(required=False)
    uom = serializers.IntegerField(required=False)
    rule = serializers.IntegerField(required=False)

    def validate(self, attrs):
        start, end = attrs.get("date_from"), attrs.get("date_to")
        if start and end and start > end:
            raise serializers.ValidationError({"date_from": "date_from no puede ser posterior a date_to."})
        return attrs

    def to_params(self) -> SalesImpactParams:
        d = self.validated_data
        return SalesImpactParams(
            metric=d["metric"], group_by=d["group_by"], granularity=d["granularity"],
            date_from=d.get("date_from"), date_to=d.get("date_to"), channel=d.get("channel"),
            customer_id=d.get("customer"), variant_id=d.get("variant"),
            uom_id=d.get("uom"), rule_id=d.get("rule"),
        )
