"""ADR-0086: los serializers de despacho/devolución exponen DocumentRefs con `url`
canónica (`*_document`) para que el frontend navegue en el drilldown en vez de apilar
el drawer. La URL la decide el `DocumentTypeRegistry` (ADR-0080 §6)."""

from datetime import date
from decimal import Decimal

import pytest

from contacts.models import Contact
from inventory.models import (
    Location,
    Product,
    ProductCategory,
    UoM,
    UoMCategory,
    Warehouse,
)
from sales.models import SaleDelivery, SaleDeliveryLine, SaleLine, SaleOrder, SaleReturn
from sales.serializers import (
    SaleDeliveryLineSerializer,
    SaleDeliverySerializer,
    SaleReturnSerializer,
)
from sales.services import SalesService


@pytest.fixture
def sales_setup(db):
    uom_cat, _ = UoMCategory.objects.get_or_create(name="Unidades")
    uom, _ = UoM.objects.get_or_create(name="unidad", defaults={"ratio": 1, "category": uom_cat})
    prod_cat, _ = ProductCategory.objects.get_or_create(name="Test", defaults={"prefix": "TST"})

    warehouse = Warehouse.objects.create(name="Bodega", code="WH-DR")
    Location.objects.get_or_create(
        location_type="INTERNAL", warehouse=warehouse, defaults={"name": "Interno"}
    )
    Location.objects.get_or_create(location_type="CUSTOMER", defaults={"name": "Cliente"})

    customer = Contact.objects.create(name="Cliente", tax_id="12345678-9")
    order = SaleOrder.objects.create(
        customer=customer, date=date(2026, 8, 1), status=SaleOrder.Status.CONFIRMED
    )
    product = Product.objects.create(
        name="Producto",
        internal_code="DR-1",
        product_type=Product.Type.STORABLE,
        uom=uom,
        category=prod_cat,
        cost_price=Decimal("0"),
    )
    sale_line = SaleLine.objects.create(
        order=order, product=product, quantity=Decimal("2"),
        unit_price=Decimal("1000"), uom=uom,
    )
    delivery = SaleDelivery.objects.create(
        sale_order=order, warehouse=warehouse, delivery_date=date(2026, 8, 14)
    )
    SaleDeliveryLine.objects.create(
        delivery=delivery, sale_line=sale_line, product=product,
        uom=uom, quantity=Decimal("2"), unit_price=Decimal("1000"),
    )
    delivery = SalesService.confirm_delivery(delivery)  # crea y enlaza el StockMove
    return {"warehouse": warehouse, "order": order, "delivery": delivery}


def test_delivery_serializer_exposes_order_document_ref(sales_setup):
    data = SaleDeliverySerializer(sales_setup["delivery"]).data

    ref = data["sale_order_document"]
    assert ref["label"] == "sales.saleorder"
    assert ref["id"] == sales_setup["order"].id
    assert ref["url"] == f"/sales/dtes/orders?selected={sales_setup['order'].id}"


def test_delivery_line_serializer_exposes_stock_move_document_ref(sales_setup):
    line = sales_setup["delivery"].lines.first()
    assert line.stock_move_id is not None

    data = SaleDeliveryLineSerializer(line).data

    ref = data["stock_move_document"]
    assert ref["label"] == "inventory.stockmove"
    assert ref["id"] == line.stock_move_id
    assert ref["url"] == f"/inventory/reports/movements?selected={line.stock_move_id}"


def test_delivery_serializer_document_ref_without_lines(db):
    """El DocumentRef de la OV no depende de las líneas ni de un contexto de request."""
    warehouse = Warehouse.objects.create(name="Bodega 2", code="WH-DR2")
    customer = Contact.objects.create(name="Cliente 2", tax_id="11111111-1")
    order = SaleOrder.objects.create(customer=customer, date=date(2026, 8, 2))
    delivery = SaleDelivery.objects.create(
        sale_order=order, warehouse=warehouse, delivery_date=date(2026, 8, 15)
    )

    ref = SaleDeliverySerializer(delivery).data["sale_order_document"]
    assert ref["url"] == f"/sales/dtes/orders?selected={order.id}"


def test_return_serializer_exposes_order_document_ref(sales_setup):
    ret = SaleReturn.objects.create(
        sale_order=sales_setup["order"], warehouse=sales_setup["warehouse"],
        date=date(2026, 8, 20),
    )

    ref = SaleReturnSerializer(ret).data["sale_order_document"]
    assert ref["label"] == "sales.saleorder"
    assert ref["id"] == sales_setup["order"].id
    assert ref["url"] == f"/sales/dtes/orders?selected={sales_setup['order'].id}"
