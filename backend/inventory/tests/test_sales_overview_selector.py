# ruff: noqa: F811  (the env fixture is imported from test_sales_impact_selector)
"""SalesOverviewSelector: volumen, clientes, canales y período anterior de un producto."""
import itertools
from datetime import date
from decimal import Decimal

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from contacts.models import Contact
from inventory.models import Product
from inventory.sales_overview_selector import SalesOverviewParams, SalesOverviewSelector
from inventory.tests.test_sales_impact_selector import _sale, env  # noqa: F401
from sales.models import SaleOrder, SaleReturn, SaleReturnLine

RANGE = {"date_from": date(2026, 1, 1), "date_to": date(2026, 12, 31)}
_n = itertools.count(1)


def _overview(env, **overrides):
    return SalesOverviewSelector.get_overview(env["product"], SalesOverviewParams(**{**RANGE, **overrides}))


def _customer(name: str) -> Contact:
    n = next(_n)
    return Contact.objects.create(name=name, tax_id=f"9{n:07d}-1")


def _return(env, qty: str, on: date = date(2026, 4, 1)):
    order = SaleOrder.objects.first()
    doc = SaleReturn.objects.create(
        sale_order=order, warehouse=env["warehouse"], date=on, status="CONFIRMED", number=f"R-{next(_n)}",
    )
    SaleReturnLine.objects.create(
        return_doc=doc, product=env["product"], uom=env["uom"], quantity=Decimal(qty),
        unit_price=Decimal("1000"), unit_cost=Decimal("400"),
    )


def test_kpis_units_revenue_and_distinct_customers(env):
    a, b = _customer("A"), _customer("B")
    _sale(env, qty="10", price="1000", gross="1190", discount="1190", customer=a)
    _sale(env, qty="5", customer=a, on=date(2026, 4, 1))
    _sale(env, qty="5", customer=b, on=date(2026, 5, 1))
    kpis = _overview(env)["kpis"]
    assert kpis["units"] == pytest.approx(20.0)
    assert kpis["net_revenue"] == pytest.approx(9000.0 + 5000.0 + 5000.0)
    assert kpis["customers"] == 2


def test_customers_not_capped_at_ten(env):
    for i in range(12):
        _sale(env, qty="1", customer=_customer(f"C{i}"))
    assert _overview(env)["kpis"]["customers"] == 12


def test_series_points_by_month(env):
    _sale(env, qty="10", on=date(2026, 3, 10))
    _sale(env, qty="5", on=date(2026, 4, 10))
    points = _overview(env)["series"]["points"]
    assert [(p["period"], p["units"]) for p in points] == [("2026-03", 10.0), ("2026-04", 5.0)]
    assert points[0]["net_revenue"] == pytest.approx(10000.0)


def test_previous_is_equal_length_window_before_date_from(env):
    _sale(env, qty="7", on=date(2025, 12, 20))
    _sale(env, qty="3", on=date(2026, 1, 10))
    result = _overview(env, date_from=date(2026, 1, 1), date_to=date(2026, 1, 20))
    assert result["kpis"]["units"] == pytest.approx(3.0)
    assert result["kpis"]["previous"]["units"] == pytest.approx(7.0)
    assert result["kpis"]["previous"]["customers"] == 1


def test_previous_is_none_without_date_from(env):
    _sale(env)
    result = _overview(env, date_from=None)
    assert result["kpis"]["previous"] is None
    assert result["series"]["previous_points"] == []


def test_previous_points_aligned_to_current_periods(env):
    _sale(env, qty="7", on=date(2026, 1, 15))
    result = _overview(env, date_from=date(2026, 4, 1), date_to=date(2026, 6, 30))
    assert [(p["period"], p["units"]) for p in result["series"]["previous_points"]] == [("2026-04", 7.0)]


def test_returns_rate(env):
    _sale(env, qty="10")
    _return(env, "2")
    kpis = _overview(env)["kpis"]
    assert kpis["return_units"] == pytest.approx(2.0)
    assert kpis["return_rate_pct"] == pytest.approx(20.0)


def test_last_sale_uses_whole_history(env):
    _sale(env, qty="4", on=date(2025, 3, 10))
    kpis = _overview(env)["kpis"]
    assert kpis["units"] == 0.0
    assert kpis["last_sale_date"] == "2025-03-10"
    assert kpis["days_since_last_sale"] == (date.today() - date(2025, 3, 10)).days


def test_no_sales_at_all(env):
    result = _overview(env)
    assert result["kpis"]["last_sale_date"] is None
    assert result["kpis"]["days_since_last_sale"] is None
    assert result["kpis"]["return_rate_pct"] == 0.0
    assert result["series"] == {"points": [], "previous_points": []}


def test_includes_variant_sales(env):
    parent = env["product"]
    variant = Product.objects.create(
        name="Tarjeta v2", category=env["category"], uom=env["uom"], sale_uom=env["uom"], purchase_uom=env["uom"],
        product_type="STORABLE", sale_price=Decimal("1000"), parent_template=parent,
    )
    Product.objects.filter(pk=parent.pk).update(has_variants=True)
    parent.refresh_from_db()
    _sale(env, qty="4", product=variant)
    result = SalesOverviewSelector.get_overview(parent, SalesOverviewParams(**RANGE))
    assert result["kpis"]["units"] == pytest.approx(4.0)


