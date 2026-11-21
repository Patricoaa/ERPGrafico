"""Validación de los parámetros de ``GET /inventory/products/{id}/production-analysis/``."""
from rest_framework import serializers

from .production_analysis_selector import INCREASE_CHOICES, ProductionAnalysisParams
from .sales_impact_selector import GRANULARITIES


class ProductionAnalysisParamsSerializer(serializers.Serializer):
    granularity = serializers.ChoiceField(choices=GRANULARITIES, default="month")
    date_from = serializers.DateField(required=False)
    date_to = serializers.DateField(required=False)
    increase_pct = serializers.ChoiceField(choices=INCREASE_CHOICES, default=10)

    def validate(self, attrs):
        start, end = attrs.get("date_from"), attrs.get("date_to")
        if start and end and start > end:
            raise serializers.ValidationError({"date_from": "date_from no puede ser posterior a date_to."})
        return attrs

    def to_params(self) -> ProductionAnalysisParams:
        d = self.validated_data
        return ProductionAnalysisParams(
            date_from=d.get("date_from"), date_to=d.get("date_to"), granularity=d["granularity"],
            increase_pct=int(d["increase_pct"]),
        )
