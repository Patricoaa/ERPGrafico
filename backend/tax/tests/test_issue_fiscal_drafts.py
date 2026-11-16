"""Emisión automática de borradores 39/41/48 con el folio del proveedor (ADR-0140 D3)."""

import itertools
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from accounting.models import RCVDocument, RCVImport
from billing.models import Invoice
from billing.services import BillingService
from billing.tests.conftest import _any_account_is_cash, env  # noqa: F401 (fixtures)
from billing.tests.test_pos_checkout_documents import _checkout, _order, pos  # noqa: F401
from tax.reconciliation.boletas import reconcile_rcv_boletas
from tax.reconciliation.issuing import issue_fiscal_drafts
from tax.reconciliation.terminal import reconcile_terminal_sales
from tax.services import TaxPeriodService
from tax.tests.reconciliation_helpers import (
    local_dt,
    make_pos_document,
    make_terminal_env,
    make_terminal_sale,
    set_match_settings,
)
from treasury.models import TerminalSale

S = RCVImport.Direction.SALES
_folios = itertools.count(9000)
DRAFT = Invoice.Status.DRAFT
BOLETA = Invoice.DTEType.BOLETA
C48 = Invoice.DTEType.COMPROBANTE_PAGO


def _import(year, month):
    return RCVImport.objects.create(
        direction=S, year=year, month=month, trigger=RCVImport.Trigger.MANUAL, status=RCVImport.Status.SUCCESS
    )


def _rcv_boleta(imp, total, day: date, folio=None, dte_type=39):
    return RCVDocument.objects.create(
        direction=S, company_rut="11111111-1", period=f"{day.year}{day.month:02d}", dte_type=dte_type,
        folio=folio if folio is not None else next(_folios), counterparty_rut="66666666-6",
        issue_date=day, total_amount=Decimal(total), first_import=imp, last_import=imp,
    )


@pytest.fixture
def tenv(db):
    set_match_settings(date(2026, 11, 1))
    return make_terminal_env()


def _draft(tenv, total, at, dte_type=C48):
    method = "CARD" if dte_type == C48 else "CASH"
    return make_pos_document(tenv, total, at, dte_type=dte_type, method=method, status=DRAFT)


@pytest.mark.django_db
def test_cash_boleta_issued_with_rcv_folio_and_date(env, pos):  # noqa: F811
    today = timezone.localdate()
    set_match_settings(today - timedelta(days=1), window=15)
    inv = _checkout(_order(env), pos, payment_method_id=pos["cash"].id)
    assert (inv.dte_type, inv.status, inv.number) == (BOLETA, DRAFT, "")
    device = pos["card"].linked_terminal_device
    TerminalSale.objects.create(
        provider=device.provider, device=device, natural_key="e2e-1", serial_number=device.serial_number,
        sale_id="E2E1", sequence_number="1", transaction_at=timezone.now() - timedelta(minutes=1),
        status=TerminalSale.Status.COMPLETED, payment_type=TerminalSale.PaymentType.CASH, document_type=39,
        sale_amount=Decimal("10000"), total_amount=Decimal("10000"),
    )
    _rcv_boleta(_import(today.year, today.month), 10000, today, folio=72762)

    reconcile_terminal_sales(today, today)
    reconcile_rcv_boletas(today.year, today.month)
    result = issue_fiscal_drafts(today.year, today.month)

    inv.refresh_from_db()
    assert result == {"issued": 1, "failed": 0}
    assert inv.status == Invoice.Status.POSTED
    assert inv.number == "72762"
    assert inv.date == today
    assert inv.journal_entry.status == "POSTED"


@pytest.mark.parametrize(
    ("sale_id", "sequence", "expected"),
    [("ABC123", "77", "ABC123"), ("N/A", "77", "77"), ("n/a ", "78", "78"), ("", "79", "79")],
)
def test_48_uses_sale_id_or_sequence(tenv, sale_id, sequence, expected):
    at = local_dt(2026, 11, 12, 23, 30)
    inv = _draft(tenv, 1000, local_dt(2026, 11, 12))
    make_terminal_sale(tenv, 1000, at, matched_invoice=inv)
    TerminalSale.objects.filter(matched_invoice=inv).update(sale_id=sale_id, sequence_number=sequence)

    result = issue_fiscal_drafts(2026, 11)

    inv.refresh_from_db()
    assert result == {"issued": 1, "failed": 0}
    assert inv.status == Invoice.Status.POSTED
    assert inv.number == expected
    assert inv.date == timezone.localdate(at)


