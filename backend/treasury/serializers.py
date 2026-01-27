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
    journal_name = serializers.CharField(source='treasury_account.name', read_only=True)
    treasury_account_type = serializers.CharField(source='treasury_account.account_type', read_only=True)
    code = serializers.SerializerMethodField()
    document_info = serializers.SerializerMethodField()

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

    def get_code(self, obj):
        prefix = 'ING' if obj.payment_type == 'INBOUND' else 'EGR'
        return f"{prefix}-{str(obj.id).zfill(5)}"

    def get_document_info(self, obj):
        info = {
            'type': None,
            'id': None,
            'number': None,
            'label': None
        }
        if obj.invoice:
            info['type'] = 'invoice'
            info['id'] = obj.invoice.id
            info['number'] = obj.invoice.number
            info['label'] = f"{obj.invoice.get_dte_type_display()} #{obj.invoice.number}"
        elif obj.purchase_order:
            info['type'] = 'purchase_order'
            info['id'] = obj.purchase_order.id
            info['number'] = obj.purchase_order.number
            info['label'] = f"OCS-{obj.purchase_order.number}"
        elif obj.sale_order:
            info['type'] = 'sale_order'
            info['id'] = obj.sale_order.id
            info['number'] = obj.sale_order.number
            info['label'] = f"PV-{obj.sale_order.number}"
        
        return info if info['type'] else None
