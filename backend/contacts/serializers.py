from rest_framework import serializers
from .models import Contact
from accounting.serializers import AccountSerializer


class ContactSerializer(serializers.ModelSerializer):
    """Full contact serializer with computed fields"""
    is_customer = serializers.BooleanField(read_only=True)
    is_supplier = serializers.BooleanField(read_only=True)
    contact_type = serializers.CharField(read_only=True)
    credit_balance_used = serializers.DecimalField(max_digits=14, decimal_places=0, read_only=True)
    credit_available = serializers.DecimalField(max_digits=14, decimal_places=0, read_only=True)
    credit_balance = serializers.DecimalField(max_digits=14, decimal_places=0, read_only=True)
    credit_aging = serializers.DictField(read_only=True)
    partner_total_contributions = serializers.DecimalField(max_digits=14, decimal_places=0, read_only=True)
    partner_total_paid_in = serializers.DecimalField(max_digits=14, decimal_places=0, read_only=True)
    partner_pending_capital = serializers.DecimalField(max_digits=14, decimal_places=0, read_only=True)
    partner_provisional_withdrawals_balance = serializers.DecimalField(max_digits=14, decimal_places=0, read_only=True)
    partner_total_withdrawals = serializers.DecimalField(max_digits=14, decimal_places=0, read_only=True)
    partner_earnings_balance = serializers.DecimalField(max_digits=14, decimal_places=0, read_only=True)
    partner_net_equity = serializers.DecimalField(max_digits=14, decimal_places=0, read_only=True)
    partner_excess_capital = serializers.DecimalField(max_digits=14, decimal_places=0, read_only=True)
    
    class Meta:
        model = Contact
        fields = [
            'id', 'code', 'display_id', 'name', 'tax_id', 'contact_name', 'email', 'phone', 'address',
            'account_receivable', 'account_payable',
            'is_customer', 'is_supplier', 'contact_type',
            'is_default_customer', 'is_default_vendor',
            'credit_enabled', 'credit_blocked', 'credit_limit', 'credit_days', 'credit_balance_used', 'credit_available', 'credit_aging', 'credit_balance',
            'credit_auto_blocked', 'credit_risk_level', 'credit_last_evaluated',
            'is_partner', 'partner_equity_percentage', 'partner_since',
            'partner_contribution_account', 'partner_provisional_withdrawal_account', 'partner_earnings_account',
            'partner_balance',
            'partner_total_contributions', 'partner_total_paid_in', 'partner_pending_capital', 'partner_excess_capital',
            'partner_provisional_withdrawals_balance', 'partner_total_withdrawals',
            'partner_earnings_balance', 'partner_net_equity',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


class ContactListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views"""
    contact_type = serializers.CharField(read_only=True)
    credit_balance_used = serializers.DecimalField(max_digits=14, decimal_places=0, read_only=True)
    credit_balance = serializers.DecimalField(max_digits=14, decimal_places=0, read_only=True)
    partner_balance = serializers.DecimalField(max_digits=14, decimal_places=0, read_only=True)
    partner_total_contributions = serializers.DecimalField(max_digits=14, decimal_places=0, read_only=True)
    partner_provisional_withdrawals_balance = serializers.DecimalField(max_digits=14, decimal_places=0, read_only=True)
    partner_earnings_balance = serializers.DecimalField(max_digits=14, decimal_places=0, read_only=True)
    partner_net_equity = serializers.DecimalField(max_digits=14, decimal_places=0, read_only=True)
    partner_excess_capital = serializers.DecimalField(max_digits=14, decimal_places=0, read_only=True)
    
    class Meta:
        model = Contact
        fields = ['id', 'code', 'display_id', 'name', 'tax_id', 'email', 'phone', 'contact_type', 'is_default_customer', 'is_default_vendor', 'credit_enabled', 'credit_blocked', 'credit_limit', 'credit_available', 'credit_balance', 'credit_balance_used', 'credit_auto_blocked', 'credit_risk_level', 'is_partner', 'partner_balance', 'partner_equity_percentage', 'partner_total_contributions', 'partner_pending_capital', 'partner_excess_capital', 'partner_provisional_withdrawals_balance', 'partner_earnings_balance', 'partner_net_equity']

from .partner_models import PartnerTransaction, PartnerEquityStake, ProfitDistributionResolution, ProfitDistributionLine

class PartnerTransactionSerializer(serializers.ModelSerializer):
    partner_name = serializers.CharField(source='partner.name', read_only=True)
    transaction_type_display = serializers.CharField(source='get_transaction_type_display', read_only=True)
    journal_entry_id = serializers.IntegerField(source='journal_entry.id', read_only=True)
    journal_entry_display = serializers.CharField(source='journal_entry.display_id', read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True, default='')

    class Meta:
        model = PartnerTransaction
        fields = [
            'id', 'partner', 'partner_name', 'transaction_type', 'transaction_type_display',
            'amount', 'date', 'description', 
            'journal_entry_id', 'journal_entry_display',
            'treasury_movement', 'distribution_resolution',
            'created_by', 'created_by_name', 'created_at'
        ]
        read_only_fields = ['created_by', 'created_at']


class PartnerEquityStakeSerializer(serializers.ModelSerializer):
    partner_name = serializers.CharField(source='partner.name', read_only=True)

    class Meta:
        model = PartnerEquityStake
        fields = [
            'id', 'partner', 'partner_name', 'percentage',
            'effective_from', 'effective_until', 'is_active',
            'source_transaction', 'notes', 'created_at',
        ]


class ProfitDistributionLineSerializer(serializers.ModelSerializer):
    partner_name = serializers.CharField(source='partner.name', read_only=True)
    destination_display = serializers.CharField(source='get_destination_display', read_only=True)

    class Meta:
        model = ProfitDistributionLine
        fields = [
            'id', 'partner', 'partner_name',
            'percentage_at_date', 'gross_amount',
            'provisional_withdrawals_offset', 'net_amount',
            'destination', 'destination_display',
            'partner_transaction', 'treasury_movement',
        ]


class ProfitDistributionResolutionSerializer(serializers.ModelSerializer):
    lines = ProfitDistributionLineSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.get_full_name', read_only=True, default='')
    executed_by_name = serializers.CharField(source='executed_by.get_full_name', read_only=True, default='')

    class Meta:
        model = ProfitDistributionResolution
        fields = [
            'id', 'display_id', 'fiscal_year', 'resolution_date',
            'net_result', 'is_profit', 'is_loss',
            'status', 'status_display',
            'approved_by', 'approved_by_name', 'approved_at',
            'executed_by', 'executed_by_name', 'executed_at',
            'journal_entry', 'acta_number', 'notes',
            'lines', 'created_at', 'updated_at',
        ]

