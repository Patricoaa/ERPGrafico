"""ERP ↔ TUU por pago: cada venta TUU se une al cobro (TreasuryMovement) que respalda."""

from datetime import date, datetime, timedelta
from decimal import Decimal

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from accounting.models import RCVDocument, RCVImport, RCVSettings
from billing.models import Invoice
from tax.fiscal_match.candidates import LinkResult, local_midnight
from tax.fiscal_match.groups import ensure_groups
from tax.fiscal_match.terminal import link_terminal_sales
from tax.models import FiscalMatch
from tax.tests.reconciliation_helpers import (
    TerminalEnv,
    local_dt,
    make_pos_document,
    make_terminal_env,
    make_terminal_sale,
    set_match_settings,
)
from treasury.models import TerminalSale, TreasuryMovement

SINCE = date(2026, 11, 1)
DAY = date(2026, 11, 10)
T0 = local_dt(2026, 11, 10, 12, 0)


@pytest.fixture
def env(db):
    set_match_settings(SINCE, window=15)
    return make_terminal_env()


def _range(day: date = DAY) -> tuple[datetime, datetime]:
    return local_midnight(day), local_midnight(day + timedelta(days=1))


def run(day: date = DAY, rematch_ids: set[int] | None = None) -> LinkResult:
    ensure_groups(SINCE)
    lo, hi = _range(day)
    return link_terminal_sales(lo, hi, rematch_ids=rematch_ids or set())


def _reload(*objs):
    for o in objs:
        o.refresh_from_db()


def _movement(invoice: Invoice) -> TreasuryMovement:
    return TreasuryMovement.objects.get(invoice=invoice)


def _payment(env: TerminalEnv, invoice: Invoice, amount: int, at: datetime, *, method: str = "CARD"):
    """Cobro adicional de ``invoice`` en la sesión POS de ``env``."""
    m = TreasuryMovement.objects.create(
        movement_type=TreasuryMovement.Type.INBOUND,
        payment_method=method,
        payment_method_new=env.card if method == "CARD" else env.cash,
        amount=Decimal(amount), created_by=env.user, contact=env.customer,
        to_account=env.cash_account, invoice=invoice, sale_order=invoice.sale_order,
        pos_session=env.session, date=at.date(),
    )
    TreasuryMovement.objects.filter(pk=m.pk).update(created_at=at)
    return m


def _split_factura(env: TerminalEnv, first: int, second: int, *, second_method: str = "CARD"):
    """Factura por ``first + second`` cobrada en dos pagos."""
    inv = make_pos_document(env, first + second, T0, dte_type=Invoice.DTEType.FACTURA)
    m1 = _movement(inv)
    TreasuryMovement.objects.filter(pk=m1.pk).update(amount=Decimal(first))
    m2 = _payment(env, inv, second, T0 + timedelta(minutes=1), method=second_method)
    return inv, m1, m2


def _rcv(folio: int, issue: date) -> RCVDocument:
    imp = RCVImport.objects.create(
        direction=RCVImport.Direction.SALES, year=issue.year, month=issue.month,
        trigger=RCVImport.Trigger.MANUAL,
    )
    return RCVDocument.objects.create(
        first_import=imp, last_import=imp, direction=RCVImport.Direction.SALES,
        company_rut="76.000.000-0", period=f"{issue:%Y%m}", dte_type=39, folio=folio,
        counterparty_rut="66.666.666-6", issue_date=issue, total_amount=Decimal(6000),
    )


def _into_group(rcv: RCVDocument, group_id: int) -> None:
    """Simula el paso TUU ↔ RCV: la boleta comparte el grupo de la venta."""
    own = rcv.fiscal_match_id
    RCVDocument.objects.filter(pk=rcv.pk).update(fiscal_match_id=group_id)
    FiscalMatch.objects.filter(pk=own).delete()


def test_single_payment_links_sale_to_invoice_group(env):
    inv = make_pos_document(env, 6000, T0)
    sale = make_terminal_sale(env, 6000, T0 + timedelta(minutes=3))
    ensure_groups(SINCE)
    sale.refresh_from_db()
    orphan_id = sale.fiscal_match_id

    result = run()

    _reload(sale)
    group = FiscalMatch.objects.get(invoice=inv)
    assert sale.fiscal_match_id == group.id
    assert sale.matched_movement_id == _movement(inv).id
    assert not FiscalMatch.objects.filter(pk=orphan_id).exists()
    assert result == LinkResult(1)


