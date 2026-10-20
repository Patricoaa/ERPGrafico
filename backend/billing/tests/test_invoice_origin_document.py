"""ADR-0086: InvoiceSerializer expone su documento de origen como `origin_document`
(DocumentRef con `url` canónica). Precedencia: nota correctora → OV → OC, igual que la
ficha de factura del frontend."""

from datetime import date
from decimal import Decimal

import pytest

from billing.models import Invoice
from billing.serializers import InvoiceSerializer
from contacts.models import Contact
from purchasing.models import PurchaseOrder
from sales.models import SaleOrder


@pytest.fixture
def env(db):
    customer = Contact.objects.create(name="Cliente", tax_id="11111111-1")
    supplier = Contact.objects.create(name="Proveedor", tax_id="22222222-2")
    return {"customer": customer, "supplier": supplier}


def _invoice(**kw):
    return Invoice.objects.create(
        total=Decimal("1000"), total_net=Decimal("840"), total_tax=Decimal("160"), **kw
    )


def test_origin_document_is_sale_order(env):
    so = SaleOrder.objects.create(customer=env["customer"], date=date(2026, 10, 1))
    invoice = _invoice(dte_type=Invoice.DTEType.FACTURA, contact=env["customer"], sale_order=so)

    ref = InvoiceSerializer(invoice).data["origin_document"]

    assert ref["label"] == "sales.saleorder"
    assert ref["id"] == so.id
    assert ref["url"] == f"/sales/orders?selected={so.id}"


def test_origin_document_is_purchase_order(env):
    po = PurchaseOrder.objects.create(number="PO-1", supplier=env["supplier"], total=0, total_net=0, total_tax=0)
    invoice = _invoice(dte_type=Invoice.DTEType.PURCHASE_INV, contact=env["supplier"], purchase_order=po)

    ref = InvoiceSerializer(invoice).data["origin_document"]

    assert ref["label"] == "purchasing.purchaseorder"
    assert ref["id"] == po.id
    assert ref["url"] == f"/purchasing/orders?selected={po.id}"


def test_origin_document_prefers_corrected_invoice(env):
    so = SaleOrder.objects.create(customer=env["customer"], date=date(2026, 10, 1))
    original = _invoice(dte_type=Invoice.DTEType.FACTURA, contact=env["customer"], sale_order=so, status=Invoice.Status.POSTED)
    note = _invoice(
        dte_type=Invoice.DTEType.NOTA_CREDITO,
        contact=env["customer"],
        sale_order=so,
        corrected_invoice=original,
    )

    ref = InvoiceSerializer(note).data["origin_document"]

    assert ref["label"] == "billing.invoice"
    assert ref["id"] == original.id
    assert ref["url"] == f"/sales/dtes?selected={original.id}"


def test_origin_document_null_for_standalone(env):
    invoice = _invoice(dte_type=Invoice.DTEType.BOLETA, contact=env["customer"])

    assert InvoiceSerializer(invoice).data["origin_document"] is None
