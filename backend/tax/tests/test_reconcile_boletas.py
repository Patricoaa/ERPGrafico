"""Cuadre de boletas 39/41 del RCV contra ventas TUU (ADR-0139 D1-D2)."""

import itertools
from datetime import date
from decimal import Decimal

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from accounting.models import RCVDocument, RCVImport, RCVSettings
from billing.models import Invoice
from core.fiscal_match import MatchStatus
from tax.reconciliation.boletas import reconcile_rcv_boletas
from tax.reconciliation.rcv import reconcile_rcv_period
from tax.tests.reconciliation_helpers import (
    local_dt,
    make_pos_document,
    make_terminal_env,
    make_terminal_sale,
    set_match_settings,
)

S = RCVImport.Direction.SALES
_folios = itertools.count(5000)


@pytest.fixture
def env(db):
    set_match_settings(date(2026, 11, 1))
    return make_terminal_env()


@pytest.fixture
def imp(db):
    return RCVImport.objects.create(
        direction=S, year=2026, month=11, trigger=RCVImport.Trigger.MANUAL, status=RCVImport.Status.SUCCESS
    )


def boleta(imp, total, day=13, *, folio=None, dte_type=39, **kw):
    return RCVDocument.objects.create(
        direction=S, company_rut="11111111-1", period="202611", dte_type=dte_type,
        folio=folio if folio is not None else next(_folios), counterparty_rut="66666666-6",
        issue_date=date(2026, 11, day), total_amount=Decimal(total),
        first_import=imp, last_import=imp, **kw,
    )


def sale(env, amount, day=13, hh=12, mm=0, *, document_type=39, **kw):
    return make_terminal_sale(env, amount, local_dt(2026, 11, day, hh, mm), document_type=document_type, **kw)


def run():
    return reconcile_rcv_boletas(2026, 11)


def _reload(*objs):
    for o in objs:
        o.refresh_from_db()


def test_pairs_by_day_and_amount(env, imp):
    s1, s2 = sale(env, 1000, 13), sale(env, 2000, 14)
    b1, b2 = boleta(imp, 2000, 14), boleta(imp, 1000, 13)

    result = run()

    _reload(s1, s2, b1, b2)
    assert s1.rcv_document_id == b2.id
    assert s2.rcv_document_id == b1.id
    assert b1.match_status == b2.match_status == MatchStatus.MATCHED
    assert result == {MatchStatus.MATCHED: 2}


def test_duplicates_pair_in_order(env, imp):
    late = sale(env, 1250, hh=17)
    early = sale(env, 1250, hh=9)
    mid = sale(env, 1250, hh=11)
    b101 = boleta(imp, 1250, folio=101)
    b100 = boleta(imp, 1250, folio=100)

    run()

    _reload(early, mid, late, b100, b101)
    assert early.rcv_document_id == b100.id
    assert mid.rcv_document_id == b101.id
    assert late.rcv_document_id is None
    assert b100.match_status == b101.match_status == MatchStatus.MATCHED


def test_local_day_boundary(env, imp):
    s = sale(env, 3000, 13, 23, 59)
    b13, b14 = boleta(imp, 3000, 13), boleta(imp, 3000, 14)

    run()

    _reload(s, b13, b14)
    assert s.rcv_document_id == b13.id
    assert b14.match_status == MatchStatus.ONLY_EXTERNAL


def test_type_must_match(env, imp):
    s = sale(env, 1000, document_type=39)
    b = boleta(imp, 1000, dte_type=41)

    run()

    _reload(s, b)
    assert s.rcv_document_id is None
    assert b.match_status == MatchStatus.ONLY_EXTERNAL


def test_rcv_without_sale_is_only_external(env, imp):
    b = boleta(imp, 1000)

    result = run()

    _reload(b)
    assert b.match_status == MatchStatus.ONLY_EXTERNAL
    assert b.matched_invoice_id is None
    assert result == {MatchStatus.ONLY_EXTERNAL: 1}


