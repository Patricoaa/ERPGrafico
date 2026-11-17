"""Emisión automática de borradores 39/41/48 con el folio del proveedor (ADR-0140 D3)."""

import functools
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
from core.fiscal_match import MatchStatus
from tax.reconciliation import issuing
from tax.reconciliation.boletas import reconcile_rcv_boletas
from tax.reconciliation.issuing import issue_fiscal_drafts
from tax.reconciliation.terminal import reconcile_terminal_sales
from tax.services import TaxPeriodService
from tax.tests.reconciliation_helpers import (
    local_dt,
    make_pos_document,
    make_terminal_env,
    set_match_settings,
)
from tax.tests.reconciliation_helpers import (
    make_terminal_sale as _make_terminal_sale,
)
from treasury.models import TerminalSale

# Vínculo del cuadre automático: la emisión solo toma ventas MATCHED.
make_terminal_sale = functools.partial(_make_terminal_sale, match_status=MatchStatus.MATCHED)

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


@pytest.mark.parametrize("status", [MatchStatus.TYPE_DIFF, MatchStatus.AMBIGUOUS])
def test_type_diff_link_is_not_issued(tenv, status):
    inv = _draft(tenv, 1000, local_dt(2026, 11, 12))
    make_terminal_sale(tenv, 1000, local_dt(2026, 11, 12), matched_invoice=inv, match_status=status)

    assert issue_fiscal_drafts(2026, 11) == {"issued": 0, "failed": 0}
    inv.refresh_from_db()
    assert (inv.status, inv.number) == (DRAFT, "")


def test_manual_matched_link_is_issued(tenv):
    inv = _draft(tenv, 1000, local_dt(2026, 11, 12))
    make_terminal_sale(tenv, 1000, local_dt(2026, 11, 12), matched_invoice=inv, matched_manually=True)

    assert issue_fiscal_drafts(2026, 11) == {"issued": 1, "failed": 0}


def test_invoice_confirmed_after_selection_is_skipped(tenv):
    inv = _draft(tenv, 1000, local_dt(2026, 11, 12))
    make_terminal_sale(tenv, 1000, local_dt(2026, 11, 12), matched_invoice=inv)
    real = issuing._linked_drafts

    def select_then_confirm_manually(year, month, **kwargs):
        sales = real(year, month, **kwargs)
        Invoice.objects.filter(pk=inv.pk).update(status=Invoice.Status.POSTED, number="555")
        return sales

    with patch.object(issuing, "_linked_drafts", select_then_confirm_manually), \
            patch.object(BillingService, "confirm_invoice") as confirm:
        result = issue_fiscal_drafts(2026, 11)

    assert result == {"issued": 0, "failed": 0}
    confirm.assert_not_called()
    inv.refresh_from_db()
    assert (inv.status, inv.number) == (Invoice.Status.POSTED, "555")


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
    assert logger.warning.call_args.kwargs == {"exc_info": True}


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
    selects = [q["sql"] for q in ctx.captured_queries if "SAVEPOINT" not in q["sql"]]
    # Una sola selección; por documento solo el row-lock y su re-lectura (constante).
    assert sum("treasury_terminalsale" in sql for sql in selects) == 1
    assert len(selects) == 1 + 2 * 6


def test_soft_time_limit_is_not_swallowed(tenv):
    from celery.exceptions import SoftTimeLimitExceeded

    inv = _draft(tenv, 1000, local_dt(2026, 11, 12))
    make_terminal_sale(tenv, 1000, local_dt(2026, 11, 12), matched_invoice=inv)
    with patch.object(BillingService, "confirm_invoice", side_effect=SoftTimeLimitExceeded()), \
            pytest.raises(SoftTimeLimitExceeded):
        issue_fiscal_drafts(2026, 11)


