from decimal import Decimal

from rest_framework import serializers

from .models import Contact


class ContactSerializer(serializers.ModelSerializer):
    """Full contact serializer with computed fields"""

    is_customer = serializers.BooleanField(read_only=True)
    is_supplier = serializers.BooleanField(read_only=True)
    contact_type = serializers.CharField(read_only=True)
    active_roles = serializers.ListField(child=serializers.CharField(), read_only=True)
    credit_balance_used = serializers.DecimalField(max_digits=14, decimal_places=0, read_only=True)
    credit_available = serializers.DecimalField(max_digits=14, decimal_places=0, read_only=True)
    credit_balance = serializers.DecimalField(max_digits=14, decimal_places=0, read_only=True)
    credit_aging = serializers.DictField(read_only=True)
    partner_total_contributions = serializers.DecimalField(
        max_digits=14, decimal_places=0, read_only=True
    )
    partner_total_paid_in = serializers.DecimalField(
        max_digits=14, decimal_places=0, read_only=True
    )
    partner_pending_capital = serializers.DecimalField(
        max_digits=14, decimal_places=0, read_only=True
    )
    partner_provisional_withdrawals_balance = serializers.DecimalField(
        max_digits=14, decimal_places=0, read_only=True
    )
    partner_total_withdrawals = serializers.DecimalField(
        max_digits=14, decimal_places=0, read_only=True
    )
    partner_earnings_balance = serializers.DecimalField(
        max_digits=14, decimal_places=0, read_only=True
    )
    partner_dividends_payable_balance = serializers.DecimalField(
        max_digits=14, decimal_places=0, read_only=True
    )
    partner_net_equity = serializers.DecimalField(max_digits=14, decimal_places=0, read_only=True)
    partner_excess_capital = serializers.DecimalField(
        max_digits=14, decimal_places=0, read_only=True
    )

    class Meta:
        model = Contact
        fields = [
            "id",
            "code",
            "display_id",
            "name",
            "tax_id",
            "contact_name",
            "email",
            "phone",
            "address",
            "is_customer",
            "is_supplier",
            "contact_type",
            "active_roles",
            "roles",
            "is_default_customer",
            "is_default_vendor",
            "credit_enabled",
            "credit_blocked",
            "credit_limit",
            "credit_days",
            "credit_balance_used",
            "credit_available",
            "credit_aging",
            "credit_balance",
            "credit_auto_blocked",
            "credit_risk_level",
            "credit_last_evaluated",
            "is_partner",
            "partner_equity_percentage",
            "partner_since",
            "partner_balance",
            "partner_total_contributions",
            "partner_total_paid_in",
            "partner_pending_capital",
            "partner_excess_capital",
            "partner_provisional_withdrawals_balance",
            "partner_total_withdrawals",
            "partner_earnings_balance",
            "partner_dividends_payable_balance",
            "partner_net_equity",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]


class ContactWriteSerializer(serializers.ModelSerializer):
    """Optimized serializer for create and update views."""
    class Meta:
        model = Contact
        fields = [
            "id",
            "code",
            "name",
            "tax_id",
            "contact_name",
            "email",
            "phone",
            "address",
            "is_default_customer",
            "is_default_vendor",
            "credit_enabled",
            "credit_blocked",
            "credit_limit",
            "credit_days",
            "credit_auto_blocked",
            "credit_risk_level",
            "credit_last_evaluated",
            "is_partner",
            "partner_equity_percentage",
            "partner_since",
        ]


class ContactTinySerializer(serializers.ModelSerializer):
    """Minimal contact serializer for nesting in other serializers (e.g. bank executives).
    Uses only DB fields — no computed properties, zero extra queries."""

    class Meta:
        model = Contact
        fields = ["id", "name", "tax_id", "email", "phone"]
        read_only_fields = fields


class ContactListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views — reads from queryset annotations
    instead of triggering per-contact DB queries via model properties."""

    contact_type = serializers.SerializerMethodField()
    active_roles = serializers.SerializerMethodField()
    credit_balance_used = serializers.SerializerMethodField()
    credit_balance = serializers.SerializerMethodField()
    partner_balance = serializers.SerializerMethodField()
    partner_total_contributions = serializers.SerializerMethodField()
    partner_provisional_withdrawals_balance = serializers.SerializerMethodField()
    partner_earnings_balance = serializers.SerializerMethodField()
    partner_dividends_payable_balance = serializers.SerializerMethodField()
    partner_net_equity = serializers.SerializerMethodField()
    partner_excess_capital = serializers.SerializerMethodField()
    last_sale_date = serializers.DateField(read_only=True)

    class Meta:
        model = Contact
        fields = [
            "id",
            "code",
            "display_id",
            "name",
            "tax_id",
            "email",
            "phone",
            "contact_type",
            "active_roles",
            "roles",
            "is_default_customer",
            "is_default_vendor",
            "credit_enabled",
            "credit_blocked",
            "credit_limit",
            "credit_available",
            "credit_balance",
            "credit_balance_used",
            "credit_auto_blocked",
            "credit_risk_level",
            "is_partner",
            "partner_balance",
            "partner_equity_percentage",
            "partner_total_contributions",
            "partner_pending_capital",
            "partner_excess_capital",
            "partner_provisional_withdrawals_balance",
            "partner_earnings_balance",
            "partner_dividends_payable_balance",
            "partner_net_equity",
            "last_sale_date",
        ]

    def _bool(self, obj, attr):
        return bool(getattr(obj, attr, False))

    def get_contact_type(self, obj):
        has_sales = self._bool(obj, "_has_sales")
        has_purchases = self._bool(obj, "_has_purchases")
        has_work_orders = self._bool(obj, "_has_work_orders")
        if has_sales and has_purchases:
            return "BOTH"
        if has_sales:
            return "CUSTOMER"
        if has_purchases:
            return "SUPPLIER"
        if has_work_orders:
            return "RELATED"
        return "NONE"

    def get_active_roles(self, obj):
        roles = set(getattr(obj, "roles", []) or [])
        if self._bool(obj, "_has_sales"):
            roles.add("CUSTOMER")
        if self._bool(obj, "_has_purchases"):
            roles.add("SUPPLIER")
        if self._bool(obj, "_has_work_orders"):
            roles.add("RELATED")
        if getattr(obj, "is_partner", False):
            roles.add("PARTNER")
        if self._bool(obj, "_has_employees"):
            roles.add("EMPLOYEE")
        if self._bool(obj, "_has_system_user"):
            roles.add("USER")
        return list(roles) if roles else ["NONE"]

    def get_credit_balance_used(self, obj):
        if not self._bool(obj, "_has_sales"):
            return Decimal("0")
        return obj.credit_balance_used

    def get_credit_balance(self, obj):
        additions = getattr(obj, "_credit_balance_additions", Decimal("0")) or Decimal("0")
        consumptions = getattr(obj, "_credit_balance_consumptions", Decimal("0")) or Decimal("0")
        return additions - consumptions

    def get_partner_balance(self, obj):
        if not getattr(obj, "is_partner", False):
            return Decimal("0")
        return obj.partner_balance

    def get_partner_total_contributions(self, obj):
        if not getattr(obj, "is_partner", False):
            return Decimal("0")
        return obj.partner_total_contributions

    def get_partner_provisional_withdrawals_balance(self, obj):
        if not getattr(obj, "is_partner", False):
            return Decimal("0")
        return obj.partner_provisional_withdrawals_balance

    def get_partner_earnings_balance(self, obj):
        if not getattr(obj, "is_partner", False):
            return Decimal("0")
        return obj.partner_earnings_balance

    def get_partner_dividends_payable_balance(self, obj):
        if not getattr(obj, "is_partner", False):
            return Decimal("0")
        return obj.partner_dividends_payable_balance

    def get_partner_net_equity(self, obj):
        if not getattr(obj, "is_partner", False):
            return Decimal("0")
        return obj.partner_net_equity

    def get_partner_excess_capital(self, obj):
        if not getattr(obj, "is_partner", False):
            return Decimal("0")
        return obj.partner_excess_capital


class PartnerListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for the partners list endpoint — no credit/roles queries."""

    partner_total_contributions = serializers.DecimalField(
        max_digits=14, decimal_places=0, read_only=True
    )
    partner_total_paid_in = serializers.DecimalField(
        max_digits=14, decimal_places=0, read_only=True
    )
    partner_pending_capital = serializers.DecimalField(
        max_digits=14, decimal_places=0, read_only=True
    )
    partner_excess_capital = serializers.DecimalField(
        max_digits=14, decimal_places=0, read_only=True
    )
    partner_provisional_withdrawals_balance = serializers.DecimalField(
        max_digits=14, decimal_places=0, read_only=True
    )
    partner_total_withdrawals = serializers.DecimalField(
        max_digits=14, decimal_places=0, read_only=True
    )
    partner_earnings_balance = serializers.DecimalField(
        max_digits=14, decimal_places=0, read_only=True
    )
    partner_dividends_payable_balance = serializers.DecimalField(
        max_digits=14, decimal_places=0, read_only=True
    )
    partner_net_equity = serializers.DecimalField(max_digits=14, decimal_places=0, read_only=True)

    class Meta:
        model = Contact
        fields = [
            "id",
            "name",
            "tax_id",
            "partner_equity_percentage",
            "partner_since",
            "partner_total_contributions",
            "partner_total_paid_in",
            "partner_pending_capital",
            "partner_excess_capital",
            "partner_provisional_withdrawals_balance",
            "partner_total_withdrawals",
            "partner_earnings_balance",
            "partner_dividends_payable_balance",
            "partner_net_equity",
        ]


