# ruff: noqa: F811  (fixtures/helpers are imported from sibling test modules)
"""SourcingSelector: fabricar vs comprar y uso como insumo con sensibilidad de costo."""
from datetime import date
from decimal import Decimal

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from inventory.models import Product, UoM
from inventory.sourcing_selector import SourcingSelector
from inventory.tests.test_production_performance_selector import _component, _consume, _ot
from inventory.tests.test_sales_impact_selector import env  # noqa: F401
from production.models import BillOfMaterials, BillOfMaterialsLine
from purchasing.models import PurchaseLine, PurchaseOrder, PurchaseReceipt, PurchaseReceiptLine

RANGE = {"date_from": date(2026, 1, 1), "date_to": date(2026, 12, 31)}


def _manufactured_and_bought(env):
    env["product"].product_type = "MANUFACTURABLE"
    env["product"].can_be_purchased = True
    env["product"].save()


def _receipt(env, qty, unit_cost, on=date(2026, 3, 1), status="CONFIRMED", uom=None, product=None):
    order = PurchaseOrder.objects.create(number=f"PO-{PurchaseOrder.objects.count() + 1}", supplier=env["customer"], status="CONFIRMED")
    receipt = PurchaseReceipt.objects.create(
        purchase_order=order, warehouse=env["warehouse"], receipt_date=on, status=status,
        number=f"RC-{PurchaseReceipt.objects.count() + 1}",
    )
    purchase_line = PurchaseLine.objects.create(
        order=order, product=product or env["product"], quantity=Decimal(qty), uom=uom or env["uom"],
        unit_cost=Decimal(unit_cost),
    )
    return PurchaseReceiptLine.objects.create(
        receipt=receipt, purchase_line=purchase_line, product=product or env["product"], quantity_received=Decimal(qty),
        uom=uom or env["uom"], unit_cost=Decimal(unit_cost), total_cost=Decimal(qty) * Decimal(unit_cost),
    )


def _make_cost(env, units="10", cost_per_unit="20"):
    """One finished OT: `units` produced, real cost = units × cost_per_unit."""
    wo = _ot(env, qty=units)
    _consume(env, wo, _component(env, name=f"Insumo {wo.id}"), units, cost=cost_per_unit)
    return wo


def _sourcing(env, product=None, **kw):
    return SourcingSelector.get_sourcing(product or env["product"], **{**RANGE, **kw})


def _bom(parent, rows):
    bom = BillOfMaterials.objects.create(product=parent, name="BOM", active=True)
    for component, qty, uom in rows:
        BillOfMaterialsLine.objects.create(bom=bom, component=component, quantity=Decimal(qty), uom=uom)
    return bom


def _parent(env, name="Tarjeta", price="1000"):
    return Product.objects.create(
        name=name, category=env["category"], uom=env["uom"], sale_uom=env["uom"], purchase_uom=env["uom"],
        product_type="MANUFACTURABLE", sale_price=Decimal(price),
    )


def _set_cost(product, cost):
    Product.objects.filter(pk=product.pk).update(cost_price=Decimal(cost))


# ── Fabricar vs comprar ──────────────────────────────────────────────────────

def test_make_vs_buy_only_when_manufactures_and_buys(env):
    assert _sourcing(env)["make_vs_buy"] is None  # STORABLE: neither
    _manufactured_and_bought(env)
    assert _sourcing(env)["make_vs_buy"] is not None
    env["product"].can_be_purchased = False
    env["product"].save()
    assert _sourcing(env)["make_vs_buy"] is None


def test_buy_avg_and_last_cost(env):
    _manufactured_and_bought(env)
    _receipt(env, "10", "100", on=date(2026, 2, 1))
    _receipt(env, "30", "200", on=date(2026, 5, 1))
    buy = _sourcing(env)["make_vs_buy"]["buy"]
    assert buy["avg_unit_cost"] == pytest.approx(175.0)  # (1000 + 6000) / 40
    assert buy["last_unit_cost"] == pytest.approx(200.0)
    assert buy["last_date"] == "2026-05-01"
    assert buy["units_bought"] == pytest.approx(40.0)
    assert buy["receipts"] == 2


