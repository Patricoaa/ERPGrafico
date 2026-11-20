"""ProductSelector.get_capabilities: capacidades y segmento de un producto."""
from decimal import Decimal

import pytest

from inventory.models import Product, ProductCategory, UoM, UoMCategory
from inventory.selectors import ProductSelector
from production.models import BillOfMaterials, BillOfMaterialsLine


@pytest.fixture
def base(db):
    uom = UoM.objects.create(name="Unidad", category=UoMCategory.objects.create(name="Unit"), uom_type="REFERENCE")
    return {"uom": uom, "category": ProductCategory.objects.create(name="Impresos")}


def _product(base, name="P", **kwargs):
    defaults = dict(
        name=name, category=base["category"], uom=base["uom"], sale_uom=base["uom"],
        purchase_uom=base["uom"], product_type="STORABLE", sale_price=Decimal("1000"),
    )
    defaults.update(kwargs)
    return Product.objects.create(**defaults)


def _bom_for(base, finished, component, active=True):
    bom = BillOfMaterials.objects.create(product=finished, name="BOM", active=active)
    BillOfMaterialsLine.objects.create(bom=bom, component=component, quantity=Decimal("1"), uom=base["uom"])
    return bom


def _caps(product):
    return ProductSelector.get_capabilities(product)


def test_manufacturable_express_segment(base):
    component = _product(base, "Papel")
    product = _product(base, "Express", product_type="MANUFACTURABLE", mfg_auto_finalize=True)
    _bom_for(base, product, component)
    caps = _caps(product)
    assert caps["segment"] == "MANUFACTURABLE_EXPRESS"
    assert caps["express"] is True
    assert caps["manufactures"] is True
    assert caps["tracks_stock"] is False


def test_manufacturable_stocked_segment(base):
    product = _product(base, "Stock", product_type="MANUFACTURABLE", track_inventory=True)
    caps = _caps(product)
    assert caps["segment"] == "MANUFACTURABLE_STOCKED"
    assert caps["tracks_stock"] is True


def test_manufacturable_on_demand_segment(base):
    product = _product(base, "Pedido", product_type="MANUFACTURABLE", track_inventory=False)
    caps = _caps(product)
    assert caps["segment"] == "MANUFACTURABLE_ON_DEMAND"
    assert caps["express"] is False


def test_storable_not_sellable_is_input(base):
    product = _product(base, "Tinta", can_be_sold=False, can_be_purchased=True)
    caps = _caps(product)
    assert caps["segment"] == "INPUT"
    assert caps["sells"] is False
    assert caps["buys"] is True


def test_storable_sellable_segment(base):
    caps = _caps(_product(base, "Resma", can_be_sold=True))
    assert caps["segment"] == "STORABLE"
    assert caps["sells"] is True


def test_service_and_subscription_segments(base):
    assert _caps(_product(base, "Diseño", product_type="SERVICE"))["segment"] == "SERVICE"
    sub = _caps(_product(base, "Hosting", product_type="SUBSCRIPTION"))
    assert sub["segment"] == "SUBSCRIPTION"
    assert sub["recurring"] is True


def test_used_in_production_true_with_active_bom_line(base):
    component = _product(base, "Tinta", can_be_sold=False)
    finished = _product(base, "Tarjeta", product_type="MANUFACTURABLE")
    _bom_for(base, finished, component)
    assert _caps(component)["used_in_production"] is True


def test_used_in_production_false_with_inactive_bom(base):
    component = _product(base, "Tinta", can_be_sold=False)
    finished = _product(base, "Tarjeta", product_type="MANUFACTURABLE")
    _bom_for(base, finished, component, active=False)
    assert _caps(component)["used_in_production"] is False


def test_insights_payload_includes_capabilities(base):
    product = _product(base, "Resma")
    insights = ProductSelector.get_insights(product)
    assert insights["capabilities"]["segment"] == "STORABLE"
