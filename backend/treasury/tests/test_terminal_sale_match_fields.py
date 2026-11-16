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
        assert row["matched_manually"] is False


@pytest.mark.django_db
def test_unlinked_sale_has_empty_match_fields(admin_client, provider):
    sale = make_sale(provider)
    row = admin_client.get(f"{URL}{sale.id}/").json()
    assert row["match_status"] == ""
    assert row["matched_invoice"] is None
    assert row["matched_invoice_display"] is None
    assert row["matched_manually"] is False


# ── Boleta SII vinculada (ADR-0139) ─────────────────────────────────────────


def _boleta(folio: int):
    from accounting.models import RCVDocument, RCVImport

    imp = RCVImport.objects.get_or_create(
        direction=RCVImport.Direction.SALES, year=2026, month=11,
        defaults={"trigger": RCVImport.Trigger.MANUAL, "status": RCVImport.Status.SUCCESS},
    )[0]
    return RCVDocument.objects.create(
        direction=RCVImport.Direction.SALES, company_rut="11111111-1", period="202611", dte_type=39,
        folio=folio, counterparty_rut="66666666-6", issue_date=date(2026, 11, 13), total_amount=1000,
        first_import=imp, last_import=imp,
    )


def _with_boleta(provider, n: int, offset: int) -> None:
    for i in range(n):
        make_sale(provider, rcv_document=_boleta(offset + i))


@pytest.mark.django_db
def test_list_exposes_rcv_boleta_without_n_plus_one(admin_client, provider):
    _with_boleta(provider, 3, 100)
    _count(admin_client)
    small = _count(admin_client)
    _with_boleta(provider, 6, 200)
    assert _count(admin_client) == small
    rows = admin_client.get(URL).json()["results"]
    assert len(rows) == 9
    for row in rows:
        assert row["rcv_document"]
        assert row["rcv_folio"] >= 100


@pytest.mark.django_db
def test_sale_without_boleta_has_null_rcv_fields(admin_client, provider):
    sale = make_sale(provider)
    row = admin_client.get(f"{URL}{sale.id}/").json()
    assert row["rcv_document"] is None and row["rcv_folio"] is None
    doc = _boleta(77)
    TerminalSale.objects.filter(pk=sale.pk).update(rcv_document=doc)
    row = admin_client.get(f"{URL}{sale.id}/").json()
    assert row["rcv_document"] == doc.id and row["rcv_folio"] == 77
