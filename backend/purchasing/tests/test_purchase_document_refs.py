"""ADR-0086: los serializers de recepción/devolución de compra exponen DocumentRefs con
`url` canónica (`*_document`) para que el frontend navegue en el drilldown en vez de
apilar el drawer. La URL la decide el `DocumentTypeRegistry` (ADR-0080 §6)."""

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
    PurchaseReceipt,
    PurchaseReceiptLine,
    PurchaseReturn,
    PurchaseReturnLine,
)
from purchasing.return_services import PurchaseReturnService
from purchasing.serializers import (
    PurchaseReceiptLineSerializer,
    PurchaseReceiptSerializer,
    PurchaseReturnLineSerializer,
    PurchaseReturnSerializer,
)


@pytest.fixture
def purchasing_setup(db):
    uom_cat, _ = UoMCategory.objects.get_or_create(name="Unidades")
    uom, _ = UoM.objects.get_or_create(name="unidad", defaults={"ratio": 1, "category": uom_cat})
    prod_cat, _ = ProductCategory.objects.get_or_create(name="Test", defaults={"prefix": "TST"})

    warehouse = Warehouse.objects.create(name="Bodega", code="WH-PDR")
    internal, _ = Location.objects.get_or_create(
        location_type="INTERNAL", warehouse=warehouse, defaults={"name": "Interno"}
    )
    vendor, _ = Location.objects.get_or_create(
        location_type="VENDOR", defaults={"name": "Proveedor"}
    )
    supplier = Contact.objects.create(name="Proveedor", tax_id="22222222-2")
    order = PurchaseOrder.objects.create(
        number="PO-DR", supplier=supplier, warehouse=warehouse, total=0, total_net=0, total_tax=0
    )
    product = Product.objects.create(
        name="Producto",
        internal_code="PDR-1",
        product_type=Product.Type.STORABLE,
        uom=uom,
        category=prod_cat,
        cost_price=Decimal("100"),
    )
    po_line = PurchaseLine.objects.create(
        order=order,
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
        "order": order,
        "product": product,
        "po_line": po_line,
    }


def _make_receipt_with_move(setup):
    receipt = PurchaseReceipt.objects.create(
        purchase_order=setup["order"],
        warehouse=setup["warehouse"],
        receipt_date=date(2026, 9, 1),
        status=PurchaseReceipt.Status.CONFIRMED,
        total=0,
        total_net=0,
        total_tax=0,
    )
    move = StockMove.objects.create(
        product=setup["product"],
        uom=setup["uom"],
        quantity=Decimal("4"),
        source_location=setup["vendor"],
        destination_location=setup["internal"],
        unit_cost=Decimal("100"),
        source_document=receipt,
    )
    line = PurchaseReceiptLine.objects.create(
        receipt=receipt,
        purchase_line=setup["po_line"],
        product=setup["product"],
        uom=setup["uom"],
        quantity_received=Decimal("4"),
        unit_cost=Decimal("100"),
        stock_move=move,
    )
    return receipt, line, move


def test_receipt_serializer_exposes_order_document_ref(purchasing_setup):
    receipt, _, _ = _make_receipt_with_move(purchasing_setup)

    ref = PurchaseReceiptSerializer(receipt).data["purchase_order_document"]
    assert ref["label"] == "purchasing.purchaseorder"
    assert ref["id"] == purchasing_setup["order"].id
    assert ref["url"] == f"/purchasing/orders?selected={purchasing_setup['order'].id}"


def test_receipt_line_serializer_exposes_stock_move_document_ref(purchasing_setup):
    _, line, move = _make_receipt_with_move(purchasing_setup)

    ref = PurchaseReceiptLineSerializer(line).data["stock_move_document"]
    assert ref["label"] == "inventory.stockmove"
    assert ref["id"] == move.id
    assert ref["url"] == f"/inventory/reports/movements?selected={move.id}"


def test_receipt_serializer_document_ref_without_request_context(purchasing_setup):
    """El DocumentRef de la OC no depende de un contexto de request."""
    receipt, _, _ = _make_receipt_with_move(purchasing_setup)

    ref = PurchaseReceiptSerializer(receipt).data["purchase_order_document"]
    assert ref["url"] == f"/purchasing/orders?selected={purchasing_setup['order'].id}"


def test_return_serializer_exposes_order_document_ref(purchasing_setup):
    ret = PurchaseReturn.objects.create(
        purchase_order=purchasing_setup["order"],
        warehouse=purchasing_setup["warehouse"],
        date=date(2026, 9, 2),
    )

    ref = PurchaseReturnSerializer(ret).data["purchase_order_document"]
    assert ref["label"] == "purchasing.purchaseorder"
    assert ref["id"] == purchasing_setup["order"].id
    assert ref["url"] == f"/purchasing/orders?selected={purchasing_setup['order'].id}"


def test_return_line_serializer_exposes_stock_move_document_ref(purchasing_setup):
    ret = PurchaseReturn.objects.create(
        purchase_order=purchasing_setup["order"],
        warehouse=purchasing_setup["warehouse"],
        date=date(2026, 9, 2),
    )
    PurchaseReturnLine.objects.create(
        return_doc=ret,
        product=purchasing_setup["product"],
        quantity=Decimal("3"),
        uom=purchasing_setup["uom"],
        unit_cost=Decimal("100"),
    )
    PurchaseReturnService.confirm_return(ret)

    line = ret.lines.get()
    line.refresh_from_db()
    assert line.stock_move_id is not None

    ref = PurchaseReturnLineSerializer(line).data["stock_move_document"]
    assert ref["label"] == "inventory.stockmove"
    assert ref["id"] == line.stock_move_id
    assert ref["url"] == f"/inventory/reports/movements?selected={line.stock_move_id}"
