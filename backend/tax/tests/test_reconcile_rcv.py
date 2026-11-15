"""Cuadre del RCV contra facturas y notas del ERP (ADR-0138 D5)."""

import itertools
from datetime import date
from decimal import Decimal
from unittest import mock

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from accounting import tasks
from accounting.models import RCVDocument, RCVImport
from billing.models import Invoice
from contacts.models import Contact
from core.fiscal_match import MatchStatus
from purchasing.models import PurchaseOrder
from tax.models import TaxPeriod
from tax.reconciliation.rcv import reconcile_rcv_period
from tax.tests.reconciliation_helpers import set_match_settings

P = RCVImport.Direction.PURCHASES
S = RCVImport.Direction.SALES
_seq = itertools.count(1000)


@pytest.fixture
def imp(db):
    set_match_settings(date(2026, 10, 1))
    return RCVImport.objects.create(
        direction=P, year=2026, month=10, trigger=RCVImport.Trigger.MANUAL, status=RCVImport.Status.SUCCESS
    )


def rcv(imp, folio, total, *, dte_type=33, rut="8973356-K", direction=P, period="202610", **kw):
    return RCVDocument.objects.create(
        direction=direction, company_rut="11111111-1", period=period, dte_type=dte_type, folio=folio,
        counterparty_rut=rut, issue_date=date(2026, 10, 15), total_amount=Decimal(total),
        first_import=imp, last_import=imp, **kw,
    )


def purchase_invoice(number, total, *, rut="8.973.356-k", dte_type=Invoice.DTEType.PURCHASE_INV, **kw):
    return Invoice.objects.create(
        dte_type=dte_type, status=kw.pop("status", Invoice.Status.POSTED), number=number,
        partner_tax_id_snapshot=rut, total=Decimal(total), date=kw.pop("date", date(2026, 10, 12)), **kw,
    )


def run(direction=P, rcv_import=None):
    return reconcile_rcv_period(direction, 2026, 10, rcv_import)


def _reload(*objs):
    for o in objs:
        o.refresh_from_db()


def test_purchase_invoice_matches_rcv(imp):
    inv = purchase_invoice("000123", 119000)
    doc = rcv(imp, 123, 119000, rut="8973356-K")

    result = run()

    _reload(doc)
    assert doc.match_status == MatchStatus.MATCHED
    assert doc.matched_invoice_id == inv.id
    assert result == {MatchStatus.MATCHED: 1}


def test_purchase_with_po_matches(imp):
    supplier = Contact.objects.create(name="Proveedor", tax_id="8.973.356-k")
    po = PurchaseOrder.objects.create(supplier=supplier, status="DRAFT")
    inv = purchase_invoice("55", 1000, dte_type=Invoice.DTEType.FACTURA, purchase_order=po)
    doc = rcv(imp, 55, 1000)

    run()

    _reload(doc)
    assert doc.matched_invoice_id == inv.id


def test_sale_invoice_not_candidate_for_purchases(imp):
    purchase_invoice("77", 1000, dte_type=Invoice.DTEType.FACTURA)  # sin OC → venta
    doc = rcv(imp, 77, 1000)

    run()

    _reload(doc)
    assert doc.match_status == MatchStatus.ONLY_EXTERNAL
    assert doc.matched_invoice_id is None


def test_amount_diff(imp):
    inv = purchase_invoice("10", 1000)
    doc = rcv(imp, 10, 1200)

    run()

    _reload(doc)
    assert doc.match_status == MatchStatus.AMOUNT_DIFF
    assert doc.matched_invoice_id == inv.id


def test_only_external_when_missing_in_erp(imp):
    purchase_invoice("10", 1000, status=Invoice.Status.DRAFT)
    purchase_invoice("10", 1000, rut="76543210-3")
    purchase_invoice("10", 1000, date=date(2026, 6, 1))  # fuera de la ventana de ±60 días
    doc = rcv(imp, 10, 1000)

    result = run()

    _reload(doc)
    assert doc.match_status == MatchStatus.ONLY_EXTERNAL
    assert doc.matched_invoice_id is None
    assert result == {MatchStatus.ONLY_EXTERNAL: 1}


