"""Unión manual del cuadre: vincular, quitar, devolver al cruce automático (spec §5.5)."""

from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch

import pytest
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.utils import timezone

from accounting.models import RCVDocument, RCVImport
from billing.models import Invoice
from core.fiscal_match import PartState
from tax.fiscal_match import groups
from tax.fiscal_match.engine import run_fiscal_match
from tax.fiscal_match.groups import ensure_groups
from tax.fiscal_match.services import (
    FiscalMatchBusy,
    group_candidates,
    link,
    link_invoice,
    link_rcv_document,
    link_terminal_sale,
    release,
    retry_issue,
    unlink,
)
from tax.models import FiscalMatch
from tax.tasks import FISCAL_MATCH_LOCK_KEY
from tax.tests.reconciliation_helpers import (
    make_pos_document,
    make_terminal_env,
    make_terminal_sale,
    set_match_settings,
)
from treasury.models import TerminalSale, TreasuryMovement

P = RCVImport.Direction.PURCHASES
SINCE = date(2026, 10, 1)


@pytest.fixture
def tenv(db):
    set_match_settings(timezone.localdate() - timedelta(days=5), window=15)
    return make_terminal_env()


@pytest.fixture
def imp(db):
    set_match_settings(SINCE)
    return RCVImport.objects.create(
        direction=P, year=2026, month=10, trigger=RCVImport.Trigger.MANUAL, status=RCVImport.Status.SUCCESS
    )


def _ago(minutes: int):
    return timezone.now() - timedelta(minutes=minutes)


def _ensure():
    ensure_groups(date(2000, 1, 1))


def _group_of(invoice: Invoice) -> FiscalMatch:
    return FiscalMatch.objects.get(invoice=invoice)


def _rcv(imp, folio, total, *, rut="8973356-K", dte_type=33):
    return RCVDocument.objects.create(
        direction=P, company_rut="11111111-1", period="202610", dte_type=dte_type, folio=folio,
        counterparty_rut=rut, issue_date=date(2026, 10, 15), total_amount=Decimal(total),
        first_import=imp, last_import=imp,
    )


def _purchase(number, total, *, rut="8.973.356-k"):
    return Invoice.objects.create(
        dte_type=Invoice.DTEType.PURCHASE_INV, status=Invoice.Status.POSTED, number=number,
        partner_tax_id_snapshot=rut, total=Decimal(total), date=date(2026, 10, 12),
    )


def test_link_terminal_sale_requires_matching_movement(tenv):
    inv = make_pos_document(tenv, 6000, _ago(120))
    other = make_pos_document(tenv, 5000, _ago(100))
    wrong = make_terminal_sale(tenv, 5000, _ago(118))
    sale = make_terminal_sale(tenv, 6000, _ago(118))
    _ensure()
    group = _group_of(inv)
    movement = TreasuryMovement.objects.get(invoice=inv)
    other_movement = TreasuryMovement.objects.get(invoice=other)

    with pytest.raises(ValidationError):
        link_terminal_sale(group, wrong, movement)  # monto distinto
    with pytest.raises(ValidationError):
        link_terminal_sale(group, wrong, other_movement)  # cobro de otro documento

    orphan_id = TerminalSale.objects.get(pk=sale.pk).fiscal_match_id
    result = link_terminal_sale(group, TerminalSale.objects.get(pk=sale.pk), movement)

    sale.refresh_from_db()
    assert result.pk == group.pk
    assert (sale.fiscal_match_id, sale.matched_movement_id, sale.linked_manually) == (group.id, movement.id, True)
    assert not FiscalMatch.objects.filter(pk=orphan_id).exists()
    assert result.tuu_state == PartState.MATCHED

    rival = make_terminal_sale(tenv, 6000, _ago(117))
    _ensure()
    with pytest.raises(ValidationError):
        link_terminal_sale(group, TerminalSale.objects.get(pk=rival.pk), movement)  # cobro ya tomado


