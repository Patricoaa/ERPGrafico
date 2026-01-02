from rest_framework import serializers
from .models import Payment, TreasuryAccount
from accounting.serializers import JournalEntrySerializer

class TreasuryAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = TreasuryAccount
        fields = '__all__'

class PaymentSerializer(serializers.ModelSerializer):
    partner_name = serializers.SerializerMethodField()
    account_name = serializers.CharField(source='account.name', read_only=True)
    payment_method_display = serializers.CharField(source='get_payment_method_display', read_only=True)
    journal_entry = JournalEntrySerializer(read_only=True)
    treasury_account = TreasuryAccountSerializer(read_only=True) # Added based on instruction

    class Meta:
        model = Payment
        fields = '__all__'
        
    def get_partner_name(self, obj):
        if obj.customer: return obj.customer.name
        if obj.supplier: return obj.supplier.name
        return '-'
