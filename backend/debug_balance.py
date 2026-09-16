import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from accounting.models import JournalItem, Account, JournalEntry
from django.db.models import Sum

items = JournalItem.objects.filter(entry__status='POSTED')
agg = items.aggregate(d=Sum('debit'), c=Sum('credit'))
print(f"Total system debit: {agg['d']}, credit: {agg['c']}")
