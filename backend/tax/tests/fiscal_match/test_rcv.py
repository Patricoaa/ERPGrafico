"""ERP ↔ RCV por clave fiscal: el documento RCV entra al grupo de su factura (ADR-0138 D5)."""

import itertools
from datetime import date
from decimal import Decimal

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from accounting.models import RCVDocument, RCVImport
from billing.models import Invoice
from contacts.models import Contact
from purchasing.models import PurchaseOrder
from tax.fiscal_match.candidates import LinkResult
from tax.fiscal_match.groups import ensure_groups
from tax.fiscal_match.rcv import link_rcv_documents, rcv_group_candidates
from tax.models import FiscalMatch
from tax.tests.reconciliation_helpers import set_match_settings

SINCE = date(2026, 10, 1)
P = RCVImport.Direction.PURCHASES
S = RCVImport.Direction.SALES
_seq = itertools.count(1000)


@pytest.fixture
def imp(db):
    set_match_settings(SINCE)
    return RCVImport.objects.create(
        direction=P, year=2026, month=10, trigger=RCVImport.Trigger.MANUAL, status=RCVImport.Status.SUCCESS
    )


def rcv(imp, folio, total, *, dte_type=33, rut="8973356-K", direction=P, company_rut="11111111-1", **kw):
    return RCVDocument.objects.create(
        direction=direction, company_rut=company_rut, period="202610", dte_type=dte_type, folio=folio,
        counterparty_rut=rut, issue_date=date(2026, 10, 15), total_amount=Decimal(total),
        first_import=imp, last_import=imp, **kw,
    )


def purchase_invoice(number, total, *, rut="8.973.356-k", dte_type=Invoice.DTEType.PURCHASE_INV, **kw):
    return Invoice.objects.create(
        dte_type=dte_type, status=kw.pop("status", Invoice.Status.POSTED), number=number,
        partner_tax_id_snapshot=rut, total=Decimal(total), date=kw.pop("date", date(2026, 10, 12)), **kw,
    )


def sale_invoice(number, total, *, rut="8.973.356-k", **kw):
    return purchase_invoice(number, total, rut=rut, dte_type=Invoice.DTEType.FACTURA, **kw)


def run() -> LinkResult:
    ensure_groups(SINCE)
    return link_rcv_documents(SINCE)


def group_of(invoice) -> FiscalMatch:
    return FiscalMatch.objects.get(invoice=invoice)


def test_same_key_moves_rcv_into_invoice_group(imp):
    inv = purchase_invoice("000123", 119000)
    doc = rcv(imp, 123, 119000)
    ensure_groups(SINCE)
    orphan_id = RCVDocument.objects.get(pk=doc.pk).fiscal_match_id

    result = run()

    doc.refresh_from_db()
    assert result == LinkResult(1)
    assert doc.fiscal_match_id == group_of(inv).id
    assert not FiscalMatch.objects.filter(pk=orphan_id).exists()


def test_purchase_with_po_matches(imp):
    supplier = Contact.objects.create(name="Proveedor", tax_id="8.973.356-k")
    po = PurchaseOrder.objects.create(supplier=supplier, status="DRAFT")
    inv = purchase_invoice("55", 1000, dte_type=Invoice.DTEType.FACTURA, purchase_order=po)
    doc = rcv(imp, 55, 1000)

    run()

    doc.refresh_from_db()
    assert doc.fiscal_match_id == group_of(inv).id


def test_purchase_and_sale_directions(imp):
    purchase = purchase_invoice("10", 1000)
    sale = sale_invoice("10", 1000)
    d_purchase = rcv(imp, 10, 1000)
    d_sale = rcv(imp, 10, 1000, direction=S)

    assert run().linked == 2

    d_purchase.refresh_from_db()
    d_sale.refresh_from_db()
    assert d_purchase.fiscal_match_id == group_of(purchase).id
    assert d_sale.fiscal_match_id == group_of(sale).id


def test_credit_note_matches_by_key(imp):
    original = purchase_invoice("10", 5000)
    note = purchase_invoice("4", 1000, dte_type=Invoice.DTEType.NOTA_CREDITO, corrected_invoice=original)
    doc = rcv(imp, 4, -1000, dte_type=61)

    run()

    doc.refresh_from_db()
    assert doc.fiscal_match_id == group_of(note).id


def test_no_match_stays_orphan(imp):
    purchase_invoice("10", 1000, status=Invoice.Status.DRAFT)
    purchase_invoice("10", 1000, rut="76543210-3")
    purchase_invoice("10", 1000, date=date(2026, 6, 1))  # fuera de la ventana de ±60 días
    sale_invoice("10", 1000)  # otra dirección
    doc = rcv(imp, 10, 1000)
    ensure_groups(SINCE)
    before = RCVDocument.objects.get(pk=doc.pk).fiscal_match_id

    result = run()

    doc.refresh_from_db()
    assert result == LinkResult(0)
    assert doc.fiscal_match_id == before


