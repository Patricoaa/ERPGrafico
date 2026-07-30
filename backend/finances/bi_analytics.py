import datetime
from decimal import Decimal

from django.db.models import Count, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone


class BIAnalyticsService:
    """Read-only cross-module analytics for the BI dashboard."""

    @staticmethod
    def get_bi_analytics(start_date=None, end_date=None):
        """Aggregates cross-module data for BI Analytics."""
        from billing.models import Invoice
        from inventory.models import Product, ProductCategory, StockMove
        from purchasing.models import PurchaseOrder
        from sales.models import SaleOrder

        if not end_date:
            end_date = timezone.now().date()
        if not start_date:
            start_date = end_date - datetime.timedelta(days=180)

        period_length = (end_date - start_date).days or 1
        prev_end = start_date - datetime.timedelta(days=1)
        prev_start = prev_end - datetime.timedelta(days=period_length)

        # ── 1. Sales Analytics ──
        ACTIVE_SALE_STATUSES = ["CONFIRMED", "INVOICED", "PAID"]
        sales_qs = SaleOrder.objects.filter(
            date__range=(start_date, end_date), status__in=ACTIVE_SALE_STATUSES
        )
        total_sales = sales_qs.aggregate(total=Sum("total"))["total"] or Decimal("0.00")
        sales_count = sales_qs.count()

        prev_sales_qs = SaleOrder.objects.filter(
            date__range=(prev_start, prev_end), status__in=ACTIVE_SALE_STATUSES
        )
        prev_total_sales = prev_sales_qs.aggregate(total=Sum("total"))["total"] or Decimal("0.00")
        if prev_total_sales > 0:
            growth = round(float((total_sales - prev_total_sales) / prev_total_sales * 100), 1)
        else:
            growth = 0.0

        monthly_sales = (
            sales_qs.annotate(month=TruncMonth("date"))
            .values("month")
            .annotate(total=Sum("total"))
            .order_by("month")
        )
        trend = [
            {"month": ms["month"].strftime("%b"), "sales": float(ms["total"])}
            for ms in monthly_sales
        ]

        top_customers_qs = (
            sales_qs.values("customer__name").annotate(total=Sum("total")).order_by("-total")[:5]
        )
        top_customers = [
            {"name": c["customer__name"], "amount": float(c["total"])} for c in top_customers_qs
        ]

        channel_dist = (
            sales_qs.values("channel").annotate(total=Sum("total"), count=Count("id")).order_by("-total")
        )
        sales_by_channel = [
            {"channel": row["channel"], "total": float(row["total"]), "count": row["count"]}
            for row in channel_dist
        ]

        pending_deliveries = sales_qs.filter(
            status="CONFIRMED", delivery_status__in=["PENDING", "PARTIAL"]
        ).count()

        # ── 2. Purchase Analytics ──
        po_qs = PurchaseOrder.objects.filter(date__range=(start_date, end_date))
        purchase_total = (
            po_qs.filter(status__in=["CONFIRMED", "RECEIVED", "INVOICED", "PAID"])
            .aggregate(total=Sum("total"))["total"] or Decimal("0")
        )
        purchase_count = po_qs.exclude(status="CANCELLED").count()

        po_by_status = (
            po_qs.exclude(status="CANCELLED")
            .values("status")
            .annotate(count=Count("id"), total=Sum("total"))
            .order_by("status")
        )
        purchase_status_dist = [
            {"status": row["status"], "count": row["count"], "total": float(row["total"] or 0)}
            for row in po_by_status
        ]

        top_suppliers_qs = (
            po_qs.filter(status__in=["CONFIRMED", "RECEIVED", "INVOICED", "PAID"])
            .values("supplier__name")
            .annotate(total=Sum("total"))
            .order_by("-total")[:5]
        )
        top_suppliers = [
            {"name": s["supplier__name"], "amount": float(s["total"])} for s in top_suppliers_qs
        ]

        # ── 3. Inventory Analytics ──
        products = Product.objects.filter(product_type="STORABLE", track_inventory=True)
        total_inventory_value = Decimal("0")

        dist = []
        categories = ProductCategory.objects.all()
        for cat in categories:
            cat_products = products.filter(category=cat)
            cat_val = Decimal("0")
            items_count = 0
            for p in cat_products:
                balance = (
                    StockMove.objects.filter(product=p, date__lte=end_date).aggregate(
                        total=Sum("quantity")
                    )["total"] or Decimal("0")
                )
                item_val = Decimal(str(balance)) * p.cost_price
                cat_val += item_val
                total_inventory_value += item_val
                if balance > 0:
                    items_count += 1
            if cat_val > 0:
                dist.append({"category": cat.name, "value": float(cat_val), "items": items_count})

        # ── 4. Production Analytics ──
        from production.models import WorkOrder

        wo_qs = WorkOrder.objects.filter(created_at__date__range=(start_date, end_date))
        wo_all = WorkOrder.objects.all()
        finished_wo = wo_qs.filter(status="FINISHED").count()
        in_progress_wo = wo_all.filter(status="IN_PROGRESS").count()
        total_wo_period = wo_qs.exclude(status="CANCELLED").count()
        prod_efficiency = (finished_wo / total_wo_period * 100) if total_wo_period > 0 else 0

        stage_dist = (
            wo_all.filter(status="IN_PROGRESS")
            .values("current_stage")
            .annotate(count=Count("id"))
            .order_by("current_stage")
        )
        wo_stage_dist = [{"stage": row["current_stage"], "count": row["count"]} for row in stage_dist]

        # ── 5. Billing / Receivables & Payables ──
        PRIMARY_DTE = [
            Invoice.DTEType.FACTURA,
            Invoice.DTEType.FACTURA_EXENTA,
            Invoice.DTEType.BOLETA,
            Invoice.DTEType.BOLETA_EXENTA,
        ]
        ar_total = (
            Invoice.objects.filter(
                status="POSTED", sale_order__isnull=False, dte_type__in=PRIMARY_DTE
            ).aggregate(total=Sum("total"))["total"] or Decimal("0")
        )
        ap_total = (
            Invoice.objects.filter(
                status="POSTED", purchase_order__isnull=False, dte_type=Invoice.DTEType.PURCHASE_INV
            ).aggregate(total=Sum("total"))["total"] or Decimal("0")
        )
        invoiced_period = (
            Invoice.objects.filter(
                date__range=(start_date, end_date),
                status__in=["POSTED", "PAID"],
                dte_type__in=PRIMARY_DTE,
                sale_order__isnull=False,
            ).aggregate(total=Sum("total"))["total"] or Decimal("0")
        )

        # ── 6. Treasury Cash Flow ──
        try:
            from treasury.models import TreasuryMovement
            tm_qs = TreasuryMovement.objects.filter(
                date__range=(start_date, end_date),
                status="POSTED",
            )
            cash_inbound = (
                tm_qs.filter(movement_type="INBOUND").aggregate(total=Sum("amount"))["total"] or Decimal("0")
            )
            cash_outbound = (
                tm_qs.filter(movement_type="OUTBOUND").aggregate(total=Sum("amount"))["total"] or Decimal("0")
            )
            net_cash_flow = float(cash_inbound) - float(cash_outbound)

            monthly_cf = (
                tm_qs.filter(movement_type__in=["INBOUND", "OUTBOUND"])
                .annotate(month=TruncMonth("date"))
                .values("month", "movement_type")
                .annotate(total=Sum("amount"))
                .order_by("month", "movement_type")
            )
            cf_by_month = {}
            for row in monthly_cf:
                key = row["month"].strftime("%b")
                if key not in cf_by_month:
                    cf_by_month[key] = {"month": key, "ingresos": 0.0, "egresos": 0.0}
                if row["movement_type"] == "INBOUND":
                    cf_by_month[key]["ingresos"] = float(row["total"])
                else:
                    cf_by_month[key]["egresos"] = float(row["total"])
            cash_flow_trend = list(cf_by_month.values())
        except Exception:
            cash_inbound = Decimal("0")
            cash_outbound = Decimal("0")
            net_cash_flow = 0.0
            cash_flow_trend = []

        # ── 7. Payroll / Labour Cost ──
        try:
            from django.db.models import Q as Q2
            from hr.models import Payroll

            payroll_qs = Payroll.objects.filter(
                period_year__gte=start_date.year,
                status="POSTED",
            )
            payroll_qs = payroll_qs.filter(
                Q2(period_year__gt=start_date.year)
                | Q2(period_year=start_date.year, period_month__gte=start_date.month)
            ).filter(
                Q2(period_year__lt=end_date.year)
                | Q2(period_year=end_date.year, period_month__lte=end_date.month)
            )
            payroll_total = payroll_qs.aggregate(total=Sum("total_haberes"))["total"] or Decimal("0")
            employee_count = payroll_qs.values("employee").distinct().count()
        except Exception:
            payroll_total = Decimal("0")
            employee_count = 0

        return {
            "sales": {
                "total_sales": float(total_sales),
                "prev_total_sales": float(prev_total_sales),
                "sales_count": sales_count,
                "growth": growth,
                "monthly_trend": trend,
                "top_customers": top_customers,
                "sales_by_channel": sales_by_channel,
                "pending_deliveries": pending_deliveries,
                "invoiced_period": float(invoiced_period),
            },
            "purchasing": {
                "purchase_total": float(purchase_total),
                "purchase_count": purchase_count,
                "status_distribution": purchase_status_dist,
                "top_suppliers": top_suppliers,
            },
            "inventory": {
                "total_value": float(total_inventory_value),
                "item_count": products.count(),
                "stock_distribution": dist,
            },
            "production": {
                "total_wo": total_wo_period,
                "finished_wo": finished_wo,
                "in_progress_wo": in_progress_wo,
                "efficiency": round(prod_efficiency, 1),
                "stage_distribution": wo_stage_dist,
            },
            "billing": {
                "ar_total": float(ar_total),
                "ap_total": float(ap_total),
            },
            "treasury": {
                "cash_inbound": float(cash_inbound),
                "cash_outbound": float(cash_outbound),
                "net_cash_flow": net_cash_flow,
                "cash_flow_trend": cash_flow_trend,
            },
            "payroll": {
                "total_cost": float(payroll_total),
                "employee_count": employee_count,
            },
        }
