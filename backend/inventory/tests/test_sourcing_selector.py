# ruff: noqa: F811  (fixtures/helpers are imported from sibling test modules)
"""SourcingSelector._used_in: uso como insumo con sensibilidad de costo (tab Producción, ADR-0150)."""
from datetime import date
from decimal import Decimal

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from inventory.costs_selector import _to_base_factory
from inventory.models import Product
from inventory.selectors import ProductSelector
from inventory.sourcing_selector import SourcingSelector
from inventory.tests.test_production_performance_selector import _component
from inventory.tests.test_sales_impact_selector import env  # noqa: F401
from production.models import BillOfMaterials, BillOfMaterialsLine
from purchasing.models import PurchaseLine, PurchaseOrder, PurchaseReceipt, PurchaseReceiptLine

RANGE = {"date_from": date(2026, 1, 1), "date_to": date(2026, 12, 31)}


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


def _sourcing(env, product=None, increase_pct=10, **_range):
    """Uso como insumo con la misma regla de visibilidad que el tab Producción (``used_in_production``)."""
    product = product or env["product"]
    ids = [product.id] + (list(product.variants.values_list("id", flat=True)) if product.has_variants else [])
    used = ProductSelector.get_capabilities(product)["used_in_production"]
    return {"used_in": SourcingSelector._used_in(ids, increase_pct, _to_base_factory()) if used else None}


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
