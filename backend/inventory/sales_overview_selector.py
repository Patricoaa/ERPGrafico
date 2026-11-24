"""SalesOverviewSelector: volumen de ventas, clientes y mezcla de un producto, con período anterior."""
from dataclasses import dataclass
from datetime import date, timedelta

from django.db.models import Count, DecimalField, ExpressionWrapper, F, Max, Q, Sum
from django.utils import timezone

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
        gross_revenue=Sum(ExpressionWrapper(F("quantity") * F("unit_price"), output_field=DecimalField(max_digits=28, decimal_places=6))),
        cost=Sum(ExpressionWrapper(F("quantity") * F("unit_cost"), output_field=DecimalField(max_digits=28, decimal_places=6))),
        customers=Count(
            "delivery__sale_order__customer_id",
            filter=Q(delivery__sale_order__customer__is_default_customer=False),
            distinct=True,
        ),
    )
    net = float(row["net_revenue"] or 0)
    gross = float(row["gross_revenue"] or 0)
    cost = float(row["cost"] or 0)
    return {
        "units": float(row["units"] or 0),
        "net_revenue": net,
        "gross_revenue": gross,
        "cost": cost,
        "customers": row["customers"] or 0,
    }


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


COUNTER_LABEL = "Mostrador (POS)"
TOP_CUSTOMERS = 10


def _grouped(lines, *fields: str) -> list[dict]:
    return list(
        lines.values(*fields)
        .annotate(units=Sum("quantity"), net_revenue=Sum(net_revenue_expression()))
        .order_by("-net_revenue")
    )


def _share(value: float, total: float) -> float:
    return value / total * 100 if total else 0.0


def _share_rows(rows: list[dict], key_field: str, labels: dict, total: float) -> list[dict]:
    return [
        {
            "key": str(r[key_field]),
            "label": labels.get(r[key_field], str(r[key_field])),
            "units": float(r["units"] or 0),
            "net_revenue": float(r["net_revenue"] or 0),
            "share_pct": _share(float(r["net_revenue"] or 0), total),
        }
        for r in rows
    ]


def _customers(lines, total: float) -> dict:
    prefix = "delivery__sale_order__customer"
    rows = _grouped(lines, f"{prefix}_id", f"{prefix}__name", f"{prefix}__is_default_customer")
    parsed = [
        {
            "id": r[f"{prefix}_id"],
            "name": COUNTER_LABEL if r[f"{prefix}__is_default_customer"] else r[f"{prefix}__name"],
            "units": float(r["units"] or 0),
            "net_revenue": float(r["net_revenue"] or 0),
            "share_pct": _share(float(r["net_revenue"] or 0), total),
            "identified": not r[f"{prefix}__is_default_customer"],
        }
        for r in rows
    ]
    identified = [c for c in parsed if c["identified"]]
    identified_total = sum(c["net_revenue"] for c in identified)
    top3 = sum(c["net_revenue"] for c in identified[:3])
    return {
        "total": len(identified),
        "top3_share_pct": _share(top3, identified_total),
        "top": [{k: v for k, v in c.items() if k != "identified"} for c in parsed[:TOP_CUSTOMERS]],
    }


def _channels(lines, total: float) -> list[dict]:
    from sales.models import SaleOrder

    return _share_rows(_grouped(lines, "sale_line__order__channel"), "sale_line__order__channel",
                       {k: str(v) for k, v in SaleOrder.Channel.choices}, total)


def _variants(lines, total: float) -> list[dict]:
    rows = _grouped(lines, "product_id")
    labels = {p.pk: p.variant_display_name or p.name for p in Product.objects.filter(pk__in=[r["product_id"] for r in rows])}
    return _share_rows(rows, "product_id", labels, total)


def _uoms(lines, total: float) -> list[dict]:
    from .models import UoM

    rows = _grouped(lines, "uom_id")
    if len(rows) < 2:
        return []
    labels = dict(UoM.objects.filter(pk__in=[r["uom_id"] for r in rows]).values_list("pk", "name"))
    return _share_rows(rows, "uom_id", labels, total)


class SalesOverviewSelector:
    @staticmethod
    def get_overview(product: Product, params: SalesOverviewParams) -> dict:
        from sales.models import SaleDeliveryLine, SaleReturnLine

        product_ids = _product_ids(product)
        date_to = params.date_to or timezone.localdate()
        lines = _lines(product_ids, params.date_from, date_to)
        totals = _totals(lines)

        previous, previous_points = None, []
        if params.date_from:
            span = date_to - params.date_from
            prev_to = params.date_from - timedelta(days=1)
            prev_lines = _lines(product_ids, prev_to - span, prev_to)
            prev_totals = _totals(prev_lines)
            prev_net = prev_totals["net_revenue"]
            prev_gross = prev_totals["gross_revenue"]
            prev_cost = prev_totals["cost"]
            has_prev_cost = float(product.cost_price or 0) > 0 or prev_cost > 0
            prev_margin_pct = (prev_net - prev_cost) / prev_net * 100 if has_prev_cost and prev_net else None
            prev_avg_discount_pct = (prev_gross - prev_net) / prev_gross * 100 if prev_gross else 0.0
            previous = {
                "units": prev_totals["units"],
                "net_revenue": prev_net,
                "customers": prev_totals["customers"],
                "margin_pct": prev_margin_pct,
                "avg_discount_pct": prev_avg_discount_pct,
            }
            previous_points = _previous_points(prev_lines, params.granularity, span + timedelta(days=1))

        has_cost = float(product.cost_price or 0) > 0 or totals["cost"] > 0
        net = totals["net_revenue"]
        gross = totals["gross_revenue"]
        cost = totals["cost"]
        margin_pct = (net - cost) / net * 100 if has_cost and net else None
        avg_discount_pct = (gross - net) / gross * 100 if gross else 0.0

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
                "units": totals["units"],
                "net_revenue": net,
                "customers": totals["customers"],
                "margin_pct": margin_pct,
                "avg_discount_pct": avg_discount_pct,
                "return_units": return_units,
                "return_rate_pct": return_units / totals["units"] * 100 if totals["units"] else 0.0,
                "last_sale_date": last_sale.isoformat() if last_sale else None,
                "days_since_last_sale": (timezone.localdate() - last_sale).days if last_sale else None,
                "previous": previous,
            },
            "series": {"points": _points(lines, params.granularity), "previous_points": previous_points},
            "customers": _customers(lines, totals["net_revenue"]),
            "channels": _channels(lines, totals["net_revenue"]),
            "variants": _variants(lines, totals["net_revenue"]) if product.has_variants else [],
            "uoms": _uoms(lines, totals["net_revenue"]),
        }
