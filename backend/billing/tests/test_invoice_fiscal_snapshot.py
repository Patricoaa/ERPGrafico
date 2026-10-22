"""Issued documents keep the counterparty's fiscal data as of issuance."""

from datetime import date

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from billing.models import Invoice
from contacts.models import Contact
from sales.models import SaleOrder


@pytest.fixture
def client(db):
    c = APIClient()
    c.force_authenticate(get_user_model().objects.create_superuser("snap", "s@x.cl", "x"))
    return c


@pytest.fixture
def order(db):
    customer = Contact.objects.create(name="Imprenta Sur SpA", tax_id="76111111-1", address="Calle 1")
    return SaleOrder.objects.create(customer=customer, date=date(2026, 9, 1))


def _invoice(order, **kw):
    return Invoice.objects.create(
        sale_order=order, date=date(2026, 9, 1), dte_type=Invoice.DTEType.FACTURA, **kw
    )


@pytest.mark.django_db
def test_issued_invoice_keeps_data_after_contact_edit(client, order):
    inv = _invoice(order, number="501", status=Invoice.Status.POSTED)
    customer = order.customer
    customer.name = "Imprenta Sur Ltda"
    customer.tax_id = "76222222-2"
    customer.save()

    data = client.get(f"/api/billing/invoices/{inv.pk}/").data
    assert data["partner_name"] == "Imprenta Sur SpA"
    assert data["partner_tax_id"] == "76111111-1"


@pytest.mark.django_db
def test_draft_shows_live_data_and_captures_on_issue(order):
    inv = _invoice(order, status=Invoice.Status.DRAFT)
    assert not inv.has_fiscal_snapshot
    order.customer.name = "Nombre corregido"
    order.customer.save()
    inv.refresh_from_db()
    assert inv.partner_display_name == "Nombre corregido"

    inv.status = Invoice.Status.POSTED
    inv.number = "502"
    inv.save(update_fields=["status", "number"])
    inv.refresh_from_db()
    assert inv.partner_name_snapshot == "Nombre corregido"
    assert inv.partner_tax_id_snapshot == "76111111-1"
    assert inv.partner_address_snapshot == "Calle 1"
