"""ProcurementSelector: cobertura, compras con período anterior, proveedores y pendiente de recibir."""
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal

from django.db.models import F, Sum

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


def _supplier_returns(product_ids: list[int], start: date | None, end: date) -> dict[int, float]:
    from purchasing.models import PurchaseReturnLine

    lines = PurchaseReturnLine.objects.filter(
        product_id__in=product_ids, return_doc__status="CONFIRMED", return_doc__date__lte=end
    )
    if start:
        lines = lines.filter(return_doc__date__gte=start)
    return {
        r["return_doc__purchase_order__supplier_id"]: float(r["qty"] or 0)
        for r in lines.values("return_doc__purchase_order__supplier_id").annotate(qty=Sum("quantity"))
    }


def _suppliers(rows: list[dict], returns: dict[int, float], preferred_id: int | None) -> list[dict]:
    by_supplier: dict[int, dict] = {}
    for r in rows:
        acc = by_supplier.setdefault(r["supplier_id"], {
            "id": r["supplier_id"], "name": r["supplier"], "units": 0.0, "spend": 0.0, "receipts": 0, "last_date": r["date"],
        })
        acc["units"] += r["qty"]
        acc["spend"] += r["cost"]
        acc["receipts"] += 1
        acc["last_date"] = max(acc["last_date"], r["date"])
    total = sum(s["spend"] for s in by_supplier.values())
    result = [
        {
            **s,
            "share_pct": s["spend"] / total * 100 if total else 0.0,
            "avg_unit_cost": s["spend"] / s["units"] if s["units"] else 0.0,
            "last_date": s["last_date"].isoformat(),
            "returned_units": returns.get(s["id"], 0.0),
            "preferred": s["id"] == preferred_id,
        }
        for s in by_supplier.values()
    ]
    return sorted(result, key=lambda s: -s["spend"])


def _pending(product_ids: list[int], to_base) -> list[dict]:
    """Líneas de órdenes confirmadas con cantidad aún sin recibir (estado actual), en unidad base."""
    from purchasing.models import PurchaseLine

    rows = []
    for line in PurchaseLine.objects.filter(
        product_id__in=product_ids, order__status="CONFIRMED", quantity__gt=F("quantity_received")
    ).values(
        "order_id", "order__number", "order__supplier__name", "order__date", "quantity", "quantity_received",
        "uom_id", "product__uom_id",
    ).order_by("order__date", "order_id"):
        ordered = float(to_base(Decimal(line["quantity"]), line["uom_id"], line["product__uom_id"]))
        received = float(to_base(Decimal(line["quantity_received"]), line["uom_id"], line["product__uom_id"]))
        rows.append({
            "order_id": line["order_id"], "number": line["order__number"], "supplier": line["order__supplier__name"],
            "date": line["order__date"].isoformat(), "ordered": ordered, "received": received,
            "pending": ordered - received,
        })
    return rows


class ProcurementSelector:
    @staticmethod
    def get_procurement(product: Product, params: ProcurementParams) -> dict:
        product_ids = [product.id]
        if product.has_variants:
            product_ids += list(product.variants.values_list("id", flat=True))
        date_to = params.date_to or date.today()
        to_base = _to_base_factory()
        receipts = _receipts(product_ids, to_base)
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
            "suppliers": _suppliers(
                in_range, _supplier_returns(product_ids, params.date_from, date_to), product.preferred_supplier_id
            ),
            "preferred_supplier": (
                {"id": preferred.id, "name": preferred.name} if (preferred := product.preferred_supplier) else None
            ),
            "pending": _pending(product_ids, to_base),
        }