from .partner_models import (
    PartnerEquityStake,
    PartnerTransaction,
    ProfitDistributionLine,
    ProfitDistributionLineDestination,
    ProfitDistributionResolution,
)


class PartnerTransactionSerializer(serializers.ModelSerializer):
    partner_name = serializers.CharField(source="partner.name", read_only=True)
    transaction_type_display = serializers.CharField(
        source="get_transaction_type_display", read_only=True
    )
    journal_entry_id = serializers.IntegerField(source="journal_entry.id", read_only=True)
    journal_entry_display = serializers.CharField(source="journal_entry.display_id", read_only=True)
    created_by_name = serializers.CharField(
        source="created_by.get_full_name", read_only=True, default=""
    )

    class Meta:
        model = PartnerTransaction
        fields = [
            "id",
            "partner",
            "partner_name",
            "transaction_type",
            "transaction_type_display",
            "amount",
            "date",
            "description",
            "journal_entry_id",
            "journal_entry_display",
            "treasury_movement",
            "stock_move",
            "distribution_resolution",
            "created_by",
            "created_by_name",
            "created_at",
        ]
        read_only_fields = ["created_by", "created_at"]


class PartnerEquityStakeSerializer(serializers.ModelSerializer):
    partner_name = serializers.CharField(source="partner.name", read_only=True)

    class Meta:
        model = PartnerEquityStake
        fields = [
            "id",
            "partner",
            "partner_name",
            "percentage",
            "effective_from",
            "effective_until",
            "is_active",
            "source_transaction",
            "notes",
            "created_at",
        ]


class ProfitDistributionLineDestinationSerializer(serializers.ModelSerializer):
    destination_display = serializers.CharField(source="get_destination_display", read_only=True)

    class Meta:
        model = ProfitDistributionLineDestination
        fields = ["id", "destination", "destination_display", "amount"]


class ProfitDistributionLineSerializer(serializers.ModelSerializer):
    partner_name = serializers.CharField(source="partner.name", read_only=True)
    destinations = ProfitDistributionLineDestinationSerializer(many=True, read_only=True)
    total_destined = serializers.DecimalField(max_digits=16, decimal_places=0, read_only=True)
    remaining_to_destine = serializers.DecimalField(max_digits=16, decimal_places=0, read_only=True)
    paid_dividend_amount = serializers.SerializerMethodField()

    class Meta:
        model = ProfitDistributionLine
        fields = [
            "id",
            "partner",
            "partner_name",
            "percentage_at_date",
            "gross_amount",
            "provisional_withdrawals_offset",
            "net_amount",
            "destinations",
            "total_destined",
            "remaining_to_destine",
            "paid_dividend_amount",
        ]

    def get_paid_dividend_amount(self, obj):
        from decimal import Decimal
        # Avoid DB hit by using prefetched data
        payments = obj.resolution.payments.all()
        total = sum(
            (p.amount or Decimal("0"))
            for p in payments
            if p.partner_id == obj.partner_id
        )
        return total or Decimal("0")


class ProfitDistributionResolutionSerializer(serializers.ModelSerializer):
    lines = ProfitDistributionLineSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    approved_by_name = serializers.CharField(
        source="approved_by.get_full_name", read_only=True, default=""
    )
    executed_by_name = serializers.CharField(
        source="executed_by.get_full_name", read_only=True, default=""
    )

    class Meta:
        model = ProfitDistributionResolution
        fields = [
            "id",
            "display_id",
            "fiscal_year",
            "fiscal_year_obj",
            "resolution_date",
            "net_result",
            "is_profit",
            "is_loss",
            "status",
            "status_display",
            "approved_by",
            "approved_by_name",
            "approved_at",
            "executed_by",
            "executed_by_name",
            "executed_at",
            "journal_entry",
            "acta_number",
            "notes",
            "lines",
            "created_at",
            "updated_at",
        ]
