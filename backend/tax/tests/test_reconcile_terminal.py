"""Cuadre de ventas TUU contra documentos POS (ADR-0138 D4)."""

from datetime import date, timedelta

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from billing.models import Invoice
from core.fiscal_match import MatchStatus
from tax.reconciliation.terminal import reconcile_terminal_sales
from tax.tests.reconciliation_helpers import (
    local_dt,
    make_pos_document,
    make_terminal_env,
    make_terminal_sale,
    set_match_settings,
)
from treasury.models import TerminalSale

DAY = date(2026, 11, 10)
T0 = local_dt(2026, 11, 10, 12, 0)


@pytest.fixture
def env(db):
    set_match_settings(date(2026, 11, 1), window=15)
    return make_terminal_env()


def run():
    return reconcile_terminal_sales(DAY, DAY)


def _reload(*objs):
    for o in objs:
        o.refresh_from_db()


def test_card_sale_matches_48(env):
    inv = make_pos_document(env, 6000, T0)
    sale = make_terminal_sale(env, 6000, T0 + timedelta(minutes=3), document_type=48)

    result = run()

    _reload(sale)
    assert sale.match_status == MatchStatus.MATCHED
    assert sale.matched_invoice_id == inv.id
    assert result == {MatchStatus.MATCHED: 1}


def test_cash_sale_matches_39_by_terminal(env):
    inv = make_pos_document(env, 4000, T0, dte_type=Invoice.DTEType.BOLETA, method="CASH")
    sale = make_terminal_sale(
        env, 4000, T0 - timedelta(minutes=2), payment_type=TerminalSale.PaymentType.CASH, document_type=39,
    )

    run()

    _reload(sale)
    assert sale.match_status == MatchStatus.MATCHED
    assert sale.matched_invoice_id == inv.id


def test_cash_sale_on_other_terminal_is_only_external(env):
    other = make_terminal_env()
    make_pos_document(other, 4000, T0, dte_type=Invoice.DTEType.BOLETA, method="CASH")
    sale = make_terminal_sale(env, 4000, T0, payment_type=TerminalSale.PaymentType.CASH, document_type=39)

    run()

    _reload(sale)
    assert sale.match_status == MatchStatus.ONLY_EXTERNAL
    assert sale.matched_invoice_id is None


def test_card_sale_on_other_device_is_only_external(env):
    other = make_terminal_env()
    make_pos_document(other, 6000, T0)
    sale = make_terminal_sale(env, 6000, T0)

    run()

    _reload(sale)
    assert sale.match_status == MatchStatus.ONLY_EXTERNAL


def test_type_diff_when_tuu_says_48_and_erp_39(env):
    inv = make_pos_document(env, 5000, T0, dte_type=Invoice.DTEType.BOLETA)
    sale = make_terminal_sale(env, 5000, T0 + timedelta(minutes=1), document_type=48)

    run()

    _reload(sale)
    assert sale.match_status == MatchStatus.TYPE_DIFF
    assert sale.matched_invoice_id == inv.id


def test_same_amount_same_window_is_ambiguous(env):
    make_pos_document(env, 5000, T0)
    make_pos_document(env, 5000, T0 + timedelta(minutes=1))
    a = make_terminal_sale(env, 5000, T0 + timedelta(minutes=2))
    b = make_terminal_sale(env, 5000, T0 + timedelta(minutes=4))

    result = run()

    _reload(a, b)
    assert a.match_status == b.match_status == MatchStatus.AMBIGUOUS
    assert a.matched_invoice is None and b.matched_invoice is None
    assert result == {MatchStatus.AMBIGUOUS: 2}


def test_outside_window_is_only_external(env):
    make_pos_document(env, 6000, T0)
    sale = make_terminal_sale(env, 6000, T0 + timedelta(minutes=16))

    run()

    _reload(sale)
    assert sale.match_status == MatchStatus.ONLY_EXTERNAL
    assert sale.matched_invoice_id is None


def test_amount_mismatch_is_only_external(env):
    make_pos_document(env, 6000, T0)
    sale = make_terminal_sale(env, 6001, T0)

    run()

    _reload(sale)
    assert sale.match_status == MatchStatus.ONLY_EXTERNAL


def test_draft_invoice_is_not_candidate(env):
    make_pos_document(env, 6000, T0, status=Invoice.Status.DRAFT)
    sale = make_terminal_sale(env, 6000, T0)

    run()

    _reload(sale)
    assert sale.match_status == MatchStatus.ONLY_EXTERNAL


def test_reversed_is_excluded(env):
    make_pos_document(env, 6000, T0)
    sale = make_terminal_sale(env, 6000, T0, status=TerminalSale.Status.REVERSED)

    result = run()

    _reload(sale)
    assert sale.match_status == MatchStatus.EXCLUDED
    assert sale.matched_invoice_id is None
    assert result == {MatchStatus.EXCLUDED: 1}


