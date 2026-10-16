"""
ADR-0085: los documentos de compra son dueños de sus StockMove.

Verifica la semántica de signo/ubicaciones de la migración:
  - Recepción (confirm_receipt): IN (PROVEEDOR → INTERNO).
  - Devolución de compra (PurchaseReturnService.confirm_return): OUT (INTERNO → PROVEEDOR).
  - Anulación de devolución: IN de reverso.
  - Anulación de recepción (annul_receipt): OUT de reverso.
Todos los movimientos quedan atribuidos vía `source_document`.
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
from purchasing.models import (
    PurchaseLine,
    PurchaseOrder,
    PurchaseReturn,
    PurchaseReturnLine,
    PurchaseReceipt,
    PurchaseReceiptLine,
)
from purchasing.return_services import PurchaseReturnService
from purchasing.services import PurchasingService


def _make_product(uom, code, cost="100"):
    prod_cat, _ = ProductCategory.objects.get_or_create(name="Test", defaults={"prefix": "TST"})
    return Product.objects.create(
        name=f"Producto {code}",
        internal_code=code,
        product_type=Product.Type.STORABLE,
        uom=uom,
        category=prod_cat,
        cost_price=Decimal(cost),
    )


@pytest.fixture
def env(db):
    uom_cat, _ = UoMCategory.objects.get_or_create(name="Unidades")
    uom, _ = UoM.objects.get_or_create(name="unidad", defaults={"ratio": 1, "category": uom_cat})
    warehouse = Warehouse.objects.create(name="Bodega", code="WH-85")
    internal, _ = Location.objects.get_or_create(
        location_type="INTERNAL", warehouse=warehouse, defaults={"name": "Interno"}
    )
    vendor, _ = Location.objects.get_or_create(location_type="VENDOR", defaults={"name": "Proveedor"})
    supplier = Contact.objects.create(name="Proveedor", tax_id="33333333-3")
    po = PurchaseOrder.objects.create(
        number="PO-85", supplier=supplier, warehouse=warehouse, total=0, total_net=0, total_tax=0
    )
    product = _make_product(uom, "P-85")
    po_line = PurchaseLine.objects.create(
        order=po,
        product=product,
        quantity=Decimal("4"),
        quantity_received=Decimal("4"),
        unit_cost=Decimal("100"),
        uom=uom,
    )
    return {
        "uom": uom,
        "warehouse": warehouse,
        "internal": internal,
        "vendor": vendor,
        "po": po,
        "product": product,
        "po_line": po_line,
    }


def test_confirm_purchase_return_creates_out_move(env):
    ret = PurchaseReturn.objects.create(
        purchase_order=env["po"], warehouse=env["warehouse"], date=date(2026, 9, 1)
    )
    PurchaseReturnLine.objects.create(
        return_doc=ret,
        product=env["product"],
        quantity=Decimal("3"),
        uom=env["uom"],
        unit_cost=Decimal("100"),
    )

    PurchaseReturnService.confirm_return(ret)

    ret.refresh_from_db()
    assert ret.status == PurchaseReturn.Status.CONFIRMED

    moves = list(StockMove.for_document(ret))
    assert len(moves) == 1
    move = moves[0]
    assert move.quantity == Decimal("3")
    assert move.source_location.location_type == "INTERNAL"
    assert move.destination_location.location_type == "VENDOR"
    assert move.direction == "OUT"

    line = ret.lines.get()
    line.refresh_from_db()
    assert line.stock_move_id == move.id


def test_annul_purchase_return_reverses_stock(env):
    ret = PurchaseReturn.objects.create(
        purchase_order=env["po"], warehouse=env["warehouse"], date=date(2026, 9, 1)
    )
    PurchaseReturnLine.objects.create(
        return_doc=ret,
        product=env["product"],
        quantity=Decimal("3"),
        uom=env["uom"],
        unit_cost=Decimal("100"),
    )
    PurchaseReturnService.confirm_return(ret)

    PurchaseReturnService.annul_return(ret.id)

    ret.refresh_from_db()
    assert ret.status == PurchaseReturn.Status.CANCELLED

    # La devolución (OUT) + la anulación (IN) = 2 movimientos atribuidos al documento.
    moves = list(StockMove.for_document(ret))
    assert len(moves) == 2
    assert {m.direction for m in moves} == {"OUT", "IN"}
    incoming = next(m for m in moves if m.direction == "IN")
    assert incoming.source_location.location_type == "VENDOR"
    assert incoming.destination_location.location_type == "INTERNAL"


def test_annul_receipt_reverses_in_moves(env):
    receipt = PurchaseReceipt.objects.create(
        purchase_order=env["po"],
        warehouse=env["warehouse"],
        receipt_date=date(2026, 9, 1),
        status=PurchaseReceipt.Status.CONFIRMED,
        total=0,
        total_net=0,
        total_tax=0,
    )
    move = StockMove.objects.create(
        product=env["product"],
        uom=env["uom"],
        quantity=Decimal("4"),
        source_location=env["vendor"],
        destination_location=env["internal"],
        unit_cost=Decimal("100"),
        source_document=receipt,
    )
    PurchaseReceiptLine.objects.create(
        receipt=receipt,
        purchase_line=env["po_line"],
        product=env["product"],
        uom=env["uom"],
        quantity_received=Decimal("4"),
        unit_cost=Decimal("100"),
        stock_move=move,
    )

    PurchasingService.annul_receipt(receipt, reason="test")

    receipt.refresh_from_db()
    assert receipt.status == PurchaseReceipt.Status.CANCELLED

    moves = list(StockMove.for_document(receipt))
    assert len(moves) == 2
    assert {m.direction for m in moves} == {"IN", "OUT"}
    outgoing = next(m for m in moves if m.direction == "OUT")
    assert outgoing.source_location.location_type == "INTERNAL"
    assert outgoing.destination_location.location_type == "VENDOR"
