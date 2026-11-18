"""Derivación de estados de partes y del grupo de cuadre (spec §5.2–§5.3)."""

import itertools
from dataclasses import replace
from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.core.cache import cache
from django.db import connection
from django.test.utils import CaptureQueriesContext

from accounting.models import RCVDocument, RCVImport
from billing.models import Invoice
from core.fiscal_match import FiscalMatchStatus, PartState
from tax.fiscal_match.groups import ensure_groups
from tax.fiscal_match.states import STATE_FIELDS, EvalContext, build_context, evaluate
from tax.fiscal_match.terminal import link_terminal_sales
from tax.models import FiscalMatch, TaxPeriod
from tax.tests.fiscal_match_helpers import (
    local_dt,
    make_pos_document,
    make_terminal_env,
    make_terminal_sale,
    set_match_settings,
)
from treasury.models import TerminalSale, TerminalSyncRun, TreasuryMovement
from treasury.tests.helpers import make_terminal_provider

SINCE = date(2026, 10, 1)
S = RCVImport.Direction.SALES
P = RCVImport.Direction.PURCHASES
AT = local_dt(2026, 11, 13, 12, 0)
_folios = itertools.count(7000)


@pytest.fixture
def env(db):
    set_match_settings(SINCE)
    return make_terminal_env()


# --- fábricas -------------------------------------------------------------------------


def rcv_import(direction=S, year=2026, month=11, status=RCVImport.Status.SUCCESS):
    return RCVImport.objects.create(
        direction=direction, year=year, month=month, trigger=RCVImport.Trigger.MANUAL, status=status
    )


def rcv_doc(group, total, *, dte_type=39, direction=S, period="202611", issue=date(2026, 11, 13), **kw):
    imp = kw.pop("imp", None) or RCVImport.objects.filter(direction=direction).first() or rcv_import(direction)
    return RCVDocument.objects.create(
        direction=direction, company_rut="11111111-1", period=period, dte_type=dte_type,
        folio=next(_folios), counterparty_rut="66666666-6", issue_date=issue,
        total_amount=Decimal(total), first_import=imp, last_import=imp, fiscal_match=group, **kw,
    )


def movement_of(invoice) -> TreasuryMovement:
    return TreasuryMovement.objects.get(invoice=invoice)


def add_payment(env, invoice, amount, at, *, method="TRANSFER", session=True) -> TreasuryMovement:
    m = TreasuryMovement.objects.create(
        movement_type=TreasuryMovement.Type.INBOUND, payment_method=method,
        payment_method_new=env.card if method == "CARD" else env.cash,
        amount=Decimal(amount), created_by=env.user, contact=env.customer, to_account=env.cash_account,
        invoice=invoice, sale_order=invoice.sale_order, pos_session=env.session if session else None,
        date=at.date(),
    )
    TreasuryMovement.objects.filter(pk=m.pk).update(created_at=at)
    return m


def attach(sale: TerminalSale, group: FiscalMatch, movement: TreasuryMovement | None) -> TerminalSale:
    orphan = sale.fiscal_match_id
    sale.fiscal_match = group
    sale.matched_movement = movement
    sale.save(update_fields=["fiscal_match", "matched_movement"])
    if orphan and orphan != group.id:
        FiscalMatch.objects.filter(pk=orphan, terminal_sales__isnull=True, rcv_documents__isnull=True).delete()
    return sale


def pos_group(env, total, *, dte_type=Invoice.DTEType.BOLETA, method="CASH", **kw):
    invoice = make_pos_document(env, total, AT, dte_type=dte_type, method=method, **kw)
    ensure_groups(SINCE)
    return invoice, FiscalMatch.objects.get(invoice=invoice)


def sale_for(env, invoice, group, *, document_type=39, payment_type=TerminalSale.PaymentType.CASH, amount=None):
    m = movement_of(invoice)
    s = make_terminal_sale(
        env, amount if amount is not None else m.amount, AT + timedelta(minutes=2),
        document_type=document_type, payment_type=payment_type,
    )
    return attach(s, group, m)


