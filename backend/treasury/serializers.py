from rest_framework import serializers

from .models import (
    Bank,
    BankStatement,
    BankStatementLine,
    Check,
    PaymentMethod,
    PaymentTerminalDevice,
    PaymentTerminalProvider,
    POSSessionAudit,
    POSTerminal,
    ReconciliationSettings,
    TreasuryAccount,
    TreasuryMovement,
)

# Remove top-level import to avoid circular dependency
# from accounting.serializers import JournalEntrySerializer


class BankSerializer(serializers.ModelSerializer):
    account_executives_details = serializers.SerializerMethodField()

    class Meta:
        model = Bank
        fields = [
            "id",
            "name",
            "code",
            "swift_code",
            "is_active",
            "account_executives",
            "account_executives_details",
            "created_at",
            "updated_at",
        ]

    def get_account_executives_details(self, obj):
        from contacts.serializers import ContactSerializer

        return ContactSerializer(obj.account_executives.all(), many=True).data


class PaymentMethodSerializer(serializers.ModelSerializer):
    method_type_display = serializers.CharField(source="get_method_type_display", read_only=True)
    treasury_account_name = serializers.CharField(source="treasury_account.name", read_only=True)

    # Ensure it's writable as ID
    treasury_account = serializers.PrimaryKeyRelatedField(
        queryset=TreasuryAccount.objects.all(), required=True
    )

    # Computed: true solo para CARD_TERMINAL con device vinculado — activa flujo TUU automatizado en POS
    is_terminal_integration = serializers.SerializerMethodField()
    settlement_account_name = serializers.CharField(
        source="effective_settlement_account.name", read_only=True, allow_null=True
    )

    def get_is_terminal_integration(self, obj):
        return obj.is_integrated

    class Meta:
        model = PaymentMethod
        fields = "__all__"


class TreasuryAccountSerializer(serializers.ModelSerializer):
    account_name = serializers.CharField(source="account.name", read_only=True)
    account_code = serializers.CharField(source="account.code", read_only=True)
    bank_name = serializers.CharField(source="bank.name", read_only=True, allow_null=True)
    account_type_display = serializers.CharField(source="get_account_type_display", read_only=True)
    is_system_managed = serializers.SerializerMethodField()

    current_balance = serializers.DecimalField(max_digits=20, decimal_places=0, read_only=True)
    available_liquidity = serializers.DecimalField(max_digits=20, decimal_places=0, read_only=True)
    credit_limit = serializers.DecimalField(
        max_digits=18, decimal_places=2, required=False, allow_null=True
    )
    available_credit = serializers.SerializerMethodField(read_only=True)
    payment_methods = PaymentMethodSerializer(many=True, read_only=True)

    def get_available_credit(self, obj):
        val = obj.available_credit
        return float(val) if val is not None else None

    terminal_providers = serializers.SerializerMethodField()

    def get_is_system_managed(self, obj):
        return obj.account_type in TreasuryAccount._NON_CASH_EQUIVALENT_TYPES

    def get_terminal_providers(self, obj):
        return [
            {
                "id": p.id,
                "name": p.name,
                "provider_type": p.provider_type,
                "provider_type_display": p.get_provider_type_display(),
                "supplier": p.supplier_id,
                "receivable_account": p.receivable_account_id,
                "commission_expense_account": p.commission_expense_account_id,
                "commission_iva_account": p.commission_iva_account_id,
                "bank_treasury_account": p.bank_treasury_account_id,
                "bank_treasury_account_name": p.bank_treasury_account.name
                if p.bank_treasury_account_id
                else None,
            }
            for p in obj.terminal_providers.all()
        ]

    reconciliation_settings = serializers.SerializerMethodField()

    def get_reconciliation_settings(self, obj):
        # We use a method field to ensure it exists or returns default (Global fallback)
        from .models import ReconciliationSettings

        settings = ReconciliationSettings.get_for_account(obj)
        return ReconciliationSettingsSerializer(settings).data

    class Meta:
        model = TreasuryAccount
        fields = [
            "id",
            "name",
            "code",
            "currency",
            "account",
            "account_name",
            "account_code",
            "account_type",
            "account_type_display",
            "bank",
            "bank_name",
            "account_number",
            "card_number",
            "credit_limit",
            "available_credit",
            "allows_cash",
            "allows_card",
            "allows_transfer",
            "allows_check",
            "is_system_managed",
            "current_balance",
            "available_liquidity",
            "payment_methods",
            "default_bank_format",
            "reconciliation_settings",
            "terminal_providers",
        ]


