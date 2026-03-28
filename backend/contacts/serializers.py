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
    partner_account_detail = AccountSerializer(source='partner_account', read_only=True)
    partner_total_contributions = serializers.DecimalField(max_digits=14, decimal_places=0, read_only=True)
    partner_total_paid_in = serializers.DecimalField(max_digits=14, decimal_places=0, read_only=True)
    partner_pending_capital = serializers.DecimalField(max_digits=14, decimal_places=0, read_only=True)
    
    class Meta:
        model = Contact
        fields = [
            'id', 'code', 'display_id', 'name', 'tax_id', 'contact_name', 'email', 'phone', 'address',
            'account_receivable', 'account_payable',
            'is_customer', 'is_supplier', 'contact_type',
            'is_default_customer', 'is_default_vendor',
            'credit_enabled', 'credit_blocked', 'credit_limit', 'credit_days', 'credit_balance_used', 'credit_available', 'credit_aging', 'credit_balance',
            'credit_auto_blocked', 'credit_risk_level', 'credit_last_evaluated',
            'is_partner', 'partner_equity_percentage', 'partner_since', 'partner_account', 'partner_account_detail', 'partner_balance',
            'partner_total_contributions', 'partner_total_paid_in', 'partner_pending_capital',
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
    
    class Meta:
        model = Contact
        fields = ['id', 'code', 'display_id', 'name', 'tax_id', 'email', 'phone', 'contact_type', 'is_default_customer', 'is_default_vendor', 'credit_enabled', 'credit_blocked', 'credit_limit', 'credit_available', 'credit_balance', 'credit_balance_used', 'credit_auto_blocked', 'credit_risk_level', 'is_partner', 'partner_balance', 'partner_equity_percentage', 'partner_total_contributions', 'partner_pending_capital']

from .partner_models import PartnerTransaction

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
            'treasury_movement',
            'created_by', 'created_by_name', 'created_at'
        ]
        read_only_fields = ['created_by', 'created_at']