def test_duplicate_erp_key_ambiguous(imp):
    purchase_invoice("10", 1000)
    purchase_invoice("010", 1000)
    doc = rcv(imp, 10, 1000)
    ensure_groups(SINCE)
    before = RCVDocument.objects.get(pk=doc.pk).fiscal_match_id

    result = run()

    doc.refresh_from_db()
    assert result == LinkResult(0, {before})
    assert doc.fiscal_match_id == before


def test_duplicate_key_ambiguous(imp):
    inv = purchase_invoice("10", 1000)
    a, b = rcv(imp, 10, 1000), rcv(imp, 10, 1000, company_rut="22222222-2")

    result = run()

    a.refresh_from_db()
    b.refresh_from_db()
    assert result.linked == 0
    assert result.ambiguous_group_ids == {a.fiscal_match_id, b.fiscal_match_id}
    assert a.fiscal_match_id != group_of(inv).id != b.fiscal_match_id


def test_invoice_with_rcv_in_group_is_taken(imp):
    inv = purchase_invoice("10", 1000)
    first = rcv(imp, 10, 1000)
    run()
    second = rcv(imp, 10, 1000, company_rut="22222222-2")

    result = run()

    first.refresh_from_db()
    second.refresh_from_db()
    assert first.fiscal_match_id == group_of(inv).id
    assert second.fiscal_match_id != first.fiscal_match_id
    assert result.linked == 0


def test_unsupported_types_stay_orphan(imp):
    d46, d43 = rcv(imp, 9, 1000, dte_type=46), rcv(imp, 8, 1000, dte_type=43)
    ensure_groups(SINCE)
    before = {d.pk: RCVDocument.objects.get(pk=d.pk).fiscal_match_id for d in (d46, d43)}

    assert run() == LinkResult(0)

    for d in (d46, d43):
        d.refresh_from_db()
        assert d.fiscal_match_id == before[d.pk]


def test_missing_since_import_and_manual_not_selected(imp):
    inv = purchase_invoice("10", 1000)
    gone = rcv(imp, 10, 1000, company_rut="33333333-3", missing_since_import=imp)
    manual = rcv(imp, 10, 1000, company_rut="22222222-2")
    ensure_groups(SINCE)
    manual.refresh_from_db()
    FiscalMatch.objects.filter(pk=manual.fiscal_match_id).update(rcv_linked_manually=True)

    assert run().linked == 0

    gone.refresh_from_db()
    assert gone.fiscal_match_id != group_of(inv).id


def test_before_start_date_untouched(imp):
    set_match_settings(date(2026, 11, 1))
    purchase_invoice("10", 1000)
    rcv(imp, 10, 1000)

    assert link_rcv_documents(date(2026, 11, 1)) == LinkResult(0)


def test_without_start_date_untouched(imp):
    set_match_settings(None)
    purchase_invoice("10", 1000)
    rcv(imp, 10, 1000)

    assert link_rcv_documents(SINCE) == LinkResult(0)


def test_rerun_is_idempotent(imp):
    inv = purchase_invoice("10", 1000)
    doc = rcv(imp, 10, 1000)

    assert run().linked == 1
    assert run() == LinkResult(0)

    doc.refresh_from_db()
    assert doc.fiscal_match_id == group_of(inv).id


def test_rcv_group_candidates(imp):
    mine = purchase_invoice("10", 1000)
    taken = purchase_invoice("20", 2000)
    other_rut = purchase_invoice("10", 1000, rut="76543210-3")
    cancelled = purchase_invoice("10", 1000, status=Invoice.Status.CANCELLED)
    doc = rcv(imp, 10, 1000)
    rcv(imp, 20, 2000)
    run()  # el segundo documento entra al grupo de `taken`
    ensure_groups(SINCE)

    ids = set(rcv_group_candidates(doc).values_list("id", flat=True))

    assert mine.id in ids
    assert taken.id not in ids
    assert other_rut.id not in ids
    assert cancelled.id not in ids


def test_rcv_group_candidates_excludes_own_group_and_caps(imp):
    inv = purchase_invoice("10", 1000)
    doc = rcv(imp, 10, 1000)
    run()
    assert list(rcv_group_candidates(doc)) == [inv]  # su propio grupo no cuenta como tomado

    for n in range(25):
        purchase_invoice(str(2000 + n), 1000)
    assert rcv_group_candidates(doc).count() == 20


def _seed(imp, n):
    for _ in range(n):
        folio = next(_seq)
        original = purchase_invoice(str(folio), 1000)
        rcv(imp, folio, 1000)
        note_folio = next(_seq)
        purchase_invoice(str(note_folio), 100, dte_type=Invoice.DTEType.NOTA_CREDITO, corrected_invoice=original)
        rcv(imp, note_folio, -100, dte_type=61)


def _count() -> int:
    ensure_groups(SINCE)
    with CaptureQueriesContext(connection) as ctx:
        link_rcv_documents(SINCE)
    return len(ctx.captured_queries)


def test_query_count_constant(imp):
    _seed(imp, 5)
    _count()  # calienta la caché del singleton RCVSettings
    _seed(imp, 5)
    small = _count()
    _seed(imp, 20)
    assert _count() == small
