"""ProductSelector.get_capabilities: capacidades y segmento de un producto."""
from decimal import Decimal

import pytest

from inventory.models import Product, ProductCategory, UoM, UoMCategory, Warehouse
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


def test_used_in_production_true_when_consumed_in_a_work_order_without_active_bom(base):
    from production.models import ProductionConsumption, WorkOrder

    component = _product(base, "Tinta", can_be_sold=False)
    finished = _product(base, "Tarjeta", product_type="MANUFACTURABLE")
    work_order = WorkOrder.objects.create(description="OT manual", product=finished, is_manual=True)
    ProductionConsumption.objects.create(
        work_order=work_order, product=component, quantity=Decimal("2"),
        warehouse=Warehouse.objects.create(name="B", code="B1"),
    )
    assert _caps(component)["used_in_production"] is True


def test_used_in_production_considers_variant_consumption(base):
    from production.models import ProductionConsumption, WorkOrder

    template = _product(base, "Tinta base", can_be_sold=False, has_variants=True)
    variant = _product(base, "Tinta cian", can_be_sold=False, parent_template=template)
    finished = _product(base, "Tarjeta", product_type="MANUFACTURABLE")
    work_order = WorkOrder.objects.create(description="OT manual", product=finished, is_manual=True)
    ProductionConsumption.objects.create(
        work_order=work_order, product=variant, quantity=Decimal("1"),
        warehouse=Warehouse.objects.create(name="B", code="B1"),
    )
    assert _caps(template)["used_in_production"] is True


@pytest.fixture
def api_client(db):
    from django.contrib.auth import get_user_model
    from rest_framework.test import APIClient

    user = get_user_model().objects.create_superuser(username="capsuser", password="password")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def test_capabilities_endpoint_returns_selector_payload(base, api_client):
    product = _product(base, "Resma", track_inventory=True)
    response = api_client.get(f"/api/inventory/products/{product.id}/capabilities/")
    assert response.status_code == 200
    body = response.json()
    assert body["segment"] == "STORABLE"
    assert body["tracks_stock"] is True
    assert body == _caps(product)


def test_capabilities_endpoint_requires_authentication(base):
    from rest_framework.test import APIClient

    product = _product(base, "Resma")
    response = APIClient().get(f"/api/inventory/products/{product.id}/capabilities/")
    assert response.status_code in (401, 403)
