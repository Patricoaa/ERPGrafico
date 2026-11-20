# ruff: noqa: F811  (the env fixture is imported from test_sales_impact_selector)
"""StockAnalysisSelector: existencia, comprometido, rotación, flujos, ajustes, bodegas y variantes."""
import itertools
from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from django.test.utils import CaptureQueriesContext

from inventory.models import (
    ADJUSTMENT_VIRTUAL_NAMES,
    Location,
    Product,
    Stock,
    StockMove,
    Warehouse,
)
from inventory.operations_selector import OperationsSelector
from inventory.stock_analysis_selector import StockAnalysisParams, StockAnalysisSelector
from inventory.tests.test_sales_impact_selector import env  # noqa: F401
from sales.models import DraftCart, SaleLine, SaleOrder

RANGE = {"date_from": date(2026, 1, 1), "date_to": date(2026, 12, 31)}
_n = itertools.count(1)


def _analysis(env, product=None, **overrides):
    return StockAnalysisSelector.get_analysis(product or env["product"], StockAnalysisParams(**{**RANGE, **overrides}))


def _loc(env, kind: str, warehouse=None) -> Location:
    names = {
        "internal": ("Interno", "INTERNAL"), "vendor": ("Proveedor", "VENDOR"), "customer": ("Cliente", "CUSTOMER"),
        "production": ("Producción", "VIRTUAL"), "loss": (ADJUSTMENT_VIRTUAL_NAMES[0], "VIRTUAL"),
        "gain": (ADJUSTMENT_VIRTUAL_NAMES[1], "VIRTUAL"), "revaluation": (ADJUSTMENT_VIRTUAL_NAMES[2], "VIRTUAL"),
    }
    name, location_type = names[kind]
    wh = warehouse or env["warehouse"]
    if location_type == "INTERNAL":
        return Location.objects.get_or_create(name=f"{name} {wh.code}", location_type="INTERNAL", warehouse=wh)[0]
    return Location.objects.get_or_create(name=name, location_type=location_type)[0]


def _move(env, src: str, dst: str, qty: str, on=date(2026, 3, 1), cost="10", product=None, src_wh=None, dst_wh=None):
    return StockMove.objects.create(
        product=product or env["product"], source_location=_loc(env, src, src_wh), destination_location=_loc(env, dst, dst_wh),
        quantity=Decimal(qty), unit_cost=Decimal(cost), date=on, description="t",
    )


def _stock(env, qty: str, warehouse=None, product=None):
    Stock.objects.update_or_create(
        product=product or env["product"], warehouse=warehouse or env["warehouse"], defaults={"quantity": Decimal(qty)},
    )


def _confirmed_sale(env, qty: str, delivered: str):
    order = SaleOrder.objects.create(
        customer=env["customer"], number=f"SO-R{next(_n)}", status="CONFIRMED",
        total=Decimal("0"), total_net=Decimal("0"), total_tax=Decimal("0"),
    )
    SaleLine.objects.create(
        order=order, product=env["product"], description="x", quantity=Decimal(qty), quantity_delivered=Decimal(delivered),
        uom=env["uom"], unit_price=Decimal("1000"), tax_rate=Decimal("19"),
    )


def _pos_cart(env, qty: int, status="OPEN"):
    from treasury.models import POSSession

    user = get_user_model().objects.create(username=f"cajero{next(_n)}")
    session = POSSession.objects.create(user=user, status=status)
    DraftCart.objects.create(pos_session=session, items=[{"id": env["product"].id, "quantity": qty}])


def _ot_material(env, planned: str, status="IN_PROGRESS"):
    from inventory.tests.test_production_performance_selector import _material, _ot

    wo = _ot(env, status=status)
    _material(wo, env["product"], planned, "0", env["uom"])


# ── Hoy ──────────────────────────────────────────────────────────────────────

def test_today_on_hand_value_reserved_available(env):
    Product.objects.filter(pk=env["product"].pk).update(cost_price=Decimal("50"))
    env["product"].refresh_from_db()
    _stock(env, "20")
    _confirmed_sale(env, "10", "4")
    today = _analysis(env)["today"]
    assert today == {"on_hand": 20.0, "value": 1000.0, "reserved": 6.0, "available": 14.0}


