from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Sum, Q
from django.db.models.functions import Coalesce
from decimal import Decimal
from sales.models import SaleOrder
from accounting.models import Account, AccountingSettings, JournalEntry, AccountType
from accounting.serializers import JournalEntrySerializer
from purchasing.models import PurchaseOrder
from production.models import WorkOrder
from inventory.models import Product
from django.db.models import Sum, Q, Value
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

            # --- NEW METRICS ---

            # 4. Total Purchases
            total_purchases = PurchaseOrder.objects.filter(
                ~Q(status=PurchaseOrder.Status.CANCELLED)
            ).aggregate(
                total=Coalesce(Sum('total_net'), Decimal('0.0')) + Coalesce(Sum('total_tax'), Decimal('0.0'))
            )['total'] or 0

            # 5. Accounts Payable (AP)
            ap_balance = 0
            if settings and settings.default_payable_account:
                ap_balance = settings.default_payable_account.balance

            # 6. Pending Purchases (Confirmed but not fully received)
            pending_purchases = PurchaseOrder.objects.filter(
                status=PurchaseOrder.Status.CONFIRMED,
                receiving_status__in=[PurchaseOrder.ReceivingStatus.PENDING, PurchaseOrder.ReceivingStatus.PARTIAL]
            ).count()

            # 7. Active Production (Work Orders)
            active_production = WorkOrder.objects.filter(
                status__in=[WorkOrder.Status.PLANNED, WorkOrder.Status.IN_PROGRESS]
            ).count()

            # 8. Stockouts (Low Stock)
            # Products with track_inventory=True and stock <= 0
            stockouts = Product.objects.filter(
                track_inventory=True
            ).annotate(
                current_stock=Coalesce(Sum('stock_moves__quantity'), Decimal('0.0'))
            ).filter(
                current_stock__lte=0
            ).count()

            # 4. Recent Activity (Latest Journal Entries)
            recent_entries = JournalEntry.objects.all().order_by('-date', '-id')[:5]
            
            return Response({
                'total_sales': float(total_sales),
                'accounts_receivable': float(ar_balance),
                'sales_count': sales_count,
                'total_purchases': float(total_purchases),
                'accounts_payable': float(ap_balance),
                'pending_purchases': pending_purchases,
                'active_production': active_production,
                'stockouts': stockouts,
                'recent_activity': JournalEntrySerializer(recent_entries, many=True).data
            })
        except Exception as e:
            logger.exception("Error calculating dashboard metrics")
            return Response({"error": str(e)}, status=500)
