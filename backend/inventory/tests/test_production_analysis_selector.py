# ruff: noqa: F811  (the env fixture is imported from test_sales_impact_selector)
"""ProductionAnalysisSelector: rol fabricado (OT, unidades, rectificación, insumos) y rol insumo (consumo, uso en BOM)."""
from datetime import date, datetime, timezone
from decimal import Decimal

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from inventory.models import Product
from inventory.production_analysis_selector import (
    ProductionAnalysisParams,
    ProductionAnalysisSelector,
)
from inventory.tests.test_production_performance_selector import (
    _component,
    _consume,
    _material,
    _ot,
)
from inventory.tests.test_sales_impact_selector import env  # noqa: F401

RANGE = {"date_from": date(2026, 1, 1), "date_to": date(2026, 12, 31)}


def _analysis(env, product=None, **overrides):
    return ProductionAnalysisSelector.get_analysis(product or env["product"], ProductionAnalysisParams(**{**RANGE, **overrides}))


def _manufactured(env):
    env["product"].product_type = "MANUFACTURABLE"
    env["product"].save()
    env["product"].refresh_from_db()


def _at(year, month, day):
    return datetime(year, month, day, 12, tzinfo=timezone.utc)


def _finished(env, units="10", on=_at(2026, 3, 10), rectified=False):
    return _ot(env, qty=units, finished_on=on, rectified=rectified)


# ── Rol fabricado ────────────────────────────────────────────────────────────

def test_made_only_for_manufactured(env):
    assert _analysis(env)["made"] is None
    _manufactured(env)
    assert _analysis(env)["made"] is not None


def test_made_kpis_orders_units_rectification(env):
    _manufactured(env)
    _finished(env, "10")
    _finished(env, "5", on=_at(2026, 4, 2), rectified=True)
    _finished(env, "5", on=_at(2026, 5, 2))
    _finished(env, "5", on=_at(2026, 6, 2))
    kpis = _analysis(env)["made"]["kpis"]
    assert (kpis["orders"], kpis["units"], kpis["rectified"]) == (4, 25.0, 1)
    assert kpis["rectification_rate"] == pytest.approx(25.0)


def test_made_previous_and_aligned_points(env):
    _manufactured(env)
    _finished(env, "7", on=_at(2026, 1, 15))
    _finished(env, "3", on=_at(2026, 4, 20))
    made = _analysis(env, date_from=date(2026, 4, 1), date_to=date(2026, 6, 30))["made"]
    assert made["kpis"]["units"] == pytest.approx(3.0)
    assert made["kpis"]["previous"] == {"orders": 1, "units": 7.0}
    assert [(p["period"], p["units"], p["orders"]) for p in made["series"]["points"]] == [("2026-04", 3.0, 1)]
    assert [(p["period"], p["units"]) for p in made["series"]["previous_points"]] == [("2026-04", 7.0)]


def test_made_previous_none_without_date_from(env):
    _manufactured(env)
    _finished(env)
    made = _analysis(env, date_from=None)["made"]
    assert made["kpis"]["previous"] is None
    assert made["series"]["previous_points"] == []


def test_made_materials_quantity_deviation(env):
    _manufactured(env)
    wo = _finished(env, "10")
    paper = _component(env, "Papel", "50")
    _material(wo, paper, "10", "50", env["uom"])
    _consume(env, wo, paper, "12", cost="50")
    material = _analysis(env)["made"]["materials"][0]
    assert material["name"] == "Papel"
    assert (material["planned_qty"], material["consumed_qty"], material["deviation_qty"]) == (10.0, 12.0, 2.0)
    assert material["deviation_pct"] == pytest.approx(20.0)
    assert "real_cost" not in material


def test_made_orders_list_with_rectified(env):
    _manufactured(env)
    wo = _finished(env, "4", rectified=True)
    orders = _analysis(env)["made"]["orders"]
    assert orders == [{"id": wo.id, "number": wo.number, "date": "2026-03-10", "units": 4.0, "rectified": True}]


def test_made_history_without_date_from(env):
    _manufactured(env)
    _finished(env, "6", on=_at(2024, 5, 10))
    assert _analysis(env, date_from=None)["made"]["kpis"]["units"] == pytest.approx(6.0)


def test_order_without_consumption_counts(env):
    _manufactured(env)
    _finished(env, "9")
    made = _analysis(env)["made"]
    assert made["kpis"]["orders"] == 1
    assert made["materials"] == []


def _finished_with_material(env, i, on):
    wo = _finished(env, "2", on=on)
    component = _component(env, f"C{i}", "10")
    _material(wo, component, "2", "10", env["uom"])
    _consume(env, wo, component, "2", cost="10")


def test_made_query_count_constant(env):
    _manufactured(env)
    _finished_with_material(env, 0, _at(2026, 1, 20))
    _analysis(env)  # warm the product's cached manufacturing profile
    with CaptureQueriesContext(connection) as few:
        _analysis(env)
    for i in range(1, 9):
        _finished_with_material(env, i, _at(2026, 1 + i, 3))
    with CaptureQueriesContext(connection) as many:
        _analysis(env)
    assert len(many) == len(few)


