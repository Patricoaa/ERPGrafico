"""ADR-0086: el serializer de Documento de Inventario expone el documento fuente como
DocumentRef (`source_document`) con `url` canónica (vía `ref_for`), para que el frontend
navegue al módulo destino en el drilldown en vez de apilar el drawer."""

from datetime import date

import pytest

from contacts.models import Contact
from inventory.models import InventoryDocument
from inventory.serializers import InventoryDocumentSerializer
from sales.models import SaleOrder


@pytest.fixture
def inventory_doc_with_sale_source(db):
    customer = Contact.objects.create(name="Cliente INV", tax_id="11111111-1")
    order = SaleOrder.objects.create(
        customer=customer, date=date(2026, 8, 1), status=SaleOrder.Status.CONFIRMED
    )
    doc = InventoryDocument.objects.create(
        document_type=InventoryDocument.Type.DELIVERY,
        status=InventoryDocument.Status.DRAFT,
        source_document_type="sales.saleorder",
        source_document_id=order.id,
    )
    return doc, order


def test_inventory_document_exposes_source_document_ref(inventory_doc_with_sale_source):
    doc, order = inventory_doc_with_sale_source

    data = InventoryDocumentSerializer(doc).data

    ref = data["source_document"]
    assert ref is not None
    assert ref["label"] == "sales.saleorder"
    assert ref["id"] == order.id
    assert ref["url"] == f"/sales/dtes/orders?selected={order.id}"


def test_inventory_document_source_document_null_without_source(db):
    doc = InventoryDocument.objects.create(
        document_type=InventoryDocument.Type.RECEIPT,
        status=InventoryDocument.Status.DRAFT,
    )

    data = InventoryDocumentSerializer(doc).data

    assert data["source_document"] is None