def test_failure_records_error_on_sale(tenv):
    closed_day = date(2026, 11, 10)
    inv = _draft(tenv, 1000, local_dt(2026, 11, 10))
    sale = make_terminal_sale(tenv, 1000, local_dt(2026, 11, 10), matched_invoice=inv)

    with patch.object(TaxPeriodService, "is_period_closed", side_effect=lambda d: d == closed_day):
        assert issue_fiscal_drafts(2026, 11) == {"issued": 0, "failed": 1}

    sale.refresh_from_db()
    assert sale.issue_error
    assert len(sale.issue_error) <= 255
    assert sale.issue_attempted_at is not None
    assert timezone.now() - sale.issue_attempted_at < timedelta(minutes=1)


def test_long_error_is_truncated(tenv):
    inv = _draft(tenv, 1000, local_dt(2026, 11, 12))
    sale = make_terminal_sale(tenv, 1000, local_dt(2026, 11, 12), matched_invoice=inv)

    with patch.object(BillingService, "confirm_invoice", side_effect=RuntimeError("x" * 400)):
        assert issue_fiscal_drafts(2026, 11) == {"issued": 0, "failed": 1}

    sale.refresh_from_db()
    assert sale.issue_error == "x" * 255


def test_recent_failure_is_not_retried(tenv):
    inv = _draft(tenv, 1000, local_dt(2026, 11, 12))
    make_terminal_sale(
        tenv, 1000, local_dt(2026, 11, 12), matched_invoice=inv,
        issue_error="Período cerrado", issue_attempted_at=timezone.now() - timedelta(minutes=10),
    )

    with patch.object(BillingService, "confirm_invoice") as confirm:
        assert issue_fiscal_drafts(2026, 11) == {"issued": 0, "failed": 0}
    confirm.assert_not_called()


def test_old_failure_is_retried_and_cleared_on_success(tenv):
    inv = _draft(tenv, 1000, local_dt(2026, 11, 12))
    sale = make_terminal_sale(
        tenv, 1000, local_dt(2026, 11, 12), matched_invoice=inv,
        issue_error="Período cerrado",
        issue_attempted_at=timezone.now() - timedelta(minutes=issuing.ISSUE_RETRY_MINUTES + 1),
    )

    assert issue_fiscal_drafts(2026, 11) == {"issued": 1, "failed": 0}

    sale.refresh_from_db()
    inv.refresh_from_db()
    assert inv.status == Invoice.Status.POSTED
    assert (sale.issue_error, sale.issue_attempted_at) == ("", None)


def test_terminal_sale_serializers_expose_issue_attempt(tenv):
    from treasury.serializers import TerminalSaleListSerializer, TerminalSaleSerializer

    sale = make_terminal_sale(tenv, 1000, local_dt(2026, 11, 12), issue_error="boom")
    for serializer in (TerminalSaleListSerializer, TerminalSaleSerializer):
        data = serializer(sale).data
        assert data["issue_error"] == "boom"
        assert "issue_attempted_at" in data


def test_manual_run_retries_recent_failure(tenv):
    inv = _draft(tenv, 1000, local_dt(2026, 11, 12))
    sale = make_terminal_sale(
        tenv, 1000, local_dt(2026, 11, 12), matched_invoice=inv,
        issue_error="Período cerrado", issue_attempted_at=timezone.now() - timedelta(minutes=10),
    )

    assert issue_fiscal_drafts(2026, 11, retry_failed=True) == {"issued": 1, "failed": 0}

    sale.refresh_from_db()
    assert (sale.issue_error, sale.issue_attempted_at) == ("", None)


@pytest.mark.parametrize("action", ["match", "unmatch"])
def test_manual_link_clears_issue_error(tenv, action):
    from tax.reconciliation.terminal import match_terminal_sale, unmatch_terminal_sale

    inv = _draft(tenv, 1000, local_dt(2026, 11, 12))
    sale = make_terminal_sale(
        tenv, 1000, local_dt(2026, 11, 12), issue_error="boom", issue_attempted_at=timezone.now(),
    )
    if action == "match":
        match_terminal_sale(sale, inv)
    else:
        unmatch_terminal_sale(sale)

    sale.refresh_from_db()
    assert (sale.issue_error, sale.issue_attempted_at) == ("", None)
