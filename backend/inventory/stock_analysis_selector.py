"""StockAnalysisSelector: existencia, comprometido, rotación, flujos, ajustes, bodegas y variantes de un producto."""
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, timedelta

from django.db.models import F, Max, Min, Sum
from django.utils import timezone

from .costs_selector import _next_start
from .models import ADJUSTMENT_VIRTUAL_NAMES, Product, Stock, StockMove
from .operations_selector import OperationsSelector, _StockCurve, coverage
from .pricing_selector import _period_start
from .sales_impact_selector import _period_label
from .selectors import ProductSelector

IDLE_DAYS_CHOICES = (30, 90, 180)
_ROTATION_KEYS = (
    "in_qty", "out_qty", "avg_stock", "turnover", "days_of_inventory", "last_in_date", "last_out_date", "idle", "idle_days",
)


@dataclass(frozen=True)
class StockAnalysisParams:
    date_from: date | None = None
    date_to: date | None = None
    granularity: str = "month"
    idle_days: int = 90


def _on_hand(product_ids: list[int]) -> dict[int, float]:
    rows = Stock.objects.filter(product_id__in=product_ids).values("product_id").annotate(qty=Sum("quantity"))
    return {r["product_id"]: float(r["qty"] or 0) for r in rows}


def _reserved(product_ids: list[int]) -> dict[int, float]:
    """Comprometido por producto con las mismas fuentes que ``Product.get_qty_reserved``, en consultas agregadas."""
    from production.models import WorkOrder, WorkOrderMaterial
    from sales.models import DraftCart, SaleLine, SaleOrder

    reserved: dict[int, float] = defaultdict(float)
    for row in (
        SaleLine.objects.filter(product_id__in=product_ids, order__status=SaleOrder.Status.CONFIRMED)
        .exclude(order__delivery_status=SaleOrder.DeliveryStatus.DELIVERED)
        .values("product_id").annotate(qty=Sum(F("quantity") - F("quantity_delivered")))
    ):
        reserved[row["product_id"]] += float(row["qty"] or 0)

    wanted = set(product_ids)
    for items in DraftCart.objects.filter(pos_session__status="OPEN").values_list("items", flat=True):
        for item in items if isinstance(items, list) else []:
            raw_id = item.get("id") or item.get("product_id")
            try:
                product_id = int(raw_id)
            except (TypeError, ValueError):
                continue
            if product_id in wanted:
                reserved[product_id] += float(item.get("quantity", 0) or 0)

    for row in (
        WorkOrderMaterial.objects.filter(
            component_id__in=product_ids,
            work_order__status__in=[WorkOrder.Status.DRAFT, WorkOrder.Status.IN_PROGRESS],
            quantity_planned__gt=F("quantity_consumed"),
        ).values("component_id").annotate(qty=Sum(F("quantity_planned") - F("quantity_consumed")))
    ):
        reserved[row["component_id"]] += float(row["qty"] or 0)
    return reserved


def _range_start(product_ids: list[int], date_from: date | None, date_to: date) -> date:
    if date_from:
        return date_from
    return StockMove.objects.filter(product_id__in=product_ids).aggregate(first=Min("date"))["first"] or date_to


def _rotation(product: Product, product_ids: list[int], start: date, date_to: date, idle_days: int) -> dict:
    full = OperationsSelector._rotation(product, product_ids, start, date_to, idle_days)
    return {key: full[key] for key in _ROTATION_KEYS}


_OUT_KEYS = {"CUSTOMER": "sale", "VIRTUAL": "production", "VENDOR": "supplier_return"}
_IN_KEYS = {"VENDOR": "purchase", "VIRTUAL": "production", "CUSTOMER": "customer_return"}
_FLOW_LABELS = {
    "sale": "Ventas", "production": "Producción", "supplier_return": "Devolución a proveedor",
    "purchase": "Compras", "customer_return": "Devolución de cliente", "other": "Otros",
}
_ADJUSTMENT_KEYS = dict(zip(ADJUSTMENT_VIRTUAL_NAMES, ("loss", "gain", "revaluation"), strict=True))
_ADJUSTMENT_LABELS = {"loss": "Merma", "gain": "Sobrante", "revaluation": "Revalorización"}


def _classified_moves(product_ids: list[int], start: date, end: date):
    _, _, flow = ProductSelector._flow_case()
    return StockMove.objects.filter(product_id__in=product_ids, date__range=(start, end)).annotate(flow=flow)


def _series(product_ids: list[int], start: date, end: date, granularity: str) -> list[dict]:
    _, history = ProductSelector._stock_flow(product_ids)
    curve = _StockCurve(history)
    daily = defaultdict(lambda: {"IN": 0.0, "OUT": 0.0})
    for row in (
        _classified_moves(product_ids, start, end).filter(flow__in=("IN", "OUT"))
        .values("date", "flow").annotate(qty=Sum("quantity"))
    ):
        daily[_period_start(row["date"], granularity)][row["flow"]] += float(row["qty"] or 0)
    points, current = [], _period_start(start, granularity)
    while current <= end:
        close = min(_next_start(current, granularity), end + timedelta(days=1)) - timedelta(days=1)
        points.append({
            "period": _period_label(current, granularity),
            "stock_end": curve.at(close),
            "in_qty": daily[current]["IN"],
            "out_qty": daily[current]["OUT"],
        })
        current = _next_start(current, granularity)
    return points


