import django
django.setup()

from accounting.models import Account

for code in ["1.1.06", "1.1.06.01", "1.1.06.02", "1.1.06.03"]:
    try:
        a = Account.objects.get(code=code)
        print(f"{code}: cf={a.cf_category}, effective_cf={a.effective_cf_category}")
    except Account.DoesNotExist:
        print(f"{code}: NOT FOUND")