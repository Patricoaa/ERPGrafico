"""Serializers de la API de importación RCV (SII vía SimpleAPI).

Secretos (clave SII y API keys) son solo escritura; nunca se devuelven. Ningún
``SerializerMethodField`` consulta la base: lo derivado llega por contexto o anotación.
"""

from rest_framework import serializers

from core.fiscal_match import MatchStatus

from .integrations.rcv_normalizer import is_valid_rut, normalize_rut
from .models import (
    RCVApiKey,
    RCVDocument,
    RCVImport,
    RCVImportAttempt,
    RCVImportSummary,
    RCVSettings,
)
from .selectors import rcv_api_key_with_same_key

# ── Documentos ───────────────────────────────────────────────────────────────


def _import_ref(rcv_import: RCVImport | None) -> dict | None:
    return {"id": rcv_import.id, "period": rcv_import.period} if rcv_import else None


class RCVDocumentListSerializer(serializers.ModelSerializer):
    is_missing = serializers.SerializerMethodField()
    match_status_display = serializers.CharField(source="get_match_status_display", read_only=True)
    matched_invoice_display = serializers.CharField(
        source="matched_invoice.display_id", read_only=True, default=None
    )
    # Anotados por `with_terminal_sale` en el selector (sin consulta por fila).
    terminal_sale = serializers.IntegerField(source="terminal_sale_pk", read_only=True, default=None)
    terminal_sale_display = serializers.SerializerMethodField()

    class Meta:
        model = RCVDocument
        fields = [
            "id",
            "direction",
            "company_rut",
            "period",
            "dte_type",
            "dte_type_label",
            "folio",
            "counterparty_rut",
            "counterparty_name",
            "issue_date",
            "received_at",
            "acknowledged_at",
            "operation_type",
            "status",
            "acknowledgement",
            "service_indicator",
            "exempt_amount",
            "net_amount",
            "vat_amount",
            "vat_recoverable",
            "vat_non_recoverable",
            "total_amount",
            "other_taxes_total",
            "reference_dte_type",
            "reference_folio",
            "is_missing",
            "match_status",
            "match_status_display",
            "matched_invoice",
            "matched_invoice_display",
            "matched_manually",
            "terminal_sale",
            "terminal_sale_display",
        ]
        read_only_fields = fields

    def get_is_missing(self, obj: RCVDocument) -> bool:
        return obj.missing_since_import_id is not None

    def get_terminal_sale_display(self, obj: RCVDocument) -> str | None:
        if getattr(obj, "terminal_sale_pk", None) is None:
            return None
        return f"Venta TUU {obj.terminal_sale_ref}"


