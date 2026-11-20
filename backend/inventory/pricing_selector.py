"""PricingSelector: margen realizado, serie de precios y efectos de cambios de precio de un producto."""
from dataclasses import dataclass
from datetime import date, timedelta

from django.db.models import ExpressionWrapper, F, FloatField, Sum
from django.db.models.functions import Coalesce

from .models import Product
from .sales_impact_selector import (
    _DECIMAL,
    _f,
    _period_expression,
    _period_label,
    foregone_expression,
    list_net_expression,
    net_revenue_expression,
)


@dataclass(frozen=True)
class PricingParams:
    date_from: date | None = None
    date_to: date | None = None
    granularity: str = "month"


_ZERO = {"units": 0.0, "net_revenue": 0.0, "gross_revenue": 0.0, "cost": 0.0, "list_revenue": 0.0, "foregone_revenue": 0.0}


def _lines(product_ids: list[int], date_from: date | None, date_to: date):
    from sales.models import SaleDeliveryLine

    lines = SaleDeliveryLine.objects.filter(
        product_id__in=product_ids, delivery__status="CONFIRMED", delivery__delivery_date__lte=date_to
    )
    if date_from:
        lines = lines.filter(delivery__delivery_date__gte=date_from)
    return lines.annotate(list_net=list_net_expression())


def _aggregates():
    return {
        "units": Sum("quantity"),
        "net_revenue": Sum(net_revenue_expression()),
        "gross_revenue": Sum(ExpressionWrapper(F("quantity") * F("unit_price"), output_field=_DECIMAL)),
        "cost": Sum(ExpressionWrapper(F("quantity") * F("unit_cost"), output_field=_DECIMAL)),
        "list_revenue": Sum(_f("quantity") * Coalesce(F("list_net"), _f("unit_price"), output_field=FloatField())),
        "foregone_revenue": Sum(foregone_expression()),
    }


def _floats(row: dict) -> dict:
    return {k: float(row.get(k) or 0) for k in _ZERO}


def _margin_pct(acc: dict, has_cost: bool) -> float | None:
    if not has_cost or not acc["net_revenue"]:
        return None
    return (acc["net_revenue"] - acc["cost"]) / acc["net_revenue"] * 100


def _kpis(acc: dict, has_cost: bool) -> dict:
    units, net, gross = acc["units"], acc["net_revenue"], acc["gross_revenue"]
    return {
        "margin_pct": _margin_pct(acc, has_cost),
        "net_revenue": net,
        "units": units,
        "avg_price": net / units if units else 0.0,
        "avg_discount_pct": (gross - net) / gross * 100 if gross else 0.0,
        "foregone_revenue": acc["foregone_revenue"],
    }


def _point(period: str, acc: dict, has_cost: bool) -> dict:
    units = acc["units"]
    return {
        "period": period,
        "units": units,
        "net_revenue": acc["net_revenue"],
        "avg_price": acc["net_revenue"] / units if units else 0.0,
        "avg_list_price": acc["list_revenue"] / units if units else 0.0,
        "avg_cost": acc["cost"] / units if units else 0.0,
        "margin_pct": _margin_pct(acc, has_cost),
    }


class PricingSelector:
    @staticmethod
    def get_pricing(product: Product, params: PricingParams) -> dict:
        product_ids = [product.id]
        if product.has_variants:
            product_ids += list(product.variants.values_list("id", flat=True))
        date_to = params.date_to or date.today()
        lines = _lines(product_ids, params.date_from, date_to)

        rows = list(
            lines.annotate(period=_period_expression(params.granularity))
            .values("period").annotate(**_aggregates()).order_by("period")
        )
        cells = [(_period_label(r["period"], params.granularity), _floats(r)) for r in rows]
        total = {k: sum(c[k] for _, c in cells) for k in _ZERO}
        has_cost = float(product.cost_price or 0) > 0 or total["cost"] > 0

        previous = None
        if params.date_from:
            prev_to = params.date_from - timedelta(days=1)
            prev_from = prev_to - (date_to - params.date_from)
            prev_row = _lines(product_ids, prev_from, prev_to).aggregate(**_aggregates())
            previous = _kpis(_floats(prev_row), has_cost)

        sale_price = float(product.sale_price or 0)
        cost = float(product.cost_price or 0)
        return {
            "has_cost": has_cost,
            "today": {
                "list_price_net": sale_price,
                "list_price_gross": float(product.sale_price_gross or 0),
                "cost": cost,
                "list_margin_pct": (sale_price - cost) / sale_price * 100 if has_cost and sale_price else None,
            },
            "kpis": {**_kpis(total, has_cost), "previous": previous},
            "series": {"points": [_point(label, acc, has_cost) for label, acc in cells], "by_rule": []},
            "list_price_changes": {"baseline": None, "changes": []},
            "rule_windows": [],
            "effects": [],
        }