def test_receipt_uom_converted_to_base(env):
    _manufactured_and_bought(env)
    dozen = UoM.objects.create(name="Docena", category=env["uom"].category, uom_type="BIGGER", ratio=Decimal("12"))
    _receipt(env, "1", "1200", uom=dozen)  # 1 dozen at 1200 = 12 base units at 100
    buy = _sourcing(env)["make_vs_buy"]["buy"]
    assert buy["units_bought"] == pytest.approx(12.0)
    assert buy["avg_unit_cost"] == pytest.approx(100.0)


def test_unconfirmed_and_out_of_window_receipts_ignored(env):
    _manufactured_and_bought(env)
    _receipt(env, "10", "100", status="DRAFT")
    _receipt(env, "10", "100", on=date(2025, 1, 1))
    buy = _sourcing(env)["make_vs_buy"]["buy"]
    assert buy["receipts"] == 0 and buy["avg_unit_cost"] == 0.0 and buy["last_date"] is None


def test_saving_positive_when_making_is_cheaper(env):
    _manufactured_and_bought(env)
    _make_cost(env, units="10", cost_per_unit="20")  # 20 / unit
    _receipt(env, "10", "50")
    mvb = _sourcing(env)["make_vs_buy"]
    assert mvb["make"]["unit_cost"] == pytest.approx(20.0)
    assert mvb["make"]["units_made"] == pytest.approx(10.0)
    assert mvb["saving_per_unit"] == pytest.approx(30.0)
    assert mvb["saving_total"] == pytest.approx(300.0)
    assert mvb["cheaper"] == "MAKE"


def test_cheaper_flag_buy_and_negative_saving(env):
    _manufactured_and_bought(env)
    _make_cost(env, units="10", cost_per_unit="80")
    _receipt(env, "10", "50")
    mvb = _sourcing(env)["make_vs_buy"]
    assert mvb["saving_per_unit"] == pytest.approx(-30.0)
    assert mvb["cheaper"] == "BUY"


def test_saving_null_without_receipts_or_orders(env):
    _manufactured_and_bought(env)
    only_make = _make_cost(env)
    assert only_make
    mvb = _sourcing(env)["make_vs_buy"]
    assert mvb["saving_per_unit"] is None and mvb["saving_total"] is None and mvb["cheaper"] is None


# ── Uso como insumo ──────────────────────────────────────────────────────────

def test_used_in_only_when_used_in_production(env):
    assert _sourcing(env)["used_in"] is None
    parent = _parent(env)
    _bom(parent, [(env["product"], "2", env["uom"])])
    assert _sourcing(env)["used_in"] is not None


def test_parent_share_and_sensitivity(env):
    component, other = env["product"], _component(env, name="Otro")
    _set_cost(component, "100")
    _set_cost(other, "300")
    parent = _parent(env, price="1000")
    _bom(parent, [(component, "2", env["uom"]), (other, "1", env["uom"])])  # 200 + 300 = 500
    (row,) = _sourcing(env, increase_pct=10)["used_in"]["parents"]
    assert row["product_id"] == parent.id
    assert row["qty_per_unit"] == pytest.approx(2.0)
    assert row["component_cost"] == pytest.approx(200.0)
    assert row["bom_cost"] == pytest.approx(500.0)
    assert row["share_pct"] == pytest.approx(40.0)
    assert row["delta_cost"] == pytest.approx(20.0)
    assert row["delta_pct"] == pytest.approx(4.0)


def test_margin_after_increase(env):
    component = env["product"]
    _set_cost(component, "100")
    parent = _parent(env, price="1000")
    _bom(parent, [(component, "5", env["uom"])])  # bom 500
    (row,) = _sourcing(env, increase_pct=20)["used_in"]["parents"]
    assert row["margin_pct"] == pytest.approx(50.0)
    assert row["margin_pct_after"] == pytest.approx(40.0)  # (1000 − 600) / 1000