class RCVDocumentSerializer(RCVDocumentListSerializer):
    first_import = serializers.SerializerMethodField()
    last_import = serializers.SerializerMethodField()
    missing_since_import = serializers.SerializerMethodField()

    class Meta(RCVDocumentListSerializer.Meta):
        fields = RCVDocumentListSerializer.Meta.fields + [
            "raw",
            "first_import",
            "last_import",
            "missing_since_import",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_first_import(self, obj: RCVDocument) -> dict | None:
        return _import_ref(obj.first_import)

    def get_last_import(self, obj: RCVDocument) -> dict | None:
        return _import_ref(obj.last_import)

    def get_missing_since_import(self, obj: RCVDocument) -> dict | None:
        return _import_ref(obj.missing_since_import)


class RCVDocumentFilterSerializer(serializers.Serializer):
    """Valida los query params de documentos RCV (400 ante valores malformados)."""

    direction = serializers.ChoiceField(choices=RCVImport.Direction.choices, required=False)
    year = serializers.IntegerField(required=False, min_value=2000, max_value=2100)
    month = serializers.IntegerField(required=False, min_value=1, max_value=12)
    dte_type = serializers.IntegerField(required=False, min_value=0)
    status = serializers.CharField(required=False, allow_blank=True)
    acknowledgement = serializers.CharField(required=False, allow_blank=True)
    missing = serializers.ChoiceField(choices=["true", "false"], required=False)
    match_status = serializers.ChoiceField(choices=MatchStatus.choices, required=False)
    issue_date_from = serializers.DateField(required=False)
    issue_date_to = serializers.DateField(required=False)
    search = serializers.CharField(required=False, allow_blank=True)


# ── Importaciones ────────────────────────────────────────────────────────────


def _masked(api_key: RCVApiKey | None) -> str | None:
    return api_key.masked_key if api_key else None


class RCVImportListSerializer(serializers.ModelSerializer):
    masked_key = serializers.SerializerMethodField()
    triggered_by_name = serializers.SerializerMethodField()

    class Meta:
        model = RCVImport
        fields = [
            "id",
            "direction",
            "year",
            "month",
            "period",
            "trigger",
            "status",
            "triggered_by",
            "triggered_by_name",
            "started_at",
            "finished_at",
            "error_code",
            "error_message",
            "warnings",
            "received_count",
            "created_count",
            "updated_count",
            "missing_count",
            "api_key",
            "masked_key",
            "created_at",
        ]
        read_only_fields = fields

    def get_masked_key(self, obj: RCVImport) -> str | None:
        return _masked(obj.api_key)

    def get_triggered_by_name(self, obj: RCVImport) -> str | None:
        user = obj.triggered_by
        return (user.get_full_name() or user.username) if user else None


class RCVImportSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = RCVImportSummary
        fields = [
            "id",
            "dte_type",
            "dte_type_label",
            "document_count",
            "exempt_amount",
            "net_amount",
            "vat_recoverable",
            "vat_common_use",
            "vat_non_recoverable",
            "total_amount",
            "status",
            "has_detail",
            "detail_count",
            "detail_total",
        ]
        read_only_fields = fields


class RCVImportAttemptSerializer(serializers.ModelSerializer):
    masked_key = serializers.SerializerMethodField()

    class Meta:
        model = RCVImportAttempt
        fields = [
            "id",
            "api_key",
            "masked_key",
            "http_status",
            "outcome",
            "duration_ms",
            "error_message",
            "rate_limit_remaining",
            "created_at",
        ]
        read_only_fields = fields

    def get_masked_key(self, obj: RCVImportAttempt) -> str | None:
        return _masked(obj.api_key)


class RCVImportSerializer(RCVImportListSerializer):
    summaries = RCVImportSummarySerializer(many=True, read_only=True)
    attempts = RCVImportAttemptSerializer(many=True, read_only=True)

    class Meta(RCVImportListSerializer.Meta):
        fields = RCVImportListSerializer.Meta.fields + [
            "summaries",
            "attempts",
            "raw_response",
            "updated_at",
        ]
        read_only_fields = fields


class RCVImportFilterSerializer(serializers.Serializer):
    direction = serializers.ChoiceField(choices=RCVImport.Direction.choices, required=False)
    status = serializers.ChoiceField(choices=RCVImport.Status.choices, required=False)
    trigger = serializers.ChoiceField(choices=RCVImport.Trigger.choices, required=False)
    year = serializers.IntegerField(required=False, min_value=2000, max_value=2100)
    month = serializers.IntegerField(required=False, min_value=1, max_value=12)


class RCVImportStartSerializer(serializers.Serializer):
    year = serializers.IntegerField(min_value=2000, max_value=2100)
    month = serializers.IntegerField(min_value=1, max_value=12)
    directions = serializers.ListField(
        child=serializers.ChoiceField(choices=RCVImport.Direction.choices), allow_empty=False
    )


# ── Configuración ────────────────────────────────────────────────────────────


def _clean_rut(value: str) -> str:
    if not (value or "").strip():
        return ""
    if not is_valid_rut(value):
        raise serializers.ValidationError("RUT inválido: revise el dígito verificador.")
    return normalize_rut(value)


class RCVSettingsSerializer(serializers.ModelSerializer):
    """Singleton de configuración. Contexto: ``next_period``, ``estimated_monthly_queries``,
    ``total_monthly_quota`` (calculados en la vista)."""

    sii_password = serializers.CharField(
        write_only=True, required=False, allow_blank=True, trim_whitespace=True
    )
    has_sii_password = serializers.BooleanField(read_only=True)
    next_period = serializers.SerializerMethodField()
    estimated_monthly_queries = serializers.SerializerMethodField()
    total_monthly_quota = serializers.SerializerMethodField()

    class Meta:
        model = RCVSettings
        fields = [
            "company_rut",
            "user_rut",
            "sii_password",
            "has_sii_password",
            "enabled",
            "interval_days",
            "run_hour",
            "include_purchases",
            "include_sales",
            "fiscal_match_start_date",
            "terminal_match_window_minutes",
            "next_period",
            "estimated_monthly_queries",
            "total_monthly_quota",
        ]

    def validate_company_rut(self, value: str) -> str:
        return _clean_rut(value)

    def validate_user_rut(self, value: str) -> str:
        return _clean_rut(value)

    def update(self, instance: RCVSettings, validated_data: dict) -> RCVSettings:
        password = (validated_data.pop("sii_password", "") or "").strip()
        if password:
            instance.set_sii_password(password)
        return super().update(instance, validated_data)

    def get_next_period(self, obj: RCVSettings) -> dict | None:
        return self.context.get("next_period")

    def get_estimated_monthly_queries(self, obj: RCVSettings) -> int | None:
        return self.context.get("estimated_monthly_queries")

    def get_total_monthly_quota(self, obj: RCVSettings) -> int | None:
        return self.context.get("total_monthly_quota")


# ── API keys ─────────────────────────────────────────────────────────────────


class RCVApiKeySerializer(serializers.ModelSerializer):
    """``key`` solo escritura (obligatoria al crear); ``used_this_month`` viene anotado."""

    key = serializers.CharField(
        write_only=True, required=False, allow_blank=True, trim_whitespace=True
    )
    masked_key = serializers.CharField(read_only=True)
    used_this_month = serializers.SerializerMethodField()

    class Meta:
        model = RCVApiKey
        fields = [
            "id",
            "label",
            "key",
            "masked_key",
            "is_active",
            "monthly_limit",
            "used_this_month",
            "exhausted_until",
            "last_used_at",
            "last_error",
        ]
        read_only_fields = ["id", "masked_key", "exhausted_until", "last_used_at", "last_error"]

    def get_used_this_month(self, obj: RCVApiKey) -> int:
        return getattr(obj, "used_this_month", 0)

    def validate_key(self, value: str) -> str:
        return (value or "").strip()

    def validate(self, attrs: dict) -> dict:
        attrs = super().validate(attrs)
        key = attrs.get("key", "")
        if self.instance is None and not key:
            raise serializers.ValidationError({"key": "La API key es obligatoria."})
        if rcv_api_key_with_same_key(key, self.instance.pk if self.instance else None):
            raise serializers.ValidationError({"key": "Esta API key ya está registrada."})
        return attrs

    def create(self, validated_data: dict) -> RCVApiKey:
        key = validated_data.pop("key")
        instance = RCVApiKey(**validated_data)
        instance.set_key(key)
        instance.save()
        return instance

    def update(self, instance: RCVApiKey, validated_data: dict) -> RCVApiKey:
        key = validated_data.pop("key", "")
        if key:
            instance.set_key(key)
            # Una key nueva no hereda el agotamiento ni el error de la anterior.
            instance.exhausted_until = None
            instance.last_error = ""
        return super().update(instance, validated_data)