def test_matched_invoice_follows_sale(env, imp):
    inv = make_pos_document(env, 1000, local_dt(2026, 11, 13), dte_type=Invoice.DTEType.BOLETA)
    s = sale(env, 1000, matched_invoice=inv, match_status=MatchStatus.MATCHED)
    b = boleta(imp, 1000)

    run()

    _reload(s, b)
    assert s.rcv_document_id == b.id
    assert b.matched_invoice_id == inv.id
    assert b.match_status == MatchStatus.MATCHED


def test_manual_rcv_row_respected(env, imp):
    inv = make_pos_document(env, 1000, local_dt(2026, 11, 13), dte_type=Invoice.DTEType.BOLETA)
    manual = boleta(imp, 1000, folio=1, matched_invoice=inv, matched_manually=True,
                    match_status=MatchStatus.MATCHED)
    linked = sale(env, 1000, hh=9, rcv_document=manual)
    s = sale(env, 1000, hh=10)
    auto = boleta(imp, 1000, folio=2)

    result = run()

    _reload(manual, linked, s, auto)
    assert manual.matched_manually and manual.matched_invoice_id == inv.id
    assert linked.rcv_document_id == manual.id
    assert s.rcv_document_id == auto.id
    assert result == {MatchStatus.MATCHED: 1}


def test_stale_manual_rcv_row_is_reevaluated(env, imp):
    inv = make_pos_document(env, 1000, local_dt(2026, 11, 13), dte_type=Invoice.DTEType.BOLETA,
                            status=Invoice.Status.CANCELLED)
    manual = boleta(imp, 1000, matched_invoice=inv, matched_manually=True, match_status=MatchStatus.MATCHED)
    s = sale(env, 1000)

    run()

    _reload(manual, s)
    assert not manual.matched_manually
    assert manual.matched_invoice_id is None
    assert s.rcv_document_id == manual.id


def test_missing_since_import_excluded(env, imp):
    b = boleta(imp, 1000)
    s = sale(env, 1000)
    run()
    _reload(s)
    assert s.rcv_document_id == b.id

    RCVDocument.objects.filter(pk=b.pk).update(missing_since_import=imp)
    result = run()

    _reload(b, s)
    assert b.match_status == MatchStatus.EXCLUDED
    assert b.matched_invoice_id is None
    assert s.rcv_document_id is None
    assert result == {MatchStatus.EXCLUDED: 1}


def test_rcv_period_reconcile_leaves_boletas_untouched(env, imp):
    b39, b41 = boleta(imp, 1000, dte_type=39), boleta(imp, 1000, dte_type=41)
    s = sale(env, 1000)
    run()
    b48 = boleta(imp, 1000, dte_type=48)

    result = reconcile_rcv_period(S, 2026, 11)

    _reload(b39, b41, b48, s)
    assert b39.match_status == MatchStatus.MATCHED
    assert b41.match_status == MatchStatus.ONLY_EXTERNAL
    assert s.rcv_document_id == b39.id
    assert b48.match_status == MatchStatus.EXCLUDED
    assert result == {MatchStatus.EXCLUDED: 1}


def test_idempotent(env, imp):
    sales = [sale(env, 1250, hh=h) for h in (9, 11, 17)]
    docs = [boleta(imp, 1250, folio=f) for f in (100, 101)] + [boleta(imp, 9999)]
    first = run()
    for s in sales:
        s.refresh_from_db()
    links = {s.id: s.rcv_document_id for s in sales}

    second = run()

    for s in sales:
        s.refresh_from_db()
    assert first == second == {MatchStatus.MATCHED: 2, MatchStatus.ONLY_EXTERNAL: 1}
    assert {s.id: s.rcv_document_id for s in sales} == links
    assert len(docs) == 3


def _queries_for(env, imp, n):
    for i in range(n):
        boleta(imp, 1000 + i, day=1 + i % 28)
        sale(env, 1000 + i, day=1 + i % 28)
    RCVSettings.get_settings()  # singleton en caché: no cuenta como consulta del cuadre
    with CaptureQueriesContext(connection) as ctx:
        result = run()
    assert result == {MatchStatus.MATCHED: n}
    return len(ctx.captured_queries)


def test_query_count_constant(env, imp):
    small = _queries_for(env, imp, 5)
    RCVDocument.objects.all().delete()
    big = _queries_for(env, imp, 40)
    assert small == big
