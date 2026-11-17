"""Serializers de la API del cuadre por grupo (spec §5.7). Solo leen datos precargados."""

from rest_framework import serializers

from accounting.models import RCVDocument
from billing.models import Invoice
from core.fiscal_match import FiscalMatchStatus
from purchasing.models import PurchaseOrder
from tax.fiscal_match.selectors import ATTENTION
from tax.models import FiscalMatch
from treasury.models import TerminalSale, TreasuryMovement

_STATUS_CHOICES = {*FiscalMatchStatus.values, ATTENTION}


class FiscalMatchFilterSerializer(serializers.Serializer):
    """Filtros de la lista y los conteos (query params). ``status`` acepta repetidos o comas."""

    direction = serializers.ChoiceField(choices=FiscalMatch.Direction.choices, required=False)
    status = serializers.ListField(child=serializers.CharField(), required=False)
    dte_type = serializers.IntegerField(min_value=0, required=False)
    date_from = serializers.DateField(required=False)
    date_to = serializers.DateField(required=False)
    search = serializers.CharField(required=False, allow_blank=True, max_length=40)

    def validate_status(self, value: list[str]) -> list[str]:
        statuses = [s.strip() for item in value for s in item.split(",") if s.strip()]
        unknown = sorted(set(statuses) - _STATUS_CHOICES)
        if unknown:
            raise serializers.ValidationError(f"Estado desconocido: {', '.join(unknown)}.")
        return statuses


class CandidatesQuerySerializer(serializers.Serializer):
    part = serializers.ChoiceField(choices=["erp", "tuu", "rcv"])


class LinkSerializer(serializers.Serializer):
    part = serializers.ChoiceField(choices=["erp", "tuu", "rcv"])
    id = serializers.IntegerField(min_value=1)
    movement = serializers.IntegerField(min_value=1, required=False, allow_null=True, default=None)


class UnlinkSerializer(serializers.Serializer):
    part = serializers.ChoiceField(choices=["tuu", "rcv"])
    id = serializers.IntegerField(min_value=1)


class ConfirmDraftSerializer(serializers.Serializer):
    invoice_id = serializers.PrimaryKeyRelatedField(queryset=Invoice.objects.all(), source="invoice")
    attachment = serializers.FileField(required=False)


class CreateDraftSerializer(serializers.Serializer):
    purchase_order_id = serializers.PrimaryKeyRelatedField(
        queryset=PurchaseOrder.objects.select_related("supplier"), source="purchase_order"
    )


# --- lista --------------------------------------------------------------------


class _InvoiceRefSerializer(serializers.ModelSerializer):
    display_id = serializers.CharField(read_only=True)

    class Meta:
        model = Invoice
        fields = ["id", "display_id"]
        read_only_fields = fields


class _SaleRefSerializer(serializers.ModelSerializer):
    class Meta:
        model = TerminalSale
        fields = ["id", "transaction_at", "sale_amount"]
        read_only_fields = fields


class _RcvRefSerializer(serializers.ModelSerializer):
    class Meta:
        model = RCVDocument
        fields = ["id", "folio"]
        read_only_fields = fields


_LIST_FIELDS = [
    "id", "direction", "status", "status_display", "erp_state", "tuu_state", "rcv_state", "dte_type",
    "issue_date", "erp_amount", "tuu_amount", "rcv_amount", "invoice", "terminal_sales", "rcv_documents",
    "notice", "closed_period_alert", "issue_error",
]


class FiscalMatchListSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    invoice = _InvoiceRefSerializer(read_only=True)
    terminal_sales = _SaleRefSerializer(many=True, read_only=True)
    rcv_documents = _RcvRefSerializer(many=True, read_only=True)

    class Meta:
        model = FiscalMatch
        fields = _LIST_FIELDS
        read_only_fields = fields


# --- detalle ------------------------------------------------------------------


class _InvoiceDetailSerializer(serializers.ModelSerializer):
    display_id = serializers.CharField(read_only=True)

    class Meta:
        model = Invoice
        fields = ["id", "display_id", "dte_type", "number", "status", "total", "date"]
        read_only_fields = fields


class _MovementRefSerializer(serializers.ModelSerializer):
    class Meta:
        model = TreasuryMovement
        fields = ["id", "amount", "created_at"]
        read_only_fields = fields


class _SaleDetailSerializer(serializers.ModelSerializer):
    matched_movement = _MovementRefSerializer(read_only=True)

    class Meta:
        model = TerminalSale
        fields = [
            "id", "transaction_at", "sale_amount", "document_type", "payment_type", "matched_movement",
            "linked_manually",
        ]
        read_only_fields = fields


class _RcvDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = RCVDocument
        fields = ["id", "folio", "dte_type", "issue_date", "total_amount", "period"]
        read_only_fields = fields


class FiscalMatchDetailSerializer(FiscalMatchListSerializer):
    invoice = _InvoiceDetailSerializer(read_only=True)
    terminal_sales = _SaleDetailSerializer(many=True, read_only=True)
    rcv_documents = _RcvDetailSerializer(many=True, read_only=True)

    class Meta:
        model = FiscalMatch
        fields = [
            *_LIST_FIELDS, "counterparty_rut", "fiscal_period", "rcv_linked_manually", "issue_attempted_at",
            "evaluated_at",
        ]
        read_only_fields = fields


# --- candidatos ---------------------------------------------------------------


class ErpCandidateSerializer(serializers.ModelSerializer):
    display_id = serializers.CharField(read_only=True)

    class Meta:
        model = Invoice
        fields = ["id", "display_id", "dte_type", "number", "total", "date"]
        read_only_fields = fields


class TuuCandidateSerializer(serializers.ModelSerializer):
    compatible_movements = serializers.ListField(child=serializers.IntegerField(), read_only=True)

    class Meta:
        model = TerminalSale
        fields = ["id", "transaction_at", "sale_amount", "document_type", "payment_type", "compatible_movements"]
        read_only_fields = fields


class RcvCandidateSerializer(serializers.ModelSerializer):
    class Meta:
        model = RCVDocument
        fields = ["id", "folio", "dte_type", "issue_date", "total_amount", "period", "counterparty_rut"]
        read_only_fields = fields


CANDIDATE_SERIALIZERS = {
    "erp": ErpCandidateSerializer,
    "tuu": TuuCandidateSerializer,
    "rcv": RcvCandidateSerializer,
}
