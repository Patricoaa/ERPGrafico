
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from treasury.models import Bank, TreasuryAccount, PaymentMethod

def initialize_payment_structure():
    print("Starting initialization of Banks and PaymentMethods...")
    
    # 1. Create default Banks
    default_banks = [
        {"name": "Banco de Chile", "code": "BCHILE"},
        {"name": "Banco Santander", "code": "SAN"},
        {"name": "Banco BCI", "code": "BCI"},
        {"name": "Banco Estado", "code": "BE"},
        {"name": "Banco Itaú", "code": "ITAU"},
        {"name": "Banco Scotiabank", "code": "SCOTIA"},
    ]
    
    bank_map = {}
    for bank_data in default_banks:
        bank, created = Bank.objects.get_or_create(code=bank_data["code"], defaults={"name": bank_data["name"]})
        bank_map[bank_data["code"]] = bank
        if created:
            print(f"Created Bank: {bank.name}")
            
    # 2. Iterate through TreasuryAccounts and create PaymentMethods
    for account in TreasuryAccount.objects.all():
        print(f"Processing Account: {account.id} - {account.account.name if account.account else 'Untranslated'}")
        
        # Determine if it's a bank account to assign a default bank
        selected_bank = None
        if not account.bank:
            name_lower = (account.account.name if account.account else "").lower()
            if "santander" in name_lower:
                selected_bank = bank_map["SAN"]
            elif "chile" in name_lower:
                selected_bank = bank_map["BCHILE"]
            elif "bci" in name_lower:
                selected_bank = bank_map["BCI"]
            elif "estado" in name_lower:
                selected_bank = bank_map["BE"]
            elif "itau" in name_lower or "itaú" in name_lower:
                selected_bank = bank_map["ITAU"]
            elif "scotia" in name_lower:
                selected_bank = bank_map["SCOTIA"]
            
            if selected_bank:
                TreasuryAccount.objects.filter(id=account.id).update(bank=selected_bank)
                print(f"  Linked to Bank: {selected_bank.name}")
        
        # Create PaymentMethods based on boolean flags
        if account.allows_cash:
            pm, created = PaymentMethod.objects.get_or_create(
                treasury_account=account,
                method_type=PaymentMethod.Type.CASH,
                defaults={"name": "Efectivo"}
            )
            if created: print(f"    Created PaymentMethod: {pm.name}")
            
        if account.allows_card:
            # Create Debit and Credit card methods by default if card is allowed
            pm1, created1 = PaymentMethod.objects.get_or_create(
                treasury_account=account,
                method_type=PaymentMethod.Type.DEBIT_CARD,
                defaults={"name": "Tarjeta de Débito"}
            )
            if created1: print(f"    Created PaymentMethod: {pm1.name}")
            
            pm2, created2 = PaymentMethod.objects.get_or_create(
                treasury_account=account,
                method_type=PaymentMethod.Type.CREDIT_CARD,
                defaults={"name": "Tarjeta de Crédito"}
            )
            if created2: print(f"    Created PaymentMethod: {pm2.name}")
            
        if account.allows_transfer:
            pm, created = PaymentMethod.objects.get_or_create(
                treasury_account=account,
                method_type=PaymentMethod.Type.TRANSFER,
                defaults={"name": "Transferencia"}
            )
            if created: print(f"    Created PaymentMethod: {pm.name}")

    print("Initialization complete.")

if __name__ == "__main__":
    initialize_payment_structure()
