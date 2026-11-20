"""Impacto de ventas por producto: margen real y analítica de reglas de precio.

Agrega en la BD las líneas de despacho confirmadas (``SaleDeliveryLine``). El ingreso es neto
de IVA y de descuentos; el costo es el ``unit_cost`` congelado en cada despacho. Las fórmulas
están documentadas en ``docs/superpowers/specs/2026-11-19-product-sales-impact-design.md``.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

from django.db.models import (
    Case,
    CharField,
    DecimalField,
    ExpressionWrapper,
    F,
    FloatField,
    Min,
    Q,
    Sum,
    Value,
    When,
)
from django.db.models.functions import (
    Cast,
    Coalesce,
    Greatest,
    Least,
    TruncMonth,
    TruncWeek,
    TruncYear,
)

from .models import PricingRule, Product

METRICS = ("units", "net_revenue", "margin", "avg_price", "discount_total", "foregone_revenue")
GROUP_BYS = ("rule", "channel", "customer", "variant", "uom")
GRANULARITIES = ("day", "week", "month", "year")

_DECIMAL = DecimalField(max_digits=28, decimal_places=6)


@dataclass(frozen=True)
class SalesImpactParams:
    metric: str = "net_revenue"
    group_by: str = "rule"
    granularity: str = "month"
    date_from: date | None = None
    date_to: date | None = None
    channel: str | None = None
    customer_id: int | None = None
    variant_id: int | None = None
    uom_id: int | None = None
    rule_id: int | None = None


def _f(expression):
    """Cast to float: SQLite collapses NUMERIC casts of integer-valued decimals back to integers."""
    return Cast(expression, output_field=FloatField())


def discount_ratio_expression():
    """Fracción del bruto de la línea que es descuento (0..1); 0 si la línea no tiene precio bruto.

    Replica ``SaleLine.calculate_subtotal``: solo se descuenta cuando hay ``unit_price_gross``.
    """
    raw = _f("sale_line__discount_amount") / (_f("sale_line__quantity") * _f("sale_line__unit_price_gross"))
    return Case(
        When(
            Q(sale_line__unit_price_gross__gt=0) & Q(sale_line__quantity__gt=0),
            then=Least(Value(1.0, output_field=FloatField()), Greatest(Value(0.0, output_field=FloatField()), raw)),
        ),
        default=Value(0.0, output_field=FloatField()),
        output_field=FloatField(),
    )


def net_revenue_expression():
    """Ingreso neto de IVA y de descuentos de una ``SaleDeliveryLine`` (prorrateado por unidad despachada)."""
    return ExpressionWrapper(
        _f("quantity") * _f("unit_price") * (Value(1.0, output_field=FloatField()) - discount_ratio_expression()),
        output_field=FloatField(),
    )


def _period_expression(granularity: str):
    if granularity == "day":
        return F("delivery__delivery_date")
    if granularity == "week":
        return TruncWeek("delivery__delivery_date")
    if granularity == "year":
        return TruncYear("delivery__delivery_date")
    return TruncMonth("delivery__delivery_date")


def _period_label(value: date, granularity: str) -> str:
    if granularity == "day":
        return value.isoformat()
    if granularity == "week":
        return value.strftime("%G-W%V")
    if granularity == "year":
        return f"{value.year}"
    return value.strftime("%Y-%m")


def _segment_key_expression(group_by: str):
    def as_text(path: str):
        return Coalesce(Cast(path, output_field=CharField()), Value("none"))

    if group_by == "channel":
        return as_text("sale_line__order__channel")
    if group_by == "customer":
        return as_text("sale_line__order__customer_id")
    if group_by == "variant":
        return as_text("product_id")
    if group_by == "uom":
        return as_text("uom_id")
    return Case(
        When(
            sale_line__pricing_rule__isnull=False,
            then=Cast("sale_line__pricing_rule_id", output_field=CharField()),
        ),
        When(sale_line__price_source="MANUAL", then=Value("manual")),
        When(sale_line__price_source__in=("LIST", "UOM_PRICE"), then=Value("list")),
        default=Value("none"),
        output_field=CharField(),
    )


def _segment_labels(group_by: str, keys: set[str]) -> dict[str, str]:
    from contacts.models import Contact
    from sales.models import SaleOrder

    from .models import UoM

    ids = [int(k) for k in keys if k.isdigit()]
    if group_by == "rule":
        labels = {str(pk): name for pk, name in PricingRule.objects.filter(pk__in=ids).values_list("pk", "name")}
        labels.update({"manual": "Manual", "list": "Precio de lista", "none": "Sin registro"})
    elif group_by == "channel":
        labels = dict(SaleOrder.Channel.choices) | {"none": "Sin canal"}
    elif group_by == "customer":
        labels = {str(pk): name for pk, name in Contact.objects.filter(pk__in=ids).values_list("pk", "name")}
        labels["none"] = "Sin cliente"
    elif group_by == "variant":
        labels = {
            str(p.pk): p.variant_display_name or p.name for p in Product.objects.filter(pk__in=ids)
        }
    else:
        labels = {str(pk): name for pk, name in UoM.objects.filter(pk__in=ids).values_list("pk", "name")}
    return {key: str(labels.get(key, key)) for key in keys}


def _metric_value(metric: str, row: dict) -> float:
    units, net, cost = row["units"], row["net_revenue"], row["cost"]
    if metric == "units":
        return units
    if metric == "net_revenue":
        return net
    if metric == "margin":
        return net - cost
    if metric == "avg_price":
        return net / units if units else 0.0
    if metric == "discount_total":
        return row["gross_revenue"] - net
    return row["foregone_revenue"]


def _table_row(key: str, label: str, row: dict) -> dict:
    net = row["net_revenue"]
    margin = net - row["cost"]
    return {
        "key": key,
        "label": label,
        "units": row["units"],
        "net_revenue": net,
        "margin": margin,
        "margin_pct": (margin / net * 100) if net else 0.0,
        "discount_total": row["gross_revenue"] - net,
        "avg_price": (net / row["units"]) if row["units"] else 0.0,
        "foregone_revenue": row["foregone_revenue"],
    }


class SalesImpactSelector:
    @staticmethod
    def get_sales_impact(product: Product, params: SalesImpactParams) -> dict:
        from sales.models import SaleDeliveryLine, SaleReturnLine

        product_ids = [product.id]
        if product.has_variants:
            product_ids += list(product.variants.values_list("id", flat=True))

        date_to = params.date_to or date.today()
        date_from = params.date_from or (date_to - timedelta(days=365))

        lines = SaleDeliveryLine.objects.filter(
            product_id__in=product_ids,
            delivery__status="CONFIRMED",
            delivery__delivery_date__range=(date_from, date_to),
        )
        if params.channel:
            lines = lines.filter(sale_line__order__channel=params.channel)
        if params.customer_id:
            lines = lines.filter(sale_line__order__customer_id=params.customer_id)
        if params.variant_id:
            lines = lines.filter(product_id=params.variant_id)
        if params.uom_id:
            lines = lines.filter(uom_id=params.uom_id)
        if params.rule_id:
            lines = lines.filter(sale_line__pricing_rule_id=params.rule_id)

        net = net_revenue_expression()
        list_net = Case(
            When(
                sale_line__list_unit_price_gross__isnull=False,
                then=_f("sale_line__list_unit_price_gross")
                / (Value(1.0, output_field=FloatField()) + _f("sale_line__tax_rate") / Value(100.0, output_field=FloatField())),
            ),
            default=None,
            output_field=FloatField(),
        )
        foregone = Case(
            When(
                list_net__gt=_f("unit_price"),
                then=_f("quantity")
                * (F("list_net") - _f("unit_price"))
                * (Value(1.0, output_field=FloatField()) - discount_ratio_expression()),
            ),
            default=Value(0.0, output_field=FloatField()),
            output_field=FloatField(),
        )

        rows = list(
            lines.annotate(
                list_net=list_net,
                period=_period_expression(params.granularity),
                segment=_segment_key_expression(params.group_by),
            )
            .values("period", "segment")
            .annotate(
                units=Sum("quantity"),
                net_revenue=Sum(net),
                gross_revenue=Sum(ExpressionWrapper(F("quantity") * F("unit_price"), output_field=_DECIMAL)),
                cost=Sum(ExpressionWrapper(F("quantity") * F("unit_cost"), output_field=_DECIMAL)),
                foregone_revenue=Sum(foregone),
            )
            .order_by("period")
        )
        cells = [
            {
                "period": _period_label(r["period"], params.granularity),
                "segment": r["segment"],
                **{k: float(r[k] or 0) for k in ("units", "net_revenue", "gross_revenue", "cost", "foregone_revenue")},
            }
            for r in rows
        ]

        labels = _segment_labels(params.group_by, {c["segment"] for c in cells})
        by_segment: dict[str, dict] = {}
        series: dict[str, dict] = {}
        zero = {"units": 0.0, "net_revenue": 0.0, "gross_revenue": 0.0, "cost": 0.0, "foregone_revenue": 0.0}
        for cell in cells:
            acc = by_segment.setdefault(cell["segment"], dict(zero))
            for k in zero:
                acc[k] += cell[k]
            point = series.setdefault(cell["period"], {"period": cell["period"], "segments": {}})
            point["segments"][cell["segment"]] = _metric_value(params.metric, cell)

        ordered = sorted(by_segment, key=lambda k: -by_segment[k]["net_revenue"])
        totals_acc = {k: sum(by_segment[s][k] for s in by_segment) for k in zero}
        totals = _table_row("total", "Total", totals_acc)
        totals.pop("key")
        totals.pop("label")
        totals.pop("avg_price")

        provenance = lines.aggregate(
            with_provenance=Sum(net, filter=Q(sale_line__price_source__isnull=False)),
            since=Min("delivery__delivery_date", filter=Q(sale_line__price_source__isnull=False)),
        )
        with_prov = float(provenance["with_provenance"] or 0)
        coverage = {
            "revenue_with_provenance_pct": round(min(100.0, with_prov / totals_acc["net_revenue"] * 100), 1) if totals_acc["net_revenue"] else 0.0,
            "since": provenance["since"].isoformat() if provenance["since"] else None,
        }

        returned = SaleReturnLine.objects.filter(
            product_id__in=product_ids, return_doc__status="CONFIRMED", return_doc__date__range=(date_from, date_to)
        ).aggregate(units=Sum("quantity"), revenue=Sum(F("quantity") * F("unit_price")))

        # Return lines carry the undiscounted price: net them with the average discount of the period.
        discount_factor = totals_acc["net_revenue"] / totals_acc["gross_revenue"] if totals_acc["gross_revenue"] else 1.0

        rule_filter = Q(product_id__in=product_ids) | Q(category_id=product.category_id)
        if product.parent_template_id:
            rule_filter |= Q(product_id=product.parent_template_id)
        windows = [
            {
                "rule_id": r.pk,
                "name": r.name,
                "start": r.start_date.isoformat() if r.start_date else None,
                "end": r.end_date.isoformat() if r.end_date else None,
            }
            for r in PricingRule.objects.filter(rule_filter).order_by("start_date", "pk")
        ]

        return {
            "series": [series[p] for p in sorted(series)],
            "segments": [{"key": k, "label": labels[k]} for k in ordered],
            "table": [_table_row(k, labels[k], by_segment[k]) for k in ordered],
            "totals": totals,
            "returns": {"units": float(returned["units"] or 0), "revenue": float(returned["revenue"] or 0) * discount_factor},
            "coverage": coverage,
            "rule_windows": windows,
        }
