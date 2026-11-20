# ruff: noqa: F811  (the env fixture is imported from test_sales_impact_selector)
"""ProductionAnalysisSelector: rol fabricado (OT, unidades, rectificación, insumos) y rol insumo (consumo, uso en BOM)."""
from datetime import date, datetime, timezone

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

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
