"""Validación de los parámetros de ``GET /inventory/products/{id}/pricing/``."""
from rest_framework import serializers

from .pricing_selector import PricingParams
from .sales_impact_selector import GRANULARITIES


class PricingParamsSerializer(serializers.Serializer):
    granularity = serializers.ChoiceField(choices=GRANULARITIES, default="month")
    date_from = serializers.DateField(required=False)
    date_to = serializers.DateField(required=False)

    def validate(self, attrs):
        start, end = attrs.get("date_from"), attrs.get("date_to")
        if start and end and start > end:
            raise serializers.ValidationError({"date_from": "date_from no puede ser posterior a date_to."})
        return attrs

    def to_params(self) -> PricingParams:
        d = self.validated_data
        return PricingParams(date_from=d.get("date_from"), date_to=d.get("date_to"), granularity=d["granularity"])
