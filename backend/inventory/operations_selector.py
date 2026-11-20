"""Operación por producto: rotación, cobertura, stock inmóvil y suscripciones (ADR-0148).

Definiciones en ``docs/superpowers/specs/2026-11-19-product-operations-design.md``. Las fechas
relativas («últimos 90 días», vencimientos, días sin salida) se miden desde ``date_to``.
"""
from __future__ import annotations

import calendar
from bisect import bisect_right
from datetime import date, timedelta

from django.db.models import Max, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone

from .models import Product, StockMove, Subscription
from .selectors import ProductSelector

_FREQUENCY_FACTOR = {"WEEKLY": 52, "MONTHLY": 12, "QUARTERLY": 4, "SEMIANNUAL": 2, "ANNUAL": 1}
_COVERAGE_DAYS = 90
_PAYMENTS_SHOWN = 24


def _pct_change(new: float, old: float) -> float | None:
    return (new - old) / old * 100 if old else None


class _StockCurve:
    """Stock level by date from the cumulative daily series (constant between movements)."""

    def __init__(self, history: list[dict]):
        self.dates = [date.fromisoformat(h["date"]) for h in history]
        self.levels = [h["stock"] for h in history]

    def at(self, day: date) -> float:
        i = bisect_right(self.dates, day)
        return self.levels[i - 1] if i else 0.0

    def average(self, start: date, end: date) -> float:
        """Time-weighted average over [start, end], both inclusive."""
        total_days = (end - start).days + 1
        cursor, level, acc = start, self.at(start), 0.0
        for d, lv in zip(self.dates, self.levels, strict=True):
            if d <= start or d > end:
                continue
            acc += level * (d - cursor).days
            cursor, level = d, lv
        acc += level * ((end - cursor).days + 1)
        return acc / total_days if total_days > 0 else 0.0


def _coverage_days(stock_now: float, recent_out: float) -> float | None:
    return stock_now / (recent_out / _COVERAGE_DAYS) if recent_out > 0 and stock_now > 0 else None


def coverage(product_ids: list[int], date_to: date) -> dict:
    """Stock al cierre, consumo diario de los últimos 90 días y días de cobertura (mismo cálculo que la rotación)."""
    _, history = ProductSelector._stock_flow(product_ids)
    stock_now = _StockCurve(history).at(date_to)
    _, _, flow = ProductSelector._flow_case()
    recent_out = float(
        StockMove.objects.filter(
            product_id__in=product_ids, date__lte=date_to, date__gte=date_to - timedelta(days=_COVERAGE_DAYS - 1)
        ).annotate(flow=flow).filter(flow="OUT").aggregate(q=Sum("quantity"))["q"] or 0
    )
    return {
        "stock_now": stock_now,
        "daily_out": recent_out / _COVERAGE_DAYS,
        "coverage_days": _coverage_days(stock_now, recent_out),
    }


