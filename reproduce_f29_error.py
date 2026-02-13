import os
import django
import sys

# Setup Django environment
sys.path.append(os.path.join(os.getcwd(), 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from treasury.services import TreasuryService
from decimal import Decimal

def reproduce():
    print("Attempting to call TreasuryService.create_movement with 'account_id'...")
    try:
        # Mimic the call from F29PaymentService.register_payment
        TreasuryService.create_movement(
            account_id=1,
            movement_type='OUTFLOW',
            amount=Decimal('1000'),
            description="Test Reproduction"
        )
        print("Success? (Unexpected)")
    except TypeError as e:
        print(f"Caught expected TypeError: {e}")
    except Exception as e:
        print(f"Caught unexpected exception: {e}")

if __name__ == "__main__":
    reproduce()