def test_unlink_then_engine_does_not_relink(tenv):
    inv = make_pos_document(tenv, 6000, _ago(120))
    sale = make_terminal_sale(tenv, 6000, _ago(118))
    run_fiscal_match()
    group = _group_of(inv)
    sale.refresh_from_db()
    assert sale.fiscal_match_id == group.id

    unlink(group, "tuu", sale.id)

    sale.refresh_from_db()
    orphan = sale.fiscal_match
    assert orphan.invoice_id is None
    assert (sale.linked_manually, sale.matched_movement_id) == (True, None)

    run_fiscal_match()

    sale.refresh_from_db()
    assert sale.fiscal_match_id == orphan.id
    assert FiscalMatch.objects.get(pk=orphan.pk).invoice_id is None


def test_unlink_rcv_then_engine_does_not_relink(imp):
    inv = _purchase("000123", 119000)
    doc = _rcv(imp, 123, 119000)
    run_fiscal_match()
    group = _group_of(inv)
    doc.refresh_from_db()
    assert doc.fiscal_match_id == group.id

    unlink(group, "rcv", doc.id)

    doc.refresh_from_db()
    orphan = doc.fiscal_match
    assert (orphan.invoice_id, orphan.rcv_linked_manually) == (None, True)
    group.refresh_from_db()
    assert group.rcv_linked_manually is False

    run_fiscal_match()

    doc.refresh_from_db()
    assert doc.fiscal_match_id == orphan.id


def test_release_allows_relink(tenv):
    inv = make_pos_document(tenv, 6000, _ago(120))
    sale = make_terminal_sale(tenv, 6000, _ago(118))
    run_fiscal_match()
    group = _group_of(inv)
    unlink(group, "tuu", sale.id)
    sale.refresh_from_db()

    released = release(sale.fiscal_match)

    sale.refresh_from_db()
    assert released.pk == sale.fiscal_match_id
    assert sale.linked_manually is False
    run_fiscal_match()
    sale.refresh_from_db()
    assert sale.fiscal_match_id == group.id

    with pytest.raises(ValidationError):
        release(group)  # solo huérfanos


def test_link_invoice_moves_orphan_sale_with_its_payment(tenv):
    inv = make_pos_document(tenv, 6000, _ago(300))
    sale = make_terminal_sale(tenv, 6000, _ago(118))  # fuera de la ventana: el motor no la une
    _ensure()
    sale.refresh_from_db()
    orphan = sale.fiscal_match

    target = link_invoice(orphan, inv)

    sale.refresh_from_db()
    movement = TreasuryMovement.objects.get(invoice=inv)
    assert target.pk == _group_of(inv).pk
    assert (sale.fiscal_match_id, sale.matched_movement_id, sale.linked_manually) == (target.pk, movement.id, True)
    assert not FiscalMatch.objects.filter(pk=orphan.pk).exists()


def test_link_invoice_requires_payment_when_ambiguous(tenv):
    inv = make_pos_document(tenv, 6000, _ago(300))
    first = TreasuryMovement.objects.get(invoice=inv)
    second = TreasuryMovement.objects.create(
        movement_type=TreasuryMovement.Type.INBOUND, payment_method="CARD", payment_method_new=tenv.card,
        amount=Decimal(6000), created_by=tenv.user, contact=tenv.customer, to_account=tenv.cash_account,
        invoice=inv, sale_order=inv.sale_order, pos_session=tenv.session, date=first.date,
    )
    sale = make_terminal_sale(tenv, 6000, _ago(118))
    _ensure()
    sale.refresh_from_db()

    with pytest.raises(ValidationError, match="Indique el pago"):
        link_invoice(sale.fiscal_match, inv)

    target = link_invoice(sale.fiscal_match, inv, second)
    sale.refresh_from_db()
    assert (sale.fiscal_match_id, sale.matched_movement_id) == (target.pk, second.pk)


def test_link_invoice_moves_orphan_rcv(imp):
    inv = _purchase("999", 119000)  # otro folio: el motor no lo une por clave
    doc = _rcv(imp, 123, 119000)
    _ensure()
    doc.refresh_from_db()

    target = link_invoice(doc.fiscal_match, inv)

    doc.refresh_from_db()
    assert doc.fiscal_match_id == target.pk
    assert target.rcv_linked_manually is True


