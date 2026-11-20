"""SalesOverviewSelector: volumen de ventas, clientes y mezcla de un producto, con período anterior."""
from dataclasses import dataclass
from datetime import date, timedelta

from django.db.models import Count, F, Max, Sum

from .models import Product
from .pricing_selector import _lines, _period_start
from .sales_impact_selector import _period_expression, _period_label, net_revenue_expression


@dataclass(frozen=True)
class SalesOverviewParams:
    date_from: date | None = None
    date_to: date | None = None
    granularity: str = "month"


def _product_ids(product: Product) -> list[int]:
    ids = [product.id]
    if product.has_variants:
        ids += list(product.variants.values_list("id", flat=True))
    return ids


def _totals(lines) -> dict:
    row = lines.aggregate(
        units=Sum("quantity"),
        net_revenue=Sum(net_revenue_expression()),
        customers=Count("delivery__sale_order__customer_id", distinct=True),
    )
    return {"units": float(row["units"] or 0), "net_revenue": float(row["net_revenue"] or 0), "customers": row["customers"] or 0}


def _points(lines, granularity: str) -> list[dict]:
    rows = (
        lines.annotate(period=_period_expression(granularity))
        .values("period")
        .annotate(units=Sum("quantity"), net_revenue=Sum(net_revenue_expression()))
        .order_by("period")
    )
    return [
        {"period": _period_label(r["period"], granularity), "units": float(r["units"] or 0), "net_revenue": float(r["net_revenue"] or 0)}
        for r in rows
    ]


def _previous_points(lines, granularity: str, shift: timedelta) -> list[dict]:
    """Ventas del período anterior con las fechas desplazadas hacia adelante, para alinear con los períodos actuales."""
    buckets: dict[date, dict] = {}
    rows = (
        lines.annotate(day=F("delivery__delivery_date"))
        .values("day")
        .annotate(units=Sum("quantity"), net_revenue=Sum(net_revenue_expression()))
    )
    for r in rows:
        start = _period_start(r["day"] + shift, granularity)
        acc = buckets.setdefault(start, {"units": 0.0, "net_revenue": 0.0})
        acc["units"] += float(r["units"] or 0)
        acc["net_revenue"] += float(r["net_revenue"] or 0)
    return [{"period": _period_label(start, granularity), **buckets[start]} for start in sorted(buckets)]


class SalesOverviewSelector:
    @staticmethod
    def get_overview(product: Product, params: SalesOverviewParams) -> dict:
        from sales.models import SaleDeliveryLine, SaleReturnLine

        product_ids = _product_ids(product)
        date_to = params.date_to or date.today()
        lines = _lines(product_ids, params.date_from, date_to)
        totals = _totals(lines)

        previous, previous_points = None, []
        if params.date_from:
            span = date_to - params.date_from
            prev_to = params.date_from - timedelta(days=1)
            prev_lines = _lines(product_ids, prev_to - span, prev_to)
            previous = _totals(prev_lines)
            previous_points = _previous_points(prev_lines, params.granularity, span + timedelta(days=1))

        returns = SaleReturnLine.objects.filter(
            product_id__in=product_ids, return_doc__status="CONFIRMED", return_doc__date__lte=date_to,
            **({"return_doc__date__gte": params.date_from} if params.date_from else {}),
        ).aggregate(units=Sum("quantity"))
        return_units = float(returns["units"] or 0)

        last_sale = SaleDeliveryLine.objects.filter(
            product_id__in=product_ids, delivery__status="CONFIRMED"
        ).aggregate(last=Max("delivery__delivery_date"))["last"]

        return {
            "kpis": {
                **totals,
                "return_units": return_units,
                "return_rate_pct": return_units / totals["units"] * 100 if totals["units"] else 0.0,
                "last_sale_date": last_sale.isoformat() if last_sale else None,
                "days_since_last_sale": (date.today() - last_sale).days if last_sale else None,
                "previous": previous,
            },
            "series": {"points": _points(lines, params.granularity), "previous_points": previous_points},
            "customers": {"total": 0, "top3_share_pct": 0.0, "top": []},
            "channels": [],
            "variants": [],
            "uoms": [],
        }
