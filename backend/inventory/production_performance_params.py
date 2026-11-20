"""Validación de los parámetros de ``GET /inventory/products/{id}/production-performance/``."""
from datetime import date

from rest_framework import serializers


class ProductionPerformanceParamsSerializer(serializers.Serializer):
    date_from = serializers.DateField(required=False)
    date_to = serializers.DateField(required=False)

    def validate(self, attrs):
        start, end = attrs.get("date_from"), attrs.get("date_to")
        if start and end and start > end:
            raise serializers.ValidationError({"date_from": "date_from no puede ser posterior a date_to."})
        return attrs

    def to_range(self) -> tuple[date | None, date | None]:
        return self.validated_data.get("date_from"), self.validated_data.get("date_to")
