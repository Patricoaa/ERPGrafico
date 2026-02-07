
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from treasury.models import TreasuryMovement, PaymentMethod, TreasuryAccount

def migrate_payment_methods():
    print("Starting data migration for TreasuryMovement.payment_method_new...")
    
    # Mapping from legacy Enum to new Method Type
    legacy_map = {
        'CASH': PaymentMethod.Type.CASH,
        'CARD': PaymentMethod.Type.DEBIT_CARD, # Default legacy card to debit if ambiguous
        'TRANSFER': PaymentMethod.Type.TRANSFER,
        'CREDIT': PaymentMethod.Type.CREDIT_LINE,
        'OTHER': PaymentMethod.Type.OTHER,
    }
    
    movements = TreasuryMovement.objects.filter(payment_method_new__isnull=True)
    count = movements.count()
    print(f"Found {count} movements to update.")
    
    updated = 0
    for mov in movements:
        # Determine which account to look at
        # Movements usually use from_account for payments or to_account for collections
        target_account = mov.from_account or mov.to_account
        
        if not target_account:
            continue
            
        method_type = legacy_map.get(mov.payment_method)
        if not method_type:
            continue
            
        # Find matching PaymentMethod for this account
        pm = PaymentMethod.objects.filter(treasury_account=target_account, method_type=method_type).first()
        
        if pm:
            mov.payment_method_new = pm
            mov.save(update_fields=['payment_method_new'])
            updated += 1
            if updated % 100 == 0:
                print(f"  Updated {updated} movements...")
        else:
            # Fallback: if no specific method found but it's cash, we might need to create it?
            # But initialize_treasury_structure should have created them.
            pass

    print(f"Data migration complete. Total updated: {updated}")

if __name__ == "__main__":
    migrate_payment_methods()
