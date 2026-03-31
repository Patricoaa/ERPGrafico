from rest_framework import serializers
from .models import Account, JournalEntry, JournalItem, AccountingSettings, Budget, BudgetItem

class AccountSerializer(serializers.ModelSerializer):
    account_type_display = serializers.CharField(source='get_account_type_display', read_only=True)
    bs_category_display = serializers.CharField(source='get_bs_category_display', read_only=True)
    debit_total = serializers.DecimalField(max_digits=20, decimal_places=2, read_only=True)
    credit_total = serializers.DecimalField(max_digits=20, decimal_places=2, read_only=True)
    balance = serializers.DecimalField(max_digits=20, decimal_places=2, read_only=True)

    class Meta:
        model = Account
        fields = [
            'id', 'code', 'name', 'account_type', 'account_type_display', 
            'bs_category', 'bs_category_display',
            'parent', 'is_reconcilable', 'is_selectable', 'debit_total', 'credit_total', 
            'balance', 'is_category', 'cf_category'
        ]
        extra_kwargs = {
            'code': {'required': False, 'allow_blank': True}
        }

class AccountingSettingsSerializer(serializers.ModelSerializer):
    default_uncollectible_expense_account_name = serializers.CharField(source='default_uncollectible_expense_account.name', read_only=True)
    partner_capital_social_account_name = serializers.CharField(source='partner_capital_social_account.name', read_only=True)
    partner_capital_contribution_account_name = serializers.CharField(source='partner_capital_contribution_account.name', read_only=True)
    partner_withdrawal_account_name = serializers.CharField(source='partner_withdrawal_account.name', read_only=True)
    partner_provisional_withdrawal_account_name = serializers.CharField(source='partner_provisional_withdrawal_account.name', read_only=True)
    partner_retained_earnings_account_name = serializers.CharField(source='partner_retained_earnings_account.name', read_only=True)
    partner_current_year_earnings_account_name = serializers.CharField(source='partner_current_year_earnings_account.name', read_only=True)
    partner_dividends_payable_account_name = serializers.CharField(source='partner_dividends_payable_account.name', read_only=True)
    partner_capital_receivable_account_name = serializers.CharField(source='partner_capital_receivable_account.name', read_only=True)


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
    
    class Meta:
        model = JournalEntry
        fields = ['id', 'number', 'display_id', 'date', 'description', 'reference', 'status', 'items', 'source_documents', 'created_at']

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
