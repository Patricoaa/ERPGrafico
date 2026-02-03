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
        """Validate that payment methods are valid"""
        valid_methods = ['CASH', 'CARD', 'TRANSFER']
        for method in value:
            if method not in valid_methods:
                raise serializers.ValidationError(
                    f"Método inválido: {method}. Opciones válidas: {', '.join(valid_methods)}"
                )
        return value
    
    def validate(self, attrs):
        """Validate that treasury account supports at least one allowed method"""
        account = attrs.get('default_treasury_account')
        methods = attrs.get('allowed_payment_methods', [])
        
        # Only validate if both fields are present (for updates, they might not be)
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
