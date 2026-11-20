"""SalesImpactSelector: margen real neto de descuentos y analítica de reglas de precio."""
import itertools
from datetime import date
from decimal import Decimal

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from contacts.models import Contact
from inventory.models import PricingRule, Product, ProductCategory, UoM, UoMCategory, Warehouse
from inventory.sales_impact_selector import SalesImpactParams, SalesImpactSelector
from sales.models import (
    SaleDelivery,
    SaleDeliveryLine,
    SaleLine,
    SaleOrder,
    SaleReturn,
    SaleReturnLine,
)

_seq = itertools.count(1)
RANGE = {"date_from": date(2026, 1, 1), "date_to": date(2026, 12, 31)}


@pytest.fixture
def env(db):
    uom = UoM.objects.create(name="Unidad", category=UoMCategory.objects.create(name="Unit"), uom_type="REFERENCE")
    category = ProductCategory.objects.create(name="Impresos")
    product = Product.objects.create(
        name="Tarjeta", category=category, uom=uom, sale_uom=uom, purchase_uom=uom,
        product_type="STORABLE", sale_price=Decimal("1000"),
    )
    return {
        "uom": uom, "category": category, "product": product,
        "customer": Contact.objects.create(name="Cliente A", tax_id="11111111-1"),
        "warehouse": Warehouse.objects.create(name="Bodega", code="B1"),
    }


def _sale(env, qty="10", delivered=None, price="1000", gross="1190", cost="400", discount="0", on=date(2026, 3, 10),
          rule=None, source=None, list_gross=None, channel="SYSTEM", customer=None, product=None, uom=None,
          tax="19.00", status="CONFIRMED"):
    n = next(_seq)
    product = product or env["product"]
    order = SaleOrder.objects.create(
        customer=customer or env["customer"], number=f"SO-{n}", channel=channel,
        total=Decimal("0"), total_net=Decimal("0"), total_tax=Decimal("0"),
    )
    line = SaleLine.objects.create(
        order=order, product=product, description="x", quantity=Decimal(qty), uom=uom or env["uom"],
        unit_price=Decimal(price), unit_price_gross=None if gross is None else Decimal(gross),
        discount_amount=Decimal(discount), tax_rate=Decimal(tax),
        pricing_rule=rule, price_source=source,
        list_unit_price_gross=None if list_gross is None else Decimal(list_gross),
    )
    delivery = SaleDelivery.objects.create(
        sale_order=order, warehouse=env["warehouse"], delivery_date=on, status=status, number=f"D-{n}",
    )
    return SaleDeliveryLine.objects.create(
        delivery=delivery, sale_line=line, product=product, uom=uom or env["uom"],
        quantity=Decimal(delivered or qty), unit_price=Decimal(price),
        unit_price_gross=None if gross is None else Decimal(gross), unit_cost=Decimal(cost),
    )


def _rule(env, name="Mayorista", **kw):
    defaults = dict(
        name=name, product=env["product"], operator="GE", min_quantity=Decimal("10"), uom=env["uom"],
        rule_type="FIXED", fixed_price_gross=Decimal("1000"),
    )
    defaults.update(kw)
    return PricingRule.objects.create(**defaults)


def _impact(env, **kw):
    return SalesImpactSelector.get_sales_impact(env["product"], SalesImpactParams(**{**RANGE, **kw}))


def _totals(env, **kw):
    return _impact(env, **kw)["totals"]


def test_net_revenue_applies_line_discount(env):
    _sale(env, qty="10", price="1000", gross="1190", discount="1190")  # 10 % del bruto
    assert _totals(env)["net_revenue"] == pytest.approx(9000.0)
    assert _totals(env)["discount_total"] == pytest.approx(1000.0)


def test_no_unit_price_gross_means_no_discount(env):
    _sale(env, qty="10", price="1000", gross=None, discount="1190")
    assert _totals(env)["net_revenue"] == pytest.approx(10000.0)


def test_discount_ratio_is_clamped_to_one(env):
    _sale(env, qty="1", price="1000", gross="1190", discount="999999")
    assert _totals(env)["net_revenue"] == pytest.approx(0.0)


def test_partial_delivery_prorates_discount(env):
    _sale(env, qty="10", delivered="5", price="1000", gross="1190", discount="1190")
    assert _totals(env)["net_revenue"] == pytest.approx(5 * 1000 * 0.9)


def test_margin_uses_frozen_unit_cost(env):
    _sale(env, qty="10", price="1000", gross="1190", cost="400")
    totals = _totals(env)
    assert totals["margin"] == pytest.approx(6000.0)
    assert totals["margin_pct"] == pytest.approx(60.0)


def test_group_by_rule_segments(env):
    rule = _rule(env)
    _sale(env, rule=rule, source="RULE", list_gross="1190")
    _sale(env, source="MANUAL", list_gross="1190")
    _sale(env, source="LIST", list_gross="1190")
    _sale(env, source=None)
    labels = {s["label"] for s in _impact(env)["segments"]}
    assert labels == {"Mayorista", "Manual", "Precio de lista", "Sin registro"}