def test_query_count_constant_with_more_rows(env):
    _sale(env)
    with CaptureQueriesContext(connection) as few:
        _overview(env)
    for i in range(15):
        _sale(env, on=date(2026, 1 + i % 11, 5), customer=_customer(f"Q{i}"))
    with CaptureQueriesContext(connection) as many:
        _overview(env)
    assert len(many) == len(few)


def _variant(env, name="Tarjeta v2"):
    return Product.objects.create(
        name=name, category=env["category"], uom=env["uom"], sale_uom=env["uom"], purchase_uom=env["uom"],
        product_type="STORABLE", sale_price=Decimal("1000"), parent_template=env["product"],
        variant_display_name=name,
    )


def test_customers_top_with_share_and_concentration(env):
    for name, qty in (("A", "50"), ("B", "30"), ("C", "10"), ("D", "10")):
        _sale(env, qty=qty, customer=_customer(name))
    customers = _overview(env)["customers"]
    assert customers["total"] == 4
    assert customers["top3_share_pct"] == pytest.approx(90.0)
    assert [(c["name"], c["share_pct"]) for c in customers["top"][:2]] == [("A", pytest.approx(50.0)), ("B", pytest.approx(30.0))]
    assert customers["top"][0]["units"] == pytest.approx(50.0)


def test_customers_top_limited_to_ten(env):
    for i in range(12):
        _sale(env, qty="1", customer=_customer(f"C{i}"))
    customers = _overview(env)["customers"]
    assert len(customers["top"]) == 10
    assert customers["total"] == 12


def test_default_customer_is_counter_not_a_customer(env):
    counter = Contact.objects.create(name="Cliente genérico", tax_id="66666666-6", is_default_customer=True)
    _sale(env, qty="10", customer=counter)
    _sale(env, qty="6", customer=_customer("A"))
    _sale(env, qty="4", customer=_customer("B"))
    result = _overview(env)
    assert result["kpis"]["customers"] == 2
    assert result["customers"]["total"] == 2
    assert result["customers"]["top3_share_pct"] == pytest.approx(100.0)
    rows = {c["name"]: c for c in result["customers"]["top"]}
    assert rows["Mostrador (POS)"]["share_pct"] == pytest.approx(50.0)
    assert rows["A"]["share_pct"] == pytest.approx(30.0)


def test_channels_split_system_and_pos(env):
    _sale(env, qty="6", channel="SYSTEM")
    _sale(env, qty="4", channel="POS")
    channels = {c["key"]: c for c in _overview(env)["channels"]}
    assert channels["SYSTEM"]["label"] == "Sistema"
    assert channels["POS"]["label"] == "Punto de Venta (POS)"
    assert channels["SYSTEM"]["share_pct"] == pytest.approx(60.0)


def test_variants_only_when_product_has_variants(env):
    _sale(env, qty="5")
    assert _overview(env)["variants"] == []
    v1, v2 = _variant(env, "Tarjeta A4"), _variant(env, "Tarjeta A5")
    Product.objects.filter(pk=env["product"].pk).update(has_variants=True)
    env["product"].refresh_from_db()
    _sale(env, qty="6", product=v1)
    _sale(env, qty="4", product=v2)
    variants = _overview(env)["variants"]
    by_label = {v["label"]: v["units"] for v in variants}
    assert by_label["Tarjeta A4"] == 6.0
    assert by_label["Tarjeta A5"] == 4.0


def test_uoms_only_when_more_than_one(env):
    from inventory.models import UoM

    _sale(env, qty="5")
    assert _overview(env)["uoms"] == []
    box = UoM.objects.create(name="Caja", category=env["uom"].category, uom_type="BIGGER", ratio=Decimal("10"))
    _sale(env, qty="2", uom=box)
    uoms = _overview(env)["uoms"]
    assert {u["label"] for u in uoms} == {"Unidad", "Caja"}


def test_shares_sum_to_100(env):
    for qty, channel in (("3", "SYSTEM"), ("5", "POS"), ("2", "SYSTEM")):
        _sale(env, qty=qty, channel=channel, customer=_customer(f"S{qty}"))
    result = _overview(env)
    assert sum(c["share_pct"] for c in result["channels"]) == pytest.approx(100.0)
    assert sum(c["share_pct"] for c in result["customers"]["top"]) == pytest.approx(100.0)


def test_breakdowns_query_count_constant_with_more_rows(env):
    Product.objects.filter(pk=env["product"].pk).update(has_variants=True)
    env["product"].refresh_from_db()
    variant = _variant(env)
    _sale(env, product=variant)
    with CaptureQueriesContext(connection) as few:
        _overview(env)
    for i in range(15):
        _sale(env, on=date(2026, 1 + i % 11, 5), customer=_customer(f"B{i}"), channel="POS" if i % 2 else "SYSTEM")
    with CaptureQueriesContext(connection) as many:
        _overview(env)
    assert len(many) == len(few)
