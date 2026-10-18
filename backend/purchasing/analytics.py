"""
Purchase order analytics over the full filtered list (ADR-0087 lote 2c).

The frontend used to aggregate the orders of the visible page only. This service receives the
same filtered queryset as the list endpoint and walks it once. Per-order amounts and states come
from `PurchaseOrderSerializer`'s own methods (pending amount, actual receipt date) so
the figures match the list and the document sheet. Sums are exact (Decimal) and converted at the
end; period buckets are the first day of the period (ISO), labelled by the client. Only the
figures the analytics panel shows are computed.
"""
from collections import Counter, defaultdict
from datetime import date
from decimal import Decimal

from django.db.models import QuerySet
from django.utils import timezone

from core import analytics as stats
from treasury.models import TreasuryMovement

PRODUCT_GROUPS = {
    "storable": ("STORABLE", "CONSUMABLE", "MANUFACTURABLE"),
    "service": ("SERVICE",),
    "subscription": ("SUBSCRIPTION",),
}
PAYMENT_KEYS = set(TreasuryMovement.Method.values)
PRIMARY_DTE_TYPES = ("FACTURA", "BOLETA", "PURCHASE_INV")
FUNNEL_STAGES = ("DRAFT", "CONFIRMED", "RECEIVED", "INVOICED", "PAID")
TOP_SUPPLIERS = 8
TOP_PRODUCTS = 6
ZERO = Decimal(0)


def _payment_key(order) -> str:
    """Method key: order payment method → first payment (method, then legacy field) → credit."""
    ref = order.payment_method_ref.method_type if order.payment_method_ref_id else None
    if ref in PAYMENT_KEYS:
        return ref
    payments = list(order.payments.all())
    if payments:
        first = payments[0]
        new = first.payment_method_new.method_type if first.payment_method_new_id else None
        if new in PAYMENT_KEYS:
            return new
        if first.payment_method in PAYMENT_KEYS and first.payment_method != "CREDIT":
            return first.payment_method
    return "CREDIT"


def _top_products(products: dict) -> list[dict]:
    return sorted(({"product": k, **v} for k, v in products.items()), key=lambda p: p["total"], reverse=True)[:TOP_PRODUCTS]


