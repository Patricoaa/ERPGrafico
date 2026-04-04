import os
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from contacts.models import Contact
from accounting.models import AccountingSettings, Account

def fix_partner_accounts():
    settings = AccountingSettings.get_solo()
    if not settings:
        print("Error: No AccountingSettings found.")
        return

    parent_account = settings.partner_current_account
    if not parent_account:
        print("Error: AccountingSettings has no partner_current_account configured.")
        return

    partners = Contact.objects.filter(is_partner=True, partner_account__isnull=True)
    print(f"Found {partners.count()} partners without an account.")

    for partner in partners:
        try:
            # Create sub-account for the partner
            new_account = Account.objects.create(
                name=f"C.P. {partner.name}",
                parent=parent_account,
                account_type=parent_account.account_type
            )
            partner.partner_account = new_account
            partner.save()
            print(f"Created account '{new_account.name}' (Code: {new_account.code}) for partner '{partner.name}'.")
        except Exception as e:
            print(f"Error creating account for partner '{partner.name}': {str(e)}")

if __name__ == "__main__":
    fix_partner_accounts()