def test_foregone_revenue_only_with_list_price(env):
    rule = _rule(env)
    # lista 1190 bruto (1000 neto), vendido a 840 neto → deja de percibir 160 × 10
    _sale(env, qty="10", price="840", gross="1000", rule=rule, source="RULE", list_gross="1190")
    _sale(env, qty="10", price="840", gross="1000", source=None)
    by_label = {r["label"]: r for r in _impact(env)["table"]}
    assert by_label["Mayorista"]["foregone_revenue"] == pytest.approx(1600.0)
    assert by_label["Sin registro"]["foregone_revenue"] == pytest.approx(0.0)


def test_group_by_channel_customer_variant_uom(env):
    other = Contact.objects.create(name="Cliente B", tax_id="22222222-2")
    _sale(env, channel="POS", customer=other)
    _sale(env, channel="SYSTEM")
    assert {s["label"] for s in _impact(env, group_by="channel")["segments"]} == {"Punto de Venta (POS)", "Sistema"}
    assert {s["label"] for s in _impact(env, group_by="customer")["segments"]} == {"Cliente A", "Cliente B"}
    assert {s["label"] for s in _impact(env, group_by="uom")["segments"]} == {"Unidad"}
    assert len(_impact(env, group_by="variant")["segments"]) == 1


def test_variants_included_and_sum_to_total(env):
    template = env["product"]
    template.has_variants = True
    template.save()
    variant = Product.objects.create(
        name="Tarjeta Roja", category=env["category"], uom=env["uom"], sale_uom=env["uom"],
        purchase_uom=env["uom"], product_type="STORABLE", sale_price=Decimal("1000"), parent_template=template,
    )
    _sale(env, qty="2")
    _sale(env, qty="3", product=variant)
    result = _impact(env, group_by="variant", metric="units")
    assert sum(r["units"] for r in result["table"]) == pytest.approx(5.0)
    assert result["totals"]["units"] == pytest.approx(5.0)


def test_granularity_month_and_day(env):
    _sale(env, on=date(2026, 3, 10))
    _sale(env, on=date(2026, 3, 20))
    _sale(env, on=date(2026, 4, 1))
    assert [p["period"] for p in _impact(env, granularity="month")["series"]] == ["2026-03", "2026-04"]
    assert [p["period"] for p in _impact(env, granularity="day")["series"]] == ["2026-03-10", "2026-03-20", "2026-04-01"]
    assert [p["period"] for p in _impact(env, granularity="year")["series"]] == ["2026"]


def test_filters_by_rule_and_channel(env):
    rule = _rule(env)
    _sale(env, qty="10", rule=rule, source="RULE", channel="POS")
    _sale(env, qty="4", channel="SYSTEM")
    assert _totals(env, rule_id=rule.id)["units"] == pytest.approx(10.0)
    assert _totals(env, channel="SYSTEM")["units"] == pytest.approx(4.0)


def test_empty_range_returns_zeroed_totals(env):
    result = _impact(env)
    assert result["series"] == [] and result["table"] == [] and result["segments"] == []
    assert result["totals"]["net_revenue"] == 0.0
    assert result["totals"]["margin_pct"] == 0.0
    assert result["coverage"] == {"revenue_with_provenance_pct": 0.0, "since": None}


def test_unconfirmed_and_out_of_range_deliveries_are_ignored(env):
    _sale(env, status="DRAFT")
    _sale(env, on=date(2025, 6, 1))
    assert _totals(env)["units"] == 0.0


def test_coverage_reports_share_with_provenance(env):
    rule = _rule(env)
    _sale(env, qty="1", price="1000", gross="1190", rule=rule, source="RULE", on=date(2026, 5, 1))
    _sale(env, qty="3", price="1000", gross="1190", source=None)
    coverage = _impact(env)["coverage"]
    assert coverage["revenue_with_provenance_pct"] == pytest.approx(25.0)
    assert coverage["since"] == "2026-05-01"


def test_rule_windows_include_product_category_and_parent_rules(env):
    _rule(env, name="Del producto", start_date=date(2026, 1, 1), end_date=date(2026, 2, 1))
    _rule(env, name="De la categoría", product=None, category=env["category"])
    windows = {w["name"]: w for w in _impact(env)["rule_windows"]}
    assert set(windows) == {"Del producto", "De la categoría"}
    assert windows["Del producto"]["start"] == "2026-01-01"
    assert windows["De la categoría"]["start"] is None


def test_returns_reported_separately(env):
    _sale(env, qty="10")
    order = SaleOrder.objects.first()
    sale_return = SaleReturn.objects.create(
        sale_order=order, warehouse=env["warehouse"], date=date(2026, 4, 1), status="CONFIRMED", number="R-1",
    )
    SaleReturnLine.objects.create(
        return_doc=sale_return, product=env["product"], uom=env["uom"], quantity=Decimal("2"),
        unit_price=Decimal("1000"), unit_cost=Decimal("400"),
    )
    result = _impact(env)
    assert result["returns"] == {"units": 2.0, "revenue": 2000.0}
    assert result["totals"]["units"] == pytest.approx(10.0)


def test_query_count_constant_with_more_rows(env):
    _sale(env)
    with CaptureQueriesContext(connection) as few:
        _impact(env, group_by="customer")
    for i in range(15):
        _sale(env, on=date(2026, 1 + i % 11, 5))
    with CaptureQueriesContext(connection) as many:
        _impact(env, group_by="customer")
    assert len(many) == len(few)


