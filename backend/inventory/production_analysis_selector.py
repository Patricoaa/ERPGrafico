"""ProductionAnalysisSelector: rol fabricado (OT, unidades, rectificación, insumos) y rol insumo (consumo, uso en BOM)."""
from dataclasses import dataclass
from datetime import date, timedelta

from .models import Product
from .pricing_selector import _period_start
from .production_performance_selector import ProductionPerformanceSelector
from .sales_impact_selector import _period_label
from .selectors import ProductSelector

INCREASE_CHOICES = (5, 10, 20)
HISTORY_START = date(1900, 1, 1)


@dataclass(frozen=True)
class ProductionAnalysisParams:
    date_from: date | None = None
    date_to: date | None = None
    granularity: str = "month"
    increase_pct: int = 10


def _previous_window(date_from: date | None, date_to: date) -> tuple[date, date, timedelta] | None:
    if not date_from:
        return None
    span = date_to - date_from
    prev_to = date_from - timedelta(days=1)
    return prev_to - span, prev_to, span + timedelta(days=1)


def _buckets(rows: list[dict], granularity: str, fields: tuple[str, ...], shift: timedelta = timedelta(0)) -> list[dict]:
    acc: dict[date, dict] = {}
    for r in rows:
        bucket = acc.setdefault(_period_start(r["day"] + shift, granularity), {f: 0.0 for f in fields})
        for f in fields:
            bucket[f] += r[f]
    return [{"period": _period_label(start, granularity), **acc[start]} for start in sorted(acc)]


def _finished_orders(product: Product, start: date | None, end: date) -> tuple[list[dict], list[dict]]:
    """Órdenes terminadas (con fecha) y materiales del rango, del mismo cálculo que ``production-performance``."""
    # get_bom_cost() reads the active BOM: prefetch it so the other selector does not query each component.
    prefetched = Product.objects.prefetch_related("boms__lines__component__uom", "boms__lines__uom").get(pk=product.pk)
    perf = ProductionPerformanceSelector.get_performance(prefetched, start or HISTORY_START, end)
    orders = [
        {"id": o["id"], "number": o["number"], "day": date.fromisoformat(o["date"]), "units": o["qty"],
         "orders": 1.0, "rectified": o["rectified"]}
        for o in perf["orders"] if o["date"]
    ]
    return orders, perf["materials"]


def _made(product: Product, params: ProductionAnalysisParams, date_to: date) -> dict:
    orders, materials = _finished_orders(product, params.date_from, date_to)
    previous, previous_points = None, []
    window = _previous_window(params.date_from, date_to)
    if window:
        prev_orders, _ = _finished_orders(product, window[0], window[1])
        previous = {"orders": len(prev_orders), "units": sum(o["units"] for o in prev_orders)}
        previous_points = _buckets(prev_orders, params.granularity, ("orders", "units"), window[2])

    count = len(orders)
    rectified = sum(1 for o in orders if o["rectified"])
    rows = []
    for m in materials:
        planned, consumed = m["planned_qty"], m["consumed_qty"]
        rows.append({
            "component_id": m["component_id"], "name": m["name"], "planned_qty": planned, "consumed_qty": consumed,
            "deviation_qty": consumed - planned,
            "deviation_pct": (consumed - planned) / planned * 100 if planned else None,
        })
    rows.sort(key=lambda r: -abs(r["deviation_qty"]))
    return {
        "kpis": {
            "orders": count,
            "units": sum(o["units"] for o in orders),
            "rectified": rectified,
            "rectification_rate": rectified / count * 100 if count else 0.0,
            "previous": previous,
        },
        "series": {
            "points": [
                {**p, "orders": int(p["orders"])} for p in _buckets(orders, params.granularity, ("orders", "units"))
            ],
            "previous_points": [{**p, "orders": int(p["orders"])} for p in previous_points],
        },
        "materials": rows,
        "orders": [
            {"id": o["id"], "number": o["number"], "date": o["day"].isoformat(), "units": o["units"], "rectified": o["rectified"]}
            for o in sorted(orders, key=lambda o: (o["day"], o["id"]))
        ],
    }


class ProductionAnalysisSelector:
    @staticmethod
    def get_analysis(product: Product, params: ProductionAnalysisParams) -> dict:
        caps = ProductSelector.get_capabilities(product)
        date_to = params.date_to or date.today()
        return {
            "made": _made(product, params, date_to) if caps["manufactures"] else None,
            "input": None,
        }
