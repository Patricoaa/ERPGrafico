"""Emisión automática desde el grupo de cuadre (ADR-0140 D3, spec cuadre unificado)."""

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
from core.fiscal_match import PartState
from tax.fiscal_match.groups import ensure_groups
from tax.fiscal_match.issuing import ISSUE_RETRY_MINUTES, issue_fiscal_drafts
from tax.models import FiscalMatch
from tax.tests.reconciliation_helpers import (
    local_dt,
    make_pos_document,
    make_terminal_env,
    make_terminal_sale,
    set_match_settings,
)

SINCE = date(2026, 11, 1)
DRAFT = Invoice.Status.DRAFT
BOLETA = Invoice.DTEType.BOLETA
C48 = Invoice.DTEType.COMPROBANTE_PAGO
_folios = itertools.count(9000)
AT = local_dt(2026, 11, 12, 23, 30)


@pytest.fixture
def tenv(db):
    set_match_settings(SINCE)
    return make_terminal_env()


def _group(tenv, total, dte_type, *, tuu_state=PartState.MATCHED):
    method = "CARD" if dte_type == C48 else "CASH"
    invoice = make_pos_document(tenv, total, AT, dte_type=dte_type, method=method, status=DRAFT)
    ensure_groups(SINCE)
    FiscalMatch.objects.filter(invoice=invoice).update(tuu_state=tuu_state)
    return invoice, FiscalMatch.objects.get(invoice=invoice)


def _sale(tenv, group, total, **extra):
    sale = make_terminal_sale(tenv, total, AT, fiscal_match=group)
    if extra:
        type(sale).objects.filter(pk=sale.pk).update(**extra)
    return sale


def _rcv(group, total, folio=None, dte_type=39):
    imp = RCVImport.objects.first() or RCVImport.objects.create(
        direction=RCVImport.Direction.SALES, year=2026, month=11,
        trigger=RCVImport.Trigger.MANUAL, status=RCVImport.Status.SUCCESS,
    )
    return RCVDocument.objects.create(
        direction=RCVImport.Direction.SALES, company_rut="11111111-1", period="202611", dte_type=dte_type,
        folio=folio if folio is not None else next(_folios), counterparty_rut="66666666-6",
        issue_date=date(2026, 11, 12), total_amount=Decimal(total), first_import=imp, last_import=imp,
        fiscal_match=group,
    )


def test_issues_48_with_tuu_id(tenv):
    inv, group = _group(tenv, 1000, C48)
    _sale(tenv, group, 1000, document_type=48, sale_id="ABC123")

    assert issue_fiscal_drafts() == {"issued": 1, "failed": 0}

    inv.refresh_from_db()
    assert (inv.status, inv.number, inv.date) == (Invoice.Status.POSTED, "ABC123", timezone.localdate(AT))


def test_48_falls_back_to_sequence_number(tenv):
    inv, group = _group(tenv, 1000, C48)
    _sale(tenv, group, 1000, sale_id="N/A", sequence_number="77")

    assert issue_fiscal_drafts() == {"issued": 1, "failed": 0}
    inv.refresh_from_db()
    assert inv.number == "77"


def test_48_with_two_sales_is_skipped(tenv):
    inv, group = _group(tenv, 1000, C48)
    _sale(tenv, group, 500)
    _sale(tenv, group, 500)

    assert issue_fiscal_drafts() == {"issued": 0, "failed": 0}
    inv.refresh_from_db()
    assert (inv.status, inv.number) == (DRAFT, "")


def test_issues_39_with_single_rcv_folio(tenv):
    inv, group = _group(tenv, 2000, BOLETA)
    _rcv(group, 2000, folio=72762)

    assert issue_fiscal_drafts() == {"issued": 1, "failed": 0}

    inv.refresh_from_db()
    assert (inv.status, inv.number, inv.date) == (Invoice.Status.POSTED, "72762", date(2026, 11, 12))


def test_does_not_issue_39_with_two_rcv_folios(tenv):
    inv, group = _group(tenv, 2000, BOLETA)
    _rcv(group, 1000)
    _rcv(group, 1000)

    assert issue_fiscal_drafts() == {"issued": 0, "failed": 0}
    inv.refresh_from_db()
    assert (inv.status, inv.number) == (DRAFT, "")