def sync_run(provider, *, start=date(2026, 11, 13), end=date(2026, 11, 13), finished=None, status="SUCCESS"):
    return TerminalSyncRun.objects.create(
        provider=provider, trigger=TerminalSyncRun.Trigger.SCHEDULED, status=status,
        start_date=start, end_date=end, started_at=AT, finished_at=finished or AT + timedelta(hours=1),
    )


def run(*groups: FiscalMatch, tuu_ambiguous=frozenset(), rcv_ambiguous=frozenset(), now=None) -> list[FiscalMatch]:
    fresh = list(FiscalMatch.objects.filter(pk__in=[g.pk for g in groups]).order_by("pk")) if groups else list(
        FiscalMatch.objects.order_by("pk")
    )
    ctx = build_context(fresh, tuu_ambiguous=tuu_ambiguous, rcv_ambiguous=rcv_ambiguous)
    if now is not None:
        ctx = replace(ctx, now=now)
    evaluate(fresh, ctx)
    return fresh


def one(group: FiscalMatch, **kw) -> FiscalMatch:
    return run(group, **kw)[0]


def parts(g: FiscalMatch) -> tuple[str, str, str, str]:
    return g.erp_state, g.tuu_state, g.rcv_state, g.status


M, PD, MI, D, A, NA, SO = (
    PartState.MATCHED, PartState.PENDING, PartState.MISSING, PartState.DIFF,
    PartState.AMBIGUOUS, PartState.NOT_APPLICABLE, PartState.SUMMARY_ONLY,
)


# --- compras (spec §5.3) --------------------------------------------------------------


def purchase_group(total=119000, day=date(2026, 10, 12), dte_type=Invoice.DTEType.PURCHASE_INV):
    invoice = Invoice.objects.create(
        dte_type=dte_type, status=Invoice.Status.POSTED, number=str(next(_folios)),
        partner_tax_id_snapshot="8.973.356-k", total=Decimal(total), date=day,
    )
    ensure_groups(SINCE)
    return invoice, FiscalMatch.objects.get(invoice=invoice)


def test_purchase_with_same_amount_rcv_is_matched_and_tuu_not_applicable(env):
    _, group = purchase_group()
    rcv_doc(group, 119000, dte_type=33, direction=P, period="202610", issue=date(2026, 10, 12))

    g = one(group)

    assert parts(g) == (M, NA, M, FiscalMatchStatus.MATCHED)


def test_purchase_with_different_rcv_amount_is_diff(env):
    _, group = purchase_group()
    rcv_doc(group, 118000, dte_type=33, direction=P, period="202610", issue=date(2026, 10, 12))

    g = one(group)

    assert g.rcv_state == D
    assert g.status == FiscalMatchStatus.DIFF


def test_purchase_boleta_rcv_not_applicable(env):
    invoice = Invoice.objects.create(
        dte_type=Invoice.DTEType.BOLETA, status=Invoice.Status.POSTED, number="9",
        total=Decimal(5000), date=date(2026, 11, 13),
    )
    group = FiscalMatch.objects.create(
        direction=FiscalMatch.Direction.PURCHASE, invoice=invoice, dte_type=39,
        issue_date=date(2026, 11, 13), fiscal_period="202611", erp_amount=Decimal(5000),
    )

    g = one(group)

    assert parts(g) == (M, NA, NA, FiscalMatchStatus.MATCHED)


def test_purchase_without_rcv_missing_only_after_three_months_imported(env):
    _, group = purchase_group(day=date(2026, 10, 12))
    rcv_import(P, 2026, 10)
    rcv_import(P, 2026, 11)
    rcv_import(S, 2026, 12)
    rcv_import(P, 2026, 12, status=RCVImport.Status.FAILED)

    assert one(group).rcv_state == PD

    rcv_import(P, 2026, 12)
    g = one(group)

    assert g.rcv_state == MI
    assert g.status == FiscalMatchStatus.MISSING_EXTERNAL


