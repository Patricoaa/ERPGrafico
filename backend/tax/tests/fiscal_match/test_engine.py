"""Motor único del cuadre: encadena grupos, vínculos, estados y emisión (spec §5.4)."""

import itertools
from datetime import timedelta
from decimal import Decimal

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from accounting.models import RCVDocument, RCVImport
from billing.models import Invoice
from billing.tests.conftest import _any_account_is_cash, env  # noqa: F401 (fixtures)
from billing.tests.test_pos_checkout_documents import _alloc, _checkout, _order, pos  # noqa: F401
from core.fiscal_match import FiscalMatchStatus, PartState
from tax.fiscal_match.engine import run_fiscal_match
from tax.models import FiscalMatch, FiscalMatchRun
from tax.tests.fiscal_match_helpers import (
    make_pos_document,
    make_terminal_env,
    make_terminal_sale,
    set_match_settings,
)
from treasury.models import TerminalSale, TerminalSyncRun, TreasuryMovement

S = RCVImport.Direction.SALES
C48 = Invoice.DTEType.COMPROBANTE_PAGO
_folios = itertools.count(7000)


@pytest.fixture
def tenv(db):
    set_match_settings(timezone.localdate() - timedelta(days=5), window=15)
    return make_terminal_env()


def _ago(minutes: int):
    return timezone.now() - timedelta(minutes=minutes)


def _rcv(total, *, dte_type=39, folio=None, group=None, rut="66666666-6"):
    day = timezone.localdate()
    imp = RCVImport.objects.create(
        direction=S, year=day.year, month=day.month, trigger=RCVImport.Trigger.MANUAL,
        status=RCVImport.Status.SUCCESS,
    )
    return RCVDocument.objects.create(
        direction=S, company_rut="11111111-1", period=f"{day:%Y%m}", dte_type=dte_type,
        folio=folio if folio is not None else next(_folios), counterparty_rut=rut,
        issue_date=day, total_amount=Decimal(total), first_import=imp, last_import=imp,
        fiscal_match=group,
    )


def _sync_run(tenv) -> TerminalSyncRun:
    """Sincronización TUU exitosa de hoy, terminada ahora (después de la última corrida)."""
    today = timezone.localdate()
    return TerminalSyncRun.objects.create(
        provider=tenv.provider, trigger=TerminalSyncRun.Trigger.SCHEDULED,
        status=TerminalSyncRun.Status.SUCCESS, start_date=today, end_date=today,
        started_at=timezone.now(), finished_at=timezone.now(),
    )


def _group_of(invoice: Invoice) -> FiscalMatch:
    return FiscalMatch.objects.get(invoice=invoice)


def _reload(*objs):
    for o in objs:
        o.refresh_from_db()


@pytest.mark.django_db
def test_full_chain_boleta_pos_to_rcv_and_issue(env, pos):  # noqa: F811
    today = timezone.localdate()
    set_match_settings(today - timedelta(days=1), window=15)
    inv = _checkout(_order(env), pos, payments=[_alloc(pos["card"], 6000), _alloc(pos["cash"], 4000)])
    docs = {d.dte_type: d for d in inv.checkout_documents}
    c48, b39 = docs[C48], docs[Invoice.DTEType.BOLETA]
    assert (c48.status, b39.status) == (Invoice.Status.DRAFT, Invoice.Status.DRAFT)
    device = pos["card"].linked_terminal_device
    now = timezone.now()

    def sale(amount, at, payment_type, document_type, n):
        return TerminalSale.objects.create(
            provider=device.provider, device=device, natural_key=f"eng-{n}",
            serial_number=device.serial_number, sale_id=f"ENG{n}", sequence_number=str(n),
            transaction_at=at, status=TerminalSale.Status.COMPLETED, payment_type=payment_type,
            document_type=document_type, sale_amount=Decimal(amount), total_amount=Decimal(amount),
        )

    card = sale(6000, now + timedelta(minutes=2), TerminalSale.PaymentType.DEBIT, 48, 1)
    cash = sale(4000, now - timedelta(minutes=1), TerminalSale.PaymentType.CASH, 39, 2)
    boleta = _rcv(4000, folio=72762)

    counts = run_fiscal_match()

    _reload(c48, b39, card, cash, boleta)
    assert (c48.status, c48.number) == (Invoice.Status.POSTED, "ENG1")
    assert (b39.status, b39.number) == (Invoice.Status.POSTED, "72762")
    assert card.fiscal_match.invoice_id == c48.id
    assert cash.fiscal_match.invoice_id == b39.id
    assert boleta.fiscal_match_id == cash.fiscal_match_id
    assert counts["issued"] == {"issued": 2, "failed": 0}
    g48, g39 = _group_of(c48), _group_of(b39)
    assert (g48.status, g48.erp_state, g48.tuu_state, g48.rcv_state) == (
        FiscalMatchStatus.MATCHED, PartState.MATCHED, PartState.MATCHED, PartState.SUMMARY_ONLY,
    )
    assert (g39.status, g39.erp_state, g39.tuu_state, g39.rcv_state) == (
        FiscalMatchStatus.MATCHED, PartState.MATCHED, PartState.MATCHED, PartState.MATCHED,
    )
    run = FiscalMatchRun.latest_finished()
    assert run is not None and run.error == "" and run.counts == counts


