"""
P1-4: F29Declaration.documents — paginated envelope + flat serializer, O(1) queries.

The documents action used to serialize every invoice of the month with the heavy
InvoiceSerializer (nested lines, related documents, stock moves, payments...),
triggering ~10+ queries per invoice and returning an unbounded bare array.
"""

from datetime import date
from decimal import Decimal

import pytest

from billing.models import Invoice
from contacts.models import Contact
from tax.models import F29Declaration, TaxPeriod


@pytest.fixture
def tax_env(db):
    from django.contrib.auth import get_user_model

    User = get_user_model()
    user = User.objects.create_user(username="taxdocuser", password="x")
    contact = Contact.objects.create(name="Cliente Test", tax_id="11111111-1")
    period = TaxPeriod.objects.create(year=2026, month=8)
    declaration = F29Declaration.objects.create(tax_period=period)
    invoices = []
    for i in range(5):
        invoices.append(
            Invoice.objects.create(
                dte_type=Invoice.DTEType.FACTURA,
                contact=contact,
                status=Invoice.Status.POSTED,
                date=date(2026, 8, 15),
                total=Decimal("50000"),
                total_net=Decimal("42017"),
                total_tax=Decimal("7983"),
            )
        )
    return {
        "user": user,
        "contact": contact,
        "period": period,
        "declaration": declaration,
        "invoices": invoices,
    }


@pytest.mark.django_db
def test_documents_paginated_envelope(api_client, tax_env):
    url = f"/api/tax/declarations/{tax_env['declaration'].id}/documents/"
    resp = api_client.get(url)
    assert resp.status_code == 200
    data = resp.json()
    assert set(data) == {"count", "next", "previous", "results"}
    assert data["count"] == 5
    assert len(data["results"]) == 5
    for row in data["results"]:
        assert row["dte_type"] == Invoice.DTEType.FACTURA
        assert row["status"] == Invoice.Status.POSTED
        assert row["partner_name"] == "Cliente Test"
        assert "lines" not in row
        assert "sale_order_detail" not in row


@pytest.mark.django_db
def test_documents_query_count_bounded(api_client, tax_env, django_assert_max_num_queries):
    url = f"/api/tax/declarations/{tax_env['declaration'].id}/documents/"
    with django_assert_max_num_queries(8):
        resp = api_client.get(url)
    assert resp.status_code == 200
