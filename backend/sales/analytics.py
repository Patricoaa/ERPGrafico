"""
Sale order analytics over the full filtered list (ADR-0087 lote 2b).

The frontend used to compute these figures from the orders of the visible page (20), so they
changed with the page. This service receives the same filtered queryset as the list endpoint and
walks it once, using the model's own amounts (`total_paid` / `pending_amount` go through
PaymentSelector, so they match the document sheet). Distribution ids are the model's own choice labels
(`get_*_display`); the frontend keeps only colors, trend formatting and period labels.
"""
from collections import Counter, defaultdict
from datetime import date
from decimal import Decimal

from django.db.models import QuerySet
from django.utils import timezone

from core import analytics as stats

PRICE_RANGES = [
    ("Hasta $50k", 0, 50_000),
    ("$50k - $200k", 50_000, 200_000),
    ("$200k - $500k", 200_000, 500_000),
    ("$500k - $1M", 500_000, 1_000_000),
    ("$1M - $5M", 1_000_000, 5_000_000),
    ("Más de $5M", 5_000_000, None),
]
TOP_CUSTOMERS = 10


class SaleOrderAnalyticsService:
    @staticmethod
    def compute(queryset: QuerySet, *, granularity: str = "month", today: date | None = None) -> dict:
        granularity = granularity if granularity in stats.GRANULARITIES else "month"
        # Local date (TIME_ZONE): the container clock is UTC and would shift "today" in the evening.
        current = stats.bucket(today or timezone.localdate(), granularity)
        previous = stats.previous_bucket(current, granularity)

        zero = Decimal(0)
        money: defaultdict[str, Decimal] = defaultdict(Decimal)
        counts: Counter[str] = Counter()
        channel: Counter[str] = Counter()
        payment: Counter[str] = Counter()
        delivery: Counter[str] = Counter()
        customer_totals: dict[int | None, dict] = {}
        products: dict[str, dict] = {}
        product_types: defaultdict[str, Decimal] = defaultdict(Decimal)
        periods: dict[date, dict] = {}
        trend = {key: {"volume": zero, "paid": zero, "count": 0} for key in ("current", "previous")}
        ranges: Counter[tuple] = Counter()

        for order in queryset:
            total = stats.num(order.total)
            paid = stats.num(order.total_paid)  # PaymentSelector once per order; pending derives from it
            is_pos = order.channel == "POS"
            money["volume"] += total
            money["paid"] += paid
            money["pending"] += stats.num(order.effective_total) - paid
            counts["orders"] += 1
            if order.delivery_status == "DELIVERED":
                counts["delivered"] += 1
            elif order.status != "CANCELLED":
                counts["pending_delivery"] += 1
            counts["pos" if is_pos else "system"] += 1

            channel[order.get_channel_display()] += 1
            payment["POS (Efectivo/Tarjeta)" if order.pos_session_id else (order.get_payment_method_display() or "Sin método")] += 1
            delivery[order.get_delivery_status_display()] += 1

            # By contact id: two customers with the same name are different customers.
            name = order.customer.name if order.customer_id else ""
            entry = customer_totals.setdefault(order.customer_id, {"customer": name, "total": zero, "order_count": 0})
            entry["total"] += total
            entry["order_count"] += 1

            for _, low, high in PRICE_RANGES:
                if total >= low and (high is None or total < high):
                    ranges[(low, high)] += 1
                    break

            for line in order.lines.all():
                subtotal = stats.num(line.subtotal)
                if not subtotal:
                    continue
                product = line.product
                key = product.name if product else (line.description or "")
                item = products.setdefault(key, {"product": key, "total": zero, "count": zero})
                item["total"] += subtotal
                item["count"] += stats.num(line.quantity)
                product_types[product.get_product_type_display() if product else "General"] += subtotal

            if not order.date:
                continue
            bucket = stats.bucket(order.date, granularity)
            period = periods.setdefault(
                bucket, {"bucket": bucket.isoformat(), "total": zero, "count": 0, "net": zero, "system": zero, "pos": zero, "delivered": 0}
            )
            period["total"] += total
            period["count"] += 1
            period["net"] += stats.num(order.total_net)
            period["pos" if is_pos else "system"] += total
            if order.delivery_status == "DELIVERED":
                period["delivered"] += 1
            for key, ref in (("current", current), ("previous", previous)):
                if bucket == ref:
                    trend[key]["volume"] += total
                    trend[key]["paid"] += paid
                    trend[key]["count"] += 1

        count = counts["orders"]
        ranked_customers = sorted(customer_totals.values(), key=lambda c: c["total"], reverse=True)
        top, rest = ranked_customers[:TOP_CUSTOMERS], ranked_customers[TOP_CUSTOMERS:]
        if rest:
            # The whole list can hold thousands of customers: the chart gets the top N plus "Otros".
            top.append({"customer": "Otros", "total": sum((c["total"] for c in rest), zero), "order_count": sum(c["order_count"] for c in rest)})
        return stats.to_json({
            "granularity": granularity,
            "totals": {
                "total_volume": money["volume"],
                "total_paid": money["paid"],
                "total_pending": money["pending"],
                "order_count": count,
                "avg_order_value": money["volume"] / count if count else zero,
                "customer_count": len([key for key in customer_totals if key is not None]),
                "delivered_count": counts["delivered"],
                "pending_delivery_count": counts["pending_delivery"],
                "pos_order_count": counts["pos"],
                "system_order_count": counts["system"],
            },
            "trend": trend,
            "channel": stats.ranked(channel),
            "payment_method": stats.ranked(payment),
            "delivery_status": stats.ranked(delivery),
            "customers": top,
            "products": sorted(products.values(), key=lambda p: p["total"], reverse=True)[:8],
            "product_types": stats.ranked(product_types),
            "periods": [periods[k] for k in sorted(periods)],
            "price_ranges": [
                {"id": label, "value": ranges[(low, high)]} for label, low, high in PRICE_RANGES if ranges[(low, high)]
            ],
        })

