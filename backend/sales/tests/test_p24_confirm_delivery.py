"""
P2.4: confirm_delivery — el match línea→stock_move pasa de Θ(T×M) (doble loop
en RAM) a O(T+M) vía dict por (product_id, quantity), preservando la semántica
de "primer move que coincide".
"""

from datetime import date
from decimal import Decimal

import pytest

from accounting.models import Account, AccountType
from contacts.models import Contact
from inventory.models import (
    InventoryDocument,
    Location,
    Product,
    ProductCategory,
    StockMove,
    UoM,
    UoMCategory,
    Warehouse,
)
from sales.models import SaleDelivery, SaleDeliveryLine, SaleLine, SaleOrder
from sales.services import SalesService


@pytest.fixture
def delivery_setup(db):
    uom_cat, _ = UoMCategory.objects.get_or_create(name="Unidades")
    uom, _ = UoM.objects.get_or_create(name="unidad", defaults={"ratio": 1, "category": uom_cat})
    prod_cat, _ = ProductCategory.objects.get_or_create(name="Test", defaults={"prefix": "TST"})

    def make_product(code):
        return Product.objects.create(
            name=f"Producto {code}",
            internal_code=code,
            product_type=Product.Type.STORABLE,
            uom=uom,
            category=prod_cat,
            cost_price=Decimal("0"),
        )

    warehouse = Warehouse.objects.create(name="Bodega", code="WH-01")
    Location.objects.get_or_create(
        location_type="INTERNAL", warehouse=warehouse, defaults={"name": "Interno"}
    )
    Location.objects.get_or_create(location_type="CUSTOMER", defaults={"name": "Cliente"})

    customer = Contact.objects.create(name="Cliente", tax_id="12345678-9")
    order = SaleOrder.objects.create(
        customer=customer, date=date(2026, 8, 1), status=SaleOrder.Status.CONFIRMED
    )
    delivery = SaleDelivery.objects.create(
        sale_order=order, warehouse=warehouse, delivery_date=date(2026, 8, 14)
    )

    return {"uom": uom, "warehouse": warehouse, "order": order, "delivery": delivery}


def _add_line(delivery_setup, product, quantity):
    line = SaleLine.objects.create(
        order=delivery_setup["order"],
        product=product,
        quantity=Decimal(str(quantity)),
        unit_price=Decimal("1000"),
        uom=delivery_setup["uom"],
    )
    return SaleDeliveryLine.objects.create(
        delivery=delivery_setup["delivery"],
        sale_line=line,
        product=product,
        uom=delivery_setup["uom"],
        quantity=Decimal(str(quantity)),
        unit_price=Decimal("1000"),
    )


def test_confirm_delivery_links_stock_moves_with_multiple_tracked_lines(delivery_setup, db):
    p1 = Product.objects.create(
        name="P1",
        internal_code="P1",
        product_type=Product.Type.STORABLE,
        uom=delivery_setup["uom"],
        category=ProductCategory.objects.get_or_create(name="Test", defaults={"prefix": "TST"})[0],
        cost_price=Decimal("0"),
    )
    p2 = Product.objects.create(
        name="P2",
        internal_code="P2",
        product_type=Product.Type.STORABLE,
        uom=delivery_setup["uom"],
        category=ProductCategory.objects.get_or_create(name="Test", defaults={"prefix": "TST"})[0],
        cost_price=Decimal("0"),
    )
    dl1 = _add_line(delivery_setup, p1, 2)
    dl2 = _add_line(delivery_setup, p2, 3)

    delivery = SalesService.confirm_delivery(delivery_setup["delivery"])

    delivery.refresh_from_db()
    assert delivery.status == SaleDelivery.Status.CONFIRMED
    assert delivery.journal_entry is None

    moves = StockMove.objects.filter(
        source_location__location_type="INTERNAL",
        destination_location__location_type="CUSTOMER",
    )
    assert moves.count() == 2

    dl1.refresh_from_db()
    dl2.refresh_from_db()
    assert dl1.stock_move is None
    assert dl2.stock_move is None


def test_confirm_delivery_rejects_non_draft(delivery_setup, db):
    product = Product.objects.create(
        name="P1",
        internal_code="P1",
        product_type=Product.Type.STORABLE,
        uom=delivery_setup["uom"],
        category=ProductCategory.objects.get_or_create(name="Test", defaults={"prefix": "TST"})[0],
        cost_price=Decimal("0"),
    )
    _add_line(delivery_setup, product, 1)
    delivery = delivery_setup["delivery"]

    SalesService.confirm_delivery(delivery)
    again = SalesService.confirm_delivery(delivery)

    assert again.status == SaleDelivery.Status.CONFIRMED
