"""Validación de los parámetros de ``GET /inventory/products/{id}/operations/``."""
from datetime import date

from rest_framework import serializers


class OperationsParamsSerializer(serializers.Serializer):
    date_from = serializers.DateField(required=False)
    date_to = serializers.DateField(required=False)
    idle_days = serializers.IntegerField(required=False, default=90, min_value=1, max_value=365)

    def validate(self, attrs):
        start, end = attrs.get("date_from"), attrs.get("date_to")
        if start and end and start > end:
            raise serializers.ValidationError({"date_from": "date_from no puede ser posterior a date_to."})
        return attrs

    def to_args(self) -> tuple[date | None, date | None, int]:
        d = self.validated_data
        return d.get("date_from"), d.get("date_to"), d["idle_days"]
