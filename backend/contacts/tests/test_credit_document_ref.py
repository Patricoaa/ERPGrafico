"""ADR-0086: las tablas de crédito que listan órdenes de venta exponen el DocumentRef
de la propia OV (`document`) para enlazar a su ruta canónica en vez de abrir un drawer.

Cubre las dos superficies:
- `ContactSelector.get_credit_ledger` (ledger de crédito del contacto) → dict con `document`.
- `SaleOrderSerializer.document` (historial de crédito, contacto y global) → ref de la OV.
"""

from datetime import date, timedelta
from decimal import Decimal

import pytest

from contacts.models import Contact
from contacts.selectors import ContactSelector
from sales.models import SaleOrder
from sales.serializers import SaleOrderSerializer

TODAY = date.today()


@pytest.fixture
def credit_customer(db):
    customer = Contact.objects.create(name="Cliente Crédito ADR86", tax_id="44.444.444-4")
    SaleOrder.objects.create(
        customer=customer,
        date=TODAY - timedelta(days=5),
        total=Decimal("1000"),
        status=SaleOrder.Status.CONFIRMED,
    )
    return customer


def test_credit_ledger_entry_exposes_sale_order_document(credit_customer):
    ledger = ContactSelector.get_credit_ledger(contact=credit_customer)

    assert len(ledger) == 1
    ref = ledger[0]["document"]
    assert ref["label"] == "sales.saleorder"
    assert ref["id"] == ledger[0]["id"]
    assert ref["url"] == f"/sales/dtes/orders?selected={ref['id']}"


def test_sale_order_serializer_exposes_self_document(credit_customer):
    order = SaleOrder.objects.get(customer=credit_customer)

    ref = SaleOrderSerializer(order).data["document"]

    assert ref["label"] == "sales.saleorder"
    assert ref["id"] == order.id
    assert ref["url"] == f"/sales/dtes/orders?selected={order.id}"
