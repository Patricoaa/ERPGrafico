"""CostsSelector: costo de un producto según cómo entra (comprado, fabricado con/sin stock, sin BOM, solo stock)."""
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.utils import timezone

from core.prefix_registry import EntityPrefix, fmt_seq_num

from .models import Product, UoM
from .pricing_selector import _period_start
from .sales_impact_selector import _period_label
from .services import UoMService


@dataclass(frozen=True)
class CostsParams:
    date_from: date | None = None
    date_to: date | None = None
    granularity: str = "month"


PURCHASE_ITEMS_LIMIT = 50


def _next_start(start: date, granularity: str) -> date:
    if granularity == "day":
        return start + timedelta(days=1)
    if granularity == "week":
        return start + timedelta(days=7)
    if granularity == "year":
        return start.replace(year=start.year + 1)
    return (start.replace(day=28) + timedelta(days=4)).replace(day=1)


def _value_at(records: list[tuple[date, float]], day: date) -> float | None:
    """Último valor vigente al cierre de ``day``; antes del primer registro, el primer valor conocido."""
    if not records:
        return None
    value = records[0][1]
    for when, current in records:
        if when > day:
            break
        value = current
    return value


def _pct_change(new: float | None, old: float | None) -> float | None:
    if new is None or not old:
        return None
    return (new - old) / old * 100


def _mode(product: Product) -> str:
    from production.models import BillOfMaterials

    if product.product_type == Product.Type.MANUFACTURABLE:
        if not BillOfMaterials.objects.filter(product=product, active=True).exists():
            return "manufactured_no_bom"
        return "manufactured_stock" if product.track_inventory else "manufactured_on_demand"
    return "purchased" if product.can_be_purchased else "stock_only"


def _to_base_factory():
    uoms = {u.id: u for u in UoM.objects.all()}

    def to_base(qty: Decimal, from_id, to_id) -> Decimal:
        from_uom, to_uom = uoms.get(from_id), uoms.get(to_id)
        if from_uom and to_uom and from_uom.id != to_uom.id:
            try:
                return UoMService.convert_quantity(qty, from_uom, to_uom)
            except ValidationError:
                return qty
        return qty

    return to_base


def _receipts(product_ids: list[int], to_base) -> list[dict]:
    """Recepciones confirmadas con costo por unidad base, en orden cronológico."""
    from purchasing.models import PurchaseReceiptLine

    rows = []
    for line in PurchaseReceiptLine.objects.filter(product_id__in=product_ids, receipt__status="CONFIRMED").values(
        "id", "quantity_received", "uom_id", "unit_cost", "product__uom_id", "receipt__receipt_date",
        "receipt__purchase_order__supplier__name", "receipt__purchase_order_id", "receipt__purchase_order__supplier_id",
        "receipt__number",
    ).order_by("receipt__receipt_date", "id"):
        base_qty = float(to_base(Decimal(line["quantity_received"]), line["uom_id"], line["product__uom_id"]))
        if base_qty <= 0:
            continue
        cost = float(Decimal(line["quantity_received"]) * Decimal(line["unit_cost"]))
        rows.append({
            "date": line["receipt__receipt_date"], "qty": base_qty, "cost": cost, "unit_cost": cost / base_qty,
            "supplier": line["receipt__purchase_order__supplier__name"],
            "supplier_id": line["receipt__purchase_order__supplier_id"],
            "order_id": line["receipt__purchase_order_id"],
            "number": f"{EntityPrefix.PURCHASE_RECEIPT}-{fmt_seq_num(line['receipt__number'])}",
        })
    return rows