class OperationsSelector:
    @staticmethod
    def get_operations(
        product: Product, date_from: date | None = None, date_to: date | None = None, idle_days: int = 90,
    ) -> dict:
        date_to = date_to or date.today()
        date_from = date_from or (date_to - timedelta(days=365))
        caps = ProductSelector.get_capabilities(product)
        product_ids = [product.id]
        if product.has_variants:
            product_ids += list(product.variants.values_list("id", flat=True))
        return {
            "rotation": (
                OperationsSelector._rotation(product, product_ids, date_from, date_to, idle_days)
                if caps["tracks_stock"] else None
            ),
            "subscriptions": (
                OperationsSelector._subscriptions(product_ids) if caps["recurring"] else None
            ),
        }

    @staticmethod
    def _rotation(product, product_ids, date_from, date_to, idle_days) -> dict:
        _, history = ProductSelector._stock_flow(product_ids)
        curve = _StockCurve(history)
        _, _, flow = ProductSelector._flow_case()
        directional = (
            StockMove.objects.filter(product_id__in=product_ids, date__lte=date_to)
            .annotate(flow=flow).filter(flow__in=("IN", "OUT"))
        )

        in_qty = out_qty = 0.0
        for row in directional.filter(date__gte=date_from).values("flow").annotate(qty=Sum("quantity")):
            if row["flow"] == "IN":
                in_qty = float(row["qty"] or 0)
            else:
                out_qty = float(row["qty"] or 0)
        recent_from = date_to - timedelta(days=_COVERAGE_DAYS - 1)
        recent_out = float(
            directional.filter(flow="OUT", date__gte=recent_from).aggregate(q=Sum("quantity"))["q"] or 0
        )
        last = {r["flow"]: r["last"] for r in directional.values("flow").annotate(last=Max("date"))}

        monthly_out: dict[str, float] = {}
        for row in (
            directional.filter(flow="OUT", date__gte=date_from)
            .annotate(month=TruncMonth("date")).values("month").annotate(qty=Sum("quantity"))
        ):
            monthly_out[row["month"].strftime("%Y-%m")] = float(row["qty"] or 0)

        stock_now = curve.at(date_to)
        avg_stock = curve.average(date_from, date_to)
        turnover = out_qty / avg_stock if avg_stock > 0 and out_qty > 0 else None
        window_days = (date_to - date_from).days + 1
        last_out = last.get("OUT")
        idle = stock_now > 0 and (last_out is None or (date_to - last_out).days >= idle_days)

        series = []
        year, month = date_from.year, date_from.month
        while (year, month) <= (date_to.year, date_to.month):
            label = f"{year}-{month:02d}"
            month_end = min(date(year, month, calendar.monthrange(year, month)[1]), date_to)
            series.append({"month": label, "out": monthly_out.get(label, 0.0), "stock_end": curve.at(month_end)})
            year, month = (year + 1, 1) if month == 12 else (year, month + 1)

        return {
            "stock_now": stock_now,
            "stock_value": stock_now * float(product.cost_price or 0),
            "in_qty": in_qty,
            "out_qty": out_qty,
            "avg_stock": avg_stock,
            "turnover": turnover,
            "days_of_inventory": window_days / turnover if turnover else None,
            "coverage_days": _coverage_days(stock_now, recent_out),
            "last_out_date": last_out.isoformat() if last_out else None,
            "last_in_date": last["IN"].isoformat() if last.get("IN") else None,
            "idle": idle,
            "idle_days": idle_days,
            "series": series,
        }

    @staticmethod
    def _subscriptions(product_ids) -> dict:
        from purchasing.models import PurchaseLine

        # next_payment_date is current state, so it is always measured from today (not from date_to).
        as_of = timezone.localdate()

        items = []
        for sub in Subscription.objects.filter(product_id__in=product_ids).select_related("supplier"):
            annualized = float(sub.amount) * _FREQUENCY_FACTOR.get(sub.recurrence_period, 12)
            items.append({
                "id": sub.id,
                "supplier": sub.supplier.name,
                "status": sub.status,
                "amount": float(sub.amount),
                "frequency": sub.recurrence_period,
                "annualized": annualized,
                "next_payment_date": sub.next_payment_date.isoformat() if sub.next_payment_date else None,
                "days_to_payment": (sub.next_payment_date - as_of).days if sub.next_payment_date else None,
            })
        active = [i for i in items if i["status"] == Subscription.Status.ACTIVE]
        horizon = as_of + timedelta(days=90)
        due = sum(
            i["amount"] for i in active
            if i["next_payment_date"] and date.fromisoformat(i["next_payment_date"]) <= horizon
        )

        payments = []
        previous_by_supplier: dict[str | None, float] = {}
        lines = (
            PurchaseLine.objects.filter(product_id__in=product_ids)
            .exclude(order__status__in=("DRAFT", "CANCELLED"))
            .select_related("order__supplier").order_by("order__date", "id")
        )
        for line in lines:
            cost = float(line.unit_cost)
            supplier = line.order.supplier.name if line.order.supplier else None
            previous = previous_by_supplier.get(supplier)
            payments.append({
                "date": line.order.date.isoformat(),
                "supplier": supplier,
                "unit_cost": cost,
                "quantity": float(line.quantity),
                "change_pct": _pct_change(cost, previous) if previous is not None else None,
            })
            previous_by_supplier[supplier] = cost
        first_to_last = (
            _pct_change(payments[-1]["unit_cost"], payments[0]["unit_cost"]) if len(payments) > 1 and len({p["supplier"] for p in payments}) == 1 else None
        )
        annualized_total = sum(i["annualized"] for i in active)
        return {
            "annualized_total": annualized_total,
            "monthly_equivalent_total": annualized_total / 12,
            "count": len(active),
            "due_90d_total": due,
            "items": sorted(items, key=lambda i: (i["next_payment_date"] is None, i["next_payment_date"] or "")),
            "payments": payments[-_PAYMENTS_SHOWN:],
            "first_to_last_pct": first_to_last,
        }