def test_reserved_matches_get_qty_reserved(env):
    _stock(env, "50")
    _confirmed_sale(env, "10", "4")
    _pos_cart(env, 3)
    _pos_cart(env, 99, status="CLOSED")
    _ot_material(env, "5")
    _ot_material(env, "7", status="FINISHED")
    assert _analysis(env)["today"]["reserved"] == pytest.approx(float(env["product"].get_qty_reserved()))
    assert _analysis(env)["today"]["reserved"] == pytest.approx(6 + 3 + 5)


def test_reserved_includes_variants(env):
    parent = env["product"]
    variant = Product.objects.create(
        name="Tarjeta v2", category=env["category"], uom=env["uom"], sale_uom=env["uom"], purchase_uom=env["uom"],
        product_type="STORABLE", sale_price=Decimal("1000"), parent_template=parent,
    )
    Product.objects.filter(pk=parent.pk).update(has_variants=True)
    parent.refresh_from_db()
    _stock(env, "5", product=variant)
    order = SaleOrder.objects.create(
        customer=env["customer"], number="SO-V", status="CONFIRMED",
        total=Decimal("0"), total_net=Decimal("0"), total_tax=Decimal("0"),
    )
    SaleLine.objects.create(order=order, product=variant, description="x", quantity=Decimal("2"), uom=env["uom"],
                            unit_price=Decimal("1000"), tax_rate=Decimal("19"))
    today = _analysis(env, product=parent)["today"]
    assert today["on_hand"] == pytest.approx(5.0)
    assert today["reserved"] == pytest.approx(2.0)


def test_available_negative(env):
    _stock(env, "2")
    _confirmed_sale(env, "10", "0")
    assert _analysis(env)["today"]["available"] == pytest.approx(-8.0)


# ── Rotación ─────────────────────────────────────────────────────────────────

def test_rotation_matches_operations(env):
    _move(env, "vendor", "internal", "30", on=date(2026, 1, 10))
    _move(env, "internal", "customer", "10", on=date(2026, 6, 1))
    rotation = _analysis(env)["rotation"]
    expected = OperationsSelector._rotation(env["product"], [env["product"].id], RANGE["date_from"], RANGE["date_to"], 90)
    for key in ("in_qty", "out_qty", "avg_stock", "turnover", "days_of_inventory", "last_in_date", "last_out_date", "idle"):
        assert rotation[key] == pytest.approx(expected[key]) if isinstance(expected[key], float) else rotation[key] == expected[key]
    assert rotation["idle_days"] == 90


def test_rotation_history_without_date_from(env):
    _move(env, "vendor", "internal", "30", on=date(2023, 1, 10))
    _move(env, "internal", "customer", "10", on=date(2023, 6, 1))
    assert _analysis(env, date_from=None)["rotation"]["out_qty"] == pytest.approx(10.0)


def test_query_count_constant_with_more_rows(env):
    _stock(env, "10")
    _move(env, "vendor", "internal", "30")
    _confirmed_sale(env, "1", "0")
    with CaptureQueriesContext(connection) as few:
        _analysis(env)
    for i in range(10):
        _move(env, "internal", "customer", "1", on=date(2026, 1 + i, 5))
        _confirmed_sale(env, "1", "0")
        _ot_material(env, "1")
    with CaptureQueriesContext(connection) as many:
        _analysis(env)
    assert len(many) == len(few)


# ── Serie, flujos y ajustes ──────────────────────────────────────────────────

def test_series_continuous_by_month(env):
    _move(env, "vendor", "internal", "30", on=date(2026, 1, 10))
    _move(env, "internal", "customer", "10", on=date(2026, 3, 5))
    series = {p["period"]: p for p in _analysis(env, date_to=date(2026, 4, 30))["series"]}
    assert list(series) == ["2026-01", "2026-02", "2026-03", "2026-04"]
    assert series["2026-01"]["stock_end"] == pytest.approx(30.0)
    assert series["2026-02"]["stock_end"] == pytest.approx(30.0)
    assert series["2026-02"]["in_qty"] == 0.0
    assert series["2026-03"]["out_qty"] == pytest.approx(10.0)
    assert series["2026-04"]["stock_end"] == pytest.approx(20.0)


