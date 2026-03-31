import requests
import json

try:
    response = requests.get('http://localhost:8000/api/accounting/settings/current/')
    if response.status_code == 200:
        data = response.json()
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
    else:
        print(f"Error: {response.status_code}")
        print(response.text)
except Exception as e:
    print(f"Exception: {str(e)}")
