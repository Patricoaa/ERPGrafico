# ruff: noqa: F811  (fixtures/helpers are imported from sibling test modules)
"""CostsSelector: costo por modo (comprado, fabricable con/sin stock, sin BOM, solo stock)."""
from datetime import date, datetime, timezone
from decimal import Decimal

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from inventory.costs_selector import CostsParams, CostsSelector
from inventory.models import Product
from inventory.tests.test_sales_impact_selector import env  # noqa: F401
from inventory.tests.test_sourcing_selector import _bom, _receipt

RANGE = {"date_from": date(2026, 1, 1), "date_to": date(2026, 12, 31)}


def _costs(env, product=None, **overrides):
    return CostsSelector.get_costs(product or env["product"], CostsParams(**{**RANGE, **overrides}))


def _at(day: date) -> datetime:
    return datetime(day.year, day.month, day.day, 12, tzinfo=timezone.utc)


def _cost_history(product, *changes, created=date(2025, 12, 1)):
    """Fija el historial de ``cost_price``: creación en ``created`` y luego ``(fecha, costo)`` por cambio."""
    product.history.update(history_date=_at(created))
    for day, cost in changes:
        product.cost_price = Decimal(cost)
        product.save()
        product.history.filter(pk=product.history.latest("history_id").pk).update(history_date=_at(day))
    product.refresh_from_db()


def _as(env, product_type, track_inventory=None, purchasable=None):
    product = env["product"]
    product.product_type = product_type
    if track_inventory is not None:
        product.track_inventory = track_inventory
    if purchasable is not None:
        product.can_be_purchased = purchasable
    product.save()
    product.refresh_from_db()
    return product


def _component(env, name="Papel", cost="50"):
    return Product.objects.create(
        name=name, category=env["category"], uom=env["uom"], sale_uom=env["uom"], purchase_uom=env["uom"],
        product_type="STORABLE", sale_price=Decimal("10"), cost_price=Decimal(cost),
    )


# ── Modo ─────────────────────────────────────────────────────────────────────

def test_mode_purchased(env):
    assert _costs(env)["mode"] == "purchased"


def test_mode_stock_only(env):
    _as(env, "STORABLE", purchasable=False)
    assert _costs(env)["mode"] == "stock_only"


def test_mode_manufactured_stock(env):
    product = _as(env, "MANUFACTURABLE", track_inventory=True)
    _bom(product, [(_component(env), "2", env["uom"])])
    assert _costs(env)["mode"] == "manufactured_stock"


def test_mode_manufactured_on_demand(env):
    product = _as(env, "MANUFACTURABLE", track_inventory=False)
    _bom(product, [(_component(env), "2", env["uom"])])
    assert _costs(env)["mode"] == "manufactured_on_demand"


def test_mode_manufactured_no_bom(env):
    _as(env, "MANUFACTURABLE", track_inventory=True)
    assert _costs(env)["mode"] == "manufactured_no_bom"


# ── Hoy y KPIs ───────────────────────────────────────────────────────────────

def test_today_purchased(env):
    _cost_history(env["product"], (date(2026, 2, 1), "120"))
    _receipt(env, "10", "100", on=date(2026, 2, 1))
    _receipt(env, "5", "150", on=date(2026, 6, 1))
    today = _costs(env)["today"]
    assert today["weighted_cost"] == pytest.approx(120.0)
    assert today["last_purchase"] == {"date": "2026-06-01", "unit_cost": 150.0, "supplier": env["customer"].name}
    assert today["bom_cost"] is None
    assert today["stock_qty"] == pytest.approx(0.0)
    assert today["stock_value"] == pytest.approx(0.0)


def test_today_without_stock_has_no_stock_value(env):
    _as(env, "STORABLE", track_inventory=False)
    today = _costs(env)["today"]
    assert today["stock_qty"] is None
    assert today["stock_value"] is None


def test_weighted_series_uses_last_value_per_period(env):
    _cost_history(env["product"], (date(2026, 3, 5), "100"), (date(2026, 3, 20), "110"), (date(2026, 6, 1), "130"))
    series = {p["period"]: p for p in _costs(env)["series"]}
    assert series["2026-01"]["weighted_cost"] == pytest.approx(0.0)
    assert series["2026-03"]["weighted_cost"] == pytest.approx(110.0)
    assert series["2026-06"]["weighted_cost"] == pytest.approx(130.0)
    assert series["2026-12"]["weighted_cost"] == pytest.approx(130.0)
    assert series["2026-03"]["bom_cost"] is None


def test_purchases_avg_min_max_and_period_avg(env):
    _receipt(env, "10", "100", on=date(2026, 2, 1))
    _receipt(env, "30", "200", on=date(2026, 2, 20))
    _receipt(env, "10", "120", on=date(2026, 5, 1))
    _receipt(env, "10", "999", on=date(2025, 5, 1))
    result = _costs(env)
    assert result["purchases"] == {"min": 100.0, "max": 200.0, "avg": pytest.approx(8200 / 50), "count": 3}
    series = {p["period"]: p for p in result["series"]}
    assert series["2026-02"]["purchase_avg"] == pytest.approx(7000 / 40)
    assert series["2026-05"]["purchase_avg"] == pytest.approx(120.0)


def test_cost_change_pct(env):
    _cost_history(env["product"], (date(2025, 12, 20), "100"), (date(2026, 6, 1), "125"))
    assert _costs(env)["kpis"]["cost_change_pct"] == pytest.approx(25.0)
    assert _costs(env, date_from=None)["kpis"]["cost_change_pct"] is None


def test_replacement_gap_purchased(env):
    _cost_history(env["product"], (date(2026, 2, 1), "100"))
    _receipt(env, "10", "110", on=date(2026, 6, 1))
    assert _costs(env)["kpis"]["replacement_gap_pct"] == pytest.approx(10.0)


def test_empty_product(env):
    result = _costs(env)
    assert result["kpis"] == {"cost_change_pct": None, "replacement_gap_pct": None}
    assert result["purchases"] == {"min": None, "max": None, "avg": None, "count": 0}
    assert result["today"]["last_purchase"] is None


def test_query_count_constant_with_more_rows(env):
    _receipt(env, "10", "100", on=date(2026, 2, 1))
    with CaptureQueriesContext(connection) as few:
        _costs(env)
    for i in range(10):
        _receipt(env, "1", str(100 + i), on=date(2026, 1 + i, 3))
        env["product"].cost_price = Decimal(100 + i)
        env["product"].save()
    with CaptureQueriesContext(connection) as many:
        _costs(env)
    assert len(many) == len(few)
