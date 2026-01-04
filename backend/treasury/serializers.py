from rest_framework import serializers
from .models import Payment, TreasuryAccount
# Remove top-level import to avoid circular dependency
# from accounting.serializers import JournalEntrySerializer

class TreasuryAccountSerializer(serializers.ModelSerializer):
    account_name = serializers.CharField(source='account.name', read_only=True)
    
    class Meta:
        model = TreasuryAccount
        fields = '__all__'

class PaymentSerializer(serializers.ModelSerializer):
    partner_name = serializers.SerializerMethodField()
    account_name = serializers.CharField(source='account.name', read_only=True)
    payment_method_display = serializers.CharField(source='get_payment_method_display', read_only=True)
    journal_entry = serializers.SerializerMethodField()
    treasury_account = TreasuryAccountSerializer(read_only=True)

    class Meta:
        model = Payment
        fields = '__all__'
        
    def get_partner_name(self, obj):
        if obj.contact:
            return obj.contact.name
        return '-'

    def get_journal_entry(self, obj):
        if obj.journal_entry:
            from accounting.serializers import JournalEntrySerializer
            return JournalEntrySerializer(obj.journal_entry).data
        return None