def test_skipped_without_start_date(db):
    set_match_settings(None)
    assert run_fiscal_match() == {"skipped": True}
    assert not FiscalMatchRun.objects.exists()


def test_late_rival_sale_reopens_matched_group_as_ambiguous(tenv):
    inv = make_pos_document(tenv, 6000, _ago(120))
    first = make_terminal_sale(tenv, 6000, _ago(118))
    run_fiscal_match()
    group = _group_of(inv)
    assert group.status == FiscalMatchStatus.MATCHED
    movement = TreasuryMovement.objects.get(invoice=inv)

    rival = make_terminal_sale(tenv, 6000, _ago(117))  # llega tarde en otra sincronización
    _sync_run(tenv)
    run_fiscal_match()

    _reload(group, first, rival)
    assert group.status == FiscalMatchStatus.AMBIGUOUS
    assert group.tuu_state == PartState.AMBIGUOUS
    assert (first.fiscal_match_id, first.matched_movement_id) == (group.id, movement.id)
    assert rival.fiscal_match.invoice_id is None
    assert group.closed_period_alert is False  # sin 48 emitido con ese id TUU

    run_fiscal_match()  # la ambigüedad no se borra en la corrida siguiente

    _reload(group)
    assert group.status == FiscalMatchStatus.AMBIGUOUS


def test_issued_48_link_frozen_with_alert_on_rival(tenv):
    inv = make_pos_document(tenv, 6000, _ago(120), status=Invoice.Status.DRAFT)
    first = make_terminal_sale(tenv, 6000, _ago(118))
    TerminalSale.objects.filter(pk=first.pk).update(sale_id="TUU-77")
    run_fiscal_match()
    _reload(inv)
    assert (inv.status, inv.number) == (Invoice.Status.POSTED, "TUU-77")
    group = _group_of(inv)
    assert group.status == FiscalMatchStatus.MATCHED

    make_terminal_sale(tenv, 6000, _ago(117))
    _sync_run(tenv)
    run_fiscal_match()

    _reload(group, first)
    assert group.status == FiscalMatchStatus.AMBIGUOUS
    assert group.closed_period_alert is True
    assert first.fiscal_match_id == group.id
    assert first.matched_movement_id == TreasuryMovement.objects.get(invoice=inv).id


def test_cancelled_invoice_releases_external_records(tenv):
    inv = make_pos_document(tenv, 9000, _ago(120), dte_type=Invoice.DTEType.FACTURA)
    sale = make_terminal_sale(tenv, 9000, _ago(118), document_type=33)
    run_fiscal_match()
    group = _group_of(inv)
    # El usuario confirma ambos vínculos a mano.
    TerminalSale.objects.filter(pk=sale.pk).update(linked_manually=True)
    doc = _rcv(9000, dte_type=33, group=group)
    FiscalMatch.objects.filter(pk=group.pk).update(rcv_linked_manually=True)
    run_fiscal_match()
    _reload(group)
    assert group.status == FiscalMatchStatus.MATCHED

    Invoice.objects.filter(pk=inv.pk).update(status=Invoice.Status.CANCELLED, updated_at=timezone.now())
    run_fiscal_match()

    _reload(group, sale, doc)
    assert group.status == FiscalMatchStatus.EXCLUDED
    assert group.rcv_linked_manually is False
    assert sale.fiscal_match_id != group.id and doc.fiscal_match_id != group.id
    assert sale.fiscal_match_id != doc.fiscal_match_id
    assert (sale.linked_manually, sale.matched_movement_id) == (False, None)
    for orphan in (sale.fiscal_match, doc.fiscal_match):
        assert orphan.invoice_id is None
        assert orphan.rcv_linked_manually is False
        assert orphan.status == FiscalMatchStatus.MISSING_ERP