# --- ventas: una fila por caso de la tabla §5.3 ---------------------------------------


def test_boleta_39_pos_cash_with_tuu_sale_and_rcv_is_matched(env):
    invoice, group = pos_group(env, 5000)
    sale_for(env, invoice, group)
    rcv_doc(group, 5000)

    g = one(group)

    assert parts(g) == (M, M, M, FiscalMatchStatus.MATCHED)
    assert (g.erp_amount, g.tuu_amount, g.rcv_amount) == (Decimal(5000), Decimal(5000), Decimal(5000))


def test_boleta_41_pos_cash_with_tuu_41_is_matched(env):
    invoice, group = pos_group(env, 5000, dte_type=Invoice.DTEType.BOLETA_EXENTA)
    sale_for(env, invoice, group, document_type=41)
    rcv_doc(group, 5000, dte_type=41)

    assert parts(one(group)) == (M, M, M, FiscalMatchStatus.MATCHED)


def test_boleta_41_with_card_tuu_48_is_diff(env):
    invoice = make_pos_document(env, 5000, AT, dte_type=Invoice.DTEType.BOLETA_EXENTA, method="CARD")
    make_terminal_sale(env, 5000, AT + timedelta(minutes=2), document_type=48)
    ensure_groups(SINCE)
    link_terminal_sales(local_dt(2026, 11, 13, 0), local_dt(2026, 11, 14, 0), rematch_ids=set())
    group = FiscalMatch.objects.get(invoice=invoice)
    rcv_doc(group, 5000, dte_type=41)

    g = one(group)

    assert g.tuu_state == D
    assert g.status == FiscalMatchStatus.DIFF


def test_comprobante_48_card_is_matched_with_rcv_summary_only(env):
    invoice = make_pos_document(env, 8000, AT, method="CARD")
    make_terminal_sale(env, 8000, AT + timedelta(minutes=1), document_type=48)
    ensure_groups(SINCE)
    link_terminal_sales(local_dt(2026, 11, 13, 0), local_dt(2026, 11, 14, 0), rematch_ids=set())
    group = FiscalMatch.objects.get(invoice=invoice)

    assert parts(one(group)) == (M, M, SO, FiscalMatchStatus.MATCHED)


def test_factura_card_tuu_33_is_matched_not_type_diff(env):
    invoice, group = pos_group(env, 119000, dte_type=Invoice.DTEType.FACTURA, method="CARD")
    sale_for(env, invoice, group, document_type=33, payment_type=TerminalSale.PaymentType.CREDIT)
    rcv_doc(group, 119000, dte_type=33)

    assert parts(one(group)) == (M, M, M, FiscalMatchStatus.MATCHED)


def test_factura_paid_by_transfer_tuu_not_applicable(env):
    _, group = pos_group(env, 119000, dte_type=Invoice.DTEType.FACTURA, method="TRANSFER")
    rcv_doc(group, 119000, dte_type=33)

    assert parts(one(group)) == (M, NA, M, FiscalMatchStatus.MATCHED)


@pytest.mark.parametrize("dte_type", [Invoice.DTEType.FACTURA, Invoice.DTEType.FACTURA_EXENTA])
def test_factura_paid_cash_at_tuu_pos_tuu_not_applicable(env, dte_type):
    # Una factura pagada en efectivo no deja registro TUU, aunque la caja tenga dispositivo.
    invoice, group = pos_group(env, 119000, dte_type=dte_type, method="CASH")
    add_payment(env, invoice, 1000, AT + timedelta(minutes=1), method="TRANSFER")
    sync_run(env.provider)

    g = one(group)

    assert g.tuu_state == NA
    assert g.status == FiscalMatchStatus.PENDING  # solo falta el RCV del período


