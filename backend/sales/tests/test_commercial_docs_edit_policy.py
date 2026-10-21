"""ADR-0091 — invoices and sale/purchase orders: editable only as DRAFT without entry."""

from datetime import date

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from billing.models import Invoice
from contacts.models import Contact
from purchasing.models import PurchaseOrder
from sales.models import SaleOrder

User = get_user_model()


@pytest.fixture
def client(db):
    c = APIClient()
    c.force_authenticate(User.objects.create_superuser("commpol", "c@x.cl", "x"))
    return c


@pytest.fixture
def contact(db):
    return Contact.objects.create(name="Cliente Proveedor", tax_id="77777777-7")


@pytest.mark.django_db
def test_confirmed_sale_order_locked_except_notes(client, contact):
    order = SaleOrder.objects.create(
        customer=contact, date=date(2026, 9, 1), status=SaleOrder.Status.CONFIRMED
    )
    other = Contact.objects.create(name="Otro", tax_id="88888888-8")
    url = f"/api/sales/orders/{order.pk}/"
    res = client.patch(url, {"customer": other.pk}, format="json")
    assert res.status_code == 422
    assert res.data["error"]["code"] == "DOCUMENT_LOCKED"
    assert client.patch(url, {"notes": "llamar antes"}, format="json").status_code == 200


@pytest.mark.django_db
def test_draft_sale_order_is_editable(client, contact):
    order = SaleOrder.objects.create(customer=contact, date=date(2026, 9, 1))
    res = client.patch(f"/api/sales/orders/{order.pk}/", {"notes": "x"}, format="json")
    assert res.status_code == 200, res.data


@pytest.mark.django_db
def test_confirmed_purchase_order_locked(client, contact):
    po = PurchaseOrder.objects.create(supplier=contact, status=PurchaseOrder.Status.CONFIRMED)
    res = client.patch(f"/api/purchasing/orders/{po.pk}/", {"supplier_reference": "X-1"}, format="json")
    assert res.status_code == 422


@pytest.mark.django_db
def test_posted_invoice_locked(client, contact):
    order = SaleOrder.objects.create(customer=contact, date=date(2026, 9, 1))
    invoice = Invoice.objects.create(
        sale_order=order, contact=contact, date=date(2026, 9, 1),
        dte_type=Invoice.DTEType.FACTURA, number="101", status=Invoice.Status.POSTED,
    )
    res = client.patch(f"/api/billing/invoices/{invoice.pk}/", {"date": "2026-09-20"}, format="json")
    assert res.status_code == 422


@pytest.mark.django_db
def test_commercial_documents_are_never_hard_deleted(client, contact):
    order = SaleOrder.objects.create(
        customer=contact, date=date(2026, 9, 1), status=SaleOrder.Status.CANCELLED
    )
    po = PurchaseOrder.objects.create(supplier=contact, status=PurchaseOrder.Status.CANCELLED)
    invoice = Invoice.objects.create(
        sale_order=order, contact=contact, date=date(2026, 9, 1),
        dte_type=Invoice.DTEType.FACTURA, status=Invoice.Status.CANCELLED,
    )
    assert client.delete(f"/api/sales/orders/{order.pk}/").status_code == 405
    assert client.delete(f"/api/purchasing/orders/{po.pk}/").status_code == 405
    assert client.delete(f"/api/billing/invoices/{invoice.pk}/").status_code == 405
