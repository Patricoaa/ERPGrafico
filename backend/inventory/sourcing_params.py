"""Validación de los parámetros de ``GET /inventory/products/{id}/sourcing/``."""
import math
from datetime import date

from rest_framework import serializers


class SourcingParamsSerializer(serializers.Serializer):
    date_from = serializers.DateField(required=False)
    date_to = serializers.DateField(required=False)
    increase_pct = serializers.FloatField(required=False, default=10, min_value=1, max_value=100)

    def validate_increase_pct(self, value):
        if not math.isfinite(value):
            raise serializers.ValidationError("increase_pct debe ser un número finito.")
        return value

    def validate(self, attrs):
        start, end = attrs.get("date_from"), attrs.get("date_to")
        if start and end and start > end:
            raise serializers.ValidationError({"date_from": "date_from no puede ser posterior a date_to."})
        return attrs

    def to_args(self) -> tuple[date | None, date | None, float]:
        d = self.validated_data
        return d.get("date_from"), d.get("date_to"), d["increase_pct"]
