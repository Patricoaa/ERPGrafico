import django
django.setup()

from accounting.models import Account
from accounting.models import CFCategory
from finances.services import FinanceService

# Just query existing accounts
for code in ["1.1.01", "1.1.01.01", "1.1.02", "1.1.02.01", "1.1.03", "1.1.04", "1.1.04.01", "2.1.01", "2.1.02", "2.1.02.01", "3.1.01", "4.1.01", "5.1.01", "5.2.01.01", "5.2.02"]:
    try:
        a = Account.objects.get(code=code)
        print(f"{code}: cf={a.cf_category}, effective_cf={a.effective_cf_category}, type={a.account_type}")
    except Account.DoesNotExist:
        print(f"{code}: NOT FOUND")

print("\n--- Testing _get_accounts_by_cf_category ---")
for cat in [CFCategory.OPERATING, CFCategory.INVESTING, CFCategory.FINANCING, CFCategory.DEP_AMORT]:
    accs = FinanceService._get_accounts_by_cf_category(cat, fiscal_year_id=None)
    print(f"{cat}: {accs.count()} accounts")
    for a in accs[:5]:
        print(f"  {a.code} ({a.name})")

print("\n--- All accounts with cf_category ---")
for a in Account.objects.exclude(cf_category__isnull=True).exclude(cf_category__exact="").order_by("code"):
    print(f"  {a.code}: cf={a.cf_category}, effective_cf={a.effective_cf_category}")