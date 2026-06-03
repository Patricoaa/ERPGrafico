"""
finances/serializers.py
"""
from rest_framework import serializers
from .models import IndicatorValue


class IndicatorValueSerializer(serializers.ModelSerializer):
    indicator_display = serializers.CharField(source='get_indicator_display', read_only=True)

    class Meta:
        model = IndicatorValue
        fields = [
            'id', 'indicator', 'indicator_display',
            'date', 'value', 'source', 'notes',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']
