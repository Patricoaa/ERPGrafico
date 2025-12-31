from rest_framework import serializers
from .models import Account, JournalEntry, JournalItem, AccountingSettings

class AccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = Account
        fields = '__all__'

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
