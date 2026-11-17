"""Campos de cuadre fiscal en ventas TUU (ADR-0138 D6)."""

from datetime import date

import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError, connection, transaction
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from billing.models import Invoice
from contacts.models import Contact
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


def _group(status: str = "MATCHED"):
    from tax.models import FiscalMatch

    return FiscalMatch.objects.create(direction=FiscalMatch.Direction.SALE, status=status)


def _linked(provider, n: int) -> None:
    for _i in range(n):
        make_sale(provider, fiscal_match=_group())


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
def test_list_exposes_fiscal_match_without_n_plus_one(admin_client, provider):
    _linked(provider, 3)
    _count(admin_client)
    small = _count(admin_client)
    _linked(provider, 6)
    assert _count(admin_client) == small
    rows = admin_client.get(URL).json()["results"]
    assert len(rows) == 9
    for row in rows:
        assert row["fiscal_match"]["status"] == "MATCHED"
        assert row["fiscal_match"]["status_display"] == "Cuadrado"
        assert row["fiscal_match"]["id"]
        for old in ("match_status", "matched_invoice", "rcv_document", "rcv_folio"):
            assert old not in row


@pytest.mark.django_db
def test_unlinked_sale_has_null_fiscal_match(admin_client, provider):
    sale = make_sale(provider)
    row = admin_client.get(f"{URL}{sale.id}/").json()
    assert row["fiscal_match"] is None
    assert row["matched_manually"] is False


@pytest.mark.django_db
def test_filter_by_fiscal_match_status(admin_client, provider):
    sale = make_sale(provider, fiscal_match=_group("DIFF"))
    make_sale(provider, fiscal_match=_group("MATCHED"))
    make_sale(provider)
    rows = admin_client.get(f"{URL}?fiscal_match_status=DIFF").json()["results"]
    assert [r["id"] for r in rows] == [sale.id]
    assert admin_client.get(f"{URL}?fiscal_match_status=NOPE").status_code == 400