def _bom(product: Product, to_base) -> dict | None:
    """Receta activa por unidad producida, con el historial de costo de cada componente (una consulta)."""
    from production.models import BillOfMaterialsLine

    rows = list(
        BillOfMaterialsLine.objects.filter(bom__product=product, bom__active=True).values(
            "component_id", "component__name", "component__cost_price", "component__uom_id", "quantity", "uom_id",
            "is_outsourced", "unit_price", "bom__yield_quantity",
            "uom__name", "uom__name_singular", "uom__name_plural",
        ).order_by("sequence", "id")
    )
    if not rows:
        return None
    component_ids = [r["component_id"] for r in rows if not r["is_outsourced"]]
    histories: dict[int, list[tuple[date, float]]] = {cid: [] for cid in component_ids}
    for cid, moment, cost in (
        Product.history.model.objects.filter(id__in=component_ids)
        .order_by("history_date", "history_id")
        .values_list("id", "history_date", "cost_price")
    ):
        histories[cid].append((moment.date(), float(cost)))

    lines = []
    for r in rows:
        batch = Decimal(r["bom__yield_quantity"] or 1) or Decimal(1)
        qty = Decimal(r["quantity"])
        shown = qty  # as written in the LdM: the line's own quantity and unit
        if not r["is_outsourced"]:
            qty = to_base(qty, r["uom_id"], r["component__uom_id"])
        lines.append({
            "component_id": r["component_id"],
            "name": r["component__name"],
            "qty_per_unit": float(qty / batch),
            "qty_display": float(shown / batch),
            "uom_singular": r["uom__name_singular"] or r["uom__name"],
            "uom_plural": r["uom__name_plural"] or r["uom__name"],
            "fixed_price": float(r["unit_price"]) if r["is_outsourced"] else None,
            "current": float(r["unit_price"]) if r["is_outsourced"] else float(r["component__cost_price"] or 0),
            "history": histories.get(r["component_id"], []),
        })
    return {"lines": lines}


def _unit_cost_at(line: dict, day: date | None) -> float:
    if line["fixed_price"] is not None or day is None:
        return line["current"]
    value = _value_at(line["history"], day)
    return line["current"] if value is None else value


def _bom_cost_at(bom: dict, day: date | None) -> float:
    return sum(line["qty_per_unit"] * _unit_cost_at(line, day) for line in bom["lines"])


def _bom_payload(bom: dict, start: date | None) -> dict:
    total = _bom_cost_at(bom, None)
    lines, drivers = [], []
    for line in bom["lines"]:
        cost = line["qty_per_unit"] * line["current"]
        first = line["history"][0][1] if line["history"] else line["current"]
        before = _unit_cost_at(line, start) if start else first
        lines.append({
            "component_id": line["component_id"],
            "name": line["name"],
            "qty_per_unit": line["qty_per_unit"],
            "qty_display": line["qty_display"],
            "uom_singular": line["uom_singular"],
            "uom_plural": line["uom_plural"],
            "unit_cost": line["current"],
            "cost": cost,
            "share_pct": cost / total * 100 if total else 0.0,
            "change_pct": _pct_change(line["current"], before) if before else None,
            "is_outsourced": line["fixed_price"] is not None,
        })
        delta = line["qty_per_unit"] * (line["current"] - before)
        if delta > 0:
            drivers.append({"component_id": line["component_id"], "name": line["name"], "delta": delta})
    drivers.sort(key=lambda d: -d["delta"])
    return {"lines": lines, "drivers": drivers}


HISTORY_START = date(1900, 1, 1)


def _work_orders(product: Product, date_from: date | None, date_to: date) -> list[dict]:
    """Órdenes terminadas con costo real, desde el mismo cálculo que ``production-performance``."""
    from .production_performance_selector import ProductionPerformanceSelector

    perf = ProductionPerformanceSelector.get_performance(product, date_from or HISTORY_START, date_to)
    rows = []
    for o in perf["orders"]:
        if o["real_cost"] is None or not o["qty"] or not o["date"]:
            continue
        unit_real = o["real_cost"] / o["qty"]
        unit_bom = o["planned_cost"] / o["qty"] if o["planned_cost"] else None
        rows.append({
            "id": o["id"],
            "number": f"{EntityPrefix.WORK_ORDER}-{fmt_seq_num(o['number'])}",
            "date": o["date"],
            "units": o["qty"],
            "unit_real_cost": unit_real,
            "unit_bom_cost": unit_bom,
            "deviation_pct": _pct_change(unit_real, unit_bom),
        })
    return sorted(rows, key=lambda r: (r["date"], r["id"]))


