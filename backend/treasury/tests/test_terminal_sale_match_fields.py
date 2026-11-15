"""Campos de cuadre fiscal en ventas TUU (ADR-0138 D6)."""

from datetime import date

import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError, connection, transaction
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from billing.models import Invoice
from contacts.models import Contact
from core.fiscal_match import MatchStatus
from treasury.models import TerminalSale
from treasury.tests.helpers import make_terminal_provider
from treasury.tests.test_terminal_sales_api import make_sale

URL = "/api/treasury/terminal-sales/"


@pytest.fixture
def provider(db):
    return make_terminal_provider()


@pytest.fixture
def admin_client(db):
    c = APIClient()
    c.force_authenticate(get_user_model().objects.create_superuser(username="m-admin", password="x"))
    return c


def _invoice(n: int) -> Invoice:
    contact = Contact.objects.get_or_create(name="Cliente cuadre", tax_id="76.333.333-3")[0]
    return Invoice.objects.create(contact=contact, date=date(2026, 11, 10), number=f"MF-{n}")


def _linked(provider, n: int) -> None:
    for i in range(n):
        make_sale(
            provider,
            matched_invoice=_invoice(i + 1000 * n),
            match_status=MatchStatus.MATCHED,
        )


@pytest.mark.django_db
def test_matched_invoice_is_unique(provider):
    inv = _invoice(1)
    make_sale(provider, matched_invoice=inv)
    with pytest.raises(IntegrityError), transaction.atomic():
        make_sale(provider, matched_invoice=inv)
    # varias ventas sin vínculo conviven
    make_sale(provider)
    make_sale(provider)
    assert TerminalSale.objects.filter(matched_invoice__isnull=True).count() == 2


def _count(client, url=URL) -> int:
    with CaptureQueriesContext(connection) as ctx:
        assert client.get(url).status_code == 200
    return len(ctx.captured_queries)


@pytest.mark.django_db
def test_list_exposes_match_fields_without_n_plus_one(admin_client, provider):
    _linked(provider, 3)
    _count(admin_client)
    small = _count(admin_client)
    _linked(provider, 6)
    assert _count(admin_client) == small
    rows = admin_client.get(URL).json()["results"]
    assert len(rows) == 9
    for row in rows:
        assert row["match_status"] == "MATCHED"
        assert row["match_status_display"] == "Cuadrado"
        assert row["matched_invoice"]
        assert row["matched_invoice_display"]


@pytest.mark.django_db
def test_unlinked_sale_has_empty_match_fields(admin_client, provider):
    sale = make_sale(provider)
    row = admin_client.get(f"{URL}{sale.id}/").json()
    assert row["match_status"] == ""
    assert row["matched_invoice"] is None
    assert row["matched_invoice_display"] is None