def test_zero_bom_cost_and_zero_price_are_null(env):
    component = env["product"]
    _set_cost(component, "0")
    parent = _parent(env, price="0")
    _bom(parent, [(component, "1", env["uom"])])
    (row,) = _sourcing(env)["used_in"]["parents"]
    assert row["share_pct"] is None and row["delta_pct"] is None
    assert row["margin_pct"] is None and row["margin_pct_after"] is None


def test_only_the_active_bom_of_a_parent_counts(env):
    component = env["product"]
    _set_cost(component, "100")
    parent = _parent(env)
    _bom(parent, [(component, "1", env["uom"])])
    _bom(parent, [(component, "2", env["uom"])])
    (row,) = _sourcing(env)["used_in"]["parents"]
    assert row["qty_per_unit"] == pytest.approx(2.0)  # activating a BOM deactivates the previous one


def test_variants_of_component_count(env):
    template = env["product"]
    template.has_variants = True
    template.save()
    variant = Product.objects.create(
        name="Tarjeta Roja", category=env["category"], uom=env["uom"], sale_uom=env["uom"],
        purchase_uom=env["uom"], product_type="STORABLE", sale_price=Decimal("1000"), parent_template=template,
    )
    _set_cost(variant, "100")
    parent = _parent(env)
    _bom(parent, [(variant, "1", env["uom"])])
    assert [p["product_id"] for p in _sourcing(env)["used_in"]["parents"]] == [parent.id]


def test_query_count_constant(env):
    component = env["product"]
    _set_cost(component, "100")
    _bom(_parent(env, name="P0"), [(component, "1", env["uom"])])
    with CaptureQueriesContext(connection) as few:
        _sourcing(env)
    for i in range(6):
        _bom(_parent(env, name=f"P{i + 1}"), [(component, "1", env["uom"])])
    with CaptureQueriesContext(connection) as many:
        _sourcing(env)
    assert len(many) == len(few)


def test_bom_yield_divides_cost_and_quantity_per_unit(env):
    component = env["product"]
    _set_cost(component, "2")
    parent = _parent(env, price="10")
    bom = _bom(parent, [(component, "500", env["uom"])])  # 500 × 2 = 1000 per batch
    BillOfMaterials.objects.filter(pk=bom.pk).update(yield_quantity=Decimal("1000"))
    (row,) = _sourcing(env, increase_pct=10)["used_in"]["parents"]
    assert row["qty_per_unit"] == pytest.approx(0.5)
    assert row["component_cost"] == pytest.approx(1.0)
    assert row["bom_cost"] == pytest.approx(1.0)
    assert row["margin_pct"] == pytest.approx(90.0)


def test_outsourced_lines_cost_unit_price_in_bom_cost(env):
    component, finishing = env["product"], _component(env, name="Laminado", cost="0")
    _set_cost(component, "100")
    parent = _parent(env, price="1000")
    bom = _bom(parent, [(component, "1", env["uom"]), (finishing, "1", env["uom"])])
    BillOfMaterialsLine.objects.filter(bom=bom, component=finishing).update(is_outsourced=True, unit_price=Decimal("300"))
    (row,) = _sourcing(env)["used_in"]["parents"]
    assert row["bom_cost"] == pytest.approx(400.0)
    assert row["share_pct"] == pytest.approx(25.0)


def test_input_that_is_itself_outsourced_uses_its_unit_price(env):
    component = env["product"]
    _set_cost(component, "0")
    parent = _parent(env, price="1000")
    bom = _bom(parent, [(component, "2", env["uom"])])
    BillOfMaterialsLine.objects.filter(bom=bom).update(is_outsourced=True, unit_price=Decimal("50"))
    (row,) = _sourcing(env)["used_in"]["parents"]
    assert row["component_cost"] == pytest.approx(100.0)
