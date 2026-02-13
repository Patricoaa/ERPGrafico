
import os
import django
import sys
from pathlib import Path

# Add backend to sys.path
backend_path = Path(__file__).resolve().parent
sys.path.append(str(backend_path))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from accounting.models import JournalEntry
from tax.models import AccountingPeriod
from rest_framework.test import APIRequestFactory
from tax.views import AccountingPeriodViewSet

def debug_periods():
    with open('debug_output.txt', 'w') as f:
        entries_count = JournalEntry.objects.count()
        periods_count = AccountingPeriod.objects.count()

        f.write(f"Total Journal Entries: {entries_count}\n")
        f.write(f"Total Accounting Periods: {periods_count}\n")

        f.write("Listing ALL Periods:\n")
        periods = list(AccountingPeriod.objects.all().order_by('year', 'month'))
        if not periods:
            f.write("NO PERIODS FOUND\n")
        for p in periods:
            f.write(f"- {p.year}-{p.month}: {p.status}\n")

        f.write("-" * 20 + "\n")
        f.write("Testing ViewSet Response:\n")
        
        factory = APIRequestFactory()
        request = factory.get('/api/tax/accounting-periods/?ordering=-year,-month')
        view = AccountingPeriodViewSet.as_view({'get': 'list'})
        
        try:
            from core.models import User
            user = User.objects.first()
            if user:
                f.write(f"Using user: {user.username}\n")
                from rest_framework.force_authenticate import force_authenticate
                force_authenticate(request, user=user)
                request.user = user
            else:
                 f.write("No user found!\n")

            response = view(request)
            f.write(f"Response Status: {response.status_code}\n")
            f.write(f"Response Data Count: {len(response.data) if hasattr(response, 'data') else 'No Data'}\n")
            if hasattr(response, 'data') and len(response.data) > 0:
                 f.write(f"First Item: {response.data[0]}\n")
        except Exception as e:
            f.write(f"View Error: {e}\n")

if __name__ == '__main__':
    debug_periods()
