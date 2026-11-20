"""ProcurementSelector: cobertura, compras con período anterior, proveedores y pendiente de recibir."""
from dataclasses import dataclass
from datetime import date, timedelta

from django.db.models import Sum

from .costs_selector import _receipts, _to_base_factory
from .models import Product
from .operations_selector import coverage
from .pricing_selector import _period_start
from .sales_impact_selector import _period_label


@dataclass(frozen=True)
class ProcurementParams:
    date_from: date | None = None
    date_to: date | None = None
    granularity: str = "month"


def _between(rows: list[dict], start: date | None, end: date) -> list[dict]:
    return [r for r in rows if (start is None or r["date"] >= start) and r["date"] <= end]


def _totals(rows: list[dict]) -> dict:
    return {
        "units": sum(r["qty"] for r in rows),
        "spend": sum(r["cost"] for r in rows),
        "orders": len({r["order_id"] for r in rows}),
    }


def _points(rows: list[dict], granularity: str, shift: timedelta = timedelta(0)) -> list[dict]:
    buckets: dict[date, dict] = {}
    for r in rows:
        acc = buckets.setdefault(_period_start(r["date"] + shift, granularity), {"units": 0.0, "spend": 0.0})
        acc["units"] += r["qty"]
        acc["spend"] += r["cost"]
    return [{"period": _period_label(start, granularity), **buckets[start]} for start in sorted(buckets)]


def _returned_units(product_ids: list[int], start: date | None, end: date) -> float:
    from purchasing.models import PurchaseReturnLine

    lines = PurchaseReturnLine.objects.filter(
        product_id__in=product_ids, return_doc__status="CONFIRMED", return_doc__date__lte=end
    )
    if start:
        lines = lines.filter(return_doc__date__gte=start)
    return float(lines.aggregate(q=Sum("quantity"))["q"] or 0)


class ProcurementSelector:
    @staticmethod
    def get_procurement(product: Product, params: ProcurementParams) -> dict:
        product_ids = [product.id]
        if product.has_variants:
            product_ids += list(product.variants.values_list("id", flat=True))
        date_to = params.date_to or date.today()
        receipts = _receipts(product_ids, _to_base_factory())
        in_range = _between(receipts, params.date_from, date_to)

        previous, previous_points = None, []
        if params.date_from:
            span = date_to - params.date_from
            prev_to = params.date_from - timedelta(days=1)
            prev_rows = _between(receipts, prev_to - span, prev_to)
            previous = _totals(prev_rows)
            previous_points = _points(prev_rows, params.granularity, span + timedelta(days=1))

        last = receipts[-1]["date"] if receipts else None
        return {
            "coverage": coverage(product_ids, date_to) if product.track_inventory else None,
            "kpis": {
                **_totals(in_range),
                "suppliers": len({r["supplier_id"] for r in in_range}),
                "last_purchase_date": last.isoformat() if last else None,
                "days_since_last_purchase": (date.today() - last).days if last else None,
                "returned_units": _returned_units(product_ids, params.date_from, date_to),
                "previous": previous,
            },
            "series": {"points": _points(in_range, params.granularity), "previous_points": previous_points},
            "suppliers": [],
            "preferred_supplier": None,
            "pending": [],
        }