class POSTerminalSerializer(serializers.ModelSerializer):
    # Computed field (read-only)
    allowed_payment_method_types = serializers.SerializerMethodField()

    # Nested serialization for reading (detailed account info)
    allowed_treasury_accounts = TreasuryAccountSerializer(many=True, read_only=True)

    # Write field (just IDs)
    allowed_treasury_account_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=TreasuryAccount.objects.all(),
        source="allowed_treasury_accounts",
        required=False,
        write_only=True,
    )

    # New Granular Payment Methods
    allowed_payment_methods = PaymentMethodSerializer(many=True, read_only=True)
    allowed_payment_method_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=PaymentMethod.objects.all(),
        source="allowed_payment_methods",
        required=False,
        write_only=True,
    )

    # Support for default account
    default_treasury_account = serializers.PrimaryKeyRelatedField(
        queryset=TreasuryAccount.objects.all(), required=False, allow_null=True
    )

    default_treasury_account_name = serializers.CharField(
        source="default_treasury_account.name", read_only=True, allow_null=True
    )
    default_treasury_account_code = serializers.CharField(
        source="default_treasury_account.code", read_only=True, allow_null=True
    )
    default_treasury_account_balance = serializers.DecimalField(
        source="default_treasury_account.current_balance",
        max_digits=20,
        decimal_places=0,
        read_only=True,
        allow_null=True,
    )

    payment_terminal_device_name = serializers.CharField(
        source="payment_terminal_device.name", read_only=True, allow_null=True
    )

    class Meta:
        model = POSTerminal
        fields = [
            "id",
            "name",
            "code",
            "location",
            "is_active",
            "default_treasury_account",
            "default_treasury_account_name",
            "default_treasury_account_code",
            "default_treasury_account_balance",
            "allowed_treasury_accounts",  # Read (full objects)
            "allowed_treasury_account_ids",  # Write (only IDs)
            "allowed_payment_methods",  # Read (full objects)
            "allowed_payment_method_ids",  # Write (only IDs)
            "allowed_payment_method_types",  # Computed types
            "payment_terminal_device",
            "payment_terminal_device_name",
            "serial_number",
            "ip_address",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def get_allowed_payment_method_types(self, obj):
        """
        Returns the computed list of allowed payment method TYPES.
        """
        return obj.allowed_payment_method_types

    def validate(self, attrs):
        from .validators import TerminalValidator
        return TerminalValidator.validate_pos_terminal(self.instance, attrs)


class PaymentAllocationSerializer(serializers.ModelSerializer):
    invoice_display_id = serializers.CharField(
        source="invoice.display_id", read_only=True, allow_null=True
    )
    sale_order_display_id = serializers.CharField(
        source="sale_order.display_id", read_only=True, allow_null=True
    )
    purchase_order_display_id = serializers.CharField(
        source="purchase_order.display_id", read_only=True, allow_null=True
    )
    bank_statement_line_display = serializers.CharField(
        source="bank_statement_line.description", read_only=True, allow_null=True
    )
    created_by_name = serializers.CharField(
        source="created_by.username", read_only=True, allow_null=True
    )

    class Meta:
        from .models import PaymentAllocation

        model = PaymentAllocation
        fields = [
            "id",
            "treasury_movement",
            "amount",
            "notes",
            "invoice",
            "invoice_display_id",
            "sale_order",
            "sale_order_display_id",
            "purchase_order",
            "purchase_order_display_id",
            "bank_statement_line",
            "bank_statement_line_display",
            "created_at",
            "created_by",
            "created_by_name",
        ]
        read_only_fields = ["created_at", "created_by"]


class TreasuryMovementSerializer(serializers.ModelSerializer):
    partner_name = serializers.SerializerMethodField()
    partner_id = serializers.SerializerMethodField()
    account_name = serializers.CharField(source="account.name", read_only=True)
    payment_method_display = serializers.CharField(
        source="get_payment_method_display", read_only=True
    )
    movement_type_display = serializers.CharField(
        source="get_movement_type_display", read_only=True
    )
    payment_type = serializers.CharField(source="movement_type", read_only=True)
    # Helper to distinguish direction in transfers
    is_inbound = serializers.SerializerMethodField()
    # Account Names
    from_account_name = serializers.CharField(
        source="from_account.name", read_only=True, allow_null=True
    )
    from_account_account_id = serializers.IntegerField(
        source="from_account.account.id", read_only=True, allow_null=True
    )
    from_account_code = serializers.CharField(
        source="from_account.account.code", read_only=True, allow_null=True
    )
    to_account_name = serializers.CharField(
        source="to_account.name", read_only=True, allow_null=True
    )
    to_account_account_id = serializers.IntegerField(
        source="to_account.account.id", read_only=True, allow_null=True
    )
    to_account_code = serializers.CharField(
        source="to_account.account.code", read_only=True, allow_null=True
    )

    payment_method_new_name = serializers.CharField(
        source="payment_method_new.name", read_only=True, allow_null=True
    )
    payment_method_new_method_type = serializers.CharField(
        source="payment_method_new.method_type", read_only=True, allow_null=True
    )

    # Legacy/Display fields for frontend compatibility
    journal_name = serializers.SerializerMethodField()

    code = serializers.SerializerMethodField()
    display_id = serializers.CharField(read_only=True)
    document_info = serializers.SerializerMethodField()

    # Reconciliation data
    reconciled_by_name = serializers.CharField(
        source="reconciled_by.username", read_only=True, allow_null=True
    )
    bank_statement_info = serializers.SerializerMethodField()

    # Additional Context
    justify_reason_display = serializers.SerializerMethodField()
    created_by_name = serializers.CharField(source="created_by.username", read_only=True)
    terminal_batch_id = serializers.IntegerField(read_only=True, allow_null=True)
    terminal_batch_display = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    def get_status(self, obj):
        if obj.is_reconciled:
            return "RECONCILED"
        if obj.is_pending_registration:
            return "PENDING"
        return "POSTED"

    def get_is_inbound(self, obj):
        # Determine if it's an inflow to the account being considered
        # Since we don't have the context account here, we use a heuristic:
        # If it's INBOUND, it's inbound.
        # If it's TRANSFER, it could be either.
        # But for the purpose of the ReconciliationPanel (which SELECTS logically),
        # we can just return the movement_type and let the frontend decide based on the treasuryAccountId it has.
        return obj.movement_type == "INBOUND"

    invoice_display_id = serializers.SerializerMethodField()
    sale_order_display_id = serializers.SerializerMethodField()
    purchase_order_display_id = serializers.SerializerMethodField()
    journal_entry_display_id = serializers.SerializerMethodField()
    card_purchase_group_detail = serializers.SerializerMethodField()

    class Meta:
        model = TreasuryMovement
        fields = "__all__"
        read_only_fields = ["created_by", "created_at", "history", "is_pending_registration"]

    def get_invoice_display_id(self, obj):
        return obj.invoice.display_id if obj.invoice else None

    def get_sale_order_display_id(self, obj):
        return obj.sale_order.display_id if obj.sale_order else None

    def get_purchase_order_display_id(self, obj):
        return obj.purchase_order.display_id if obj.purchase_order else None

    def get_journal_entry_display_id(self, obj):
        return obj.journal_entry.display_id if obj.journal_entry else None

    def get_card_purchase_group_detail(self, obj):
        if not obj.card_purchase_group:
            return None
        group = obj.card_purchase_group
        return {
            "id": group.id,
            "uuid": str(group.uuid),
            "total_amount": str(group.total_amount),
            "installments": group.installments,
            "monthly_rate": str(group.monthly_rate),
            "principal_per_installment": str(group.principal_per_installment),
            "first_installment_date": group.first_installment_date.isoformat()
            if group.first_installment_date
            else None,
            "partner_name": group.partner.name if group.partner else None,
            "partner_id": group.partner.id if group.partner else None,
            "client_reference": group.client_reference,
            "notes": group.notes,
        }

    def get_journal_name(self, obj):
        # Return the name of the primary treasury account involved
        if obj.treasury_account:
            return obj.treasury_account.name
        return None

    def get_partner_name(self, obj):
        from .selectors import TreasuryMovementSelector
        return TreasuryMovementSelector.get_partner_name(obj)

    def get_partner_id(self, obj):
        from .selectors import TreasuryMovementSelector
        return TreasuryMovementSelector.get_partner_id(obj)

    def get_journal_entry(self, obj):
        if obj.journal_entry:
            from accounting.serializers import JournalEntrySerializer

            return JournalEntrySerializer(obj.journal_entry).data
        return None

    def get_code(self, obj):
        return obj.display_id

    def get_justify_reason_display(self, obj):
        if not obj.justify_reason:
            return None
        # Robust check to avoid AttributeError during migrations/refactors
        if hasattr(obj, "get_justify_reason_display"):
            return obj.get_justify_reason_display()
        return obj.justify_reason

    def get_document_info(self, obj):
        return TreasuryMovementSelector.get_document_info(obj)

    def get_bank_statement_info(self, obj):
        if obj.bank_statement_line:
            return {
                "line_id": obj.bank_statement_line.id,
                "statement_id": obj.bank_statement_line.statement.id,
                "statement_display_id": obj.bank_statement_line.statement.display_id,
            }
        return None

    def get_terminal_batch_display(self, obj):
        if obj.terminal_batch:
            return obj.terminal_batch.display_id
        return None


class CardPendingChargeSerializer(serializers.ModelSerializer):
    charge_type_display = serializers.CharField(
        source="get_charge_type_display",
        read_only=True,
    )

    class Meta:
        from .models import CardPendingCharge

        model = CardPendingCharge
        fields = [
            "id",
            "card_account",
            "amount",
            "charge_type",
            "charge_type_display",
            "description",
            "date",
            "is_billed",
            "billed_in_statement",
            "journal_entry",
            "created_by",
            "created_at",
        ]


class POSSessionSerializer(serializers.ModelSerializer):
    """Serializer for POS Sessions"""

    from .models import POSSession

    user_name = serializers.SerializerMethodField()
    terminal_name = serializers.CharField(source="terminal.name", read_only=True, allow_null=True)
    terminal_details = POSTerminalSerializer(source="terminal", read_only=True)
    treasury_account_name = serializers.CharField(
        source="treasury_account.name", read_only=True, allow_null=True
    )
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    expected_cash = serializers.DecimalField(read_only=True, max_digits=12, decimal_places=2)
    closed_by_name = serializers.CharField(
        source="closed_by.username", read_only=True, allow_null=True
    )
    cash_movements = TreasuryMovementSerializer(source="movements", many=True, read_only=True)

    class Meta:
        from .models import POSSession

        model = POSSession
        fields = "__all__"

    def get_user_name(self, obj):
        return obj.user.get_full_name() or obj.user.username


class POSSessionAuditSerializer(serializers.ModelSerializer):
    """Serializer for POS Session Audits (Arqueos)"""

    class Meta:
        model = POSSessionAudit
        fields = "__all__"


class CashFlowSerializer(serializers.Serializer):
    """
    Serializer unificado para vista de flujo de efectivo.
    Combina Payments y CashMovements relevantes.
    """

    id = serializers.IntegerField()
    source = serializers.ChoiceField(choices=["PAYMENT", "CASH_MOVEMENT"])
    type = serializers.CharField()  # payment_type o movement_type
    date = serializers.DateField()
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    description = serializers.CharField()
    treasury_account_name = serializers.CharField()
    partner_name = serializers.CharField(allow_null=True)
    reference = serializers.CharField()
    is_internal = serializers.BooleanField()  # True para traspasos


class BankStatementLineSerializer(serializers.ModelSerializer):
    reconciled_by_name = serializers.CharField(
        source="reconciled_by.username", read_only=True, allow_null=True
    )
    amount = serializers.DecimalField(max_digits=20, decimal_places=2, read_only=True)
    reconciliation_group_data = serializers.SerializerMethodField()

    def get_reconciliation_group_data(self, obj):
        return ReconciliationMatchSelector.get_group_data(obj)

    class Meta:
        model = BankStatementLine
        fields = "__all__"


class BankStatementSerializer(serializers.ModelSerializer):
    treasury_account_name = serializers.CharField(source="treasury_account.name", read_only=True)
    imported_by_name = serializers.CharField(source="imported_by.username", read_only=True)
    reconciliation_progress = serializers.FloatField(read_only=True)
    display_id = serializers.CharField(read_only=True)
    lines = BankStatementLineSerializer(many=True, read_only=True)

    class Meta:
        model = BankStatement
        fields = "__all__"
        read_only_fields = ["id", "status"]


class BankStatementListSerializer(serializers.ModelSerializer):
    treasury_account_name = serializers.CharField(source="treasury_account.name", read_only=True)
    imported_by_name = serializers.CharField(source="imported_by.username", read_only=True)
    reconciliation_progress = serializers.FloatField(read_only=True)
    display_id = serializers.CharField(read_only=True)
    reconciled_lines = serializers.IntegerField(read_only=True)

    class Meta:
        model = BankStatement
        fields = [
            "id",
            "display_id",
            "treasury_account",
            "treasury_account_name",
            "statement_date",
            "opening_balance",
            "closing_balance",
            "status",
            "total_lines",
            "reconciled_lines",
            "reconciliation_progress",
            "imported_at",
            "imported_by_name",
        ]


class ReconciliationSettingsSerializer(serializers.ModelSerializer):
    treasury_account_name = serializers.CharField(source="treasury_account.name", read_only=True)

    class Meta:
        model = ReconciliationSettings
        fields = "__all__"


class PaymentTerminalProviderSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    receivable_account_name = serializers.CharField(
        source="receivable_account.name", read_only=True
    )
    commission_expense_account_name = serializers.CharField(
        source="commission_expense_account.name", read_only=True
    )
    commission_iva_account_name = serializers.CharField(
        source="commission_iva_account.name", read_only=True
    )
    bank_treasury_account_name = serializers.CharField(
        source="bank_treasury_account.name", read_only=True
    )
    default_deposit_account_name = serializers.CharField(
        source="default_deposit_account.name", read_only=True
    )
    provider_type_display = serializers.CharField(
        source="get_provider_type_display", read_only=True
    )

    class Meta:
        model = PaymentTerminalProvider
        fields = "__all__"
        read_only_fields = ("bank_treasury_account",)

    def validate_default_deposit_account(self, value):
        if value and value.account_type in ("BRIDGE", "CHECK_PORTFOLIO", "ISSUED_CHECKS"):
            from rest_framework import serializers as rf_serializers

            raise rf_serializers.ValidationError(
                "La cuenta de tesorería por defecto no puede ser de tipo puente (BRIDGE). "
                "Seleccione una cuenta bancaria (CHECKING) o de caja (CASH)."
            )
        return value


class PaymentTerminalDeviceSerializer(serializers.ModelSerializer):
    provider_name = serializers.CharField(source="provider.name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = PaymentTerminalDevice
        fields = "__all__"


class TerminalBatchSerializer(serializers.ModelSerializer):
    """Serializer for Terminal Batch settlement information"""

    # Display fields
    provider_name = serializers.CharField(source="provider.name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    display_id = serializers.CharField(read_only=True)
    payment_count = serializers.IntegerField(read_only=True)

    # Nested objects for detailed view
    settlement_journal_entry_data = serializers.SerializerMethodField()
    bank_statement_line_data = serializers.SerializerMethodField()
    supplier_invoice_data = serializers.SerializerMethodField()

    # Writable fields
    provider = serializers.PrimaryKeyRelatedField(queryset=PaymentTerminalProvider.objects.all())

    class Meta:
        from .models import TerminalBatch

        model = TerminalBatch
        fields = [
            "id",
            "display_id",
            "provider",
            "provider_name",
            "sales_date",
            "sales_date_end",
            "settlement_date",
            "deposit_date",
            "gross_amount",
            "commission_base",
            "commission_tax",
            "commission_total",
            "net_amount",
            "terminal_reference",
            "status",
            "status_display",
            "payment_count",
            "settlement_journal_entry",
            "settlement_journal_entry_data",
            "bank_statement_line",
            "bank_statement_line_data",
            "supplier_invoice",
            "supplier_invoice_data",
            "notes",
            "created_at",
            "created_by",
        ]
        read_only_fields = [
            "created_at",
            "created_by",
            "settlement_journal_entry",
            "bank_statement_line",
            "supplier_invoice",
        ]

    def get_settlement_journal_entry_data(self, obj):
        if obj.settlement_journal_entry:
            from accounting.serializers import JournalEntrySerializer

            return JournalEntrySerializer(obj.settlement_journal_entry).data
        return None

    def get_bank_statement_line_data(self, obj):
        if obj.bank_statement_line:
            return {
                "id": obj.bank_statement_line.id,
                "statement_id": obj.bank_statement_line.statement.id,
                "statement_display_id": obj.bank_statement_line.statement.display_id,
                "transaction_date": obj.bank_statement_line.transaction_date,
                "description": obj.bank_statement_line.description,
                "amount": obj.bank_statement_line.credit or obj.bank_statement_line.debit,
            }
        return None

    def get_supplier_invoice_data(self, obj):
        if obj.supplier_invoice:
            return {
                "id": obj.supplier_invoice.id,
                "number": obj.supplier_invoice.number,
                "total": obj.supplier_invoice.total,
                "status": obj.supplier_invoice.status,
            }
        return None


class CheckSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    direction_display = serializers.CharField(source="get_direction_display", read_only=True)
    display_id = serializers.CharField(read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)
    bank_name = serializers.CharField(source="bank.name", read_only=True)
    counterparty_name = serializers.SerializerMethodField()
    sale_order_display = serializers.SerializerMethodField()

    def get_counterparty_name(self, obj):
        if obj.counterparty:
            return obj.counterparty.name
        return obj.drawer_name or None

    def get_sale_order_display(self, obj):
        if obj.sale_order:
            return {
                "id": obj.sale_order.id,
                "number": obj.sale_order.number,
            }
        return None

    class Meta:
        model = Check
        fields = [
            "id",
            "display_id",
            "direction",
            "direction_display",
            "status",
            "status_display",
            "is_overdue",
            "bank",
            "bank_name",
            "check_number",
            "amount",
            "issue_date",
            "due_date",
            "counterparty",
            "counterparty_name",
            "drawer_name",
            "portfolio_account",
            "deposit_account",
            "receipt_movement",
            "settlement_movement",
            "invoice",
            "sale_order",
            "sale_order_display",
            "notes",
            "deposited_at",
            "cleared_at",
            "bounced_at",
            "created_at",
            "created_by",
        ]
        read_only_fields = [
            "display_id",
            "direction",
            "status",
            "is_overdue",
            "portfolio_account",
            "deposit_account",
            "receipt_movement",
            "settlement_movement",
            "deposited_at",
            "cleared_at",
            "bounced_at",
            "created_at",
            "created_by",
        ]


# ── F2.11: Créditos bancarios (BankLoan + LoanInstallment) ──────────────────


class LoanInstallmentSerializer(serializers.ModelSerializer):
    """Serializer para `LoanInstallment` (cuota individual)."""

    display_id = serializers.CharField(read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    loan_display_id = serializers.CharField(source="loan.display_id", read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)

    class Meta:
        from .models import LoanInstallment

        model = LoanInstallment
        fields = [
            "id",
            "display_id",
            "loan",
            "loan_display_id",
            "number",
            "due_date",
            "principal_amount",
            "interest_amount",
            "insurance_amount",
            "total_amount",
            "outstanding_balance",
            "status",
            "status_display",
            "is_overdue",
            "paid_at",
            "payment_movement",
            "uf_value_used",
            "clp_amount_paid",
            "penalty_paid",
            "notes",
        ]
        read_only_fields = [
            "display_id",
            "status",
            "is_overdue",
            "outstanding_balance",
            "paid_at",
            "payment_movement",
            "uf_value_used",
            "clp_amount_paid",
            "penalty_paid",
        ]


class BankLoanSerializer(serializers.ModelSerializer):
    """Serializer para `BankLoan` (crédito bancario).

    Incluye campos derivados (display_id, status_display), referencias a
    entidades relacionadas (nombres legibles) y la lista anidada de cuotas.
    Para escribir se usan IDs (FK). Validación de `liability_account` se
    delega al `clean()` del modelo (LIABILITY en taxonomía = CREDIT_CARD).
    """

    display_id = serializers.CharField(read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    currency_display = serializers.CharField(source="get_currency_display", read_only=True)
    rate_basis_display = serializers.CharField(source="get_rate_basis_display", read_only=True)
    amortization_system_display = serializers.CharField(
        source="get_amortization_system_display",
        read_only=True,
    )

    lender_name = serializers.CharField(source="lender.name", read_only=True)
    disbursement_account_name = serializers.CharField(
        source="disbursement_account.name",
        read_only=True,
    )
    liability_account_name = serializers.CharField(
        source="liability_account.name",
        read_only=True,
    )
    created_by_name = serializers.CharField(
        source="created_by.username",
        read_only=True,
        allow_null=True,
    )

    # Indicadores agregados útiles para UI.
    outstanding_balance = serializers.SerializerMethodField()
    next_due_date = serializers.SerializerMethodField()
    next_installment_amount = serializers.SerializerMethodField()
    installments_count = serializers.SerializerMethodField()
    paid_installments_count = serializers.SerializerMethodField()

    installments = LoanInstallmentSerializer(many=True, read_only=True)

    def get_outstanding_balance(self, obj):
        from decimal import Decimal
        from .models import LoanInstallment

        # Reads from prefetched installments in RAM
        installments = obj.installments.all()
        paid_principal = sum(
            (inst.principal_amount or Decimal("0"))
            for inst in installments
            if inst.status == LoanInstallment.Status.PAID
        )

        bal = obj.principal - paid_principal
        return str(bal.quantize(Decimal("0.01")))

    def get_next_due_date(self, obj):
        from .models import LoanInstallment
        
        installments = [inst for inst in obj.installments.all() if inst.status == LoanInstallment.Status.PENDING]
        if not installments:
            return None
        
        # Sort by due_date to find the earliest
        installments.sort(key=lambda x: x.due_date)
        return str(installments[0].due_date)

    def get_next_installment_amount(self, obj):
        from .models import LoanInstallment

        installments = [inst for inst in obj.installments.all() if inst.status == LoanInstallment.Status.PENDING]
        if not installments:
            return None
            
        installments.sort(key=lambda x: x.due_date)
        return installments[0].total_amount

    def get_installments_count(self, obj):
        return len(obj.installments.all())

    def get_paid_installments_count(self, obj):
        from .models import LoanInstallment
        return sum(1 for inst in obj.installments.all() if inst.status == LoanInstallment.Status.PAID)

    total_disbursed = serializers.SerializerMethodField()

    def get_total_disbursed(self, obj):
        from decimal import Decimal
        from .models import LoanInstallment

        result = sum(
            (inst.total_amount or Decimal("0"))
            for inst in obj.installments.all()
            if inst.status == LoanInstallment.Status.PAID
        )
        return (result or Decimal("0")).quantize(Decimal("0.01"))

    class Meta:
        from .models import BankLoan

        model = BankLoan
        fields = [
            "id",
            "display_id",
            "lender",
            "lender_name",
            "loan_number",
            "currency",
            "currency_display",
            "principal",
            "interest_rate",
            "rate_basis",
            "rate_basis_display",
            "amortization_system",
            "amortization_system_display",
            "term_months",
            "start_date",
            "first_due_date",
            "insurance_monthly",
            "opening_fee",
            "stamp_tax",
            "penalty_rate",
            "disbursement_account",
            "disbursement_account_name",
            "liability_account",
            "liability_account_name",
            "status",
            "status_display",
            "notes",
            "collateral_notes",
            "outstanding_balance",
            "next_due_date",
            "next_installment_amount",
            "installments_count",
            "paid_installments_count",
            "total_disbursed",
            "installments",
            "created_at",
            "updated_at",
            "created_by",
            "created_by_name",
        ]
        read_only_fields = [
            "display_id",
            "status",
            "created_at",
            "updated_at",
            "created_by",
        ]


class BankLoanWriteSerializer(serializers.ModelSerializer):
    """
    Serializer de escritura más liviano (omite campos derivados).

    `liability_account` recibe el ID de una **cuenta contable** (Account)
    de tipo LIABILITY, NO de una TreasuryAccount. El backend resuelve
    (o crea) la TreasuryAccount tipo LOAN correspondiente en
    `BankLoanViewSet.perform_create`, vía
    `loan_provisioning.get_or_create_loan_treasury_account`. Esto evita que
    el operador tenga que crear manualmente el wrapper de tesorería para el
    pasivo del préstamo (ADR-0041).
    """

    class Meta:
        from accounting.models import Account

        from .models import BankLoan

        model = BankLoan
        fields = [
            "lender",
            "loan_number",
            "currency",
            "principal",
            "interest_rate",
            "rate_basis",
            "amortization_system",
            "term_months",
            "start_date",
            "first_due_date",
            "insurance_monthly",
            "opening_fee",
            "stamp_tax",
            "penalty_rate",
            "disbursement_account",
            "liability_account",
            "notes",
            "collateral_notes",
        ]
        extra_kwargs = {
            # Truco: la FK del modelo apunta a TreasuryAccount, pero acá
            # sobreescribimos el queryset para que el campo acepte el ID
            # de la `Account` contable. En `BankLoanViewSet.perform_create`
            # extraemos `validated_data['liability_account']` (un Account)
            # y lo reemplazamos por la TreasuryAccount resuelta ANTES del
            # save, para satisfacer la FK del modelo.
            "liability_account": {
                "queryset": Account.objects.all(),
                "help_text": (
                    "ID de la cuenta contable de PASIVO (Account.account_type=LIABILITY, "
                    "hoja) que materializa la deuda. El backend crea/vincula la "
                    "TreasuryAccount tipo LOAN correspondiente."
                ),
            },
        }

    def validate_liability_account(self, value):
        """Valida que la cuenta contable de pasivo sea apta."""
        from accounting.models import AccountType

        if value.account_type != AccountType.LIABILITY:
            raise serializers.ValidationError(
                "La cuenta contable debe ser de tipo PASIVO (LIABILITY)."
            )
        if not getattr(value, "is_selectable", True):
            raise serializers.ValidationError(
                "La cuenta contable debe ser una cuenta auxiliar (hoja)."
            )
        return value

    def validate(self, attrs):
        from .validators import LoanValidator
        return LoanValidator.validate_bank_loan(attrs)


class CreditLineSerializer(serializers.ModelSerializer):
    """Serializer de lectura para CreditLine."""

    status_display = serializers.CharField(source="get_status_display", read_only=True)
    account_name = serializers.CharField(source="treasury_account.name", read_only=True)
    used_amount = serializers.DecimalField(max_digits=18, decimal_places=2, read_only=True)
    available_amount = serializers.DecimalField(max_digits=18, decimal_places=2, read_only=True)
    utilization_rate = serializers.SerializerMethodField()

    class Meta:
        from .models import CreditLine

        model = CreditLine
        fields = [
            "id",
            "treasury_account",
            "account_name",
            "code",
            "currency",
            "credit_limit",
            "used_amount",
            "available_amount",
            "utilization_rate",
            "interest_rate",
            "rate_basis",
            "spread",
            "commitment_fee",
            "valid_from",
            "valid_until",
            "auto_renewal",
            "renewal_term_months",
            "collateral_notes",
            "notes",
            "status",
            "status_display",
            "created_at",
            "updated_at",
            "created_by",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "created_by"]

    def get_utilization_rate(self, obj):
        from decimal import Decimal

        rate = obj.utilization_rate
        if rate is None:
            return None
        return rate.quantize(Decimal("0.01"))


class CreditLineWriteSerializer(serializers.ModelSerializer):
    """Serializer de escritura para CreditLine (campos planos, sin derivados)."""

    class Meta:
        from .models import CreditLine

        model = CreditLine
        fields = [
            "id",
            "treasury_account",
            "code",
            "currency",
            "credit_limit",
            "interest_rate",
            "rate_basis",
            "spread",
            "commitment_fee",
            "valid_from",
            "valid_until",
            "auto_renewal",
            "renewal_term_months",
            "collateral_notes",
            "notes",
            "status",
        ]


class PayInstallmentActionSerializer(serializers.Serializer):
    """Payload para la acción `pay` de LoanInstallmentViewSet."""

    payment_account = serializers.IntegerField(
        help_text="ID de la TreasuryAccount desde donde se paga.",
    )
    date = serializers.DateField(required=False)
    principal_amount = serializers.DecimalField(
        max_digits=18,
        decimal_places=2,
        required=False,
        help_text="Monto de capital a pagar (default: monto de la cuota).",
    )
    interest_amount = serializers.DecimalField(
        max_digits=18,
        decimal_places=2,
        required=False,
        help_text="Monto de interés a pagar (default: monto de la cuota).",
    )
    insurance_amount = serializers.DecimalField(
        max_digits=18,
        decimal_places=2,
        required=False,
        help_text="Monto de seguro a pagar (default: monto de la cuota).",
    )
    tax_amount = serializers.DecimalField(
        max_digits=18,
        decimal_places=2,
        required=False,
        help_text="Monto de impuestos pagados (default: 0).",
    )
    penalty_amount = serializers.DecimalField(
        max_digits=18,
        decimal_places=2,
        required=False,
        help_text="Monto de multa por mora pagada (default: cálculo automático si aplica).",
    )
    interest_expense_account = serializers.IntegerField(required=False, allow_null=True)
    insurance_expense_account = serializers.IntegerField(required=False, allow_null=True)


class PrepayLoanActionSerializer(serializers.Serializer):
    """Payload para la acción `prepay` de BankLoanViewSet."""

    payment_account = serializers.IntegerField()
    date = serializers.DateField(required=False)
    insurance_amount = serializers.DecimalField(
        max_digits=18,
        decimal_places=2,
        required=False,
        help_text="Monto total de seguro a pagar (default: suma de seguro de cuotas pendientes).",
    )
    tax_amount = serializers.DecimalField(
        max_digits=18,
        decimal_places=2,
        required=False,
        help_text="Monto total de impuestos pagados (default: 0).",
    )
    penalty_amount = serializers.DecimalField(
        max_digits=18,
        decimal_places=2,
        required=False,
        help_text="Monto total de multa por mora pagada (default: cálculo automático).",
    )
    interest_expense_account = serializers.IntegerField(required=False, allow_null=True)
    insurance_expense_account = serializers.IntegerField(required=False, allow_null=True)


class DisburseLoanActionSerializer(serializers.Serializer):
    """
    Payload para la acción `disburse` de BankLoanViewSet.

    Los cargos (`opening_fee`, `stamp_tax`) son **overrides one-shot**: el
    `BankLoan` conserva los valores del contrato tal como fueron registrados
    originalmente. Los overrides se usan exclusivamente para construir el
    asiento del desembolso. La diferencia (si la hay) se documenta en las
    `notes` del `TreasuryMovement` para trazabilidad contable.

    Las cuentas de gasto (`commission_expense_account`, `stamp_tax_expense_account`)
    son **overrides opcionales** del `AccountingSettings`. Si vienen en el
    payload, ganan sobre los settings; si no, caen a:
      - `settings.loan_commission_expense_account`
      - `settings.loan_stamp_tax_expense_account`

    Esto permite al operador configurar el asiento "in-line" cuando los
    settings no están definidos a nivel empresa (escape híbrido).
    """

    from accounting.models import Account

    date = serializers.DateField(required=False)
    opening_fee = serializers.DecimalField(
        max_digits=18,
        decimal_places=2,
        required=False,
        allow_null=True,
        min_value=0,
    )
    stamp_tax = serializers.DecimalField(
        max_digits=18,
        decimal_places=2,
        required=False,
        allow_null=True,
        min_value=0,
    )
    commission_expense_account = serializers.PrimaryKeyRelatedField(
        queryset=Account.objects.all(),
        required=False,
        allow_null=True,
    )
    stamp_tax_expense_account = serializers.PrimaryKeyRelatedField(
        queryset=Account.objects.all(),
        required=False,
        allow_null=True,
    )

    def validate_commission_expense_account(self, value):
        from accounting.models import AccountType

        if value is None:
            return value
        if value.account_type != AccountType.EXPENSE:
            raise serializers.ValidationError(
                "La cuenta de gasto por comisión debe ser de tipo GASTO (EXPENSE)."
            )
        return value

    def validate_stamp_tax_expense_account(self, value):
        from accounting.models import AccountType

        if value is None:
            return value
        if value.account_type != AccountType.EXPENSE:
            raise serializers.ValidationError(
                "La cuenta de gasto por ITE debe ser de tipo GASTO (EXPENSE)."
            )
        return value


# ── F3.5: Tarjeta de crédito — estados de cuenta ────────────────────────────


class CreditCardStatementSerializer(serializers.ModelSerializer):
    """Serializer de lectura para `CreditCardStatement`."""

    display_id = serializers.CharField(read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    card_account_name = serializers.CharField(
        source="card_account.name",
        read_only=True,
    )
    card_account_bank = serializers.PrimaryKeyRelatedField(
        source="card_account.bank",
        read_only=True,
    )
    payment_movement_id = serializers.PrimaryKeyRelatedField(
        source="payment_movement",
        read_only=True,
    )
    payment_account_name = serializers.CharField(
        source="payment_account.name",
        read_only=True,
        allow_null=True,
    )
    charges_movement_id = serializers.PrimaryKeyRelatedField(
        source="charges_movement",
        read_only=True,
    )
    created_by_name = serializers.CharField(
        source="created_by.username",
        read_only=True,
        allow_null=True,
    )
    total_to_pay = serializers.SerializerMethodField()
    is_overdue = serializers.BooleanField(read_only=True)
    # Onda 3 (ADR-0044): campos de pagos parciales.
    amount_paid = serializers.DecimalField(
        max_digits=14,
        decimal_places=2,
        read_only=True,
    )
    outstanding_balance = serializers.SerializerMethodField()

    def get_total_to_pay(self, obj):
        return str(obj.total_to_pay)

    def get_outstanding_balance(self, obj):
        return str(obj.outstanding_balance)

    class Meta:
        from .models import CreditCardStatement

        model = CreditCardStatement
        fields = [
            "id",
            "display_id",
            "card_account",
            "card_account_name",
            "card_account_bank",
            "period_year",
            "period_month",
            "cut_off_date",
            "due_date",
            "billed_amount",
            "minimum_payment",
            "interest_charged",
            "fees_charged",
            "credit_limit",
            "status",
            "status_display",
            "is_overdue",
            "total_to_pay",
            "amount_paid",
            "outstanding_balance",
            "paid_at",
            "payment_movement",
            "payment_movement_id",
            "payment_account",
            "payment_account_name",
            "charges_movement",
            "charges_movement_id",
            "notes",
            "created_at",
            "updated_at",
            "created_by",
            "created_by_name",
        ]
        read_only_fields = [
            "display_id",
            "status",
            "is_overdue",
            "total_to_pay",
            "amount_paid",
            "outstanding_balance",
            "paid_at",
            "payment_movement",
            "payment_account",
            "charges_movement",
            "created_at",
            "updated_at",
            "created_by",
        ]


class CreditCardStatementWriteSerializer(serializers.ModelSerializer):
    """Serializer de escritura para `CreditCardStatement`."""

    class Meta:
        from .models import CreditCardStatement

        model = CreditCardStatement
        fields = [
            "card_account",
            "period_year",
            "period_month",
            "cut_off_date",
            "due_date",
            "billed_amount",
            "minimum_payment",
            "interest_charged",
            "fees_charged",
            "credit_limit",
            "notes",
        ]

    def validate(self, attrs):
        card_account = attrs.get("card_account")
        if card_account and card_account.account_type != TreasuryAccount.Type.CREDIT_CARD:
            raise serializers.ValidationError(
                {
                    "card_account": "La cuenta debe ser de tipo Tarjeta de Crédito (CREDIT_CARD).",
                }
            )
        due_date = attrs.get("due_date")
        cut_off = attrs.get("cut_off_date")
        if due_date and cut_off and due_date < cut_off:
            raise serializers.ValidationError(
                {
                    "due_date": "La fecha de vencimiento no puede ser anterior al cierre.",
                }
            )
        return attrs


class PayStatementActionSerializer(serializers.Serializer):
    """Payload para la acción `pay` de CreditCardStatementViewSet."""

    payment_account = serializers.IntegerField(
        help_text="ID de la TreasuryAccount bancaria desde donde se paga.",
    )
    date = serializers.DateField(required=False)
    # Onda 3 (ADR-0044): pago parcial opcional. Si se omite o es
    # >= outstanding_balance, se paga el total.
    amount = serializers.DecimalField(
        max_digits=14,
        decimal_places=2,
        required=False,
        allow_null=True,
        help_text=(
            "Monto a pagar. Si se omite o es >= outstanding_balance, "
            "se paga el total. Para pago parcial, enviar el monto deseado."
        ),
    )


class ApplyChargesActionSerializer(serializers.Serializer):
    """Payload para la acción `apply_charges` de CreditCardStatementViewSet."""

    interest_expense_account = serializers.IntegerField(required=False, allow_null=True)
    fees_expense_account = serializers.IntegerField(required=False, allow_null=True)
