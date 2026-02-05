
import os
import django
import sys
from decimal import Decimal

# Setup Django
sys.path.append(os.path.join(os.getcwd(), 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from treasury.models import POSSession, POSTerminal, TreasuryAccount, Payment
from treasury.services import TreasuryService
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError

User = get_user_model()

def verify_fallback():
    print("Starting verification of POS treasury account fallback...")
    
    # 1. Setup test data
    user = User.objects.first()
    
    from accounting.models import Account, AccountType
    # Create a financial account
    f_acc = Account.objects.create(
        code="1.1.1.TEST",
        name="Test Cash Account",
        account_type=AccountType.ASSET
    )
    
    # Create a test treasury account
    acc = TreasuryAccount.objects.create(
        name="Test POS Cash",
        code="TEST_POS_CASH",
        account_type='CASH',
        allows_cash=True,
        account=f_acc
    )
    
    # Create a terminal with this default account
    terminal = POSTerminal.objects.create(
        code="T-VERIFY",
        name="Terminal Verification",
        default_treasury_account=acc
    )
    terminal.allowed_treasury_accounts.add(acc)
    
    # Open a session
    session = POSSession.objects.create(
        user=user,
        terminal=terminal,
        status='OPEN'
    )
    
    print(f"Created Session {session.id} for Terminal {terminal.code} with default account {acc.id}")
    
    try:
        # 2. Attempt to register a payment WITHOUT treasury_account_id
        # But PROVIDING pos_session_id
        payment = TreasuryService.register_payment(
            amount=Decimal('1000'),
            payment_type='INBOUND',
            payment_method='CASH',
            pos_session_id=session.id,
            partner=None # Optional
        )
        
        if payment and payment.treasury_account == acc:
            print("SUCCESS: Payment registered successfully using fallback default account.")
        else:
            print(f"FAILURE: Payment registered but account is {payment.treasury_account if payment else 'None'}")
            
    except ValidationError as e:
        print(f"FAILURE: Validation error raised: {e}")
    except Exception as e:
        print(f"FAILURE: Unexpected error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # Cleanup
        session.delete()
        terminal.delete()
        acc.delete()

if __name__ == "__main__":
    verify_fallback()
