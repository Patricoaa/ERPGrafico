import os
import django
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from accounting.models import AccountingSettings

settings = AccountingSettings.objects.first()
if settings:
    partner_fields = [
        'partner_capital_social_account',
        'partner_capital_contribution_account',
        'partner_withdrawal_account',
        'partner_provisional_withdrawal_account',
        'partner_retained_earnings_account',
        'partner_current_year_earnings_account',
        'partner_dividends_payable_account',
        'partner_capital_receivable_account'
    ]
    
    results = {}
    for field in partner_fields:
        acc = getattr(settings, field)
        results[field] = acc.code if acc else None
        results[f"{field}_name"] = acc.name if acc else None
        
    print(json.dumps(results, indent=2))
else:
    print("No settings found")
