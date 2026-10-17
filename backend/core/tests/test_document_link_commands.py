"""
M1 (auditoría documental): comandos `audit_document_integrity` (D5, solo lectura) y
`backfill_document_links` (D3, dry-run por defecto).

Se fabrica el estado histórico generado por el bug (GAP-01/02/03, INT-04): desde
ADR-0085 el despacho ya no acuña un `InventoryDocument`, así que el fixture reproduce
a mano el documento legado (con `source_document_type` apuntando a la OV) y deja sin
enlazar el detalle y la línea, que es lo que estos comandos reparan.
"""

from datetime import date
from decimal import Decimal
from io import StringIO

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from contacts.models import Contact
from core.prefix_registry import EntityPrefix
from inventory.models import (
    InventoryDocument,
    InventoryDocumentDetail,
    Location,
    Product,
    ProductCategory,
    StockMove,
    UoM,
    UoMCategory,
    Warehouse,
)
from sales.models import SaleDelivery, SaleDeliveryLine, SaleLine, SaleOrder


@pytest.fixture
def broken_delivery(db):
    uom_cat, _ = UoMCategory.objects.get_or_create(name="Unidades")
    uom, _ = UoM.objects.get_or_create(name="unidad", defaults={"ratio": 1, "category": uom_cat})
    cat, _ = ProductCategory.objects.get_or_create(name="Test", defaults={"prefix": "TST"})
    product = Product.objects.create(
        name="Papel", internal_code="PAP-BF", product_type=Product.Type.STORABLE,
        uom=uom, category=cat, cost_price=Decimal("0"),
    )
    warehouse = Warehouse.objects.create(name="Bodega", code="WH-BF")
    internal = Location.objects.create(location_type="INTERNAL", warehouse=warehouse, name="Interno")
    customer_loc = Location.objects.create(location_type="CUSTOMER", name="Cliente")
    customer = Contact.objects.create(name="Cliente", tax_id="12345678-9")
    order = SaleOrder.objects.create(customer=customer, date=date(2026, 8, 1), status=SaleOrder.Status.CONFIRMED)
    sale_line = SaleLine.objects.create(
        order=order, product=product, quantity=Decimal("4"), unit_price=Decimal("1000"), uom=uom
    )
    delivery = SaleDelivery.objects.create(
        sale_order=order, warehouse=warehouse, delivery_date=date(2026, 8, 14),
        status=SaleDelivery.Status.CONFIRMED,
    )
    line = SaleDeliveryLine.objects.create(
        delivery=delivery, sale_line=sale_line, product=product, uom=uom,
        quantity=Decimal("4"), unit_price=Decimal("1000"),
    )
    SaleOrder.objects.filter(pk=order.pk).update(delivery_status=SaleOrder.DeliveryStatus.DELIVERED)

    # Estado legado creado por el confirm_delivery anterior a ADR-0085 (con el bug):
    # el documento de inventario apuntaba a la OV, y ni detalle ni línea quedaron enlazados.
    doc = InventoryDocument.objects.create(
        document_type=InventoryDocument.Type.DELIVERY,
        status=InventoryDocument.Status.CONFIRMED,
        date=delivery.delivery_date,
        reference=f"Despacho {EntityPrefix.SALE_ORDER}-{order.number}",
        partner=customer,
        source_document_type="sales.saleorder",
        source_document_id=order.id,
    )
    type_label = doc.get_document_type_display()
    move = StockMove.objects.create(
        product=product, quantity=Decimal("4"),
        source_location=internal, destination_location=customer_loc,
        unit_cost=Decimal("0"),
        description=f"{type_label} {doc.display_id}" + (f" - {doc.reference}" if doc.reference else ""),
    )
    InventoryDocumentDetail.objects.create(
        document=doc, product=product, warehouse=warehouse,
        quantity=Decimal("4"), unit_cost=Decimal("0"), stock_move=None,
    )
    return {"doc": doc, "line": line, "sale_line": sale_line, "delivery": delivery, "move": move}


def _run(*args):
    out = StringIO()
    call_command(*args, stdout=out)
    return out.getvalue()


@pytest.mark.django_db
def test_audit_is_strict_on_broken_data(broken_delivery):
    report = _run("audit_document_integrity")
    assert "FALLA" in report
    with pytest.raises(CommandError):
        call_command("audit_document_integrity", "--strict", stdout=StringIO())


@pytest.mark.django_db
def test_backfill_dry_run_reports_but_does_not_write(broken_delivery):
    report = _run("backfill_document_links")

    assert "DRY-RUN" in report
    assert "despacho: enlazables 1" in report
    broken_delivery["line"].refresh_from_db()
    broken_delivery["sale_line"].refresh_from_db()
    broken_delivery["doc"].refresh_from_db()
    assert broken_delivery["line"].stock_move_id is None
    assert broken_delivery["sale_line"].quantity_delivered == 0
    assert broken_delivery["doc"].source_document_type == "sales.saleorder"


@pytest.mark.django_db
def test_backfill_apply_restores_links(broken_delivery):
    _run("backfill_document_links", "--apply")

    line = broken_delivery["line"]
    line.refresh_from_db()
    broken_delivery["sale_line"].refresh_from_db()
    broken_delivery["doc"].refresh_from_db()
    assert line.stock_move is not None
    assert line.stock_move.inventory_document_detail.document == broken_delivery["doc"]
    assert broken_delivery["sale_line"].quantity_delivered == Decimal("4")
    assert broken_delivery["doc"].source_document_type == "sales.saledelivery"
    assert broken_delivery["doc"].source_document_id == broken_delivery["delivery"].id
    assert "OK  " in _run("audit_document_integrity")