class PurchaseOrderAnalyticsService:
    @staticmethod
    def compute(queryset: QuerySet, *, granularity: str = "month", today: date | None = None) -> dict:
        from .serializers import PurchaseOrderSerializer

        serializer = PurchaseOrderSerializer(context={})
        granularity = granularity if granularity in stats.GRANULARITIES else "month"
        # Local date (TIME_ZONE): the container clock is UTC and would shift "today" in the evening.
        local_today = today or timezone.localdate()

        money: defaultdict[str, Decimal] = defaultdict(Decimal)
        counts: Counter[str] = Counter()
        funnel: Counter[str] = Counter()
        payment: Counter[str] = Counter()
        warehouses: Counter[str] = Counter()
        dte: Counter[str] = Counter()
        suppliers: dict[int | None, dict] = {}
        periods: dict[date, dict] = {}
        products: dict[str, dict] = defaultdict(lambda: {"total": ZERO})
        product_types: defaultdict[str, Decimal] = defaultdict(Decimal)
        by_type = {
            name: {"products": defaultdict(lambda: {"total": ZERO, "count": ZERO}), "periods": defaultdict(Decimal),
                   "categories": defaultdict(Decimal), "total": ZERO, "orders": 0}
            for name in PRODUCT_GROUPS
        }

        for order in queryset:
            total = stats.num(order.total)
            money["volume"] += total
            counts["orders"] += 1

            if order.status != "CANCELLED":
                # Funnel by axis (ADR-0084): the order status no longer says received/invoiced/paid.
                if order.status in ("DRAFT", "CONFIRMED"):
                    funnel[order.status] += 1
                if order.receiving_status == "RECEIVED":
                    funnel["RECEIVED"] += 1
                if order.invoicing_status == "INVOICED":
                    funnel["INVOICED"] += 1
                if stats.num(serializer.get_pending_amount(order)) <= 0:
                    funnel["PAID"] += 1

            receipt = order.receipt_date
            if order.receiving_status != "RECEIVED":
                counts["pending_receipt"] += 1
                if receipt and receipt < local_today:
                    counts["overdue"] += 1
            elif receipt:
                actual = serializer.get_actual_receipt_date(order)
                if actual:
                    counts["on_time" if actual <= receipt.isoformat() else "late"] += 1

            payment[TreasuryMovement.Method(_payment_key(order)).label] += 1
            warehouses[order.warehouse.name if order.warehouse_id else "Sin almacén"] += 1
            # By contact id: two suppliers with the same name are different suppliers.
            supplier = suppliers.setdefault(order.supplier_id, {"supplier": order.supplier.name if order.supplier_id else "Desconocido", "total": ZERO, "order_count": 0})
            supplier["total"] += total
            supplier["order_count"] += 1

            # Same rule as the serializer's is_invoiced / invoice_details: the first primary invoice.
            primary = next((inv for inv in order.invoices.all() if inv.dte_type in PRIMARY_DTE_TYPES), None)
            if primary:
                counts["invoiced"] += 1
                money["invoiced"] += total
                dte[primary.dte_type] += 1
            else:
                money["not_invoiced"] += total

            bucket = stats.bucket(order.date, granularity) if order.date else None
            if bucket:
                period = periods.setdefault(bucket, {"bucket": bucket, "total": ZERO, "count": 0})
                period["total"] += total
                period["count"] += 1

            # Original lines only (not those of notes), as the list serializer shows them.
            types_in_order = set()
            for line in order.lines.all():
                if line.related_note_id is not None:
                    continue
                product = line.product
                line_total = stats.num(line.subtotal) or stats.num(line.quantity) * stats.num(line.unit_cost)
                money["lines"] += line_total
                product_types[product.get_product_type_display() if product else "General"] += line_total
                if not product:
                    continue
                products[product.name]["total"] += line_total
                for name, members in PRODUCT_GROUPS.items():
                    if product.product_type not in members:
                        continue
                    group = by_type[name]
                    types_in_order.add(name)
                    group["total"] += line_total
                    item = group["products"][product.name]
                    item["total"] += line_total
                    item["count"] += stats.num(line.quantity)
                    if bucket:
                        group["periods"][bucket] += line_total
                    group["categories"][product.category.name if product.category_id else "Sin Categoría"] += line_total
            for name in types_in_order:
                by_type[name]["orders"] += 1

        return stats.to_json({
            "granularity": granularity,
            "totals": {
                "total_volume": money["volume"],
                "order_count": counts["orders"],
                "overdue_count": counts["overdue"],
                "pending_receipt_count": counts["pending_receipt"],
                "on_time_count": counts["on_time"],
                "late_count": counts["late"],
                "total_line_volume": money["lines"],
            },
            "funnel": [{"id": stage, "value": funnel[stage]} for stage in FUNNEL_STAGES if funnel[stage]],
            "payment_method": stats.ranked(payment),
            "top_suppliers": sorted(suppliers.values(), key=lambda s: s["total"], reverse=True)[:TOP_SUPPLIERS],
            "periods": [periods[k] for k in sorted(periods)],
            "warehouses": [{"warehouse": k, "count": v} for k, v in warehouses.most_common()],
            "top_products": _top_products(products),
            "product_types": stats.ranked(product_types),
            "dte": stats.ranked(dte),
            "invoiced": {"invoiced_count": counts["invoiced"], "invoiced_volume": money["invoiced"], "pending_volume": money["not_invoiced"]},
            "by_type": {
                name: {
                    "top_products": _top_products(g["products"]),
                    "periods": [{"bucket": k, "total": g["periods"][k]} for k in sorted(g["periods"]) if g["periods"][k] > 0],
                    "categories": stats.ranked(g["categories"]),
                    "total_volume": g["total"],
                    "order_count": g["orders"],
                }
                for name, g in by_type.items()
            },
        })
