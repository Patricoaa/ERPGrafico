import os
import django
import sys
from decimal import Decimal
from datetime import timedelta
from django.utils import timezone

# Setup Django
# Run this from within the backend directory
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from treasury.models import BankStatement, BankStatementLine, Payment, TreasuryAccount
from treasury.matching_service import MatchingService

def verify_bidirectional_and_unmatch():
    print("--- Verifying Bidirectional Suggestions ---")
    
    # Get or create a test account
    account, _ = TreasuryAccount.objects.get_or_create(
        name="Test Account Verification",
        defaults={'account_type': 'BANK', 'currency': 'CLP', 'balance': 0}
    )
    
    # Create a test statement and line
    statement = BankStatement.objects.create(
        treasury_account=account,
        display_id="TEST-ST-VERIF",
        statement_date=timezone.now().date(),
        opening_balance=0,
        closing_balance=1000
    )
    
    line = BankStatementLine.objects.create(
        statement=statement,
        line_number=1,
        transaction_date=timezone.now().date(),
        description="Payment for Invoice 999",
        credit=1000,
        debit=0
    )
    
    # Create a payment that matches
    payment = Payment.objects.create(
        treasury_account=account,
        amount=1000,
        date=timezone.now().date(),
        payment_type='INBOUND',
        transaction_number="INV-999"
    )
    
    # Test Bidirectional Suggestion
    suggestions = MatchingService.suggest_lines_for_payment(payment.id)
    print(f"Suggestions for payment {payment.id}: {len(suggestions)}")
    if suggestions and suggestions[0]['line_data']['id'] == line.id:
        print("✅ Bidirectional suggestion PASSED")
    else:
        print("❌ Bidirectional suggestion FAILED")
        
    # Test Unmatch for EXCLUDED
    print("\n--- Verifying Unmatch for EXCLUDED ---")
    line.reconciliation_state = 'EXCLUDED'
    line.save()
    print(f"Initial state: {line.reconciliation_state}")
    
    MatchingService.unmatch(line.id)
    line.refresh_from_db()
    print(f"State after unmatch: {line.reconciliation_state}")
    
    if line.reconciliation_state == 'UNRECONCILED':
        print("✅ Unmatch for EXCLUDED PASSED")
    else:
        print("❌ Unmatch for EXCLUDED FAILED")

    # Cleanup
    payment.delete()
    line.delete()
    statement.delete()
    print("\nVerification complete and cleanup done.")

if __name__ == "__main__":
    verify_bidirectional_and_unmatch()