def test_before_start_date_untouched(env):
    set_match_settings(date(2026, 11, 11))
    make_pos_document(env, 6000, T0)
    sale = make_terminal_sale(env, 6000, T0)

    result = run()

    _reload(sale)
    assert sale.match_status == ""
    assert sale.matched_invoice_id is None
    assert result == {}


def test_no_start_date_returns_empty(env):
    set_match_settings(None)
    make_pos_document(env, 6000, T0)
    sale = make_terminal_sale(env, 6000, T0)

    assert run() == {}
    _reload(sale)
    assert sale.match_status == ""


def test_manual_link_survives_rerun(env):
    inv = make_pos_document(env, 6000, T0)
    manual = make_terminal_sale(
        env, 9999, T0 + timedelta(minutes=30), matched_invoice=inv,
        match_status=MatchStatus.MATCHED, matched_manually=True,
    )
    other = make_terminal_sale(env, 6000, T0 + timedelta(minutes=1))

    run()
    run()

    _reload(manual, other)
    assert manual.matched_invoice_id == inv.id
    assert manual.match_status == MatchStatus.MATCHED
    assert other.matched_invoice_id is None
    assert other.match_status == MatchStatus.ONLY_EXTERNAL


def test_invoice_linked_outside_range_is_not_reassigned(env):
    inv = make_pos_document(env, 6000, local_dt(2026, 11, 10, 23, 55))
    prev = make_terminal_sale(env, 6000, local_dt(2026, 11, 11, 0, 2))
    reconcile_terminal_sales(date(2026, 11, 11), date(2026, 11, 11))
    _reload(prev)
    assert prev.matched_invoice_id == inv.id

    sale = make_terminal_sale(env, 6000, local_dt(2026, 11, 10, 23, 58))
    run()

    _reload(prev, sale)
    assert prev.matched_invoice_id == inv.id
    assert sale.matched_invoice_id is None
    assert sale.match_status == MatchStatus.ONLY_EXTERNAL


def test_border_competitor_makes_both_ambiguous(env):
    make_pos_document(env, 6000, local_dt(2026, 11, 9, 23, 55))
    a = make_terminal_sale(env, 6000, local_dt(2026, 11, 9, 23, 58))
    b = make_terminal_sale(env, 6000, local_dt(2026, 11, 10, 0, 2))

    result = run()

    _reload(a, b)
    assert result == {MatchStatus.AMBIGUOUS: 1}
    assert b.match_status == MatchStatus.AMBIGUOUS and b.matched_invoice_id is None
    assert a.match_status == "" and a.matched_invoice_id is None

    reconcile_terminal_sales(date(2026, 11, 9), DAY)

    _reload(a, b)
    assert a.match_status == b.match_status == MatchStatus.AMBIGUOUS
    assert a.matched_invoice_id is None and b.matched_invoice_id is None


def test_idempotent(env):
    inv = make_pos_document(env, 6000, T0)
    make_pos_document(env, 5000, T0)
    make_pos_document(env, 5000, T0)
    s1 = make_terminal_sale(env, 6000, T0)
    s2 = make_terminal_sale(env, 5000, T0)
    s3 = make_terminal_sale(env, 7000, T0, status=TerminalSale.Status.OTHER)

    def snapshot():
        _reload(s1, s2, s3)
        return [(s.matched_invoice_id, s.match_status) for s in (s1, s2, s3)]

    first = run()
    snap = snapshot()
    second = run()

    assert first == second
    assert snapshot() == snap
    assert snap[0] == (inv.id, MatchStatus.MATCHED)
    assert snap[1] == (None, MatchStatus.AMBIGUOUS)
    assert snap[2] == (None, MatchStatus.EXCLUDED)


def _seed(env, n, offset):
    for i in range(n):
        at = T0 - timedelta(hours=6) + timedelta(minutes=(offset + i) * 15)
        make_pos_document(env, 1000 + offset + i, at)
        make_terminal_sale(env, 1000 + offset + i, at + timedelta(minutes=1))
        make_pos_document(env, 2000 + offset + i, at, dte_type=Invoice.DTEType.BOLETA, method="CASH")
        make_terminal_sale(
            env, 2000 + offset + i, at, payment_type=TerminalSale.PaymentType.CASH, document_type=39,
        )


def test_query_count_constant(env):
    _seed(env, 5, 0)
    run()  # calienta la caché de RCVSettings
    with CaptureQueriesContext(connection) as small:
        small_result = run()

    _seed(env, 15, 5)
    with CaptureQueriesContext(connection) as large:
        large_result = run()

    assert small_result == {MatchStatus.MATCHED: 10}
    assert large_result == {MatchStatus.MATCHED: 40}
    assert len(small) == len(large)
