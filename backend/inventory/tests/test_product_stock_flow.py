"""stock_flow y stock_history de ProductSelector.get_insights: agregados en la BD, sin tope de 100 movimientos."""
from datetime import date
from decimal import Decimal

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from inventory.models import (
    ADJUSTMENT_VIRTUAL_NAMES,
    Location,
    Product,
    ProductCategory,
    StockMove,
    UoM,
    UoMCategory,
    Warehouse,
)
from inventory.selectors import ProductSelector


@pytest.fixture
def env(db):
    uom = UoM.objects.create(name="Unidad", category=UoMCategory.objects.create(name="Unit"), uom_type="REFERENCE")
    category = ProductCategory.objects.create(name="Impresos")
    warehouse = Warehouse.objects.create(name="Bodega", code="B1")
    other = Warehouse.objects.create(name="Bodega 2", code="B2")
    locs = {
        "internal": Location.objects.create(name="Interno", location_type="INTERNAL", warehouse=warehouse),
        "internal2": Location.objects.create(name="Interno 2", location_type="INTERNAL", warehouse=other),
        "vendor": Location.objects.create(name="Proveedor", location_type="VENDOR"),
        "customer": Location.objects.create(name="Cliente", location_type="CUSTOMER"),
        "adjust": Location.objects.create(name=ADJUSTMENT_VIRTUAL_NAMES[0], location_type="VIRTUAL"),
    }
    product = Product.objects.create(
        name="Resma", category=category, uom=uom, sale_uom=uom, purchase_uom=uom,
        product_type="STORABLE", sale_price=Decimal("1000"),
    )
    return {"product": product, "locs": locs, "uom": uom, "category": category}


def _move(env, src, dst, qty, cost="100", on=date(2026, 1, 15), product=None):
    return StockMove.objects.create(
        product=product or env["product"], source_location=env["locs"][src], destination_location=env["locs"][dst],
        quantity=Decimal(qty), unit_cost=Decimal(cost), date=on, description="t",
    )


def _insights(env):
    return ProductSelector.get_insights(env["product"])


def test_stock_flow_totals_by_direction(env):
    _move(env, "vendor", "internal", "10")
    _move(env, "internal", "customer", "4")
    totals = _insights(env)["stock_flow"]["totals"]
    assert totals == {"in_qty": 10.0, "in_cost": 1000.0, "out_qty": 4.0, "out_cost": 400.0}


def test_stock_flow_monthly_groups_by_month(env):
    _move(env, "vendor", "internal", "10", on=date(2026, 1, 15))
    _move(env, "internal", "customer", "3", on=date(2026, 2, 3))
    _move(env, "vendor", "internal", "5", on=date(2026, 2, 20))
    monthly = {row["month"]: row for row in _insights(env)["stock_flow"]["monthly"]}
    assert monthly["2026-01"] == {"month": "2026-01", "in": 10.0, "out": 0.0}
    assert monthly["2026-02"] == {"month": "2026-02", "in": 5.0, "out": 3.0}
    assert list(monthly) == sorted(monthly)


def test_stock_flow_includes_variants(env):
    template = env["product"]
    template.has_variants = True
    template.save()
    variant = Product.objects.create(
        name="Resma Roja", category=env["category"], uom=env["uom"], sale_uom=env["uom"],
        purchase_uom=env["uom"], product_type="STORABLE", sale_price=Decimal("1000"), parent_template=template,
    )
    _move(env, "vendor", "internal", "7", product=variant)
    assert _insights(env)["stock_flow"]["totals"]["in_qty"] == 7.0


def test_stock_flow_empty_product(env):
    flow = _insights(env)["stock_flow"]
    assert flow["totals"] == {"in_qty": 0.0, "in_cost": 0.0, "out_qty": 0.0, "out_cost": 0.0}
    assert flow["monthly"] == []
    assert _insights(env)["stock_history"] == []


def test_transfers_and_adjustments_excluded_from_flow(env):
    _move(env, "vendor", "internal", "10")
    _move(env, "internal", "internal2", "6")
    _move(env, "internal", "adjust", "1")
    totals = _insights(env)["stock_flow"]["totals"]
    assert totals["in_qty"] == 10.0
    assert totals["out_qty"] == 0.0


def test_insights_has_no_kardex_key(env):
    assert "kardex" not in _insights(env)


def test_stock_history_uses_every_move_not_only_the_last_100(env):
    for i in range(120):
        _move(env, "vendor", "internal", "1", on=date(2026, 1, 1))
    assert _insights(env)["stock_history"][-1]["stock"] == 120.0


def test_stock_history_counts_adjustments_and_ignores_transfers(env):
    _move(env, "vendor", "internal", "10", on=date(2026, 1, 1))
    _move(env, "internal", "internal2", "6", on=date(2026, 1, 2))
    _move(env, "internal", "adjust", "1", on=date(2026, 1, 3))
    _move(env, "internal", "customer", "4", on=date(2026, 1, 4))
    history = _insights(env)["stock_history"]
    assert [row["stock"] for row in history] == [10.0, 10.0, 9.0, 5.0]


def test_insights_query_count_does_not_grow_with_moves(env):
    _move(env, "vendor", "internal", "1")
    with CaptureQueriesContext(connection) as few:
        _insights(env)
    for i in range(20):
        _move(env, "vendor", "internal", "1", on=date(2026, 3, 1 + i))
    with CaptureQueriesContext(connection) as many:
        _insights(env)
    assert len(many) == len(few)
