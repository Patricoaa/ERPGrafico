import django
django.setup()

from accounting.models import Account
from accounting.services import AccountingService
from finances.services import FinanceService
from accounting.models import CFCategory
from decimal import Decimal
from datetime import date

# Check if there are journal entries
from accounting.models import JournalEntry, JournalItem
print(f"JournalEntry count: {JournalEntry.objects.count()}")
print(f"JournalItem count: {JournalItem.objects.count()}")
print(f"Posted entries: {JournalEntry.objects.filter(status='POSTED').count()}")

# Test get_cash_flow
cf = FinanceService.get_cash_flow(date(2026, 1, 1), date(2026, 12, 31))
import json
print(json.dumps(cf, indent=2, default=str))