# ── Rol insumo ───────────────────────────────────────────────────────────────

def _parent(env, name="Tarjeta", price="1000"):
    return Product.objects.create(
        name=name, category=env["category"], uom=env["uom"], sale_uom=env["uom"], purchase_uom=env["uom"],
        product_type="MANUFACTURABLE", sale_price=Decimal(price),
    )


def _used_in_ot(env, qty, parent, on=_at(2026, 3, 10), consumed_on=date(2026, 3, 5), component=None):
    from production.models import ProductionConsumption

    wo = _ot(env, qty="1", finished_on=on, product=parent)
    consumption = _consume(env, wo, component or env["product"], qty, cost="10")
    ProductionConsumption.objects.filter(pk=consumption.pk).update(date=consumed_on)
    return wo


def _in_bom(env, parent, qty="2"):
    from production.models import BillOfMaterials, BillOfMaterialsLine

    bom = BillOfMaterials.objects.create(product=parent, name="BOM", active=True)
    BillOfMaterialsLine.objects.create(bom=bom, component=env["product"], quantity=Decimal(qty), uom=env["uom"])


def test_input_only_when_used_in_production(env):
    assert _analysis(env)["input"] is None
    _in_bom(env, _parent(env))
    assert _analysis(env)["input"] is not None


def test_input_consumption_and_orders(env):
    card = _parent(env)
    _used_in_ot(env, "4", card)
    _used_in_ot(env, "6", card, consumed_on=date(2026, 5, 2))
    kpis = _analysis(env)["input"]["kpis"]
    assert (kpis["consumed"], kpis["orders"]) == (10.0, 2)


def test_input_previous_and_aligned_points(env):
    card = _parent(env)
    _used_in_ot(env, "7", card, consumed_on=date(2026, 1, 15))
    _used_in_ot(env, "3", card, consumed_on=date(2026, 4, 20))
    data = _analysis(env, date_from=date(2026, 4, 1), date_to=date(2026, 6, 30))["input"]
    assert data["kpis"]["previous"] == {"consumed": 7.0, "orders": 1}
    assert [(p["period"], p["consumed"]) for p in data["series"]["points"]] == [("2026-04", 3.0)]
    assert [(p["period"], p["consumed"]) for p in data["series"]["previous_points"]] == [("2026-04", 7.0)]


def test_input_by_product_share(env):
    card, flyer = _parent(env, "Tarjeta"), _parent(env, "Volante")
    _used_in_ot(env, "6", card)
    _used_in_ot(env, "2", flyer)
    rows = {r["name"]: r for r in _analysis(env)["input"]["by_product"]}
    assert rows["Tarjeta"]["qty"] == pytest.approx(6.0)
    assert rows["Tarjeta"]["share_pct"] == pytest.approx(75.0)
    assert rows["Volante"]["product_id"] == flyer.id


def test_input_includes_variant_consumption(env):
    parent = env["product"]
    variant = Product.objects.create(
        name="Tarjeta v2", category=env["category"], uom=env["uom"], sale_uom=env["uom"], purchase_uom=env["uom"],
        product_type="STORABLE", sale_price=Decimal("1000"), parent_template=parent,
    )
    Product.objects.filter(pk=parent.pk).update(has_variants=True)
    parent.refresh_from_db()
    _used_in_ot(env, "5", _parent(env), component=variant)
    assert _analysis(env, product=parent)["input"]["kpis"]["consumed"] == pytest.approx(5.0)


def test_used_in_matches_sourcing(env):
    from inventory.sourcing_selector import SourcingSelector

    _in_bom(env, _parent(env))
    expected = SourcingSelector.get_sourcing(env["product"], increase_pct=20)["used_in"]
    assert _analysis(env, increase_pct=20)["input"]["used_in"] == expected


def test_increase_pct_changes_margin_after(env):
    Product.objects.filter(pk=env["product"].pk).update(cost_price=Decimal("100"))
    env["product"].refresh_from_db()
    _in_bom(env, _parent(env, price="1000"))
    low = _analysis(env, increase_pct=5)["input"]["used_in"]["parents"][0]
    high = _analysis(env, increase_pct=20)["input"]["used_in"]["parents"][0]
    assert high["margin_pct_after"] < low["margin_pct_after"]
    assert high["margin_pct"] == low["margin_pct"]


def test_input_query_count_constant(env):
    _used_in_ot(env, "1", _parent(env, "P0"))
    _analysis(env)
    with CaptureQueriesContext(connection) as few:
        _analysis(env)
    for i in range(1, 8):
        parent = _parent(env, f"P{i}")
        _in_bom(env, parent)
        _used_in_ot(env, "1", parent, consumed_on=date(2026, 1 + i, 3))
    with CaptureQueriesContext(connection) as many:
        _analysis(env)
    assert len(many) == len(few)