def test_48_without_sale_id_nor_sequence_stays_draft(tenv):
    inv = _draft(tenv, 1000, local_dt(2026, 11, 12))
    make_terminal_sale(tenv, 1000, local_dt(2026, 11, 12), matched_invoice=inv)
    TerminalSale.objects.filter(matched_invoice=inv).update(sale_id="N/A", sequence_number="")

    assert issue_fiscal_drafts(2026, 11) == {"issued": 0, "failed": 0}
    inv.refresh_from_db()
    assert (inv.status, inv.number) == (DRAFT, "")


def test_boleta_without_rcv_stays_draft(tenv):
    inv = _draft(tenv, 1000, local_dt(2026, 11, 12), dte_type=BOLETA)
    make_terminal_sale(tenv, 1000, local_dt(2026, 11, 12), document_type=39, matched_invoice=inv)

    assert issue_fiscal_drafts(2026, 11) == {"issued": 0, "failed": 0}
    inv.refresh_from_db()
    assert (inv.status, inv.number) == (DRAFT, "")


def test_drafts_outside_month_or_unlinked_are_ignored(tenv):
    october = _draft(tenv, 1000, local_dt(2026, 10, 31))
    make_terminal_sale(tenv, 1000, local_dt(2026, 10, 31), matched_invoice=october)
    unlinked = _draft(tenv, 2000, local_dt(2026, 11, 12))

    assert issue_fiscal_drafts(2026, 11) == {"issued": 0, "failed": 0}
    for inv in (october, unlinked):
        inv.refresh_from_db()
        assert inv.status == DRAFT


def test_failure_is_isolated(tenv):
    closed_day = date(2026, 11, 10)
    blocked = _draft(tenv, 1000, local_dt(2026, 11, 10))
    make_terminal_sale(tenv, 1000, local_dt(2026, 11, 10), matched_invoice=blocked)
    ok = _draft(tenv, 2000, local_dt(2026, 11, 12))
    make_terminal_sale(tenv, 2000, local_dt(2026, 11, 12), matched_invoice=ok)

    with patch.object(TaxPeriodService, "is_period_closed", side_effect=lambda d: d == closed_day), \
            patch("tax.reconciliation.issuing.logger") as logger:
        result = issue_fiscal_drafts(2026, 11)

    blocked.refresh_from_db()
    ok.refresh_from_db()
    assert result == {"issued": 1, "failed": 1}
    assert (blocked.status, blocked.number) == (DRAFT, "")
    assert ok.status == Invoice.Status.POSTED
    logger.warning.assert_called_once()
    assert logger.warning.call_args.args[1] == blocked.pk


def test_duplicate_folio_fails_cleanly(tenv):
    imp = _import(2026, 11)
    existing = make_pos_document(tenv, 500, local_dt(2026, 11, 5), dte_type=BOLETA, method="CASH")
    Invoice.objects.filter(pk=existing.pk).update(number="72762")
    inv = _draft(tenv, 1000, local_dt(2026, 11, 12), dte_type=BOLETA)
    doc = _rcv_boleta(imp, 1000, date(2026, 11, 12), folio=72762)
    make_terminal_sale(tenv, 1000, local_dt(2026, 11, 12), document_type=39, matched_invoice=inv, rcv_document=doc)

    result = issue_fiscal_drafts(2026, 11)

    inv.refresh_from_db()
    assert result == {"issued": 0, "failed": 1}
    assert (inv.status, inv.number) == (DRAFT, "")


def test_query_count_bounded(tenv):
    imp = _import(2026, 11)
    for i in range(3):
        c48 = _draft(tenv, 1000 + i, local_dt(2026, 11, 12))
        make_terminal_sale(tenv, 1000 + i, local_dt(2026, 11, 12), matched_invoice=c48)
        b39 = _draft(tenv, 2000 + i, local_dt(2026, 11, 12), dte_type=BOLETA)
        doc = _rcv_boleta(imp, 2000 + i, date(2026, 11, 12))
        make_terminal_sale(
            tenv, 2000 + i, local_dt(2026, 11, 12), document_type=39, matched_invoice=b39, rcv_document=doc
        )

    with patch.object(BillingService, "confirm_invoice") as confirm, \
            CaptureQueriesContext(connection) as ctx:
        result = issue_fiscal_drafts(2026, 11)

    assert result == {"issued": 6, "failed": 0}
    assert confirm.call_count == 6
    selects = [q for q in ctx.captured_queries if "SAVEPOINT" not in q["sql"]]
    assert len(selects) == 1