def test_credit_note_matches_by_absolute_amount(imp):
    original = purchase_invoice("10", 5000)
    note = purchase_invoice("4", 1000, dte_type=Invoice.DTEType.NOTA_CREDITO, corrected_invoice=original)
    doc = rcv(imp, 4, -1000, dte_type=61)

    run()

    _reload(doc)
    assert doc.match_status == MatchStatus.MATCHED
    assert doc.matched_invoice_id == note.id


def test_boleta_and_48_detail_rows_are_excluded(imp):
    docs = [rcv(imp, 1, 1000, dte_type=39, direction=S), rcv(imp, 2, 1000, dte_type=48, direction=S),
            rcv(imp, 3, 1000, dte_type=41, direction=S)]

    result = run(S)

    _reload(*docs)
    assert {d.match_status for d in docs} == {MatchStatus.EXCLUDED}
    assert result == {MatchStatus.EXCLUDED: 3}


def test_unsupported_type_excluded(imp):
    doc = rcv(imp, 9, 1000, dte_type=46)

    run()

    _reload(doc)
    assert doc.match_status == MatchStatus.EXCLUDED


def test_missing_since_import_unlinks(imp):
    inv = purchase_invoice("10", 1000)
    doc = rcv(imp, 10, 1000)
    run()
    _reload(doc)
    assert doc.matched_invoice_id == inv.id

    RCVDocument.objects.filter(pk=doc.pk).update(missing_since_import=imp)
    run()

    _reload(doc)
    assert doc.match_status == MatchStatus.EXCLUDED
    assert doc.matched_invoice_id is None


def test_manual_link_survives_rerun(imp):
    inv = purchase_invoice("10", 1000)
    other = purchase_invoice("20", 999)
    manual = rcv(imp, 20, 1000, matched_invoice=inv, matched_manually=True, match_status=MatchStatus.AMOUNT_DIFF)
    auto = rcv(imp, 10, 1000)  # su clave coincide con `inv`, ya tomado por el vínculo manual

    run()
    run()

    _reload(manual, auto)
    assert manual.matched_invoice_id == inv.id
    assert manual.match_status == MatchStatus.AMOUNT_DIFF
    assert auto.matched_invoice_id is None
    assert auto.match_status == MatchStatus.ONLY_EXTERNAL
    assert other.rcv_documents.count() == 0


def test_rerun_is_idempotent(imp):
    inv = purchase_invoice("10", 1000)
    doc = rcv(imp, 10, 1000)

    assert run() == run() == {MatchStatus.MATCHED: 1}

    _reload(doc)
    assert doc.matched_invoice_id == inv.id


def test_duplicate_erp_key_is_ambiguous(imp):
    purchase_invoice("10", 1000)
    purchase_invoice("010", 1000)
    doc = rcv(imp, 10, 1000)

    run()

    _reload(doc)
    assert doc.match_status == MatchStatus.AMBIGUOUS
    assert doc.matched_invoice_id is None


def test_closed_period_new_diff_adds_warning(imp):
    TaxPeriod.objects.create(year=2026, month=10, status=TaxPeriod.Status.CLOSED)
    inv = purchase_invoice("10", 1000)
    matched = rcv(imp, 10, 1000)
    run()
    _reload(matched)
    assert matched.match_status == MatchStatus.MATCHED

    Invoice.objects.filter(pk=inv.pk).update(total=Decimal("900"))
    rcv(imp, 11, 500)  # nueva, sin evaluar → ONLY_EXTERNAL
    rcv(imp, 12, 500, dte_type=46)  # nueva → EXCLUDED, no cuenta
    run(rcv_import=imp)

    imp.refresh_from_db()
    assert imp.warnings == ["Hay 2 diferencia(s) nueva(s) del RCV en un período tributario cerrado."]


