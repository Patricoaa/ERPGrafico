"""CostsSelector: costo de un producto según cómo entra (comprado, fabricado con/sin stock, sin BOM, solo stock)."""
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal

from django.core.exceptions import ValidationError

from .models import Product, UoM
from .pricing_selector import _period_start
from .sales_impact_selector import _period_label
from .services import UoMService


@dataclass(frozen=True)
class CostsParams:
    date_from: date | None = None
    date_to: date | None = None
    granularity: str = "month"


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
        "receipt__purchase_order__supplier__name",
    ).order_by("receipt__receipt_date", "id"):
        base_qty = float(to_base(Decimal(line["quantity_received"]), line["uom_id"], line["product__uom_id"]))
        if base_qty <= 0:
            continue
        cost = float(Decimal(line["quantity_received"]) * Decimal(line["unit_cost"]))
        rows.append({
            "date": line["receipt__receipt_date"], "qty": base_qty, "cost": cost, "unit_cost": cost / base_qty,
            "supplier": line["receipt__purchase_order__supplier__name"],
        })
    return rows


class CostsSelector:
    @staticmethod
    def get_costs(product: Product, params: CostsParams) -> dict:
        product_ids = [product.id]
        if product.has_variants:
            product_ids += list(product.variants.values_list("id", flat=True))
        date_to = params.date_to or date.today()
        granularity = params.granularity
        mode = _mode(product)

        history = [
            (moment.date(), float(cost))
            for moment, cost in product.history.order_by("history_date", "history_id").values_list("history_date", "cost_price")
        ]
        receipts = _receipts(product_ids, _to_base_factory())
        in_range = [r for r in receipts if (not params.date_from or r["date"] >= params.date_from) and r["date"] <= date_to]

        range_from = params.date_from or (history[0][0] if history else date_to)
        starts = {_period_start(date_to, granularity), _period_start(range_from, granularity)}
        starts |= {_period_start(day, granularity) for day, _ in history if range_from <= day <= date_to}
        starts |= {_period_start(r["date"], granularity) for r in in_range}

        series = []
        for start in sorted(starts):
            close = min(_next_start(start, granularity) - timedelta(days=1), date_to)
            bucket = [r for r in in_range if _period_start(r["date"], granularity) == start]
            qty = sum(r["qty"] for r in bucket)
            series.append({
                "period": _period_label(start, granularity),
                "weighted_cost": _value_at(history, close),
                "bom_cost": None,
                "purchase_avg": sum(r["cost"] for r in bucket) / qty if qty else None,
                "real_avg": None,
            })

        weighted = float(product.cost_price or 0)
        last = receipts[-1] if receipts else None
        total_qty = sum(r["qty"] for r in in_range)
        tracks = bool(product.track_inventory)
        stock_qty = float(product.qty_on_hand) if tracks else None
        replacement = last["unit_cost"] if mode == "purchased" and last else None
        return {
            "mode": mode,
            "today": {
                "weighted_cost": weighted,
                "bom_cost": None,
                "last_purchase": (
                    {"date": last["date"].isoformat(), "unit_cost": last["unit_cost"], "supplier": last["supplier"]}
                    if last else None
                ),
                "stock_qty": stock_qty,
                "stock_value": stock_qty * weighted if stock_qty is not None else None,
            },
            "kpis": {
                "cost_change_pct": (
                    _pct_change(weighted, _value_at(history, params.date_from)) if params.date_from else None
                ),
                "replacement_gap_pct": _pct_change(replacement, weighted),
            },
            "series": series,
            "purchases": {
                "min": min((r["unit_cost"] for r in in_range), default=None),
                "max": max((r["unit_cost"] for r in in_range), default=None),
                "avg": sum(r["cost"] for r in in_range) / total_qty if total_qty else None,
                "count": len(in_range),
            },
            "bom": None,
            "work_orders": [],
        }