def test_sync_runs_read_only_overlap_unbacked_payment_days(env):
    _, group = pos_group(env, 5000)  # cobro en efectivo sin venta el 13/11
    backed_invoice = make_pos_document(env, 7000, local_dt(2026, 11, 20, 12), method="CARD")
    ensure_groups(SINCE)
    backed_group = FiscalMatch.objects.get(invoice=backed_invoice)
    s = make_terminal_sale(env, 7000, local_dt(2026, 11, 20, 12, 1), document_type=48)
    attach(s, backed_group, movement_of(backed_invoice))
    covering = sync_run(env.provider)
    sync_run(env.provider, start=date(2026, 11, 1), end=date(2026, 11, 12))
    sync_run(env.provider, start=date(2026, 11, 14), end=date(2026, 11, 30))

    ctx = build_context([group, backed_group])

    assert ctx.sync_runs == {env.provider.id: ((covering.start_date, covering.end_date, covering.finished_at),)}


def test_credit_note_tuu_not_applicable_and_rcv_by_absolute_value(env):
    invoice = Invoice.objects.create(
        dte_type=Invoice.DTEType.NOTA_CREDITO, status=Invoice.Status.POSTED, number="77",
        total=Decimal(10000), date=date(2026, 11, 13),
    )
    group = FiscalMatch.objects.create(
        direction=FiscalMatch.Direction.SALE, invoice=invoice, dte_type=61,
        issue_date=date(2026, 11, 13), fiscal_period="202611",
    )
    rcv_doc(group, -10000, dte_type=61)

    g = one(group)

    assert parts(g) == (M, NA, M, FiscalMatchStatus.MATCHED)
    assert g.rcv_amount == Decimal(10000)


def test_boleta_outside_pos_tuu_not_applicable(env):
    invoice, group = pos_group(env, 5000)
    TreasuryMovement.objects.filter(invoice=invoice).update(pos_session=None)
    rcv_doc(group, 5000)

    assert parts(one(group)) == (M, NA, M, FiscalMatchStatus.MATCHED)


# --- TUU por pago ---------------------------------------------------------------------


def test_pos_document_pending_until_sync_covers_payment(env):
    _, group = pos_group(env, 5000)
    rcv_doc(group, 5000)
    sync_run(env.provider, finished=AT + timedelta(minutes=30), status=TerminalSyncRun.Status.FAILED)
    sync_run(make_terminal_provider(), finished=AT + timedelta(hours=2))
    sync_run(env.provider, start=date(2026, 11, 14), end=date(2026, 11, 15))

    assert one(group).tuu_state == PD

    # Cubre el día pero terminó antes de pago + ventana: todavía puede llegar.
    sync_run(env.provider, finished=AT + timedelta(minutes=10))
    assert one(group).tuu_state == PD

    sync_run(env.provider, start=date(2026, 11, 12), end=date(2026, 11, 13), finished=AT + timedelta(minutes=20))
    g = one(group)

    assert g.tuu_state == MI
    assert g.status == FiscalMatchStatus.MISSING_EXTERNAL


def test_card_payment_pending_uses_card_device_provider(env):
    _, group = pos_group(env, 8000, dte_type=Invoice.DTEType.COMPROBANTE_PAGO, method="CARD")

    assert one(group).tuu_state == PD

    sync_run(env.provider)
    assert one(group).tuu_state == MI


def test_one_of_two_payments_without_sale_keeps_tuu_pending(env):
    invoice, group = pos_group(env, 6000, dte_type=Invoice.DTEType.FACTURA, method="CARD")
    sale_for(env, invoice, group, document_type=33, payment_type=TerminalSale.PaymentType.CREDIT)
    add_payment(env, invoice, 4000, AT + timedelta(minutes=5), method="CARD")

    g = one(group)

    assert g.tuu_state == PD
    assert g.tuu_amount == Decimal(6000)