def test_closed_period_without_new_diffs_adds_no_warning(imp):
    TaxPeriod.objects.create(year=2026, month=10, status=TaxPeriod.Status.CLOSED)
    purchase_invoice("10", 1000)
    rcv(imp, 10, 1000)

    run(rcv_import=imp)

    imp.refresh_from_db()
    assert imp.warnings == []


def test_before_start_date_untouched(imp):
    set_match_settings(date(2026, 11, 1))
    purchase_invoice("10", 1000)
    doc = rcv(imp, 10, 1000)

    assert run() == {}

    _reload(doc)
    assert doc.match_status == ""
    assert doc.matched_invoice_id is None


def test_without_start_date_untouched(imp):
    set_match_settings(None)
    doc = rcv(imp, 10, 1000)

    assert run() == {}

    _reload(doc)
    assert doc.match_status == ""


def test_start_date_inside_period_evaluates_whole_period(imp):
    set_match_settings(date(2026, 10, 20))
    doc = rcv(imp, 10, 1000)

    run()

    _reload(doc)
    assert doc.match_status == MatchStatus.ONLY_EXTERNAL


def _seed(imp, n):
    for _ in range(n):
        folio = next(_seq)
        original = purchase_invoice(str(folio), 1000)
        rcv(imp, folio, 1000)
        note_folio = next(_seq)
        purchase_invoice(str(note_folio), 100, dte_type=Invoice.DTEType.NOTA_CREDITO, corrected_invoice=original)
        rcv(imp, note_folio, -100, dte_type=61)


def _count(imp):
    with CaptureQueriesContext(connection) as ctx:
        run(rcv_import=imp)
    return len(ctx.captured_queries)


def test_query_count_constant(imp):
    _seed(imp, 5)
    run()  # calienta la caché del singleton RCVSettings
    small = _count(imp)
    _seed(imp, 20)
    assert _count(imp) == small


def test_import_task_triggers_reconciliation(imp):
    def execute(rcv_import):
        return rcv_import

    with mock.patch.object(tasks.rcv_service, "execute_import", side_effect=execute), \
            mock.patch("tax.reconciliation.rcv.reconcile_rcv_period") as reconcile:
        tasks.run_rcv_imports([imp.id])

    reconcile.assert_called_once()
    args = reconcile.call_args.args
    assert args[:3] == (P, 2026, 10)
    assert args[3].pk == imp.pk


def test_import_task_skips_failed_and_survives_errors(imp):
    failed = RCVImport.objects.create(
        direction=S, year=2026, month=10, trigger=RCVImport.Trigger.MANUAL, status=RCVImport.Status.FAILED
    )

    with mock.patch.object(tasks.time, "sleep"), \
            mock.patch.object(tasks.rcv_service, "execute_import", side_effect=lambda i: i), \
            mock.patch("tax.reconciliation.rcv.reconcile_rcv_period", side_effect=RuntimeError("x")) as reconcile:
        statuses = tasks.run_rcv_imports([failed.id, imp.id])

    assert reconcile.call_count == 1
    assert statuses == [RCVImport.Status.FAILED, RCVImport.Status.SUCCESS]


def test_manual_link_to_cancelled_invoice_is_reevaluated(imp):
    cancelled = purchase_invoice("30", 1000)
    replacement = purchase_invoice("20", 1000)
    doc = rcv(imp, 20, 1000, matched_invoice=cancelled, matched_manually=True, match_status=MatchStatus.MATCHED)
    Invoice.objects.filter(pk=cancelled.pk).update(status=Invoice.Status.CANCELLED)

    run()

    _reload(doc)
    assert doc.matched_manually is False
    assert doc.matched_invoice_id == replacement.id
    assert doc.match_status == MatchStatus.MATCHED


def test_manual_link_with_null_invoice_is_reevaluated(imp):
    inv = purchase_invoice("20", 1000)
    doc = rcv(imp, 20, 1000, matched_invoice=None, matched_manually=True, match_status=MatchStatus.MATCHED)

    run()

    _reload(doc)
    assert doc.matched_manually is False
    assert doc.matched_invoice_id == inv.id
    assert doc.match_status == MatchStatus.MATCHED
