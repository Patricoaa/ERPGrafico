"""Referencia compacta al grupo de cuadre fiscal para listas RCV y TUU."""

from rest_framework import serializers


class FiscalMatchRefSerializer(serializers.Serializer):
    """``{id, status, status_display}`` del ``tax.FiscalMatch`` (select_related en el selector)."""

    id = serializers.IntegerField(read_only=True)
    status = serializers.CharField(read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