def _flows(product_ids: list[int], start: date, end: date) -> dict:
    out: dict[str, float] = defaultdict(float)
    inn: dict[str, float] = defaultdict(float)
    for row in (
        _classified_moves(product_ids, start, end).filter(flow__in=("IN", "OUT"))
        .values("flow", "source_location__location_type", "destination_location__location_type")
        .annotate(qty=Sum("quantity"))
    ):
        qty = float(row["qty"] or 0)
        if row["flow"] == "OUT":
            out[_OUT_KEYS.get(row["destination_location__location_type"], "other")] += qty
        else:
            inn[_IN_KEYS.get(row["source_location__location_type"], "other")] += qty

    def rows(acc: dict[str, float]) -> list[dict]:
        return [{"key": k, "label": _FLOW_LABELS[k], "qty": v} for k, v in sorted(acc.items(), key=lambda kv: -kv[1])]

    return {"outflows": rows(out), "inflows": rows(inn)}


def _adjustments(product_ids: list[int], start: date, end: date) -> list[dict]:
    acc: dict[str, dict] = {}
    for row in (
        _classified_moves(product_ids, start, end).filter(flow="ADJUSTMENT")
        .values("source_location__name", "destination_location__name")
        .annotate(qty=Sum("quantity"), value=Sum(F("quantity") * F("unit_cost")))
    ):
        name = row["source_location__name"] if row["source_location__name"] in _ADJUSTMENT_KEYS else row["destination_location__name"]
        key = _ADJUSTMENT_KEYS.get(name)
        if not key:
            continue
        entry = acc.setdefault(key, {"key": key, "label": _ADJUSTMENT_LABELS[key], "qty": 0.0, "value": 0.0})
        entry["qty"] += float(row["qty"] or 0)
        entry["value"] += float(row["value"] or 0)
    return [acc[k] for k in ("loss", "gain", "revaluation") if k in acc]


def _warehouses(product_ids: list[int], date_to: date, idle_days: int) -> list[dict]:
    rows: dict[int, dict] = {}
    for r in Stock.objects.filter(product_id__in=product_ids).values("warehouse_id", "warehouse__name").annotate(qty=Sum("quantity")):
        rows[r["warehouse_id"]] = {"id": r["warehouse_id"], "name": r["warehouse__name"], "on_hand": float(r["qty"] or 0), "last": None}
    moves = StockMove.objects.filter(product_id__in=product_ids, date__lte=date_to)
    for side in ("source_location", "destination_location"):
        for r in (
            moves.filter(**{f"{side}__warehouse__isnull": False})
            .values(f"{side}__warehouse_id", f"{side}__warehouse__name").annotate(last=Max("date"))
        ):
            entry = rows.setdefault(r[f"{side}__warehouse_id"], {
                "id": r[f"{side}__warehouse_id"], "name": r[f"{side}__warehouse__name"], "on_hand": 0.0, "last": None,
            })
            entry["last"] = max(filter(None, (entry["last"], r["last"])))
    result = []
    for entry in sorted(rows.values(), key=lambda w: (-w["on_hand"], w["name"])):
        last = entry.pop("last")
        result.append({
            **entry,
            "last_move_date": last.isoformat() if last else None,
            "idle": entry["on_hand"] > 0 and (last is None or (date_to - last).days >= idle_days),
        })
    return result


def _variants(product: Product, on_hand: dict[int, float], reserved: dict[int, float]) -> list[dict]:
    rows = []
    for variant in product.variants.values("id", "name", "variant_display_name").order_by("id"):
        qty, held = on_hand.get(variant["id"], 0.0), reserved.get(variant["id"], 0.0)
        rows.append({
            "id": variant["id"], "name": variant["variant_display_name"] or variant["name"],
            "on_hand": qty, "reserved": held, "available": qty - held,
        })
    return rows


class StockAnalysisSelector:
    @staticmethod
    def get_analysis(product: Product, params: StockAnalysisParams) -> dict:
        product_ids = [product.id]
        if product.has_variants:
            product_ids += list(product.variants.values_list("id", flat=True))
        date_to = params.date_to or timezone.localdate()

        start = _range_start(product_ids, params.date_from, date_to)
        on_hand_by_product = _on_hand(product_ids)
        reserved_by_product = _reserved(product_ids)
        on_hand = sum(on_hand_by_product.values())
        rotation = _rotation(product, product_ids, start, date_to, params.idle_days)
        adjustments = _adjustments(product_ids, start, date_to)
        loss = next((a["qty"] for a in adjustments if a["key"] == "loss"), 0.0)
        reserved = sum(reserved_by_product.values())
        return {
            "today": {
                "on_hand": on_hand,
                "value": on_hand * float(product.cost_price or 0),
                "reserved": reserved,
                "available": on_hand - reserved,
            },
            "rotation": rotation,
            "coverage": coverage(product_ids, date_to),
            "series": _series(product_ids, start, date_to, params.granularity),
            "flows": _flows(product_ids, start, date_to),
            "adjustments": adjustments,
            "loss_pct": loss / rotation["out_qty"] * 100 if rotation["out_qty"] else None,
            "warehouses": _warehouses(product_ids, date_to, params.idle_days),
            "variants": _variants(product, on_hand_by_product, reserved_by_product) if product.has_variants else [],
        }
