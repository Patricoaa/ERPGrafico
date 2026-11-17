"""TUU ↔ RCV boletas: la boleta RCV entra al grupo de su venta o de su boleta emitida (ADR-0139 D1)."""

import itertools
from datetime import date, datetime
from decimal import Decimal

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from accounting.models import RCVDocument, RCVImport
from billing.models import Invoice
from tax.fiscal_match.boletas import pair_rcv_boletas
from tax.fiscal_match.candidates import LinkResult, local_midnight
from tax.fiscal_match.groups import ensure_groups
from tax.fiscal_match.terminal import link_terminal_sales
from tax.models import FiscalMatch
from tax.tests.reconciliation_helpers import (
    local_dt,
    make_pos_document,
    make_terminal_env,
    make_terminal_sale,
    set_match_settings,
)
from treasury.models import TerminalSale

SINCE = date(2026, 11, 1)
S = RCVImport.Direction.SALES
_folios = itertools.count(5000)


@pytest.fixture
def env(db):
    set_match_settings(SINCE)
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


def run(*, terminal: bool = False) -> LinkResult:
    ensure_groups(SINCE)
    lo, hi = local_midnight(date(2026, 11, 1)), local_midnight(date(2026, 12, 1))
    if terminal:
        link_terminal_sales(lo, hi, rematch_ids=set())
    return pair_rcv_boletas(lo, hi)


def _reload(*objs):
    for o in objs:
        o.refresh_from_db()


def test_pairs_in_order_same_day_amount(env, imp):
    d2 = boleta(imp, 5000, folio=2)
    d1 = boleta(imp, 5000, folio=1)
    d3 = boleta(imp, 5000, folio=3)
    s1, s2 = sale(env, 5000, hh=10), sale(env, 5000, hh=11)
    ensure_groups(SINCE)

    result = run()

    _reload(d1, d2, d3, s1, s2)
    assert result.linked == 2
    assert d1.fiscal_match_id == s1.fiscal_match_id
    assert d2.fiscal_match_id == s2.fiscal_match_id
    assert d3.fiscal_match_id not in (s1.fiscal_match_id, s2.fiscal_match_id)
    # los grupos huérfanos vacíos de d1 y d2 se borran; el de d3 sigue
    assert FiscalMatch.objects.filter(rcv_documents__isnull=True, terminal_sales__isnull=True,
                                      invoice__isnull=True).count() == 0
    assert FiscalMatch.objects.count() == 3


@pytest.mark.parametrize(
    "doc_kw, sale_kw",
    [
        ({"day": 14}, {}),
        ({}, {"hh": 23, "mm": 59, "day": 12}),
        ({"dte_type": 41}, {}),
    ],
)
def test_does_not_pair_other_day_or_type(env, imp, doc_kw, sale_kw):
    d = boleta(imp, 5000, **doc_kw)
    s = sale(env, 5000, **sale_kw)
    run()
    _reload(d, s)
    assert d.fiscal_match_id != s.fiscal_match_id


def test_different_amount_not_paired(env, imp):
    d, s = boleta(imp, 5000), sale(env, 5001)
    assert run().linked == 0
    _reload(d, s)
    assert d.fiscal_match_id != s.fiscal_match_id


def test_rcv_boleta_follows_sale_into_invoice_group(env, imp):
    inv = make_pos_document(env, 6000, local_dt(2026, 11, 13, 12, 0))
    s = sale(env, 6000, hh=12, mm=3, document_type=48)
    d = boleta(imp, 6000)
    s.document_type = 39
    s.save()

    result = run(terminal=True)

    _reload(d, s)
    group = FiscalMatch.objects.get(invoice=inv)
    assert s.fiscal_match_id == group.id
    assert d.fiscal_match_id == group.id
    assert result.linked == 1