def test_link_rcv_document_validates_type_and_rut(imp):
    inv = _purchase("999", 119000)
    good = _rcv(imp, 123, 119000)
    other_rut = _rcv(imp, 124, 119000, rut="7777777-7")
    other_type = _rcv(imp, 125, 119000, dte_type=61)
    _ensure()
    group = _group_of(inv)

    for bad in (other_rut, other_type):
        with pytest.raises(ValidationError):
            link_rcv_document(group, RCVDocument.objects.get(pk=bad.pk))

    assert [d.id for d in group_candidates(group, "rcv")] == [good.id]
    result = link_rcv_document(group, RCVDocument.objects.get(pk=good.pk))
    good.refresh_from_db()
    assert good.fiscal_match_id == group.id
    assert result.rcv_linked_manually is True


def test_tuu_candidates_list_compatible_payments(tenv):
    inv = make_pos_document(tenv, 6000, _ago(300))
    fits = make_terminal_sale(tenv, 6000, _ago(118))
    make_terminal_sale(tenv, 4000, _ago(118))  # monto de ningún pago
    _ensure()
    movement = TreasuryMovement.objects.get(invoice=inv)

    found = group_candidates(_group_of(inv), "tuu")

    assert [(s.id, [m.id for m in s.compatible_movements]) for s in found] == [(fits.id, [movement.id])]
    with pytest.raises(ValidationError):
        group_candidates(_group_of(inv), "erp")


def test_erp_candidates_for_orphan_sale(tenv):
    inv = make_pos_document(tenv, 6000, _ago(300))
    make_pos_document(tenv, 4000, _ago(300))  # otro monto
    sale = make_terminal_sale(tenv, 6000, _ago(118))
    _ensure()
    sale.refresh_from_db()

    found = group_candidates(sale.fiscal_match, "erp")
    assert [i.id for i in found] == [inv.id]
    assert [m.id for m in found[0].compatible_movements] == [TreasuryMovement.objects.get(invoice=inv).id]


def test_erp_candidates_expose_each_free_payment_of_the_sale_amount(tenv):
    """Dos cobros libres del mismo monto: el usuario debe elegir; el candidato trae ambos."""
    inv = make_pos_document(tenv, 6000, _ago(300))
    first = TreasuryMovement.objects.get(invoice=inv)
    second = TreasuryMovement.objects.create(
        movement_type=TreasuryMovement.Type.INBOUND, payment_method="CASH", amount=Decimal(6000),
        created_by=tenv.user, contact=tenv.customer, to_account=tenv.cash_account, invoice=inv,
        sale_order=inv.sale_order, pos_session=tenv.session, date=first.date,
    )
    sale = make_terminal_sale(tenv, 6000, _ago(118))
    _ensure()
    sale.refresh_from_db()

    (candidate,) = group_candidates(sale.fiscal_match, "erp")

    assert [m.id for m in candidate.compatible_movements] == [first.id, second.id]
    with pytest.raises(ValidationError):
        link_invoice(sale.fiscal_match, inv)  # sin elegir pago
    target = link_invoice(sale.fiscal_match, inv, second)
    sale.refresh_from_db()
    assert sale.fiscal_match_id == target.id and sale.matched_movement_id == second.id


def test_erp_candidates_without_sale_have_no_payments(imp):
    inv = _purchase("999", 119000)
    doc = _rcv(imp, 999, 119000)
    _ensure()
    doc.refresh_from_db()
    found = group_candidates(doc.fiscal_match, "erp")
    assert [i.id for i in found] == [inv.id] and found[0].compatible_movements == []


def test_retry_issue_requires_pending_draft(tenv):
    inv = make_pos_document(tenv, 6000, _ago(120))
    _ensure()
    with pytest.raises(ValidationError):
        retry_issue(_group_of(inv))  # ya emitido


# --- ronda de revisión 1 ------------------------------------------------------------


@pytest.fixture
def no_lock():
    cache.delete(FISCAL_MATCH_LOCK_KEY)
    yield
    cache.delete(FISCAL_MATCH_LOCK_KEY)


def test_manual_service_fails_fast_while_engine_runs(tenv, no_lock):
    inv = make_pos_document(tenv, 6000, _ago(120))
    sale = make_terminal_sale(tenv, 6000, _ago(118))
    run_fiscal_match()
    group = _group_of(inv)
    cache.add(FISCAL_MATCH_LOCK_KEY, "engine", timeout=540)

    with pytest.raises(FiscalMatchBusy, match="El cuadre automático se está ejecutando"):
        unlink(group, "tuu", sale.id)

    sale.refresh_from_db()
    assert (sale.fiscal_match_id, sale.linked_manually) == (group.id, False)
    assert cache.get(FISCAL_MATCH_LOCK_KEY) == "engine"  # no suelta el candado ajeno


