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


MAX_CHANGES = 50


class ChangeSerializer(serializers.Serializer):
    """Un cambio en espera de la ficha; las reglas de negocio las valida ``apply_changes``."""

    op = serializers.ChoiceField(choices=["link", "unlink"])
    part = serializers.ChoiceField(choices=["erp", "tuu", "rcv"])
    id = serializers.IntegerField(min_value=1)
    movement = serializers.IntegerField(min_value=1, required=False, allow_null=True)
    # ``{sale_id: movement_id}``; las claves JSON llegan como texto y se convierten a entero.
    payments = serializers.DictField(
        child=serializers.IntegerField(min_value=1), required=False, allow_null=True
    )

    def validate_payments(self, value: dict[str, int] | None) -> dict[int, int] | None:
        if value is None:
            return None
        if not all(key.isdecimal() and int(key) > 0 for key in value):
            raise serializers.ValidationError("Las claves de «payments» deben ser ids de venta.")
        return {int(key): movement for key, movement in value.items()}


class ApplySerializer(serializers.Serializer):
    changes = serializers.ListField(
        child=ChangeSerializer(), min_length=1, max_length=MAX_CHANGES, allow_empty=False
    )


class ConfirmDraftSerializer(serializers.Serializer):
    invoice_id = serializers.PrimaryKeyRelatedField(
        queryset=Invoice.objects.all(), source="invoice"
    )
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
    "id",
    "direction",
    "status",
    "status_display",
    "erp_state",
    "tuu_state",
    "rcv_state",
    "dte_type",
    "issue_date",
    "erp_amount",
    "tuu_amount",
    "rcv_amount",
    "invoice",
    "terminal_sales",
    "rcv_documents",
    "notice",
    "closed_period_alert",
    "issue_error",
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
            "id",
            "transaction_at",
            "sale_amount",
            "document_type",
            "payment_type",
            "matched_movement",
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
            *_LIST_FIELDS,
            "counterparty_rut",
            "fiscal_period",
            "rcv_linked_manually",
            "issue_attempted_at",
            "evaluated_at",
        ]
        read_only_fields = fields


# --- candidatos ---------------------------------------------------------------


class CandidateMovementSerializer(serializers.ModelSerializer):
    """Cobro del documento al que puede corresponder una venta TUU (``payment_method_new`` precargado)."""

    method = serializers.SerializerMethodField()

    class Meta:
        model = TreasuryMovement
        fields = ["id", "amount", "created_at", "method"]
        read_only_fields = fields

    def get_method(self, obj: TreasuryMovement) -> str:
        return (
            obj.payment_method_new.name
            if obj.payment_method_new
            else obj.get_payment_method_display()
        )


class SearchQuerySerializer(serializers.Serializer):
    """Query params de ``search`` (spec §5.2)."""

    part = serializers.ChoiceField(choices=["erp", "tuu", "rcv"])
    q = serializers.CharField(required=False, allow_blank=True, max_length=40, default="")
    ordering = serializers.ChoiceField(choices=["score", "recent"], required=False, default="score")


class MatchWarningSerializer(serializers.Serializer):
    code = serializers.CharField(read_only=True)
    label = serializers.CharField(read_only=True)
    blocking = serializers.BooleanField(read_only=True)


class CarriedRcvSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    folio = serializers.CharField(read_only=True)


class SearchItemSerializer(serializers.Serializer):
    """Tarjeta candidata de la búsqueda; los campos opcionales solo viajan en su parte."""

    id = serializers.IntegerField(read_only=True)
    kind = serializers.CharField(read_only=True)
    label = serializers.CharField(read_only=True)
    counterparty = serializers.CharField(read_only=True)
    date = serializers.DateField(read_only=True)
    datetime = serializers.DateTimeField(read_only=True, required=False)
    amount = serializers.DecimalField(max_digits=14, decimal_places=0, read_only=True)
    score = serializers.IntegerField(read_only=True)
    warnings = MatchWarningSerializer(many=True, read_only=True)
    compatible_movements = CandidateMovementSerializer(many=True, read_only=True, required=False)
    carried_rcv = CarriedRcvSerializer(many=True, read_only=True, required=False)
    payments_by_sale = serializers.DictField(
        child=serializers.ListField(child=CandidateMovementSerializer()),
        read_only=True,
        required=False,
    )


class InvoiceCandidateSerializer(serializers.ModelSerializer):
    """Borrador sugerido para un documento de compra del SII que falta en el ERP."""

    dte_type = serializers.CharField(read_only=True)
    display_id = serializers.CharField(read_only=True)

    class Meta:
        model = Invoice
        fields = ["id", "display_id", "dte_type", "total", "date"]
        read_only_fields = fields


class PurchaseOrderOptionSerializer(serializers.ModelSerializer):
    display_id = serializers.CharField(read_only=True)

    class Meta:
        model = PurchaseOrder
        fields = ["id", "display_id", "date", "total"]
        read_only_fields = fields
