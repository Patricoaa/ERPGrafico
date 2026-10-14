"""
M1 (auditoría documental): comandos `audit_document_integrity` (D5, solo lectura) y
`backfill_document_links` (D3, dry-run por defecto).

Se confirma un despacho con el servicio actual y luego se "rompen" sus vínculos para
reproducir los datos históricos generados por el bug (GAP-01/02/03, INT-04).
"""

from datetime import date
from decimal import Decimal
from io import StringIO

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from contacts.models import Contact
from inventory.models import (
    InventoryDocument,
    InventoryDocumentDetail,
    Location,
    Product,
    ProductCategory,
    UoM,
    UoMCategory,
    Warehouse,
)
from sales.models import SaleDelivery, SaleDeliveryLine, SaleLine, SaleOrder
from sales.services import SalesService


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
    Location.objects.get_or_create(location_type="INTERNAL", warehouse=warehouse, defaults={"name": "Interno"})
    Location.objects.get_or_create(location_type="CUSTOMER", defaults={"name": "Cliente"})
    customer = Contact.objects.create(name="Cliente", tax_id="12345678-9")
    order = SaleOrder.objects.create(customer=customer, date=date(2026, 8, 1), status=SaleOrder.Status.CONFIRMED)
    sale_line = SaleLine.objects.create(
        order=order, product=product, quantity=Decimal("4"), unit_price=Decimal("1000"), uom=uom
    )
    delivery = SaleDelivery.objects.create(sale_order=order, warehouse=warehouse, delivery_date=date(2026, 8, 14))
    line = SaleDeliveryLine.objects.create(
        delivery=delivery, sale_line=sale_line, product=product, uom=uom,
        quantity=Decimal("4"), unit_price=Decimal("1000"),
    )
    SalesService.confirm_delivery(delivery)
    SaleOrder.objects.filter(pk=order.pk).update(delivery_status=SaleOrder.DeliveryStatus.DELIVERED)

    # Reproducir el estado histórico (bug)
    doc = InventoryDocument.objects.get(source_document_type="sales.saledelivery", source_document_id=delivery.id)
    InventoryDocument.objects.filter(pk=doc.pk).update(
        source_document_type="sales.saleorder", source_document_id=order.id
    )
    InventoryDocumentDetail.objects.filter(document=doc).update(stock_move=None)
    SaleDeliveryLine.objects.filter(pk=line.pk).update(stock_move=None)
    SaleLine.objects.filter(pk=sale_line.pk).update(quantity_delivered=0)
    return {"doc": doc, "line": line, "sale_line": sale_line, "delivery": delivery}


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