def test_factura_two_card_payments_links_both_sales(env):
    inv, m1, m2 = _split_factura(env, 50_000, 30_000)
    a = make_terminal_sale(env, 50_000, T0 + timedelta(minutes=2), document_type=33)
    b = make_terminal_sale(env, 30_000, T0 + timedelta(minutes=3), document_type=33)

    result = run()

    _reload(a, b)
    group = FiscalMatch.objects.get(invoice=inv)
    assert a.fiscal_match_id == b.fiscal_match_id == group.id
    assert a.matched_movement_id == m1.id
    assert b.matched_movement_id == m2.id
    assert result.linked == 2 and result.ambiguous_group_ids == set()
    assert FiscalMatch.objects.count() == 1


def test_factura_card_plus_cash_links_card_sale_only(env):
    inv, card, cash = _split_factura(env, 50_000, 30_000, second_method="CASH")
    sale = make_terminal_sale(env, 50_000, T0 + timedelta(minutes=2), document_type=33)

    result = run()

    _reload(sale)
    assert sale.fiscal_match.invoice_id == inv.id
    assert sale.matched_movement_id == card.id
    assert not TerminalSale.objects.filter(matched_movement=cash).exists()
    assert result == LinkResult(1)


def test_amount_compared_against_payment_not_invoice_total(env):
    """Una venta por el total de una factura pagada en dos cobros no calza con ninguno."""
    _split_factura(env, 50_000, 30_000)
    sale = make_terminal_sale(env, 80_000, T0 + timedelta(minutes=2), document_type=33)

    result = run()

    _reload(sale)
    assert sale.fiscal_match.invoice_id is None
    assert sale.matched_movement_id is None
    assert result == LinkResult(0)


def test_two_movements_same_amount_in_window_is_ambiguous(env):
    make_pos_document(env, 5000, T0)
    make_pos_document(env, 5000, T0 + timedelta(minutes=1))
    a = make_terminal_sale(env, 5000, T0 + timedelta(minutes=2))
    b = make_terminal_sale(env, 5000, T0 + timedelta(minutes=4))

    result = run()

    _reload(a, b)
    assert a.fiscal_match.invoice_id is None and b.fiscal_match.invoice_id is None
    assert a.matched_movement_id is None and b.matched_movement_id is None
    assert result.linked == 0
    assert result.ambiguous_group_ids == {a.fiscal_match_id, b.fiscal_match_id}


def test_border_competitor_makes_ambiguous(env):
    make_pos_document(env, 6000, local_dt(2026, 11, 9, 23, 55))
    a = make_terminal_sale(env, 6000, local_dt(2026, 11, 9, 23, 58))
    b = make_terminal_sale(env, 6000, local_dt(2026, 11, 10, 0, 2))

    result = run()

    _reload(a, b)
    assert b.fiscal_match.invoice_id is None and b.matched_movement_id is None
    assert result.ambiguous_group_ids == {b.fiscal_match_id}
    assert a.matched_movement_id is None  # fuera del rango: no se escribe


def test_outside_window_or_other_device_stays_orphan(env):
    other = make_terminal_env()
    make_pos_document(env, 6000, T0)
    make_pos_document(other, 7000, T0)
    late = make_terminal_sale(env, 6000, T0 + timedelta(minutes=16))
    wrong_device = make_terminal_sale(env, 7000, T0)

    result = run()

    _reload(late, wrong_device)
    assert late.fiscal_match.invoice_id is None
    assert wrong_device.fiscal_match.invoice_id is None
    assert result == LinkResult(0)


def test_manual_link_not_touched(env):
    inv = make_pos_document(env, 6000, T0)
    ensure_groups(SINCE)
    group = FiscalMatch.objects.get(invoice=inv)
    manual = make_terminal_sale(
        env, 6000, T0 + timedelta(minutes=1), fiscal_match=group,
        matched_movement=_movement(inv), linked_manually=True,
    )
    other = make_terminal_sale(env, 6000, T0 + timedelta(minutes=2))

    result = run(rematch_ids={group.id})

    _reload(manual, other)
    assert manual.fiscal_match_id == group.id
    assert manual.matched_movement_id == _movement(inv).id
    # El cobro ya está tomado: la otra venta no compite ni queda ambigua.
    assert other.fiscal_match.invoice_id is None
    assert result == LinkResult(0)


def test_rematch_still_unique_changes_nothing(env):
    inv = make_pos_document(env, 6000, T0)
    sale = make_terminal_sale(env, 6000, T0 + timedelta(minutes=1))
    run()
    group = FiscalMatch.objects.get(invoice=inv)

    result = run(rematch_ids={group.id})

    _reload(sale)
    assert sale.fiscal_match_id == group.id
    assert sale.matched_movement_id == _movement(inv).id
    assert result == LinkResult(0)


