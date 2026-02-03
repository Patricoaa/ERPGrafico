from rest_framework import serializers
from .models import (Payment, TreasuryAccount, BankStatement, BankStatementLine,  
                     ReconciliationRule, CardPaymentProvider, DailySettlement, 
                     CardTransaction, POSTerminal)
# Remove top-level import to avoid circular dependency
# from accounting.serializers import JournalEntrySerializer

class TreasuryAccountSerializer(serializers.ModelSerializer):
    account_name = serializers.CharField(source='account.name', read_only=True)
    
    class Meta:
        model = TreasuryAccount
        fields = '__all__'


class POSTerminalSerializer(serializers.ModelSerializer):
    default_treasury_account_name = serializers.CharField(
        source='default_treasury_account.name',
        read_only=True
    )
    default_treasury_account_code = serializers.CharField(
        source='default_treasury_account.code',
        read_only=True
    )
    
    class Meta:
        model = POSTerminal
        fields = [
            'id', 'name', 'code', 'location', 'is_active',
            'default_treasury_account', 'default_treasury_account_name', 'default_treasury_account_code',
            'allowed_payment_methods', 'serial_number', 'ip_address',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']
    
    def validate_allowed_payment_methods(self, value):
        valid_methods = ['CASH', 'CARD', 'TRANSFER']
        for method in value:
            if method not in valid_methods:
                raise serializers.ValidationError(
                    f"Método inválido: {method}. Opciones válidas: {', '.join(valid_methods)}"
                )
        return value
    
    def validate(self, attrs):
        account = attrs.get('default_treasury_account')
        methods = attrs.get('allowed_payment_methods', [])
        
        if account and methods:
            if 'CASH' in methods and not account.allows_cash:
                raise serializers.ValidationError({
                    'default_treasury_account': 
                    'La cuenta seleccionada no permite efectivo, pero el terminal lo requiere.'
                })
            if 'CARD' in methods and not account.allows_card:
                raise serializers.ValidationError({
                    'default_treasury_account': 
                    'La cuenta seleccionada no permite tarjetas, pero el terminal lo requiere.'
                })
            if 'TRANSFER' in methods and not account.allows_transfer:
                raise serializers.ValidationError({
                    'default_treasury_account': 
                    'La cuenta seleccionada no permite transferencias, pero el terminal lo requiere.'
                })
        
        return attrs


class PaymentSerializer(serializers.ModelSerializer):
    partner_name = serializers.SerializerMethodField()
    account_name = serializers.CharField(source='account.name', read_only=True)
    payment_method_display = serializers.CharField(source='get_payment_method_display', read_only=True)
    journal_name = serializers.CharField(source='treasury_account.name', read_only=True)
    treasury_account_type = serializers.CharField(source='treasury_account.account_type', read_only=True)
    code = serializers.SerializerMethodField()
    display_id = serializers.CharField(read_only=True)
    document_info = serializers.SerializerMethodField()
    
    # Reconciliation data
    reconciled_by_name = serializers.CharField(source='reconciled_by.username', read_only=True, allow_null=True)
    bank_statement_info = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = '__all__'
        
    def get_partner_name(self, obj):
        if obj.contact:
            return obj.contact.name
        if obj.invoice and obj.invoice.contact:
            return obj.invoice.contact.name
        if obj.sale_order and obj.sale_order.customer:
            return obj.sale_order.customer.name
        if obj.purchase_order and obj.purchase_order.supplier:
            return obj.purchase_order.supplier.name
        return 'Particular'

    def get_journal_entry(self, obj):
        if obj.journal_entry:
            from accounting.serializers import JournalEntrySerializer
            return JournalEntrySerializer(obj.journal_entry).data
        return None

    def get_code(self, obj):
        return obj.display_id

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
    
    def get_bank_statement_info(self, obj):
        if obj.bank_statement_line:
            return {
                'line_id': obj.bank_statement_line.id,
                'statement_id': obj.bank_statement_line.statement.id,
                'statement_display_id': obj.bank_statement_line.statement.display_id,
            }
        return None


class BankStatementLineSerializer(serializers.ModelSerializer):
    """Serializer for bank statement lines"""
    amount = serializers.DecimalField(read_only=True, max_digits=20, decimal_places=2)
    matched_payment_info = serializers.SerializerMethodField()
    reconciliation_state_display = serializers.CharField(source='get_reconciliation_state_display', read_only=True)
    reconciled_by_name = serializers.CharField(source='reconciled_by.username', read_only=True, allow_null=True)
    
    class Meta:
        model = BankStatementLine
        fields = '__all__'
    
    def get_matched_payment_info(self, obj):
        if obj.matched_payment:
            return {
                'id': obj.matched_payment.id,
                'display_id': obj.matched_payment.display_id,
                'amount': obj.matched_payment.amount,
                'date': obj.matched_payment.date,
            }
        return None


class BankStatementSerializer(serializers.ModelSerializer):
    """Serializer for bank statements"""
    display_id = serializers.CharField(read_only=True)
    treasury_account_name = serializers.CharField(source='treasury_account.name', read_only=True)
    reconciliation_progress = serializers.DecimalField(read_only=True, max_digits=5, decimal_places=1)
    state_display = serializers.CharField(source='get_state_display', read_only=True)
    imported_by_name = serializers.CharField(source='imported_by.username', read_only=True)
    
    # Nested lines (optional, for detail view)
    lines = BankStatementLineSerializer(many=True, read_only=True, required=False)
    
    class Meta:
        model = BankStatement
        fields = '__all__'


class BankStatementListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list view"""
    display_id = serializers.CharField(read_only=True)
    treasury_account_name = serializers.CharField(source='treasury_account.name', read_only=True)
    reconciliation_progress = serializers.DecimalField(read_only=True, max_digits=5, decimal_places=1)
    state_display = serializers.CharField(source='get_state_display', read_only=True)
    imported_by_name = serializers.CharField(source='imported_by.username', read_only=True)
    
    class Meta:
        model = BankStatement
        exclude = ['notes']


class ReconciliationRuleSerializer(serializers.ModelSerializer):
    """Serializer for reconciliation rules"""
    treasury_account_name = serializers.CharField(source='treasury_account.name', read_only=True, allow_null=True)
    
    class Meta:
        model = ReconciliationRule
        fields = '__all__'
        read_only_fields = ['created_by', 'times_applied', 'success_rate']


class CardPaymentProviderSerializer(serializers.ModelSerializer):
    """Serializer for Card Payment Providers"""
    
    class Meta:
        model = CardPaymentProvider
        fields = '__all__'


class DailySettlementSerializer(serializers.ModelSerializer):
    """Serializer for Daily Settlements"""
    provider_name = serializers.CharField(source='provider.name', read_only=True)
    
    class Meta:
        model = DailySettlement
        fields = '__all__'


class CardTransactionSerializer(serializers.ModelSerializer):
    """Serializer for Card Transactions"""
    provider_name = serializers.CharField(source='provider.name', read_only=True)
    
    class Meta:
        model = CardTransaction
        fields = '__all__'


class POSSessionSerializer(serializers.ModelSerializer):
    """Serializer for POS Sessions"""
    from .models import POSSession
    
    user_name = serializers.SerializerMethodField()
    treasury_account_name = serializers.CharField(source='treasury_account.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    expected_cash = serializers.DecimalField(read_only=True, max_digits=12, decimal_places=2)
    closed_by_name = serializers.CharField(source='closed_by.username', read_only=True, allow_null=True)
    
    class Meta:
        from .models import POSSession
        model = POSSession
        fields = '__all__'
    
    def get_user_name(self, obj):
        return obj.user.get_full_name() or obj.user.username


class POSSessionAuditSerializer(serializers.ModelSerializer):
    """Serializer for POS Session Audits (Arqueos)"""
    
    class Meta:
        from .models import POSSessionAudit
        model = POSSessionAudit
        fields = '__all__'