def test_transfers_do_not_count_as_flow(env):
    other = Warehouse.objects.create(name="Bodega 2", code="B2")
    _move(env, "vendor", "internal", "10", on=date(2026, 1, 10))
    _move(env, "internal", "internal", "4", on=date(2026, 2, 10), dst_wh=other)
    result = _analysis(env)
    assert sum(f["qty"] for f in result["flows"]["outflows"]) == 0.0
    assert sum(f["qty"] for f in result["flows"]["inflows"]) == pytest.approx(10.0)


def test_outflows_by_destination(env):
    _move(env, "vendor", "internal", "50", on=date(2026, 1, 1))
    _move(env, "internal", "customer", "10")
    _move(env, "internal", "production", "6")
    _move(env, "internal", "vendor", "2")
    outflows = {f["key"]: f for f in _analysis(env)["flows"]["outflows"]}
    assert (outflows["sale"]["qty"], outflows["production"]["qty"], outflows["supplier_return"]["qty"]) == (10.0, 6.0, 2.0)
    assert outflows["sale"]["label"] == "Ventas"


def test_inflows_by_origin(env):
    _move(env, "vendor", "internal", "20")
    _move(env, "production", "internal", "5")
    _move(env, "customer", "internal", "1")
    inflows = {f["key"]: f["qty"] for f in _analysis(env)["flows"]["inflows"]}
    assert inflows == {"purchase": 20.0, "production": 5.0, "customer_return": 1.0}


def test_adjustments_loss_gain_and_value(env):
    _move(env, "vendor", "internal", "100", on=date(2026, 1, 1))
    _move(env, "internal", "loss", "3", cost="20")
    _move(env, "gain", "internal", "1", cost="20")
    result = _analysis(env)
    adjustments = {a["key"]: a for a in result["adjustments"]}
    assert (adjustments["loss"]["qty"], adjustments["loss"]["value"]) == (3.0, 60.0)
    assert adjustments["gain"]["qty"] == pytest.approx(1.0)
    assert adjustments["loss"]["label"] == "Merma"
    assert sum(f["qty"] for f in result["flows"]["outflows"]) == 0.0


def test_loss_pct(env):
    _move(env, "vendor", "internal", "100", on=date(2026, 1, 1))
    _move(env, "internal", "customer", "50")
    _move(env, "internal", "loss", "2")
    assert _analysis(env)["loss_pct"] == pytest.approx(4.0)


def test_loss_pct_none_without_outflows(env):
    _move(env, "vendor", "internal", "100", on=date(2026, 1, 1))
    _move(env, "internal", "loss", "2")
    assert _analysis(env)["loss_pct"] is None


def test_revaluation_is_an_adjustment_not_a_flow(env):
    _move(env, "vendor", "internal", "10", on=date(2026, 1, 1))
    _move(env, "revaluation", "internal", "5", cost="20")
    result = _analysis(env)
    adjustments = {a["key"]: a for a in result["adjustments"]}
    assert adjustments["revaluation"]["value"] == pytest.approx(100.0)
    assert sum(f["qty"] for f in result["flows"]["inflows"]) == pytest.approx(10.0)


def test_query_count_constant_with_more_moves(env):
    _move(env, "vendor", "internal", "100", on=date(2026, 1, 1))
    _move(env, "internal", "loss", "1")
    with CaptureQueriesContext(connection) as few:
        _analysis(env)
    for i in range(12):
        _move(env, "internal", "customer", "1", on=date(2026, 1 + i % 11, 8))
        _move(env, "internal", "loss" if i % 2 else "production", "1", on=date(2026, 1 + i % 11, 9))
    with CaptureQueriesContext(connection) as many:
        _analysis(env)
    assert len(many) == len(few)


