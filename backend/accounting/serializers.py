from rest_framework import serializers

from billing.dte_policy import CONFIGURABLE_DTE_TYPES
from core.serializers.mixins import FrozenFieldsField
from treasury.pos_lock import PosSessionLockedField

from .models import (
    Account,
    AccountingSettings,
    Budget,
    BudgetItem,
    ClosingChecklistInstance,
    FiscalYear,
    FiscalYearAccountMapping,
    JournalEntry,
    JournalItem,
)


class AccountSerializer(serializers.ModelSerializer):
    frozen_fields = FrozenFieldsField()
    pos_session_locked = PosSessionLockedField()
    account_type_display = serializers.CharField(source="get_account_type_display", read_only=True)
    bs_category_display = serializers.CharField(source="get_bs_category_display", read_only=True)
    debit_total = serializers.DecimalField(max_digits=20, decimal_places=2, read_only=True)
    credit_total = serializers.DecimalField(max_digits=20, decimal_places=2, read_only=True)
    balance = serializers.DecimalField(max_digits=20, decimal_places=2, read_only=True)
    has_posted_items = serializers.BooleanField(read_only=True)

    class Meta:
        model = Account
        fields = [
            "frozen_fields",
            "pos_session_locked",
            "id",
            "code",
            "name",
            "account_type",
            "account_type_display",
            "bs_category",
            "bs_category_display",
            "parent",
            "is_reconcilable",
            "is_selectable",
            "has_posted_items",
            "debit_total",
            "credit_total",
            "balance",
            "is_category",
            "cf_category",
            "is_active",
        ]
        extra_kwargs = {"code": {"required": False, "allow_blank": True}}


