# ruff: noqa: F811  (the env fixture is imported from test_sales_impact_selector)
"""Product.get_bom_cost: costo por unidad producida, con la misma regla que la pantalla de BOM."""
from decimal import Decimal

import pytest

from inventory.models import Product, UoM
from inventory.tests.test_sales_impact_selector import env  # noqa: F401
from production.models import BillOfMaterials, BillOfMaterialsLine
from production.selectors import ProductionSelectorExt


def _component(env, name: str, cost: str) -> Product:
    return Product.objects.create(
        name=name, category=env["category"], uom=env["uom"], sale_uom=env["uom"], purchase_uom=env["uom"],
        product_type="STORABLE", sale_price=Decimal("10"), cost_price=Decimal(cost),
    )


def _bom(env, yield_quantity: str) -> BillOfMaterials:
    product = env["product"]
    product.product_type = "MANUFACTURABLE"
    product.save()
    return BillOfMaterials.objects.create(product=product, name="BOM", active=True, yield_quantity=Decimal(yield_quantity))


def test_bom_cost_is_per_produced_unit(env):
    bom = _bom(env, "2")
    BillOfMaterialsLine.objects.create(bom=bom, component=_component(env, "Papel", "50"), quantity=Decimal("4"), uom=env["uom"])
    assert env["product"].get_bom_cost() == Decimal("100")


def test_outsourced_lines_use_their_price(env):
    bom = _bom(env, "1")
    BillOfMaterialsLine.objects.create(bom=bom, component=_component(env, "Papel", "50"), quantity=Decimal("2"), uom=env["uom"])
    BillOfMaterialsLine.objects.create(
        bom=bom, component=_component(env, "Corte", "0"), quantity=Decimal("1"), uom=env["uom"],
        is_outsourced=True, unit_price=Decimal("30"),
    )
    assert env["product"].get_bom_cost() == Decimal("130")


def test_matches_bom_screen(env):
    box = UoM.objects.create(name="Caja", category=env["uom"].category, uom_type="BIGGER", ratio=Decimal("10"))
    bom = _bom(env, "4")
    BillOfMaterialsLine.objects.create(bom=bom, component=_component(env, "Tinta", "5"), quantity=Decimal("1"), uom=box)
    BillOfMaterialsLine.objects.create(
        bom=bom, component=_component(env, "Corte", "0"), quantity=Decimal("2"), uom=env["uom"],
        is_outsourced=True, unit_price=Decimal("10"),
    )
    assert float(env["product"].get_bom_cost()) == pytest.approx(ProductionSelectorExt.get_total_cost(bom))


def test_no_active_bom_is_zero(env):
    assert env["product"].get_bom_cost() == Decimal("0.00")