class CostsSelector:
    @staticmethod
    def get_costs(product: Product, params: CostsParams) -> dict:
        product_ids = [product.id]
        if product.has_variants:
            product_ids += list(product.variants.values_list("id", flat=True))
        date_to = params.date_to or timezone.localdate()
        granularity = params.granularity
        mode = _mode(product)

        history = [
            (moment.date(), float(cost))
            for moment, cost in product.history.order_by("history_date", "history_id").values_list("history_date", "cost_price")
        ]
        to_base = _to_base_factory()
        receipts = _receipts(product_ids, to_base)
        manufactured = mode.startswith("manufactured")
        bom = _bom(product, to_base) if manufactured else None
        work_orders = _work_orders(product, params.date_from, date_to) if manufactured else []
        in_range = [r for r in receipts if (not params.date_from or r["date"] >= params.date_from) and r["date"] <= date_to]

        range_from = params.date_from or (history[0][0] if history else date_to)
        starts = {_period_start(date_to, granularity), _period_start(range_from, granularity)}
        starts |= {_period_start(day, granularity) for day, _ in history if range_from <= day <= date_to}
        starts |= {_period_start(r["date"], granularity) for r in in_range}
        starts |= {_period_start(date.fromisoformat(o["date"]), granularity) for o in work_orders}
        if bom:
            starts |= {
                _period_start(day, granularity)
                for line in bom["lines"] for day, _ in line["history"] if range_from <= day <= date_to
            }

        series = []
        for start in sorted(starts):
            close = min(_next_start(start, granularity) - timedelta(days=1), date_to)
            bucket = [r for r in in_range if _period_start(r["date"], granularity) == start]
            qty = sum(r["qty"] for r in bucket)
            made = [o for o in work_orders if _period_start(date.fromisoformat(o["date"]), granularity) == start]
            made_units = sum(o["units"] for o in made)
            series.append({
                "period": _period_label(start, granularity),
                "weighted_cost": float(product.cost_price or 0) if close >= date_to else _value_at(history, close),
                "bom_cost": _bom_cost_at(bom, close) if bom else None,
                "purchase_avg": sum(r["cost"] for r in bucket) / qty if qty else None,
                "real_avg": sum(o["unit_real_cost"] * o["units"] for o in made) / made_units if made_units else None,
            })

        weighted = float(product.cost_price or 0)
        last = receipts[-1] if receipts else None
        total_qty = sum(r["qty"] for r in in_range)
        tracks = bool(product.track_inventory)
        stock_qty = float(product.qty_on_hand) if tracks else None
        bom_today = _bom_cost_at(bom, None) if bom else None
        replacement = last["unit_cost"] if mode == "purchased" and last else None
        if mode == "manufactured_stock":
            replacement = bom_today
        if params.date_from is None:
            cost_change = None
        elif mode == "manufactured_no_bom":
            real = [p["real_avg"] for p in series if p["real_avg"] is not None]
            cost_change = _pct_change(real[-1], real[0]) if len(real) > 1 else None
        elif mode == "manufactured_on_demand" and bom:
            cost_change = _pct_change(bom_today, _bom_cost_at(bom, params.date_from))
        else:
            cost_change = _pct_change(weighted, _value_at(history, params.date_from))
        return {
            "mode": mode,
            "today": {
                "weighted_cost": weighted,
                "bom_cost": bom_today,
                "last_purchase": (
                    {"date": last["date"].isoformat(), "unit_cost": last["unit_cost"], "supplier": last["supplier"]}
                    if last else None
                ),
                "stock_qty": stock_qty,
                "stock_value": stock_qty * weighted if stock_qty is not None else None,
            },
            "kpis": {
                "cost_change_pct": cost_change,
                "replacement_gap_pct": _pct_change(replacement, weighted),
            },
            "series": series,
            "purchases": {
                "min": min((r["unit_cost"] for r in in_range), default=None),
                "max": max((r["unit_cost"] for r in in_range), default=None),
                "avg": sum(r["cost"] for r in in_range) / total_qty if total_qty else None,
                "count": len(in_range),
                "items": [
                    {
                        "date": r["date"].isoformat(), "number": r["number"], "supplier": r["supplier"],
                        "qty": r["qty"], "unit_cost": r["unit_cost"], "total": r["cost"],
                    }
                    for r in reversed(in_range[-PURCHASE_ITEMS_LIMIT:])
                ],
            },
            "bom": _bom_payload(bom, params.date_from) if bom else None,
            "work_orders": work_orders,
        }
