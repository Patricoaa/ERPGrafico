"""StockAnalysisSelector: existencia, comprometido, rotación, flujos, ajustes, bodegas y variantes de un producto."""
from collections import defaultdict
from dataclasses import dataclass
from datetime import date

from django.db.models import F, Min, Sum

from .models import Product, Stock, StockMove
from .operations_selector import OperationsSelector

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


def _rotation(product: Product, product_ids: list[int], date_from: date | None, date_to: date, idle_days: int) -> dict:
    start = date_from or StockMove.objects.filter(product_id__in=product_ids).aggregate(first=Min("date"))["first"] or date_to
    full = OperationsSelector._rotation(product, product_ids, start, date_to, idle_days)
    return {key: full[key] for key in _ROTATION_KEYS}


class StockAnalysisSelector:
    @staticmethod
    def get_analysis(product: Product, params: StockAnalysisParams) -> dict:
        product_ids = [product.id]
        if product.has_variants:
            product_ids += list(product.variants.values_list("id", flat=True))
        date_to = params.date_to or date.today()

        on_hand = sum(_on_hand(product_ids).values())
        reserved = sum(_reserved(product_ids).values())
        return {
            "today": {
                "on_hand": on_hand,
                "value": on_hand * float(product.cost_price or 0),
                "reserved": reserved,
                "available": on_hand - reserved,
            },
            "rotation": _rotation(product, product_ids, params.date_from, date_to, params.idle_days),
            "series": [],
            "flows": {"outflows": [], "inflows": []},
            "adjustments": [],
            "loss_pct": None,
            "warehouses": [],
            "variants": [],
        }