def _snapshot():
    return sorted(
        FiscalMatch.objects.values_list("id", "invoice_id", "status", "erp_state", "tuu_state", "rcv_state")
    )


def test_second_run_is_idempotent(tenv):
    make_pos_document(tenv, 6000, _ago(120))
    make_terminal_sale(tenv, 6000, _ago(118))
    make_pos_document(tenv, 4000, _ago(90), dte_type=Invoice.DTEType.BOLETA, method="CASH")
    make_terminal_sale(tenv, 4000, _ago(89), payment_type=TerminalSale.PaymentType.CASH, document_type=39)
    _rcv(4000)
    make_terminal_sale(tenv, 1234, _ago(60))  # huérfana sin documento
    first = run_fiscal_match()
    before = _snapshot()

    second = run_fiscal_match()

    assert first["created"] > 0
    assert second["created"] == 0
    assert _snapshot() == before
    assert FiscalMatchRun.objects.filter(finished_at__isnull=False).count() == 2


def _seed(tenv, n: int, offset: int) -> None:
    for i in range(n):
        at = _ago(200 + offset + i * 3)
        make_pos_document(tenv, 1000 + offset + i, at)
        make_terminal_sale(tenv, 1000 + offset + i, at + timedelta(minutes=1))
        _rcv(500 + offset + i, dte_type=33)


def _queries() -> int:
    with CaptureQueriesContext(connection) as ctx:
        run_fiscal_match()
    return len(ctx.captured_queries)


def test_engine_query_count_constant(tenv, django_assert_max_num_queries):
    run_fiscal_match()  # deja una corrida previa y calienta el singleton
    _seed(tenv, 10, 0)
    small = _queries()
    _seed(tenv, 50, 100)
    with django_assert_max_num_queries(small):
        run_fiscal_match()


def test_failed_run_does_not_advance_change_mark(tenv):
    from unittest.mock import patch

    inv = make_pos_document(tenv, 6000, _ago(120))
    sale = make_terminal_sale(tenv, 6000, _ago(118))
    run_fiscal_match()
    group = _group_of(inv)
    assert group.status == FiscalMatchStatus.MATCHED

    sale.refresh_from_db()
    sale.document_type = 39  # cambia después de la corrida buena (bumps updated_at)
    sale.save()
    with patch("tax.fiscal_match.engine.link_terminal_sales", side_effect=RuntimeError("boom")):
        with pytest.raises(RuntimeError):
            run_fiscal_match()
    assert FiscalMatchRun.objects.filter(error__startswith="RuntimeError").exists()

    run_fiscal_match()

    _reload(group)
    assert group.status == FiscalMatchStatus.DIFF


def test_source_group_of_committed_move_is_reevaluated_after_crash(tenv):
    from unittest.mock import patch

    inv1 = make_pos_document(tenv, 6000, _ago(120))
    sale = make_terminal_sale(tenv, 6000, _ago(118))
    run_fiscal_match()
    run_fiscal_match()  # la marca queda después de la creación de los grupos
    g1 = _group_of(inv1)
    assert g1.status == FiscalMatchStatus.MATCHED

    # El cobro de inv1 deja de calzar y aparece otro documento cuyo cobro sí calza.
    TreasuryMovement.objects.filter(invoice=inv1).update(amount=Decimal(5000))
    inv2 = make_pos_document(tenv, 6000, _ago(117))
    _sync_run(tenv)
    with patch("tax.fiscal_match.engine._evaluate", side_effect=RuntimeError("boom")):
        with pytest.raises(RuntimeError):
            run_fiscal_match()  # el paso TUU ya confirmó el traslado; la evaluación cae
    _reload(sale, g1)
    assert sale.fiscal_match.invoice_id == inv2.id
    assert g1.status == FiscalMatchStatus.MATCHED  # quedó con el estado viejo

    run_fiscal_match()

    _reload(g1)
    assert g1.status != FiscalMatchStatus.MATCHED


def test_sync_ranges_are_merged():
    from datetime import date

    from tax.fiscal_match.engine import _merged_days

    d = date(2026, 11, 10)
    ranges = [(d, d), (d, d + timedelta(days=1)), (d + timedelta(days=2), d + timedelta(days=2)),
              (d + timedelta(days=5), d + timedelta(days=6))]
    assert _merged_days(ranges) == [(d, d + timedelta(days=2)), (d + timedelta(days=5), d + timedelta(days=6))]