class AccountingSettingsSerializer(serializers.ModelSerializer):
    default_uncollectible_expense_account_name = serializers.CharField(
        source="default_uncollectible_expense_account.name", read_only=True, default=None
    )
    partner_capital_social_account_name = serializers.CharField(
        source="partner_capital_social_account.name", read_only=True, default=None
    )
    partner_capital_contribution_account_name = serializers.CharField(
        source="partner_capital_contribution_account.name", read_only=True, default=None
    )
    partner_withdrawal_account_name = serializers.CharField(
        source="partner_withdrawal_account.name", read_only=True, default=None
    )
    partner_provisional_withdrawal_account_name = serializers.CharField(
        source="partner_provisional_withdrawal_account.name", read_only=True, default=None
    )
    partner_retained_earnings_account_name = serializers.CharField(
        source="partner_retained_earnings_account.name", read_only=True, default=None
    )
    partner_current_year_earnings_account_name = serializers.CharField(
        source="partner_current_year_earnings_account.name", read_only=True, default=None
    )
    partner_dividends_payable_account_name = serializers.CharField(
        source="partner_dividends_payable_account.name", read_only=True, default=None
    )
    partner_capital_receivable_account_name = serializers.CharField(
        source="partner_capital_receivable_account.name", read_only=True, default=None
    )
    # Cierran F5.1 / Gap 1.5a (ADR-0037): nombres legibles de las cuentas
    # de gasto financiero que `CardService.apply_charges` resuelve
    # automáticamente desde settings.
    interest_expense_account_name = serializers.CharField(
        source="interest_expense_account.name", read_only=True, default=None
    )
    bank_commission_account_name = serializers.CharField(
        source="bank_commission_account.name", read_only=True, default=None
    )

    class Meta:
        model = AccountingSettings
        fields = "__all__"

    def validate_pos_default_credit_percentage(self, value):
        if value < 0 or value > 100:
            raise serializers.ValidationError("El porcentaje debe estar entre 0 y 100.")
        return value

    def validate_credit_auto_block_days(self, value):
        if value is not None and value <= 0:
            raise serializers.ValidationError(
                "Los días de auto-bloqueo deben ser positivos o quedar vacíos para desactivarlo."
            )
        return value

    def validate_allowed_dte_types_emit(self, value):
        return self._validate_allowed_dte_types(value)

    def validate_allowed_dte_types_receive(self, value):
        return self._validate_allowed_dte_types(value)

    @staticmethod
    def _validate_allowed_dte_types(value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Debe enviar una lista de tipos DTE.")
        invalid_types = [
            item for item in value
            if not isinstance(item, str) or item not in CONFIGURABLE_DTE_TYPES
        ]
        if invalid_types:
            raise serializers.ValidationError(
                f"Tipos DTE no permitidos: {', '.join(map(str, invalid_types))}."
            )
        if len(set(value)) != len(value):
            raise serializers.ValidationError("La lista no puede contener tipos repetidos.")
        return value


class JournalItemSerializer(serializers.ModelSerializer):
    account_code = serializers.CharField(source="account.code", read_only=True)
    account_name = serializers.CharField(source="account.name", read_only=True)

    class Meta:
        model = JournalItem
        fields = [
            "id",
            "account",
            "account_code",
            "account_name",
            "partner",
            "label",
            "debit",
            "credit",
        ]


class JournalEntrySerializer(serializers.ModelSerializer):
    items = JournalItemSerializer(many=True, read_only=True)
    # Documento origen como DocumentRef (ADR-0080/0083 U6; reemplaza `source_documents`)
    source_document = serializers.SerializerMethodField()
    display_id = serializers.CharField(read_only=True)
    reversal_of = serializers.SerializerMethodField()

    class Meta:
        model = JournalEntry
        fields = [
            "id",
            "number",
            "display_id",
            "date",
            "description",
            "status",
            "is_manual",
            "items",
            "source_document",
            "reversal_of",
            "created_at",
            "source_content_type_id",
            "source_object_id",
        ]
        read_only_fields = ["id", "number", "status"]

    def get_source_document(self, obj):
        if not obj.source_content_type_id or not obj.source_object_id:
            return None
        from core.documents import ref_for
        from core.documents.types import DocumentTypeRegistry

        model = obj.source_content_type.model_class()
        if model is None:
            return None
        request = self.context.get("request")
        return ref_for(DocumentTypeRegistry.label_for(model), obj.source_object_id, getattr(request, "user", None))

    def get_reversal_of(self, obj):
        if obj.reversal_of_id:
            return {
                "id": obj.reversal_of.id,
                "display_id": obj.reversal_of.display_id,
            }
        return None


# --- Budgeting Serializers ---


class BudgetItemSerializer(serializers.ModelSerializer):
    account_name = serializers.CharField(source="account.name", read_only=True)
    account_code = serializers.CharField(source="account.code", read_only=True)

    class Meta:
        model = BudgetItem
        fields = [
            "id",
            "budget",
            "account",
            "account_code",
            "account_name",
            "month",
            "year",
            "amount",
        ]


class BudgetSerializer(serializers.ModelSerializer):
    items = BudgetItemSerializer(
        many=True, read_only=True
    )  # or separate endpoint for items management

    class Meta:
        model = Budget
        fields = ["id", "name", "start_date", "end_date", "description", "created_at", "items"]


# --- Fiscal Year Closing Serializers ---


class FiscalYearSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    closing_entry_display = serializers.CharField(
        source="closing_entry.display_id", read_only=True, default=None
    )
    opening_entry_display = serializers.CharField(
        source="opening_entry.display_id", read_only=True, default=None
    )
    closed_by_username = serializers.CharField(
        source="closed_by.username", read_only=True, default=None
    )

    class Meta:
        model = FiscalYear
        fields = [
            "id",
            "year",
            "start_date",
            "end_date",
            "status",
            "status_display",
            "closing_entry",
            "closing_entry_display",
            "opening_entry",
            "opening_entry_display",
            "net_result",
            "is_profit",
            "is_loss",
            "closed_at",
            "closed_by",
            "closed_by_username",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "status",
            "closing_entry",
            "opening_entry",
            "net_result",
            "closed_at",
            "closed_by",
        ]


class FiscalYearPreviewAccountSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    code = serializers.CharField()
    name = serializers.CharField()
    balance = serializers.FloatField()


class FiscalYearPreviewValidationSerializer(serializers.Serializer):
    passed = serializers.BooleanField()
    message = serializers.CharField()


class FiscalYearPreviewSerializer(serializers.Serializer):
    year = serializers.IntegerField()
    income_accounts = FiscalYearPreviewAccountSerializer(many=True)
    expense_accounts = FiscalYearPreviewAccountSerializer(many=True)
    income_total = serializers.FloatField()
    expense_total = serializers.FloatField()
    net_result = serializers.FloatField()
    is_profit = serializers.BooleanField()
    is_loss = serializers.BooleanField()
    validations = serializers.DictField()
    can_close = serializers.BooleanField()
    result_account_id = serializers.IntegerField(allow_null=True)
    result_account_code = serializers.CharField(allow_null=True)
    result_account_name = serializers.CharField(allow_null=True)
    is_balanced = serializers.BooleanField(default=True)


class FiscalYearMappingSerializer(serializers.ModelSerializer):
    account_code = serializers.CharField(source="account.code", read_only=True)
    account_name = serializers.CharField(source="account.name", read_only=True)

    class Meta:
        model = FiscalYearAccountMapping
        fields = [
            "id",
            "account",
            "account_code",
            "account_name",
            "is_category",
            "bs_category",
            "cf_category",
        ]


class ClosingChecklistInstanceSerializer(serializers.ModelSerializer):
    code = serializers.CharField(source="template.code", read_only=True)
    name = serializers.CharField(source="template.name", read_only=True)
    description = serializers.CharField(source="template.description", read_only=True)
    category = serializers.CharField(source="template.category", read_only=True)
    category_display = serializers.CharField(source="template.get_category_display", read_only=True)
    is_required = serializers.BooleanField(source="template.is_required", read_only=True)
    order = serializers.IntegerField(source="template.order", read_only=True)
    completed_by_username = serializers.CharField(
        source="completed_by.username", read_only=True, default=None
    )

    class Meta:
        model = ClosingChecklistInstance
        fields = [
            "id",
            "fiscal_year",
            "code",
            "name",
            "description",
            "category",
            "category_display",
            "is_required",
            "order",
            "is_completed",
            "completed_at",
            "completed_by",
            "completed_by_username",
            "notes",
        ]
        read_only_fields = [
            "id",
            "fiscal_year",
            "code",
            "name",
            "description",
            "category",
            "category_display",
            "is_required",
            "order",
            "completed_at",
            "completed_by",
            "completed_by_username",
        ]
