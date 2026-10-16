"""
P2.4: confirm_delivery — el match línea→stock_move pasa de Θ(T×M) (doble loop
en RAM) a O(T+M) vía dict por (product_id, quantity), preservando la semántica
de "primer move que coincide".
"""

from datetime import date
from decimal import Decimal

import pytest

from contacts.models import Contact
from inventory.models import (
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
    # GAP-02 (auditoría documental): antes quedaban en None por un emparejamiento
    # heurístico (product_id, -qty) que nunca coincidía con moves de cantidad absoluta.
    assert dl1.stock_move.product == p1
    assert dl2.stock_move.product == p2
    assert dl1.stock_move.quantity == Decimal("2")
    assert dl2.stock_move.quantity == Decimal("3")
    assert dl1.stock_move.source_document == delivery
    assert dl2.stock_move.source_document == delivery

    # GAP-01: el cumplimiento queda registrado en las líneas de la OV
    assert dl1.sale_line.quantity_delivered == Decimal("2")
    assert dl2.sale_line.quantity_delivered == Decimal("3")


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


def test_confirm_delivery_partial_then_annul_restores_quantities(delivery_setup, db):
    """GAP-01/02: despacho parcial → PARTIAL; anularlo repone stock y vuelve a PENDING."""
    product = Product.objects.create(
        name="P3",
        internal_code="P3",
        product_type=Product.Type.STORABLE,
        uom=delivery_setup["uom"],
        category=ProductCategory.objects.get_or_create(name="Test", defaults={"prefix": "TST"})[0],
        cost_price=Decimal("0"),
    )
    sale_line = SaleLine.objects.create(
        order=delivery_setup["order"], product=product, quantity=Decimal("5"),
        unit_price=Decimal("1000"), uom=delivery_setup["uom"],
    )
    SaleDeliveryLine.objects.create(
        delivery=delivery_setup["delivery"], sale_line=sale_line, product=product,
        uom=delivery_setup["uom"], quantity=Decimal("2"), unit_price=Decimal("1000"),
    )

    delivery = SalesService.confirm_delivery(delivery_setup["delivery"])
    SalesService._update_order_delivery_status(delivery.sale_order)

    sale_line.refresh_from_db()
    order = delivery.sale_order
    order.refresh_from_db()
    assert sale_line.quantity_delivered == Decimal("2")
    assert order.delivery_status == SaleOrder.DeliveryStatus.PARTIAL

    SalesService.annul_delivery(delivery, reason="test")

    sale_line.refresh_from_db()
    order.refresh_from_db()
    assert sale_line.quantity_delivered == Decimal("0")
    assert order.delivery_status == SaleOrder.DeliveryStatus.PENDING
    returned = StockMove.objects.filter(
        product=product, destination_location__location_type="INTERNAL"
    )
    assert returned.count() == 1, "anular el despacho debe reponer el stock"
