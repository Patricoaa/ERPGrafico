import urllib.request
import json
import sys

try:
    url = 'http://localhost:8100/api/accounting/settings/current/'
    with urllib.request.urlopen(url) as response:
        if response.status == 200:
            data = json.loads(response.read().decode())
            partner_fields = [
                'partner_capital_social_account',
                'partner_capital_social_account_name',
                'partner_capital_contribution_account',
                'partner_capital_contribution_account_name',
                'partner_withdrawal_account',
                'partner_withdrawal_account_name',
                'partner_provisional_withdrawal_account',
                'partner_provisional_withdrawal_account_name',
                'partner_retained_earnings_account',
                'partner_retained_earnings_account_name',
                'partner_current_year_earnings_account',
                'partner_current_year_earnings_account_name',
                'partner_dividends_payable_account',
                'partner_dividends_payable_account_name',
                'partner_capital_receivable_account',
                'partner_capital_receivable_account_name'
            ]
            
            results = {field: data.get(field) for field in partner_fields}
            print(json.dumps(results, indent=2))
            sys.exit(0)
        else:
            print(f"Error: {response.status}")
            sys.exit(1)
except Exception as e:
    print(f"Exception: {str(e)}")
    sys.exit(1)
