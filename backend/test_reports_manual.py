
import os
import django
from datetime import date

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from reports.services import ReportService
from accounting.models import Account, JournalEntry, AccountType

def test_reports():
    print("--- Testing ReportService ---")
    
    # Balance Sheet
    print("\n[Balance Sheet Data]")
    bs = ReportService.get_balance_sheet(date.today())
    print(f"Total Assets: {bs['total_assets']}")
    print(f"Total Liabilities: {bs['total_liabilities']}")
    print(f"Total Equity: {bs['total_equity']}")
    print(f"Check (Should be 0): {bs['check']}")
    
    if abs(bs['check']) > 0.01:
        print("WARNING: Balance Sheet not balanced!")
    else:
        print("OK: Balance Sheet balanced.")

    # Income Statement
    print("\n[Income Statement Data]")
    pl = ReportService.get_income_statement(date(date.today().year, 1, 1), date.today())
    print(f"Total Income: {pl['total_income']}")
    print(f"Total Expenses: {pl['total_expenses']}")
    print(f"Net Income: {pl['net_income']}")

    # Cash Flow
    print("\n[Cash Flow Data]")
    cf = ReportService.get_cash_flow(date(date.today().year, 1, 1), date.today())
    print(f"Operating CF: {cf['total_operating']}")
    print(f"Investing CF: {cf['total_investing']}")
    print(f"Financing CF: {cf['total_financing']}")
    print(f"Net Cash Flow: {cf['net_cash_flow']}")

    # Structure check
    if 'operating' in cf:
        print("OK: Cash Flow structure looks correct.")
        if len(cf['operating']) > 0:
            print("Sample Operating Item:", cf['operating'][0])
    
if __name__ == "__main__":
    test_reports()