def test_manual_service_releases_its_lock(tenv, no_lock):
    inv = make_pos_document(tenv, 6000, _ago(120))
    sale = make_terminal_sale(tenv, 6000, _ago(118))
    run_fiscal_match()
    unlink(_group_of(inv), "tuu", sale.id)
    assert cache.get(FISCAL_MATCH_LOCK_KEY) is None


def test_link_terminal_sale_rejects_moved_sale(tenv):
    inv = make_pos_document(tenv, 6000, _ago(300))
    other = make_pos_document(tenv, 6000, _ago(290))
    sale = make_terminal_sale(tenv, 6000, _ago(118))
    _ensure()
    stale = TerminalSale.objects.get(pk=sale.pk)
    orphan_id = stale.fiscal_match_id
    # Mientras tanto otra acción la movió al documento ``other``.
    TerminalSale.objects.filter(pk=sale.pk).update(fiscal_match=_group_of(other))
    movement = TreasuryMovement.objects.get(invoice=inv)

    with pytest.raises(ValidationError, match="cambió de grupo"):
        link_terminal_sale(_group_of(inv), stale, movement)

    sale.refresh_from_db()
    assert sale.fiscal_match_id == _group_of(other).id
    assert FiscalMatch.objects.filter(pk=orphan_id).exists()


def test_link_rcv_document_rejects_moved_doc(imp):
    inv = _purchase("999", 119000)
    other = _purchase("998", 119000)
    doc = _rcv(imp, 123, 119000)
    _ensure()
    stale = RCVDocument.objects.get(pk=doc.pk)
    RCVDocument.objects.filter(pk=doc.pk).update(fiscal_match=_group_of(other))

    with pytest.raises(ValidationError, match="cambió de grupo"):
        link_rcv_document(_group_of(inv), stale)

    doc.refresh_from_db()
    assert doc.fiscal_match_id == _group_of(other).id


def test_link_invoice_checks_orphan_rcv_type_and_rut(imp):
    inv = _purchase("999", 119000)
    doc = _rcv(imp, 123, 119000, rut="7777777-7")
    _ensure()
    doc.refresh_from_db()

    with pytest.raises(ValidationError, match="otro RUT"):
        link_invoice(doc.fiscal_match, inv)


def test_link_rejects_ignored_movement(imp, tenv):
    inv = _purchase("999", 119000)
    doc = _rcv(imp, 123, 119000)
    pos = make_pos_document(tenv, 6000, _ago(120))
    _ensure()
    doc.refresh_from_db()
    movement = TreasuryMovement.objects.get(invoice=pos)

    with pytest.raises(ValidationError, match="pago"):
        link_invoice(doc.fiscal_match, inv, movement)  # el huérfano no tiene ventas TUU
    with pytest.raises(ValidationError, match="pago"):
        link(_group_of(inv), "rcv", doc.id, movement.id)


def test_link_missing_record_is_validation_error(tenv):
    inv = make_pos_document(tenv, 6000, _ago(120))
    _ensure()
    with pytest.raises(ValidationError, match="no existe"):
        link(_group_of(inv), "tuu", 999999, 999999)


def test_retry_issue_without_candidates(tenv):
    inv = make_pos_document(tenv, 6000, _ago(120), status=Invoice.Status.DRAFT)
    _ensure()
    with pytest.raises(ValidationError, match="No hay nada para emitir en este grupo."):
        retry_issue(_group_of(inv))


def test_group_for_invoice_survives_concurrent_create(imp):
    inv = _purchase("999", 119000)
    real = groups._group_of_invoice
    calls = []

    def racing(invoice):
        calls.append(invoice.pk)
        if len(calls) == 1:
            ensure_groups(date(2000, 1, 1))  # otro proceso crea el grupo entre la lectura y el INSERT
            return None
        return real(invoice)

    with patch.object(groups, "_group_of_invoice", side_effect=racing):
        group = groups.group_for_invoice(inv)

    assert group.pk == _group_of(inv).pk
    assert FiscalMatch.objects.filter(invoice=inv).count() == 1