def test_extra_manual_sale_does_not_break_matched(env):
    invoice, group = pos_group(env, 5000)
    sale_for(env, invoice, group)
    extra = make_terminal_sale(env, 1000, AT, document_type=39, payment_type=TerminalSale.PaymentType.CASH)
    extra.linked_manually = True
    extra.save(update_fields=["linked_manually"])
    attach(extra, group, None)
    rcv_doc(group, 6000)

    g = one(group)

    assert g.tuu_state == M
    assert g.tuu_amount == Decimal(6000)
    assert g.rcv_state == M


def test_tuu_ambiguous_group(env):
    sale = make_terminal_sale(env, 5000, AT, document_type=39)
    ensure_groups(SINCE)
    sale.refresh_from_db()
    orphan = sale.fiscal_match

    g = one(orphan, tuu_ambiguous={orphan.id})

    assert g.tuu_state == A
    assert g.status == FiscalMatchStatus.AMBIGUOUS


# --- RCV ------------------------------------------------------------------------------


def test_boleta_rcv_amount_equals_tuu_sum_is_matched(env):
    invoice, group = pos_group(env, 6000)
    Invoice.objects.filter(pk=invoice.pk).update(total=Decimal(10000))
    sale_for(env, invoice, group)
    add_payment(env, invoice, 4000, AT + timedelta(minutes=1), method="TRANSFER")
    rcv_doc(group, 6000)

    g = one(group)

    assert (g.erp_amount, g.tuu_amount) == (Decimal(10000), Decimal(6000))
    assert parts(g) == (M, M, M, FiscalMatchStatus.MATCHED)


def test_boleta_rcv_amount_matching_neither_is_diff(env):
    invoice, group = pos_group(env, 5000)
    sale_for(env, invoice, group)
    rcv_doc(group, 4999)

    assert one(group).rcv_state == D


def test_boleta_with_several_rcv_folios_sums_and_sets_notice(env):
    invoice, group = pos_group(env, 5000)
    sale_for(env, invoice, group)
    rcv_doc(group, 3000)
    rcv_doc(group, 2000)

    g = one(group)

    assert g.rcv_state == M
    assert g.rcv_amount == Decimal(5000)
    assert g.notice == "Varios folios en el SII"


def test_single_rcv_folio_clears_several_folios_notice(env):
    invoice, group = pos_group(env, 5000)
    sale_for(env, invoice, group)
    rcv_doc(group, 5000)
    FiscalMatch.objects.filter(pk=group.pk).update(notice="Varios folios en el SII")

    assert one(group).notice == ""


def test_sale_without_rcv_pending_until_period_imported(env):
    invoice, group = pos_group(env, 5000)
    sale_for(env, invoice, group)
    rcv_import(P, 2026, 11)

    assert one(group).rcv_state == PD

    rcv_import(S, 2026, 11)
    g = one(group)

    assert g.rcv_state == MI
    assert g.status == FiscalMatchStatus.MISSING_EXTERNAL


def test_rcv_ambiguous_group(env):
    imp = rcv_import(S)
    orphan = FiscalMatch.objects.create(
        direction=FiscalMatch.Direction.SALE, dte_type=33, issue_date=date(2026, 11, 13), fiscal_period="202611"
    )
    rcv_doc(orphan, 1000, dte_type=33, imp=imp)

    g = one(orphan, rcv_ambiguous={orphan.id})

    assert g.rcv_state == A
    assert g.status == FiscalMatchStatus.AMBIGUOUS


def test_fiscal_period_comes_from_rcv_period(env):
    invoice, group = pos_group(env, 5000)
    sale_for(env, invoice, group)
    rcv_doc(group, 5000, period="202612")

    assert one(group).fiscal_period == "202612"


# --- ERP y huérfanos ------------------------------------------------------------------


def test_orphan_rcv_is_missing_erp(env):
    orphan = FiscalMatch.objects.create(
        direction=FiscalMatch.Direction.SALE, dte_type=33, issue_date=date(2026, 11, 13), fiscal_period="202611"
    )
    rcv_doc(orphan, 1000, dte_type=33)

    g = one(orphan)

    assert parts(g) == (MI, NA, M, FiscalMatchStatus.MISSING_ERP)
    assert g.erp_amount is None


