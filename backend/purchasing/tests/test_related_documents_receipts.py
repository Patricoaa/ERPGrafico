"""
GAP-07 (auditoría documental): el Hub de compras debe listar recepciones, no
StockMoves. El `id` de cada entrada de `receipts` es el de la PurchaseReceipt,
porque el frontend lo usa para abrir y anular la recepción.
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
from purchasing.models import PurchaseLine, PurchaseOrder, PurchaseReceipt, PurchaseReceiptLine
from purchasing.selectors import PurchaseOrderSelector


@pytest.fixture
def env(db):
    uom_cat, _ = UoMCategory.objects.get_or_create(name="Unidades")
    uom, _ = UoM.objects.get_or_create(name="unidad", defaults={"ratio": 1, "category": uom_cat})
    prod_cat, _ = ProductCategory.objects.get_or_create(name="Test", defaults={"prefix": "TST"})
    product = Product.objects.create(
        name="Papel",
        internal_code="PAP-1",
        product_type=Product.Type.STORABLE,
        uom=uom,
        category=prod_cat,
        cost_price=Decimal("0"),
    )
    warehouse = Warehouse.objects.create(name="Bodega", code="WH-07")
    internal, _ = Location.objects.get_or_create(
        location_type="INTERNAL", warehouse=warehouse, defaults={"name": "Interno"}
    )
    vendor, _ = Location.objects.get_or_create(location_type="VENDOR", defaults={"name": "Proveedor"})
    supplier = Contact.objects.create(name="Proveedor", tax_id="33333333-3")
    po = PurchaseOrder.objects.create(
        number="PO-GAP07", supplier=supplier, warehouse=warehouse, total=0, total_net=0, total_tax=0
    )
    po_line = PurchaseLine.objects.create(
        order=po, product=product, quantity=Decimal("10"), unit_cost=Decimal("100"), uom=uom
    )
    return {
        "uom": uom,
        "product": product,
        "warehouse": warehouse,
        "po": po,
        "po_line": po_line,
        "locations": (vendor, internal),
    }


def _receipt(env, qty, with_move):
    receipt = PurchaseReceipt.objects.create(
        purchase_order=env["po"],
        warehouse=env["warehouse"],
        receipt_date=date(2026, 10, 1),
        total=0,
        total_net=0,
        total_tax=0,
    )
    move = None
    if with_move:
        vendor, internal = env["locations"]
        move = StockMove.objects.create(
            product=env["product"],
            uom=env["uom"],
            quantity=Decimal(str(qty)),
            source_location=vendor,
            destination_location=internal,
        )
    PurchaseReceiptLine.objects.create(
        receipt=receipt,
        purchase_line=env["po_line"],
        product=env["product"],
        uom=env["uom"],
        quantity_received=Decimal(str(qty)),
        unit_cost=Decimal("100"),
        stock_move=move,
    )
    return receipt, move


def _receipts(env):
    order = PurchaseOrderSelector.get_base_queryset().get(pk=env["po"].pk)
    return PurchaseOrderSelector.get_related_documents(order)["receipts"]


@pytest.mark.django_db
def test_receipts_use_receipt_id_not_stock_move_id(env):
    # Desfasar ids: crear moves sueltos para que id de move != id de recepción.
    vendor, internal = env["locations"]
    for _ in range(3):
        StockMove.objects.create(
            product=env["product"], uom=env["uom"], quantity=Decimal("1"),
            source_location=vendor, destination_location=internal,
        )
    receipt, move = _receipt(env, 4, with_move=True)
    assert receipt.id != move.id

    entries = _receipts(env)

    assert len(entries) == 1
    entry = entries[0]
    assert entry["id"] == receipt.id
    assert entry["docType"] == "purchase_receipt"
    assert entry["status"] == receipt.status
    assert [m["id"] for m in entry["stock_moves"]] == [move.id]


@pytest.mark.django_db
def test_receipts_without_stock_move_are_listed(env):
    """Antes se omitían (21/34 recepciones en dev no tenían stock_move)."""
    linked, _ = _receipt(env, 2, with_move=True)
    unlinked, _ = _receipt(env, 3, with_move=False)

    ids = {e["id"] for e in _receipts(env)}

    assert ids == {linked.id, unlinked.id}
