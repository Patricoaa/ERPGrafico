from rest_framework import serializers

from billing.models import Invoice


class TerminalRunSerializer(serializers.Serializer):
    year = serializers.IntegerField(min_value=2000, max_value=2100)
    month = serializers.IntegerField(min_value=1, max_value=12)


# Mismo cuerpo para el reporte (query params), el recálculo del RCV y el de TUU.
PeriodSerializer = TerminalRunSerializer


class TerminalMatchSerializer(serializers.Serializer):
    invoice_id = serializers.PrimaryKeyRelatedField(queryset=Invoice.objects.all(), source="invoice")


class TerminalCandidateSerializer(serializers.ModelSerializer):
    dte_type = serializers.CharField(read_only=True)
    display_id = serializers.CharField(read_only=True)

    class Meta:
        model = Invoice
        fields = ["id", "display_id", "dte_type", "total", "date"]
        read_only_fields = fields


# Mismo formato de candidato para ventas TUU y documentos RCV.
InvoiceCandidateSerializer = TerminalCandidateSerializer