def test_orphan_tuu_sale_erp_pending_until_window_then_missing(env):
    sale = make_terminal_sale(env, 5000, AT, document_type=48)
    ensure_groups(SINCE)
    orphan = FiscalMatch.objects.get(terminal_sales=sale)

    g = one(orphan, now=AT + timedelta(minutes=14))
    assert (g.erp_state, g.tuu_state, g.rcv_state) == (PD, M, SO)
    assert g.status == FiscalMatchStatus.PENDING

    g = one(orphan, now=AT + timedelta(minutes=16))
    assert g.erp_state == MI
    assert g.status == FiscalMatchStatus.MISSING_ERP


def test_draft_boleta_without_number_erp_pending(env):
    invoice, group = pos_group(env, 5000, status=Invoice.Status.DRAFT)
    assert invoice.number == ""
    sale_for(env, invoice, group)
    rcv_doc(group, 5000)

    g = one(group)

    assert parts(g) == (PD, M, M, FiscalMatchStatus.PENDING)


# --- excluidos ------------------------------------------------------------------------


def test_cancelled_invoice_group_is_excluded(env):
    invoice, group = pos_group(env, 5000)
    Invoice.objects.filter(pk=invoice.pk).update(status=Invoice.Status.CANCELLED)

    assert one(group).status == FiscalMatchStatus.EXCLUDED


@pytest.mark.parametrize("dte_type", [43, 46, 110, 111, 112, 914])
def test_types_without_local_equivalent_are_excluded(env, dte_type):
    orphan = FiscalMatch.objects.create(
        direction=FiscalMatch.Direction.PURCHASE, dte_type=dte_type,
        issue_date=date(2026, 11, 13), fiscal_period="202611",
    )
    rcv_doc(orphan, 1000, dte_type=dte_type, direction=P)

    assert one(orphan).status == FiscalMatchStatus.EXCLUDED


def test_orphan_rcv_missing_since_import_is_excluded(env):
    first, later = rcv_import(S), rcv_import(S)
    orphan = FiscalMatch.objects.create(
        direction=FiscalMatch.Direction.SALE, dte_type=33, issue_date=date(2026, 11, 13), fiscal_period="202611"
    )
    rcv_doc(orphan, 1000, dte_type=33, imp=first, missing_since_import=later)

    assert one(orphan).status == FiscalMatchStatus.EXCLUDED


def test_group_before_start_date_is_excluded(env):
    invoice, group = pos_group(env, 5000)
    set_match_settings(date(2026, 11, 14))

    assert one(group).status == FiscalMatchStatus.EXCLUDED


# --- alerta de período cerrado --------------------------------------------------------


def test_closed_period_alert_when_matched_becomes_diff(env):
    _, group = purchase_group()
    doc = rcv_doc(group, 119000, dte_type=33, direction=P, period="202610", issue=date(2026, 10, 12))
    TaxPeriod.objects.create(year=2026, month=10, status=TaxPeriod.Status.CLOSED)
    g = one(group)
    assert g.status == FiscalMatchStatus.MATCHED and g.closed_period_alert is False
    g.save(update_fields=list(STATE_FIELDS))

    RCVDocument.objects.filter(pk=doc.pk).update(total_amount=Decimal(118000))
    g = one(group)
    assert g.status == FiscalMatchStatus.DIFF
    assert g.closed_period_alert is True
    g.save(update_fields=list(STATE_FIELDS))

    # Sigue con diferencia: la alerta se mantiene; vuelve a cuadrar: se limpia.
    assert one(group).closed_period_alert is True
    RCVDocument.objects.filter(pk=doc.pk).update(total_amount=Decimal(119000))
    assert one(group).closed_period_alert is False


