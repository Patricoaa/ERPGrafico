from rest_framework import serializers
from .models import TreasuryAccount

class TerminalValidator:
    @staticmethod
    def validate_pos_terminal(instance, attrs):
        default_account = attrs.get('default_treasury_account', getattr(instance, 'default_treasury_account', None))
        if not default_account: return attrs
        
        allowed_methods = attrs.get('allowed_payment_methods')
        allowed_ids = set(m.treasury_account_id for m in allowed_methods) if allowed_methods is not None else set(instance.allowed_payment_methods.values_list('treasury_account_id', flat=True)) if instance else set()
        
        legacy = attrs.get('allowed_treasury_accounts')
        if legacy is not None: allowed_ids.update(a.id for a in legacy)
        elif instance and allowed_methods is None: allowed_ids.update(instance.allowed_treasury_accounts.values_list('id', flat=True))
        
        if allowed_ids and default_account.id not in allowed_ids:
            raise serializers.ValidationError({'default_treasury_account': 'La cuenta predeterminada debe ser una de las cuentas permitidas.'})
        return attrs

class LoanValidator:
    @staticmethod
    def validate_bank_loan(attrs):
        start = attrs.get('start_date')
        first_due = attrs.get('first_due_date')
        if start and first_due and first_due < start:
            raise serializers.ValidationError({'first_due_date': 'El primer vencimiento no puede ser anterior al inicio.'})
            
        disb = attrs.get('disbursement_account')
        if disb and disb.account_type in (TreasuryAccount.Type.CREDIT_CARD, TreasuryAccount.Type.LOAN, TreasuryAccount.Type.CHECK_PORTFOLIO):
            raise serializers.ValidationError({'disbursement_account': 'La cuenta de desembolso debe ser bancaria o caja.'})
        return attrs
