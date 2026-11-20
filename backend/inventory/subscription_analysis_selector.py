"""SubscriptionAnalysisSelector: costo recurrente, pagos del período, subidas de precio y vencimientos."""
from dataclasses import dataclass
from datetime import date, timedelta

from django.utils import timezone

from .models import Product, Subscription
from .operations_selector import _FREQUENCY_FACTOR
from .pricing_selector import _period_start
from .sales_impact_selector import _period_label

AMOUNT_TOLERANCE = 0.01
DUE_HORIZON_DAYS = 90


@dataclass(frozen=True)
class SubscriptionAnalysisParams:
    date_from: date | None = None
    date_to: date | None = None
    granularity: str = "month"


def _pct(new: float, old: float | None) -> float | None:
    return (new - old) / old * 100 if old else None


def _payments(product_ids: list[int]) -> list[dict]:
    """Pagos (líneas de compra no borrador ni anuladas) en orden cronológico, con la variación por proveedor."""
    from purchasing.models import PurchaseLine

    previous: dict[int | None, float] = {}
    rows = []
    for line in (
        PurchaseLine.objects.filter(product_id__in=product_ids)
        .exclude(order__status__in=("DRAFT", "CANCELLED"))
        .values("order__date", "order__supplier_id", "order__supplier__name", "quantity", "unit_cost")
        .order_by("order__date", "id")
    ):
        supplier_id = line["order__supplier_id"]
        amount = float(line["quantity"]) * float(line["unit_cost"])
        rows.append({
            "day": line["order__date"], "supplier_id": supplier_id, "supplier": line["order__supplier__name"],
            "amount": amount, "change_pct": _pct(amount, previous.get(supplier_id)),
        })
        previous[supplier_id] = amount
    return rows


def _series(rows: list[dict], granularity: str, shift: timedelta = timedelta(0)) -> list[dict]:
    acc: dict[date, float] = {}
    for r in rows:
        start = _period_start(r["day"] + shift, granularity)
        acc[start] = acc.get(start, 0.0) + r["amount"]
    return [{"period": _period_label(start, granularity), "paid": acc[start]} for start in sorted(acc)]


def _between(rows: list[dict], start: date | None, end: date) -> list[dict]:
    return [r for r in rows if (start is None or r["day"] >= start) and r["day"] <= end]


def _subscriptions(product_ids: list[int], payments: list[dict], as_of: date) -> list[dict]:
    last_by_supplier: dict[int | None, dict] = {}
    for p in payments:
        last_by_supplier[p["supplier_id"]] = p
    rows = []
    for sub in Subscription.objects.filter(product_id__in=product_ids).select_related("supplier").order_by("next_payment_date", "id"):
        amount = float(sub.amount)
        last = last_by_supplier.get(sub.supplier_id)
        rows.append({
            "id": sub.id,
            "supplier": sub.supplier.name,
            "status": sub.status,
            "amount": amount,
            "frequency": sub.recurrence_period,
            "annualized": amount * _FREQUENCY_FACTOR.get(sub.recurrence_period, 12),
            "next_payment_date": sub.next_payment_date.isoformat() if sub.next_payment_date else None,
            "days_to_payment": (sub.next_payment_date - as_of).days if sub.next_payment_date else None,
            "end_date": sub.end_date.isoformat() if sub.end_date else None,
            "days_to_end": (sub.end_date - as_of).days if sub.end_date else None,
            "last_payment": {"date": last["day"].isoformat(), "amount": last["amount"]} if last else None,
            "change_pct": last["change_pct"] if last else None,
            "differs_from_amount": bool(last and amount and abs(last["amount"] - amount) / amount > AMOUNT_TOLERANCE),
        })
    return rows


class SubscriptionAnalysisSelector:
    @staticmethod
    def get_analysis(product: Product, params: SubscriptionAnalysisParams) -> dict:
        product_ids = [product.id]
        if product.has_variants:
            product_ids += list(product.variants.values_list("id", flat=True))
        date_to = params.date_to or date.today()
        # Next payments are current state: always measured from today, not from date_to.
        as_of = timezone.localdate()

        payments = _payments(product_ids)
        in_range = _between(payments, params.date_from, date_to)
        previous, previous_points = None, []
        if params.date_from:
            span = date_to - params.date_from
            prev_to = params.date_from - timedelta(days=1)
            prev_rows = _between(payments, prev_to - span, prev_to)
            previous = {"paid": sum(r["amount"] for r in prev_rows), "payments": len(prev_rows)}
            previous_points = _series(prev_rows, params.granularity, span + timedelta(days=1))

        subscriptions = _subscriptions(product_ids, payments, as_of)
        active = [s for s in subscriptions if s["status"] == Subscription.Status.ACTIVE]
        horizon = as_of + timedelta(days=DUE_HORIZON_DAYS)
        annualized = sum(s["annualized"] for s in active)
        return {
            "today": {
                "annualized_total": annualized,
                "monthly_equivalent": annualized / 12,
                "active_count": len(active),
                "due_90d_total": sum(
                    s["amount"] for s in active
                    if s["next_payment_date"] and date.fromisoformat(s["next_payment_date"]) <= horizon
                ),
            },
            "kpis": {"paid": sum(r["amount"] for r in in_range), "payments": len(in_range), "previous": previous},
            "series": {"points": _series(in_range, params.granularity), "previous_points": previous_points},
            "subscriptions": subscriptions,
            "payments": [
                {"date": r["day"].isoformat(), "supplier": r["supplier"], "amount": r["amount"], "change_pct": r["change_pct"]}
                for r in in_range
            ],
        }
