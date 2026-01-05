from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Sum, Q
from django.db.models.functions import Coalesce
from decimal import Decimal
from sales.models import SaleOrder
from accounting.models import Account, AccountingSettings, JournalEntry
from accounting.serializers import JournalEntrySerializer
import logging

logger = logging.getLogger(__name__)

class DashboardMetricsView(APIView):
    def get(self, request):
        try:
            # 1. Total Sales
            total_sales = SaleOrder.objects.filter(
                ~Q(status=SaleOrder.Status.CANCELLED)
            ).aggregate(
                total=Coalesce(Sum('total_net'), Decimal('0.0')) + Coalesce(Sum('total_tax'), Decimal('0.0'))
            )['total'] or 0

            # 2. Accounts Receivable (AR)
            ar_balance = 0
            settings = AccountingSettings.objects.first()
            if settings and settings.default_receivable_account:
                ar_balance = settings.default_receivable_account.balance

            # 3. Sales Count
            sales_count = SaleOrder.objects.filter(
                ~Q(status=SaleOrder.Status.CANCELLED)
            ).count()

            # 4. Recent Activity (Latest Journal Entries)
            recent_entries = JournalEntry.objects.all().order_by('-date', '-id')[:5]
            
            return Response({
                'total_sales': float(total_sales),
                'accounts_receivable': float(ar_balance),
                'sales_count': sales_count,
                'recent_activity': JournalEntrySerializer(recent_entries, many=True).data
            })
        except Exception as e:
            logger.exception("Error calculating dashboard metrics")
            return Response({"error": str(e)}, status=500)
