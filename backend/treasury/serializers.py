from rest_framework import serializers
from .models import BankJournal, Payment

class BankJournalSerializer(serializers.ModelSerializer):
    class Meta:
        model = BankJournal
        fields = '__all__'

class PaymentSerializer(serializers.ModelSerializer):
    journal_name = serializers.CharField(source='journal.name', read_only=True)
    partner_name = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = '__all__'
        
    def get_partner_name(self, obj):
        if obj.customer: return obj.customer.name
        if obj.supplier: return obj.supplier.name
        return '-'
