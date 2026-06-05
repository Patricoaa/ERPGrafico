from rest_framework import serializers
from .models import Account, JournalEntry, JournalItem, AccountingSettings, Budget, BudgetItem, FiscalYear

class AccountSerializer(serializers.ModelSerializer):
    account_type_display = serializers.CharField(source='get_account_type_display', read_only=True)
    bs_category_display = serializers.CharField(source='get_bs_category_display', read_only=True)
    debit_total = serializers.DecimalField(max_digits=20, decimal_places=2, read_only=True)
    credit_total = serializers.DecimalField(max_digits=20, decimal_places=2, read_only=True)
    balance = serializers.DecimalField(max_digits=20, decimal_places=2, read_only=True)
    has_posted_items = serializers.BooleanField(read_only=True)

    class Meta:
        model = Account
        fields = [
            'id', 'code', 'name', 'account_type', 'account_type_display', 
            'bs_category', 'bs_category_display',
            'parent', 'is_reconcilable', 'is_selectable', 'has_posted_items',
            'debit_total', 'credit_total', 
            'balance', 'is_category', 'cf_category'
        ]
        extra_kwargs = {
            'code': {'required': False, 'allow_blank': True}
        }

class AccountingSettingsSerializer(serializers.ModelSerializer):
    default_uncollectible_expense_account_name = serializers.CharField(source='default_uncollectible_expense_account.name', read_only=True, default=None)
    partner_capital_social_account_name = serializers.CharField(source='partner_capital_social_account.name', read_only=True, default=None)
    partner_capital_contribution_account_name = serializers.CharField(source='partner_capital_contribution_account.name', read_only=True, default=None)
    partner_withdrawal_account_name = serializers.CharField(source='partner_withdrawal_account.name', read_only=True, default=None)
    partner_provisional_withdrawal_account_name = serializers.CharField(source='partner_provisional_withdrawal_account.name', read_only=True, default=None)
    partner_retained_earnings_account_name = serializers.CharField(source='partner_retained_earnings_account.name', read_only=True, default=None)
    partner_current_year_earnings_account_name = serializers.CharField(source='partner_current_year_earnings_account.name', read_only=True, default=None)
    partner_dividends_payable_account_name = serializers.CharField(source='partner_dividends_payable_account.name', read_only=True, default=None)
    partner_capital_receivable_account_name = serializers.CharField(source='partner_capital_receivable_account.name', read_only=True, default=None)
    # Cierran F5.1 / Gap 1.5a (ADR-0037): nombres legibles de las cuentas
    # de gasto financiero que `CardService.apply_charges` resuelve
    # automáticamente desde settings.
    interest_expense_account_name = serializers.CharField(source='interest_expense_account.name', read_only=True, default=None)
    bank_commission_account_name = serializers.CharField(source='bank_commission_account.name', read_only=True, default=None)


    class Meta:
        model = AccountingSettings
        fields = '__all__'

class JournalItemSerializer(serializers.ModelSerializer):
    account_code = serializers.CharField(source='account.code', read_only=True)
    account_name = serializers.CharField(source='account.name', read_only=True)

    class Meta:
        model = JournalItem
        fields = ['id', 'account', 'account_code', 'account_name', 'partner', 'label', 'debit', 'credit']

class JournalEntrySerializer(serializers.ModelSerializer):
    items = JournalItemSerializer(many=True, read_only=True)
    source_documents = serializers.ListField(source='get_source_documents', read_only=True)
    display_id = serializers.CharField(read_only=True)
    reversal_of = serializers.SerializerMethodField()

    class Meta:
        model = JournalEntry
        fields = ['id', 'number', 'display_id', 'date', 'description', 'status', 'is_manual', 'items', 'source_documents', 'reversal_of', 'created_at', 'source_content_type_id', 'source_object_id']
        read_only_fields = ['id', 'number', 'status']

    def get_reversal_of(self, obj):
        if obj.reversal_of_id:
            return {
                'id': obj.reversal_of.id,
                'display_id': obj.reversal_of.display_id,
            }
        return None

# --- Budgeting Serializers ---

class BudgetItemSerializer(serializers.ModelSerializer):
    account_name = serializers.CharField(source='account.name', read_only=True)
    account_code = serializers.CharField(source='account.code', read_only=True)
    
    class Meta:
        model = BudgetItem
        fields = ['id', 'budget', 'account', 'account_code', 'account_name', 'month', 'year', 'amount']

class BudgetSerializer(serializers.ModelSerializer):
    items = BudgetItemSerializer(many=True, read_only=True) # or separate endpoint for items management

    class Meta:
        model = Budget
        fields = ['id', 'name', 'start_date', 'end_date', 'description', 'created_at', 'items']

# --- Fiscal Year Closing Serializers ---

class FiscalYearSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    closing_entry_display = serializers.CharField(
        source='closing_entry.display_id', read_only=True, default=None
    )
    opening_entry_display = serializers.CharField(
        source='opening_entry.display_id', read_only=True, default=None
    )
    closed_by_username = serializers.CharField(
        source='closed_by.username', read_only=True, default=None
    )

    class Meta:
        model = FiscalYear
        fields = [
            'id', 'year', 'start_date', 'end_date', 'status', 'status_display',
            'closing_entry', 'closing_entry_display',
            'opening_entry', 'opening_entry_display',
            'net_result', 'is_profit', 'is_loss',
            'closed_at', 'closed_by', 'closed_by_username',
            'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'status', 'closing_entry', 'opening_entry', 'net_result',
            'closed_at', 'closed_by',
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