def test_39_without_rcv_is_skipped(tenv):
    inv, _ = _group(tenv, 2000, BOLETA)

    assert issue_fiscal_drafts() == {"issued": 0, "failed": 0}
    inv.refresh_from_db()
    assert inv.status == DRAFT


def test_group_without_matched_tuu_is_not_issued(tenv):
    inv, group = _group(tenv, 1000, C48, tuu_state=PartState.PENDING)
    _sale(tenv, group, 1000)

    assert issue_fiscal_drafts() == {"issued": 0, "failed": 0}
    inv.refresh_from_db()
    assert inv.status == DRAFT


def test_group_ids_restricts_candidates(tenv):
    inv1, g1 = _group(tenv, 1000, C48)
    _sale(tenv, g1, 1000)
    inv2, g2 = _group(tenv, 2000, C48)
    _sale(tenv, g2, 2000)

    assert issue_fiscal_drafts(group_ids=[g2.pk]) == {"issued": 1, "failed": 0}
    inv1.refresh_from_db()
    inv2.refresh_from_db()
    assert (inv1.status, inv2.status) == (DRAFT, Invoice.Status.POSTED)


def test_failure_recorded_on_group_and_retried_after_60_min(tenv):
    inv, group = _group(tenv, 1000, C48)
    _sale(tenv, group, 1000)

    with patch.object(BillingService, "confirm_invoice", side_effect=RuntimeError("x" * 400)):
        assert issue_fiscal_drafts() == {"issued": 0, "failed": 1}

    group.refresh_from_db()
    assert group.issue_error == "x" * 255
    assert timezone.now() - group.issue_attempted_at < timedelta(minutes=1)

    # Fallo reciente: no se reintenta.
    with patch.object(BillingService, "confirm_invoice") as confirm:
        assert issue_fiscal_drafts() == {"issued": 0, "failed": 0}
    confirm.assert_not_called()

    # Pasada la espera: reintenta y el éxito limpia el registro.
    FiscalMatch.objects.filter(pk=group.pk).update(
        issue_attempted_at=timezone.now() - timedelta(minutes=ISSUE_RETRY_MINUTES + 1)
    )
    assert issue_fiscal_drafts() == {"issued": 1, "failed": 0}
    group.refresh_from_db()
    inv.refresh_from_db()
    assert inv.status == Invoice.Status.POSTED
    assert (group.issue_error, group.issue_attempted_at) == ("", None)


def test_retry_failed_ignores_wait(tenv):
    inv, group = _group(tenv, 1000, C48)
    _sale(tenv, group, 1000)
    FiscalMatch.objects.filter(pk=group.pk).update(
        issue_error="Período cerrado", issue_attempted_at=timezone.now() - timedelta(minutes=10)
    )

    assert issue_fiscal_drafts() == {"issued": 0, "failed": 0}
    assert issue_fiscal_drafts(retry_failed=True) == {"issued": 1, "failed": 0}
    group.refresh_from_db()
    assert (group.issue_error, group.issue_attempted_at) == ("", None)


def test_candidate_queries_do_not_grow_with_groups(tenv):
    for i in range(3):
        _, g48 = _group(tenv, 1000 + i, C48)
        _sale(tenv, g48, 1000 + i)
        _, g39 = _group(tenv, 2000 + i, BOLETA)
        _rcv(g39, 2000 + i)

    with patch.object(BillingService, "confirm_invoice") as confirm, CaptureQueriesContext(connection) as ctx:
        assert issue_fiscal_drafts() == {"issued": 6, "failed": 0}
    assert confirm.call_count == 6
    selects = [q["sql"] for q in ctx.captured_queries if "SAVEPOINT" not in q["sql"]]
    assert sum("treasury_terminalsale" in sql for sql in selects) == 1
    assert sum("accounting_rcvdocument" in sql for sql in selects) == 1
    assert len(selects) == 3 + 2 * 6  # grupos + prefetch ventas + prefetch RCV; por documento lock y relectura
