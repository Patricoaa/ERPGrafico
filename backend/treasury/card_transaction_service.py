from decimal import Decimal
from django.db import transaction
from .models import TreasuryMovement, CardTransaction

class CardTransactionService:
    @staticmethod
    @transaction.atomic
    def process_movement(movement: TreasuryMovement):
        """
        Creates a CardTransaction for a given TreasuryMovement if it involves a card provider.
        Calculates commissions based on the provider's rates.
        """
        if not movement.card_provider or movement.movement_type != TreasuryMovement.Type.INBOUND:
            return None

        provider = movement.card_provider
        gross_amount = movement.amount
        
        # Calculate commission
        # Assuming fixed rate for now as per provider model
        rate = provider.commission_rate / Decimal('100.0')
        vat_rate = provider.vat_rate / Decimal('100.0')
        
        commission = (gross_amount * rate).quantize(Decimal('1'), rounding='ROUND_HALF_UP')
        vat = (commission * vat_rate).quantize(Decimal('1'), rounding='ROUND_HALF_UP')
        net_amount = gross_amount - commission - vat

        transaction = CardTransaction.objects.create(
            provider=provider,
            movement=movement,
            transaction_date=movement.date,
            gross_amount=gross_amount,
            commission_amount=commission,
            vat_amount=vat,
            net_amount=net_amount,
            transaction_reference=movement.transaction_number or movement.reference,
            status='PENDING'
        )
        
        return transaction
