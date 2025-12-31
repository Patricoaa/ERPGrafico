from rest_framework import serializers
from .models import Account, JournalEntry, JournalItem, AccountingSettings

class AccountSerializer(serializers.ModelSerializer):
    account_type_display = serializers.CharField(source='get_account_type_display', read_only=True)
    debit_total = serializers.DecimalField(max_digits=20, decimal_places=2, read_only=True)
    credit_total = serializers.DecimalField(max_digits=20, decimal_places=2, read_only=True)
    balance = serializers.DecimalField(max_digits=20, decimal_places=2, read_only=True)

    class Meta:
        model = Account
        fields = ['id', 'code', 'name', 'account_type', 'account_type_display', 'parent', 'is_reconcilable', 'debit_total', 'credit_total', 'balance']

class AccountingSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = AccountingSettings
        fields = '__all__'

class JournalItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = JournalItem
        fields = ['id', 'account', 'partner', 'label', 'debit', 'credit']

class JournalEntrySerializer(serializers.ModelSerializer):
    items = JournalItemSerializer(many=True, read_only=True)
    
    class Meta:
        model = JournalEntry
        fields = ['id', 'date', 'description', 'reference', 'state', 'items', 'created_at']
