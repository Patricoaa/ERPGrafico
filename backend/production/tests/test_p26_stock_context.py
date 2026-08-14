"""
P2.6: ProductionSelectorExt.get_stock_available — la manufacturabilidad se
resuelve desde el contexto prefetched (BOM + stock de componentes anotado),
sin queries extra por material.
"""

from decimal import Decimal

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from inventory.models import Product, ProductCategory, Stock, UoM, UoMCategory, Warehouse
from production.models import (
    BillOfMaterials,
    BillOfMaterialsLine,
    WorkOrder,
    WorkOrderMaterial,
)
from production.selectors import ProductionSelectorExt
from production.services import WorkOrderService


@pytest.fixture
def bom_env(db):
    uom_cat, _ = UoMCategory.objects.get_or_create(name="Unidades")
    uom, _ = UoM.objects.get_or_create(
        name="unidad", defaults={"ratio": 1, "category": uom_cat}
    )
    prod_cat, _ = ProductCategory.objects.get_or_create(name="Test", defaults={"prefix": "TST"})
    wh = Warehouse.objects.create(name="Bodega P26", code="WH-P26")

    component = Product.objects.create(
        name="Componente",
        internal_code="C-P26",
        product_type=Product.Type.STORABLE,
        uom=uom,
        category=prod_cat,
    )
    product = Product.objects.create(
        name="Fabricado",
        internal_code="F-P26",
        product_type=Product.Type.MANUFACTURABLE,
        uom=uom,
        category=prod_cat,
    )
    bom = BillOfMaterials.objects.create(
        product=product, name="BOM P26", active=True, yield_quantity=Decimal("1"), yield_uom=uom
    )
    BillOfMaterialsLine.objects.create(
        bom=bom, component=component, quantity=Decimal("2"), uom=uom
    )

    Stock.objects.create(product=component, warehouse=wh, quantity=Decimal("5"))

    wo = WorkOrder.objects.create(description="OT P26", warehouse=wh)
    material = WorkOrderMaterial.objects.create(
        work_order=wo, component=product, quantity_planned=Decimal("10"), uom=uom
    )
    return {"wh": wh, "product": product, "component": component, "material": material}


@pytest.mark.django_db
def test_manufacturable_uses_prefetched_context(bom_env):
    material = bom_env["material"]
    stocks, products_by_id = WorkOrderService.build_stock_context(material.work_order)

    with CaptureQueriesContext(connection) as ctx:
        available = ProductionSelectorExt.get_stock_available(
            material, {"stocks_by_product": stocks, "products_by_id": products_by_id}
        )
    assert available == 2.0
    assert len(ctx) == 0


@pytest.mark.django_db
def test_storable_uses_stocks_by_product(bom_env):
    wo = bom_env["material"].work_order
    material = WorkOrderMaterial.objects.create(
        work_order=wo,
        component=bom_env["component"],
        quantity_planned=Decimal("1"),
        uom=UoM.objects.get(name="unidad"),
    )
    stocks, products_by_id = WorkOrderService.build_stock_context(wo)

    with CaptureQueriesContext(connection) as ctx:
        available = ProductionSelectorExt.get_stock_available(
            material, {"stocks_by_product": stocks, "products_by_id": products_by_id}
        )

    assert available == 5.0
    assert len(ctx) == 0
