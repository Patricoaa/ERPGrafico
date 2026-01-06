
import os
import django
import sys
import traceback

# Setup Django environment
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from accounting.models import Account, JournalEntry
from accounting.serializers import JournalEntrySerializer
from core.dashboard_view import DashboardMetricsView
from rest_framework.test import APIRequestFactory

def check_accounts():
    print("Checking Accounts...")
    for account in Account.objects.all():
        try:
            _ = account.balance
        except Exception:
            print(f"Error checking balance for account {account.id} ({account.code})")
            traceback.print_exc()

def check_journal_entries():
    print("Checking Journal Entries...")
    entries = JournalEntry.objects.all()
    print(f"Total entries: {entries.count()}")
    try:
        data = JournalEntrySerializer(entries, many=True).data
        # Force evaluation
        _ = list(data)
    except Exception:
        print("Error serializing journal entries")
        traceback.print_exc()

def check_dashboard_view():
    print("Checking Dashboard View...")
    factory = APIRequestFactory()
    request = factory.get('/core/dashboard/metrics/')
    view = DashboardMetricsView.as_view()
    
    try:
        response = view(request)
        print("Status Code:", response.status_code)
        if response.status_code != 200:
             print("Response Data:", response.data)
    except Exception:
        print("Error in Dashboard View")
        traceback.print_exc()

if __name__ == "__main__":
    check_accounts()
    check_journal_entries()
    check_dashboard_view()