# ── Bodegas y variantes ──────────────────────────────────────────────────────

def test_warehouses_on_hand_and_last_move(env):
    other = Warehouse.objects.create(name="Bodega 2", code="B2")
    _move(env, "vendor", "internal", "8", on=date(2026, 12, 1))  # moves keep the Stock table in sync
    _move(env, "vendor", "internal", "3", on=date(2026, 6, 1), dst_wh=other)
    warehouses = {w["name"]: w for w in _analysis(env)["warehouses"]}
    assert warehouses["Bodega"]["on_hand"] == pytest.approx(8.0)
    assert warehouses["Bodega"]["last_move_date"] == "2026-12-01"
    assert warehouses["Bodega 2"]["on_hand"] == pytest.approx(3.0)
    assert warehouses["Bodega"]["idle"] is False


def test_warehouse_idle(env):
    other = Warehouse.objects.create(name="Bodega 2", code="B2")
    _move(env, "vendor", "internal", "3", on=date(2026, 6, 1), dst_wh=other)
    warehouses = {w["name"]: w for w in _analysis(env)["warehouses"]}
    assert warehouses["Bodega 2"]["idle"] is True
    assert {w["name"]: w for w in _analysis(env, idle_days=180)["warehouses"]}["Bodega 2"]["idle"] is True
    assert {w["name"]: w for w in _analysis(env, date_to=date(2026, 7, 1))["warehouses"]}["Bodega 2"]["idle"] is False


def test_transfer_updates_both_warehouses_last_move(env):
    other = Warehouse.objects.create(name="Bodega 2", code="B2")
    _move(env, "internal", "internal", "4", on=date(2026, 9, 10), dst_wh=other)
    warehouses = {w["name"]: w for w in _analysis(env)["warehouses"]}
    assert warehouses["Bodega"]["last_move_date"] == "2026-09-10"
    assert warehouses["Bodega 2"]["last_move_date"] == "2026-09-10"


def test_variants_sum_to_total(env):
    parent = env["product"]
    variants = [
        Product.objects.create(
            name=name, category=env["category"], uom=env["uom"], sale_uom=env["uom"], purchase_uom=env["uom"],
            product_type="STORABLE", sale_price=Decimal("1000"), parent_template=parent, variant_display_name=name,
        )
        for name in ("Tarjeta A4", "Tarjeta A5")
    ]
    Product.objects.filter(pk=parent.pk).update(has_variants=True)
    parent.refresh_from_db()
    _stock(env, "6", product=variants[0])
    _stock(env, "4", product=variants[1])
    result = _analysis(env, product=parent)
    rows = {v["name"]: v for v in result["variants"]}
    assert rows["Tarjeta A4"]["on_hand"] == pytest.approx(6.0)
    assert rows["Tarjeta A5"]["available"] == pytest.approx(4.0)
    assert sum(v["on_hand"] for v in result["variants"]) == pytest.approx(result["today"]["on_hand"])


def test_no_variants_for_simple_product(env):
    _stock(env, "5")
    assert _analysis(env)["variants"] == []


def test_query_count_constant_with_more_warehouses_and_variants(env):
    parent = env["product"]
    Product.objects.filter(pk=parent.pk).update(has_variants=True)
    parent.refresh_from_db()

    def add(i):
        variant = Product.objects.create(
            name=f"V{i}", category=env["category"], uom=env["uom"], sale_uom=env["uom"], purchase_uom=env["uom"],
            product_type="STORABLE", sale_price=Decimal("1000"), parent_template=parent,
        )
        warehouse = Warehouse.objects.create(name=f"B{i}", code=f"W{i}")
        _move(env, "vendor", "internal", "2", product=variant, dst_wh=warehouse)

    add(0)
    with CaptureQueriesContext(connection) as few:
        _analysis(env, product=parent)
    for i in range(1, 8):
        add(i)
    with CaptureQueriesContext(connection) as many:
        _analysis(env, product=parent)
    assert len(many) == len(few)