def test_issued_boleta_matches_by_folio_directly(env, imp):
    inv = make_pos_document(env, 7000, local_dt(2026, 11, 13, 12, 0), dte_type=Invoice.DTEType.BOLETA)
    Invoice.objects.filter(pk=inv.pk).update(number="000123")
    d = boleta(imp, 7000, folio=123)
    other = boleta(imp, 7000, folio=124)

    result = run()

    _reload(d, other)
    group = FiscalMatch.objects.get(invoice=inv)
    assert d.fiscal_match_id == group.id
    assert other.fiscal_match_id != group.id
    assert result.linked == 1


def test_folio_of_other_type_does_not_match(env, imp):
    inv = make_pos_document(env, 7000, local_dt(2026, 11, 13, 12, 0), dte_type=Invoice.DTEType.BOLETA)
    Invoice.objects.filter(pk=inv.pk).update(number="123")
    d = boleta(imp, 7000, folio=123, dte_type=41)
    assert run().linked == 0
    _reload(d)
    assert d.fiscal_match_id != FiscalMatch.objects.get(invoice=inv).id


def test_missing_since_import_not_paired(env, imp):
    d = boleta(imp, 5000, missing_since_import=imp)
    s = sale(env, 5000)
    assert run().linked == 0
    _reload(d, s)
    assert d.fiscal_match_id != s.fiscal_match_id


def test_manual_rcv_link_untouched(env, imp):
    d = boleta(imp, 5000)
    s = sale(env, 5000)
    ensure_groups(SINCE)
    d.refresh_from_db()
    FiscalMatch.objects.filter(pk=d.fiscal_match_id).update(rcv_linked_manually=True)
    original = d.fiscal_match_id

    assert run().linked == 0

    _reload(d, s)
    assert d.fiscal_match_id == original
    assert d.fiscal_match_id != s.fiscal_match_id


def test_existing_pairs_stable_and_idempotent(env, imp):
    d1, d2 = boleta(imp, 5000, folio=1), boleta(imp, 5000, folio=2)
    s1 = sale(env, 5000, hh=10)
    first = run()
    _reload(d1, d2, s1)
    assert first.linked == 1 and d1.fiscal_match_id == s1.fiscal_match_id
    # una venta nueva anterior no roba la boleta ya emparejada
    sale(env, 5000, hh=9)
    second = run()
    _reload(d1, d2)
    assert second.linked == 1
    assert d1.fiscal_match_id == s1.fiscal_match_id
    assert d2.fiscal_match_id != s1.fiscal_match_id
    assert run().linked == 0


def test_cancelled_sale_not_paired(env, imp):
    d = boleta(imp, 5000)
    s = sale(env, 5000, status=TerminalSale.Status.REVERSED)
    assert run().linked == 0
    _reload(d, s)
    assert d.fiscal_match_id != s.fiscal_match_id


def test_start_date_none_returns_zero(env, imp):
    set_match_settings(None)
    boleta(imp, 5000)
    sale(env, 5000)
    lo, hi = datetime(2026, 11, 1, tzinfo=None), datetime(2026, 12, 1)
    assert pair_rcv_boletas(lo, hi) == LinkResult(0)


def _queries_for(env, imp, n):
    for i in range(n):
        boleta(imp, 1000 + i, day=1 + i % 28)
        sale(env, 1000 + i, day=1 + i % 28)
    ensure_groups(SINCE)
    with CaptureQueriesContext(connection) as ctx:
        result = pair_rcv_boletas(local_midnight(date(2026, 11, 1)), local_midnight(date(2026, 12, 1)))
    assert result.linked == n
    return len(ctx.captured_queries)


def test_query_count_constant(env, imp):
    from accounting.models import RCVSettings

    RCVSettings.get_settings()
    small = _queries_for(env, imp, 2)
    big = _queries_for(env, imp, 12)
    assert small == big


def test_months_in_range_reexported():
    from tax.fiscal_match import boletas
    from tax.reconciliation.boletas import _pair, months_in_range

    assert months_in_range is boletas.months_in_range and _pair is boletas._pair
