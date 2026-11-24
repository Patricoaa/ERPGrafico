"""Validación de los parámetros de ``GET /inventory/products/{id}/stock-analysis/``."""
from rest_framework import serializers

from .sales_impact_selector import GRANULARITIES
from .stock_analysis_selector import IDLE_DAYS_CHOICES, StockAnalysisParams


class StockAnalysisParamsSerializer(serializers.Serializer):
    granularity = serializers.ChoiceField(choices=GRANULARITIES, default="month")
    date_from = serializers.DateField(required=False)
    date_to = serializers.DateField(required=False)
    idle_days = serializers.ChoiceField(choices=IDLE_DAYS_CHOICES, default=90)

    def validate(self, attrs):
        start, end = attrs.get("date_from"), attrs.get("date_to")
        if start and end and start > end:
            raise serializers.ValidationError({"date_from": "date_from no puede ser posterior a date_to."})
        return attrs

    def to_params(self) -> StockAnalysisParams:
        d = self.validated_data
        return StockAnalysisParams(
            date_from=d.get("date_from"), date_to=d.get("date_to"), granularity=d["granularity"],
            idle_days=int(d["idle_days"]),
        )
