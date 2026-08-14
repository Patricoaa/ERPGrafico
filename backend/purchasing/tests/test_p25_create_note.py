"""
P2.5: PurchasingService.create_note — el lookup de bodega por devolución pasa
de Θ(I×R) (escaneo de recepciones + query por línea) a O(1) vía dict
construido con prefetch de recepciones confirmadas.
"""

from datetime import date
from decimal import Decimal

import pytest

from accounting.models import Account, AccountingSettings, AccountType
from billing.models import Invoice
from contacts.models import Contact
from core.cache import CACHE_KEY_ACCOUNTING_SETTINGS, invalidate_singleton
from inventory.models import (
    InventoryDocumentDetail,
    Location,
    Product,
    ProductCategory,
    UoM,
    UoMCategory,
    Warehouse,
)
from purchasing.models import PurchaseLine, PurchaseOrder, PurchaseReceipt, PurchaseReceiptLine
from purchasing.services import PurchasingService


@pytest.fixture
def note_setup(db):
    payable = Account.objects.create(
        code="2.1.01.001", name="CXP", account_type=AccountType.LIABILITY
    )
    stock_input = Account.objects.create(
        code="5.1.03.001", name="Entrada Stock", account_type=AccountType.EXPENSE
    )
    settings, _ = AccountingSettings.objects.get_or_create(pk=1)
    settings.default_payable_account = payable
    settings.stock_input_account = stock_input
    settings.save()
    invalidate_singleton(CACHE_KEY_ACCOUNTING_SETTINGS)

    uom_cat = UoMCategory.objects.create(name="Unidades")
    uom = UoM.objects.create(name="unidad", ratio=1, category=uom_cat)
    prod_cat = ProductCategory.objects.create(name="Test", prefix="TST")
    product = Product.objects.create(
        name="Producto",
        internal_code="P-1",
        product_type=Product.Type.STORABLE,
        uom=uom,
        category=prod_cat,
        cost_price=Decimal("100"),
    )

    supplier = Contact.objects.create(name="Proveedor", tax_id="33333333-3")
    order_wh = Warehouse.objects.create(name="Bodega Orden", code="WH-ORD")
    receipt_wh = Warehouse.objects.create(name="Bodega Recepción", code="WH-REC")
    Location.objects.get_or_create(
        location_type="INTERNAL", warehouse=receipt_wh, defaults={"name": "Interno"}
    )
    Location.objects.get_or_create(
        location_type="INTERNAL", warehouse=order_wh, defaults={"name": "Interno Orden"}
    )
    Location.objects.get_or_create(location_type="CUSTOMER", defaults={"name": "Cliente"})

    po = PurchaseOrder.objects.create(
        supplier=supplier,
        warehouse=order_wh,
        total=Decimal("1000"),
        total_net=Decimal("1000"),
        total_tax=0,
    )
    line = PurchaseLine.objects.create(
        order=po,
        product=product,
        quantity=Decimal("10"),
        quantity_received=Decimal("10"),
        unit_cost=Decimal("100"),
    )
    Invoice.objects.create(
        purchase_order=po,
        dte_type=Invoice.DTEType.FACTURA,
        number="FAC-0001",
        status=Invoice.Status.POSTED,
        total=Decimal("1000"),
        total_net=Decimal("1000"),
        total_tax=0,
    )
    receipt = PurchaseReceipt.objects.create(
        purchase_order=po,
        warehouse=receipt_wh,
        status=PurchaseReceipt.Status.CONFIRMED,
        receipt_date=date(2026, 7, 1),
        total=Decimal("1000"),
        total_net=Decimal("1000"),
        total_tax=0,
    )
    PurchaseReceiptLine.objects.create(
        receipt=receipt,
        purchase_line=line,
        product=product,
        quantity_received=Decimal("10"),
        unit_cost=Decimal("100"),
    )

    return {"po": po, "product": product, "line": line, "receipt_wh": receipt_wh}


def test_create_note_uses_receipt_warehouse_for_returns(note_setup):
    note = PurchasingService.create_note(
        order=note_setup["po"],
        note_type=Invoice.DTEType.NOTA_CREDITO,
        amount_net=Decimal("100"),
        amount_tax=Decimal("0"),
        document_number="NC-0001",
        return_items=[
            {
                "product_id": note_setup["product"].id,
                "quantity": Decimal("2"),
                "line_id": note_setup["line"].id,
            }
        ],
    )

    detail = InventoryDocumentDetail.objects.filter(
        document__source_document_id=note.id
    ).get(product=note_setup["product"])

    assert detail.quantity == Decimal("-2")
    assert detail.source_location.warehouse_id == note_setup["receipt_wh"].id
    assert detail.destination_location.location_type == "CUSTOMER"


def test_create_note_falls_back_to_order_warehouse_without_receipts(note_setup):
    PurchaseReceipt.objects.all().delete()

    note = PurchasingService.create_note(
        order=note_setup["po"],
        note_type=Invoice.DTEType.NOTA_CREDITO,
        amount_net=Decimal("100"),
        amount_tax=Decimal("0"),
        document_number="NC-0002",
        return_items=[
            {
                "product_id": note_setup["product"].id,
                "quantity": Decimal("2"),
                "line_id": note_setup["line"].id,
            }
        ],
    )

    detail = InventoryDocumentDetail.objects.filter(
        document__source_document_id=note.id
    ).get(product=note_setup["product"])

    assert detail.quantity == Decimal("-2")
    assert detail.source_location.warehouse_id == note_setup["po"].warehouse_id
