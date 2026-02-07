
import os
import django
import sys

# Setup Django environment
# sys.path.append removed
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

print("Django setup check...")

try:
    import treasury.models as tmodels
    print(f"BankStatementLine in tmodels: {'BankStatementLine' in dir(tmodels)}")
    from treasury.models import TreasuryMovement, BankStatementLine, CardTransaction
    print("Models imported successfully.")
    
    # Check ForeignKeys
    print(f"BankStatementLine.matched_payment related model: {BankStatementLine.matched_payment.field.related_model}")
    print(f"CardTransaction.payment related model: {CardTransaction.payment.field.related_model}")
    
    from treasury.views import TreasuryMovementViewSet
    print("TreasuryMovementViewSet imported.")
    
    from treasury.serializers import POSSessionSerializer, TreasuryMovementSerializer
    print("Serializers imported.")
    
    # Check POSSessionSerializer cash_movements
    print(f"POSSessionSerializer.cash_movements: {POSSessionSerializer().get_fields()['cash_movements']}")
    
    from treasury.return_services import TreasuryReturnService
    print("TreasuryReturnService imported.")
    
    print("Smoke test passed!")
except Exception as e:
    print(f"SMOKE TEST FAILED: {e}")
    import traceback
    traceback.print_exc()
