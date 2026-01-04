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
        extra_kwargs = {
            'code': {'required': False, 'allow_blank': True}
        }

class AccountingSettingsSerializer(serializers.ModelSerializer):
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
    
    class Meta:
        model = JournalEntry
        fields = ['id', 'number', 'date', 'description', 'reference', 'state', 'items', 'source_documents', 'created_at']
