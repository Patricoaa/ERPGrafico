"""PricingSelector: margen realizado, serie de precios y reglas de precio de un producto."""
from dataclasses import dataclass
from datetime import date, timedelta

from django.db.models import ExpressionWrapper, F, FloatField, Sum, Value
from django.db.models.functions import Coalesce

from .models import Product
from .sales_impact_selector import (
    _DECIMAL,
    _f,
    _period_expression,
    _period_label,
    _segment_key_expression,
    _segment_labels,
    foregone_expression,
    list_net_expression,
    net_revenue_expression,
    rule_windows,
)


@dataclass(frozen=True)
class PricingParams:
    date_from: date | None = None
    date_to: date | None = None
    granularity: str = "month"


_ZERO = {
    "units": 0.0,
    "net_revenue": 0.0,
    "gross_revenue": 0.0,
    "cost": 0.0,
    "list_revenue": 0.0,
    "list_gross_revenue": 0.0,
    "foregone_revenue": 0.0,
}


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
        "list_gross_revenue": Sum(
            _f("quantity")
            * Coalesce(
                _f("sale_line__list_unit_price_gross"),
                _f("sale_line__unit_price_gross"),
                _f("unit_price") * Value(1.19, output_field=FloatField()),
                output_field=FloatField(),
            )
        ),
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
    net = acc["net_revenue"]
    gross = acc["gross_revenue"]
    list_gross = acc.get("list_gross_revenue") or (acc["list_revenue"] * 1.19)
    return {
        "period": period,
        "units": units,
        "net_revenue": net,
        "avg_price": net / units if units else 0.0,
        "avg_price_gross": gross / units if units else 0.0,
        "avg_list_price": acc["list_revenue"] / units if units else 0.0,
        "avg_list_price_gross": list_gross / units if units else 0.0,
        "avg_cost": acc["cost"] / units if units else 0.0,
        "margin_pct": _margin_pct(acc, has_cost),
    }


def _period_start(day: date, granularity: str) -> date:
    if granularity == "week":
        return day - timedelta(days=day.weekday())
    if granularity == "month":
        return day.replace(day=1)
    if granularity == "year":
        return day.replace(month=1, day=1)
    return day


def _by_rule(lines, granularity: str) -> list[dict]:
    rows = list(
        lines.annotate(period=_period_expression(granularity), segment=_segment_key_expression("rule"))
        .values("period", "segment")
        .annotate(
            units=Sum("quantity"),
            net_revenue=Sum(net_revenue_expression()),
            gross_revenue=Sum(ExpressionWrapper(F("quantity") * F("unit_price"), output_field=_DECIMAL)),
        )
        .order_by("period", "segment")
    )
    labels = _segment_labels("rule", {r["segment"] for r in rows})
    result = []
    for r in rows:
        units = float(r["units"] or 0)
        net = float(r["net_revenue"] or 0)
        gross = float(r["gross_revenue"] or 0)
        result.append(
            {
                "period": _period_label(r["period"], granularity),
                "key": r["segment"],
                "label": labels[r["segment"]],
                "units": units,
                "avg_price": net / units if units else 0.0,
                "avg_price_gross": gross / units if units else (net * 1.19 / units if units else 0.0),
                "net_revenue": net,
            }
        )
    return result


def _list_price_changes(product: Product, date_from: date | None, date_to: date) -> dict:
    """Cambios de ``sale_price`` del historial dentro del rango, con el precio vigente al inicio (``baseline``)."""
    records = list(product.history.order_by("history_date", "history_id").values_list("history_date", "sale_price"))
    if not records:
        return {"baseline": None, "changes": []}
    baseline = float(records[0][1])
    previous = baseline
    changes = []
    for moment, price in records[1:]:
        day, value = moment.date(), float(price)
        if value == previous:
            continue
        if date_from and day < date_from:
            baseline = value
        elif day <= date_to:
            changes.append({"date": day.isoformat(), "from": previous, "to": value})
        previous = value
    return {"baseline": baseline, "changes": changes}


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

        list_price_changes = _list_price_changes(product, params.date_from, date_to)
        for change in list_price_changes["changes"]:
            change["period"] = _period_label(
                _period_start(date.fromisoformat(change["date"]), params.granularity), params.granularity
            )

        windows = rule_windows(product, product_ids)

        sale_price = float(product.sale_price or 0)
        sale_price_gross = float(product.sale_price_gross or 0) or (sale_price * 1.19)
        cost = float(product.cost_price or 0)
        return {
            "has_cost": has_cost,
            "today": {
                "list_price_net": sale_price,
                "list_price_gross": sale_price_gross,
                "cost": cost,
                "list_margin_pct": (sale_price - cost) / sale_price * 100 if has_cost and sale_price else None,
            },
            "kpis": {**_kpis(total, has_cost), "previous": previous},
            "series": {
                "points": [_point(label, acc, has_cost) for label, acc in cells],
                "by_rule": _by_rule(lines, params.granularity),
            },
            "list_price_changes": list_price_changes,
            "rule_windows": windows,
        }