def test_no_closed_period_alert_when_period_open(env):
    _, group = purchase_group()
    doc = rcv_doc(group, 119000, dte_type=33, direction=P, period="202610", issue=date(2026, 10, 12))
    TaxPeriod.objects.create(year=2026, month=10, status=TaxPeriod.Status.OPEN)
    one(group).save(update_fields=list(STATE_FIELDS))
    RCVDocument.objects.filter(pk=doc.pk).update(total_amount=Decimal(118000))

    assert one(group).closed_period_alert is False


# --- pureza y consultas ---------------------------------------------------------------


def _scenario(env, n: int) -> None:
    for i in range(n):
        invoice = make_pos_document(env, 5000 + i, AT + timedelta(minutes=30 * i), method="CASH",
                                    dte_type=Invoice.DTEType.BOLETA)
        ensure_groups(SINCE)
        group = FiscalMatch.objects.get(invoice=invoice)
        sale_for(env, invoice, group)
        rcv_doc(group, 5000 + i)
        card = make_pos_document(env, 8000 + i, AT + timedelta(minutes=30 * i + 5), method="CARD")
        add_payment(env, card, 100, AT + timedelta(minutes=30 * i + 6), method="CARD")
        purchase_group(total=1000 + i)
    orphan = FiscalMatch.objects.create(
        direction=FiscalMatch.Direction.SALE, dte_type=33, issue_date=date(2026, 11, 13), fiscal_period="202611"
    )
    rcv_doc(orphan, 1000, dte_type=33)
    ensure_groups(SINCE)
    sync_run(env.provider)


def _context_queries() -> int:
    groups = list(FiscalMatch.objects.all())
    cache.clear()  # RCVSettings vive en caché: ambas mediciones incluyen su lectura.
    with CaptureQueriesContext(connection) as ctx:
        build_context(groups)
    return len(ctx.captured_queries)


def test_build_context_query_count_constant(env):
    _scenario(env, 1)
    small = _context_queries()
    _scenario(make_terminal_env(), 4)

    assert FiscalMatch.objects.count() > 10
    assert _context_queries() == small


def test_evaluate_makes_no_queries(env, django_assert_num_queries):
    _scenario(env, 2)
    groups = list(FiscalMatch.objects.all())
    ctx = build_context(groups)
    assert isinstance(ctx, EvalContext)

    with django_assert_num_queries(0):
        evaluate(groups, ctx)

    assert all(g.evaluated_at == ctx.now for g in groups)


def test_factura_paid_cash_with_tuu_cash_boleta_attached_is_type_diff(env):
    # Sin pagos que esperen TUU la parte sería NOT_APPLICABLE, pero una venta de otro tipo
    # en el grupo es una diferencia (no se esconde bajo «no aplica»).
    invoice, group = pos_group(env, 5000, dte_type=Invoice.DTEType.FACTURA, method="CASH")
    sale_for(env, invoice, group, document_type=39)
    rcv_doc(group, 5000, dte_type=33)

    g = one(group)

    assert g.tuu_state == D
    assert g.status == FiscalMatchStatus.DIFF


def test_reversed_tuu_sale_does_not_back_its_payment(env):
    invoice, group = pos_group(env, 5000, dte_type=Invoice.DTEType.COMPROBANTE_PAGO, method="CARD")
    sale = sale_for(env, invoice, group, document_type=48, payment_type=TerminalSale.PaymentType.DEBIT)
    TerminalSale.objects.filter(pk=sale.pk).update(status=TerminalSale.Status.REVERSED)
    sync_run(env.provider)

    g = one(group)

    assert g.tuu_state == MI
    assert g.tuu_amount is None
    assert g.status != FiscalMatchStatus.MATCHED


def test_orphan_with_only_reversed_sales_is_excluded(env):
    sale = make_terminal_sale(env, 5000, AT, status=TerminalSale.Status.REVERSED)
    ensure_groups(SINCE)
    group = FiscalMatch.objects.create(direction=FiscalMatch.Direction.SALE, dte_type=48, issue_date=AT.date())
    TerminalSale.objects.filter(pk=sale.pk).update(fiscal_match=group)

    assert one(group).status == FiscalMatchStatus.EXCLUDED