def test_rematch_now_ambiguous_keeps_link(env):
    inv = make_pos_document(env, 6000, T0)
    sale = make_terminal_sale(env, 6000, T0 + timedelta(minutes=1))
    run()
    group = FiscalMatch.objects.get(invoice=inv)
    rival = make_terminal_sale(env, 6000, T0 + timedelta(minutes=2))

    result = run(rematch_ids={group.id})

    _reload(sale, rival)
    assert sale.fiscal_match_id == group.id
    assert sale.matched_movement_id == _movement(inv).id
    assert rival.fiscal_match.invoice_id is None
    assert result.ambiguous_group_ids == {group.id, rival.fiscal_match_id}


def test_orphan_rcv_moves_with_sale(env):
    inv = make_pos_document(env, 6000, T0, dte_type=Invoice.DTEType.BOLETA, method="CASH")
    sale = make_terminal_sale(env, 6000, T0, payment_type=TerminalSale.PaymentType.CASH, document_type=39)
    rcv = _rcv(500, DAY)
    ensure_groups(SINCE)
    _reload(sale, rcv)
    orphan_id = sale.fiscal_match_id
    _into_group(rcv, orphan_id)

    run()

    _reload(sale, rcv)
    group = FiscalMatch.objects.get(invoice=inv)
    assert sale.fiscal_match_id == rcv.fiscal_match_id == group.id
    assert not FiscalMatch.objects.filter(pk=orphan_id).exists()


def test_invoice_group_with_rcv_keeps_orphan_rcv_apart(env):
    inv = make_pos_document(env, 6000, T0)
    sale = make_terminal_sale(env, 6000, T0)
    own_rcv, orphan_rcv = _rcv(501, DAY), _rcv(502, DAY)
    ensure_groups(SINCE)
    _reload(sale, own_rcv, orphan_rcv)
    group = FiscalMatch.objects.get(invoice=inv)
    _into_group(own_rcv, group.id)
    orphan_id = sale.fiscal_match_id
    _into_group(orphan_rcv, orphan_id)

    run()

    _reload(sale, own_rcv, orphan_rcv)
    assert sale.fiscal_match_id == own_rcv.fiscal_match_id == group.id
    assert orphan_rcv.fiscal_match_id == orphan_id
    assert FiscalMatch.objects.filter(pk=orphan_id).exists()


def test_invoice_without_group_skips_sale(env):
    inv = make_pos_document(env, 6000, T0)
    sale = make_terminal_sale(env, 6000, T0)
    ensure_groups(SINCE)
    FiscalMatch.objects.filter(invoice=inv).delete()
    lo, hi = _range()

    result = link_terminal_sales(lo, hi, rematch_ids=set())

    _reload(sale)
    assert sale.fiscal_match.invoice_id is None
    assert sale.matched_movement_id is None
    assert result == LinkResult(0)


def test_no_start_date_does_nothing(env):
    make_pos_document(env, 6000, T0)
    sale = make_terminal_sale(env, 6000, T0)
    ensure_groups(SINCE)
    set_match_settings(None)
    lo, hi = _range()

    assert link_terminal_sales(lo, hi, rematch_ids=set()) == LinkResult(0)
    _reload(sale)
    assert sale.matched_movement_id is None


def _populate(env: TerminalEnv, day: date, n: int) -> None:
    for i in range(n):
        at = local_dt(day.year, day.month, day.day, 9 + i)
        make_pos_document(env, 1000 + i, at)
        make_terminal_sale(env, 1000 + i, at + timedelta(minutes=1))
        rcv = _rcv(day.day * 100 + i, day)
        ensure_groups(SINCE)
        _reload(rcv)
        sale = TerminalSale.objects.get(sale_amount=1000 + i, transaction_at=at + timedelta(minutes=1))
        _into_group(rcv, sale.fiscal_match_id)


def _queries(day: date) -> tuple[int, LinkResult]:
    lo, hi = _range(day)
    RCVSettings.get_settings()  # la caché de ajustes no cuenta como consulta por fila
    with CaptureQueriesContext(connection) as ctx:
        result = link_terminal_sales(lo, hi, rematch_ids=set())
    return len(ctx.captured_queries), result


def test_query_count_constant(env):
    small, large = date(2026, 11, 3), date(2026, 11, 5)
    _populate(env, small, 1)
    _populate(env, large, 6)

    few, r1 = _queries(small)
    many, r6 = _queries(large)

    assert r1.linked == 1 and r6.linked == 6
    assert many == few
