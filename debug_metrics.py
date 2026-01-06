import os
import django
import sys

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db.models import Sum, Q
from django.db.models.functions import Coalesce
from decimal import Decimal
from sales.models import SaleOrder
from accounting.models import Account, AccountingSettings, JournalEntry
from accounting.serializers import JournalEntrySerializer

def test_metrics():
    try:
        print("Calculating Total Sales...")
        total_sales = SaleOrder.objects.filter(
            ~Q(status=SaleOrder.Status.CANCELLED)
        ).aggregate(
            total=Coalesce(Sum('total_net'), Decimal('0.0')) + Coalesce(Sum('total_tax'), Decimal('0.0'))
        )['total'] or 0
        print(f"Total Sales: {total_sales}")

        print("Calculating AR Balance...")
        ar_balance = 0
        settings = AccountingSettings.objects.first()
        if settings and settings.default_receivable_account:
            ar_balance = settings.default_receivable_account.balance
        print(f"AR Balance: {ar_balance}")

        print("Calculating Sales Count...")
        sales_count = SaleOrder.objects.filter(
            ~Q(status=SaleOrder.Status.CANCELLED)
        ).count()
        print(f"Sales Count: {sales_count}")

        print("Fetching Recent Activity...")
        recent_entries = JournalEntry.objects.all().order_by('-date', '-id')[:5]
        data = JournalEntrySerializer(recent_entries, many=True).data
        print(f"Recent Activity count: {len(data)}")
        
        print("Success!")
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_metrics()
