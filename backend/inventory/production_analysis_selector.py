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
    perf = ProductionPerformanceSelector.get_performance(product, start or HISTORY_START, end)
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


def _consumption_rows(product_ids: list[int], start: date | None, end: date) -> list[dict]:
    """Consumo del insumo por día, OT y producto fabricado (producto de la OT o de su línea de venta)."""
    from django.db.models import Sum
    from django.db.models.functions import Coalesce

    from production.models import ProductionConsumption

    lines = ProductionConsumption.objects.filter(product_id__in=product_ids, date__lte=end)
    if start:
        lines = lines.filter(date__gte=start)
    rows = (
        lines.annotate(
            made_id=Coalesce("work_order__product_id", "work_order__sale_line__product_id"),
            made_name=Coalesce("work_order__product__name", "work_order__sale_line__product__name"),
        )
        .values("date", "work_order_id", "made_id", "made_name")
        .annotate(qty=Sum("quantity"))
    )
    return [
        {"day": r["date"], "order": r["work_order_id"], "made_id": r["made_id"], "made_name": r["made_name"],
         "consumed": float(r["qty"] or 0)}
        for r in rows
    ]


def _input(product: Product, product_ids: list[int], params: ProductionAnalysisParams, date_to: date) -> dict:
    from .costs_selector import _to_base_factory
    from .sourcing_selector import SourcingSelector

    rows = _consumption_rows(product_ids, params.date_from, date_to)
    previous, previous_points = None, []
    window = _previous_window(params.date_from, date_to)
    if window:
        prev_rows = _consumption_rows(product_ids, window[0], window[1])
        previous = {"consumed": sum(r["consumed"] for r in prev_rows), "orders": len({r["order"] for r in prev_rows})}
        previous_points = _buckets(prev_rows, params.granularity, ("consumed",), window[2])

    total = sum(r["consumed"] for r in rows)
    by_product: dict[int | None, dict] = {}
    for r in rows:
        entry = by_product.setdefault(r["made_id"], {
            "product_id": r["made_id"], "name": r["made_name"] or "Sin producto", "qty": 0.0,
        })
        entry["qty"] += r["consumed"]
    return {
        "kpis": {"consumed": total, "orders": len({r["order"] for r in rows}), "previous": previous},
        "series": {"points": _buckets(rows, params.granularity, ("consumed",)), "previous_points": previous_points},
        "by_product": sorted(
            ({**e, "share_pct": e["qty"] / total * 100 if total else 0.0} for e in by_product.values()),
            key=lambda e: -e["qty"],
        ),
        "used_in": SourcingSelector._used_in(product_ids, params.increase_pct, _to_base_factory()),
    }


class ProductionAnalysisSelector:
    @staticmethod
    def get_analysis(product: Product, params: ProductionAnalysisParams) -> dict:
        caps = ProductSelector.get_capabilities(product)
        date_to = params.date_to or date.today()
        product_ids = [product.id]
        if product.has_variants:
            product_ids += list(product.variants.values_list("id", flat=True))
        return {
            "made": _made(product, params, date_to) if caps["manufactures"] else None,
            "input": _input(product, product_ids, params, date_to) if caps["used_in_production"] else None,
        }
