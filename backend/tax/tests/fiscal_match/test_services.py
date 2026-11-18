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
from core.fiscal_match import FiscalMatchStatus, PartState
from tax.fiscal_match import groups
from tax.fiscal_match.candidates import (
    attach_free_payments,
    attach_sale_payments,
    free_inbound_movements,
)
from tax.fiscal_match.engine import run_fiscal_match
from tax.fiscal_match.groups import ensure_groups
from tax.fiscal_match.services import (
    MOVED,
    NOT_COMPLETED,
    OTHER_DIRECTION,
    OTHER_DOCUMENT_PAYMENT,
    PAYMENT_REQUIRED,
    PAYMENT_TAKEN,
    SECOND_DOCUMENT,
    SECOND_RCV,
    TYPE_INCOMPATIBLE,
    FiscalMatchBusy,
    FiscalMatchRuleError,
    apply_changes,
    link_invoice,
    link_rcv_document,
    link_terminal_sale,
    release,
    retry_issue,
)
from tax.models import FiscalMatch
from tax.tasks import FISCAL_MATCH_LOCK_KEY
from tax.tests.fiscal_match_helpers import (
    make_pos_document,
    make_terminal_env,
    make_terminal_sale,
    set_match_settings,
)
from treasury.models import TerminalSale, TreasuryMovement

P = RCVImport.Direction.PURCHASES
SINCE = date(2026, 10, 1)


def unlink(group, part, record_id):
    return apply_changes(group, [{"op": "unlink", "part": part, "id": record_id}])


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

    wrong.refresh_from_db()
    with _rule_error(OTHER_DOCUMENT_PAYMENT):
        link_terminal_sale(group, wrong, other_movement)  # cobro de otro documento
    # Otro monto no bloquea: se une con advertencia (test_apply.py, Ruling C).

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


def test_link_rcv_document_validates_type(imp):
    inv = _purchase("999", 119000)
    good = _rcv(imp, 123, 119000)
    other_type = _rcv(imp, 125, 119000, dte_type=61)
    _ensure()
    group = _group_of(inv)

    with pytest.raises(ValidationError):
        link_rcv_document(group, RCVDocument.objects.get(pk=other_type.pk))

    result = link_rcv_document(group, RCVDocument.objects.get(pk=good.pk))
    good.refresh_from_db()
    assert good.fiscal_match_id == group.id
    assert result.rcv_linked_manually is True






def test_free_inbound_movements_and_sale_payments(tenv):
    inv = make_pos_document(tenv, 6000, _ago(300))
    fits = make_terminal_sale(tenv, 6000, _ago(118))
    other = make_terminal_sale(tenv, 4000, _ago(118))  # monto de ningún pago
    _ensure()
    movement = TreasuryMovement.objects.get(invoice=inv)
    assert [m.id for m in free_inbound_movements(inv)] == [movement.id]

    sales = [TerminalSale.objects.get(pk=fits.pk), TerminalSale.objects.get(pk=other.pk)]
    attach_sale_payments(sales, free_inbound_movements(inv))

    assert [[m.id for m in s.compatible_movements] for s in sales] == [[movement.id], []]


def test_attach_free_payments_exposes_each_free_payment_of_the_sale_amount(tenv):
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

    (candidate,) = [inv]
    attach_free_payments([candidate], sale)

    assert [m.id for m in candidate.compatible_movements] == [first.id, second.id]
    with pytest.raises(ValidationError):
        link_invoice(sale.fiscal_match, inv)  # sin elegir pago
    target = link_invoice(sale.fiscal_match, inv, second)
    sale.refresh_from_db()
    assert sale.fiscal_match_id == target.id and sale.matched_movement_id == second.id




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


def test_link_invoice_accepts_orphan_rcv_of_other_rut(imp):
    """El RUT distinto ya no bloquea (spec §7c): se une y el grupo queda con advertencias."""
    inv = _purchase("999", 119000)
    doc = _rcv(imp, 123, 119000, rut="7777777-7")
    _ensure()
    doc.refresh_from_db()

    target = link_invoice(doc.fiscal_match, inv)

    doc.refresh_from_db()
    assert doc.fiscal_match_id == target.pk
    assert target.status == FiscalMatchStatus.DIFF


def test_link_rejects_ignored_movement(imp, tenv):
    inv = _purchase("999", 119000)
    doc = _rcv(imp, 123, 119000)
    pos = make_pos_document(tenv, 6000, _ago(120))
    _ensure()
    doc.refresh_from_db()
    movement = TreasuryMovement.objects.get(invoice=pos)

    with pytest.raises(ValidationError, match="pago"):
        link_invoice(doc.fiscal_match, inv, movement)  # el huérfano no tiene ventas TUU




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


def test_link_invoice_rejects_orphan_with_reversed_sale(tenv):
    inv = make_pos_document(tenv, 6000, _ago(300))
    sale = make_terminal_sale(tenv, 6000, _ago(118))
    _ensure()
    TerminalSale.objects.filter(pk=sale.pk).update(status=TerminalSale.Status.REVERSED)
    sale.refresh_from_db()

    with pytest.raises(ValidationError, match="no está completada"):
        link_invoice(sale.fiscal_match, inv)


def _rcv_boleta(day, total, folio):
    imp = RCVImport.objects.create(
        direction=RCVImport.Direction.SALES, year=day.year, month=day.month,
        trigger=RCVImport.Trigger.MANUAL, status=RCVImport.Status.SUCCESS,
    )
    return RCVDocument.objects.create(
        direction=RCVImport.Direction.SALES, company_rut="11111111-1", period=f"{day:%Y%m}", dte_type=39,
        folio=folio, counterparty_rut="66666666-6", issue_date=day, total_amount=Decimal(total),
        first_import=imp, last_import=imp,
    )


def _draft_boleta(tenv, total, at):
    return make_pos_document(
        tenv, total, at, dte_type=Invoice.DTEType.BOLETA, method="CASH", status=Invoice.Status.DRAFT
    )


def test_ambiguous_boleta_is_resolved_from_its_orphan_group(tenv):
    """Dos boletas borrador y dos ventas TUU en efectivo iguales: el usuario une desde el huérfano."""
    at = timezone.now().replace(hour=12, minute=0, second=0, microsecond=0) - timedelta(days=1)
    first = _draft_boleta(tenv, 5000, at)
    second = _draft_boleta(tenv, 5000, at + timedelta(minutes=3))
    cash = TerminalSale.PaymentType.CASH
    s1 = make_terminal_sale(tenv, 5000, at + timedelta(minutes=1), payment_type=cash, document_type=39)
    make_terminal_sale(tenv, 5000, at + timedelta(minutes=4), payment_type=cash, document_type=39)
    run_fiscal_match()
    day = timezone.localdate(at)
    _rcv_boleta(day, 5000, 81001)
    _rcv_boleta(day, 5000, 81002)
    run_fiscal_match()
    s1.refresh_from_db()
    orphan = s1.fiscal_match
    assert orphan.invoice_id is None and orphan.status == "AMBIGUOUS"
    assert orphan.rcv_documents.count() == 1

    found = [first, second]
    attach_free_payments(found, orphan.terminal_sales.get())
    assert all(len(i.compatible_movements) == 1 for i in found)
    target = link_invoice(orphan, first, TreasuryMovement.objects.get(invoice=first))
    s1.refresh_from_db()
    assert target.invoice_id == first.id
    assert s1.fiscal_match_id == target.id
    assert target.rcv_documents.count() == 1




# --- reglas bloqueantes de la unión manual (ficha en columnas, spec §7c) ------------


def _rule_error(code: str):
    return pytest.raises(FiscalMatchRuleError, check=lambda e: e.code == code)


def test_rule_error_is_a_validation_error():
    err = FiscalMatchRuleError(TYPE_INCOMPATIBLE)
    assert isinstance(err, ValidationError)
    assert err.code == "TYPE_INCOMPATIBLE" and err.messages and err.messages[0]


def test_tuu_sale_of_other_type_is_type_incompatible(tenv):
    inv = make_pos_document(tenv, 6000, _ago(120))  # comprobante 48
    sale = make_terminal_sale(tenv, 6000, _ago(300), document_type=39)
    _ensure()
    movement = TreasuryMovement.objects.get(invoice=inv)

    with _rule_error(TYPE_INCOMPATIBLE):
        link_terminal_sale(_group_of(inv), TerminalSale.objects.get(pk=sale.pk), movement)
    sale.refresh_from_db()
    with _rule_error(TYPE_INCOMPATIBLE):
        link_invoice(sale.fiscal_match, inv)


def test_tuu_factura_33_fits_factura_33(tenv):
    inv = make_pos_document(tenv, 6000, _ago(120), dte_type=Invoice.DTEType.FACTURA)
    sale = make_terminal_sale(tenv, 6000, _ago(300), document_type=33)
    _ensure()
    result = link_terminal_sale(
        _group_of(inv), TerminalSale.objects.get(pk=sale.pk), TreasuryMovement.objects.get(invoice=inv)
    )
    sale.refresh_from_db()
    assert sale.fiscal_match_id == result.pk


def test_cash_tuu_sale_only_backs_boletas(tenv):
    inv = make_pos_document(tenv, 6000, _ago(120), method="CASH")  # comprobante 48 en efectivo
    sale = make_terminal_sale(
        tenv, 6000, _ago(300), payment_type=TerminalSale.PaymentType.CASH, document_type=None
    )
    _ensure()
    with _rule_error(TYPE_INCOMPATIBLE):
        link_terminal_sale(
            _group_of(inv), TerminalSale.objects.get(pk=sale.pk), TreasuryMovement.objects.get(invoice=inv)
        )


def test_taken_payment_is_payment_taken(tenv):
    inv = make_pos_document(tenv, 6000, _ago(120))
    make_terminal_sale(tenv, 6000, _ago(118))
    rival = make_terminal_sale(tenv, 6000, _ago(300))
    run_fiscal_match()
    rival.refresh_from_db()
    assert rival.fiscal_match.invoice_id is None

    with _rule_error(PAYMENT_TAKEN):
        link_terminal_sale(_group_of(inv), rival, TreasuryMovement.objects.get(invoice=inv))


def test_reversed_sale_is_not_completed(tenv):
    inv = make_pos_document(tenv, 6000, _ago(120))
    sale = make_terminal_sale(tenv, 6000, _ago(300))
    _ensure()
    TerminalSale.objects.filter(pk=sale.pk).update(status=TerminalSale.Status.REVERSED)
    sale.refresh_from_db()
    movement = TreasuryMovement.objects.get(invoice=inv)

    with _rule_error(NOT_COMPLETED):
        link_terminal_sale(_group_of(inv), sale, movement)
    with _rule_error(NOT_COMPLETED):
        link_invoice(sale.fiscal_match, inv)


def test_ambiguous_payment_is_payment_required(tenv):
    inv = make_pos_document(tenv, 6000, _ago(300))
    first = TreasuryMovement.objects.get(invoice=inv)
    TreasuryMovement.objects.create(
        movement_type=TreasuryMovement.Type.INBOUND, payment_method="CARD", payment_method_new=tenv.card,
        amount=Decimal(6000), created_by=tenv.user, contact=tenv.customer, to_account=tenv.cash_account,
        invoice=inv, sale_order=inv.sale_order, pos_session=tenv.session, date=first.date,
    )
    sale = make_terminal_sale(tenv, 6000, _ago(118))
    _ensure()
    sale.refresh_from_db()

    with _rule_error(PAYMENT_REQUIRED):
        link_invoice(sale.fiscal_match, inv)


def test_moved_record_is_moved(imp):
    inv = _purchase("999", 119000)
    other = _purchase("998", 119000)
    doc = _rcv(imp, 123, 119000)
    _ensure()
    stale = RCVDocument.objects.get(pk=doc.pk)
    RCVDocument.objects.filter(pk=doc.pk).update(fiscal_match=_group_of(other))

    with _rule_error(MOVED):
        link_rcv_document(_group_of(inv), stale)


def test_rcv_of_other_type_is_type_incompatible(imp):
    inv = _purchase("999", 119000)
    doc = _rcv(imp, 125, 119000, dte_type=61)
    _ensure()
    with _rule_error(TYPE_INCOMPATIBLE):
        link_rcv_document(_group_of(inv), RCVDocument.objects.get(pk=doc.pk))
    doc.refresh_from_db()
    with _rule_error(TYPE_INCOMPATIBLE):
        link_invoice(doc.fiscal_match, inv)


def test_rcv_of_other_direction_is_other_direction(imp, tenv):
    inv = make_pos_document(tenv, 119000, _ago(120), dte_type=Invoice.DTEType.FACTURA)  # venta 33
    doc = _rcv(imp, 123, 119000)  # compra 33
    _ensure()
    with _rule_error(OTHER_DIRECTION):
        link_rcv_document(_group_of(inv), RCVDocument.objects.get(pk=doc.pk))
    doc.refresh_from_db()
    with _rule_error(OTHER_DIRECTION):
        link_invoice(doc.fiscal_match, inv)


def test_tuu_sale_into_purchase_is_other_direction(imp, tenv):
    inv = _purchase("999", 6000)
    pos = make_pos_document(tenv, 6000, _ago(120))
    sale = make_terminal_sale(tenv, 6000, _ago(300))
    _ensure()
    sale.refresh_from_db()
    with _rule_error(OTHER_DIRECTION):
        link_invoice(sale.fiscal_match, inv)
    with _rule_error(OTHER_DIRECTION):
        link_terminal_sale(_group_of(inv), sale, TreasuryMovement.objects.get(invoice=pos))


def test_group_with_document_is_second_document(imp):
    inv = _purchase("999", 119000)
    other = _purchase("998", 119000)
    _ensure()
    with _rule_error(SECOND_DOCUMENT):
        link_invoice(_group_of(other), inv)


def test_record_of_another_document_is_second_document(imp):
    inv = _purchase("999", 119000)
    other = _purchase("123", 119000)
    doc = _rcv(imp, 123, 119000)
    run_fiscal_match()
    doc.refresh_from_db()
    assert doc.fiscal_match_id == _group_of(other).id

    with _rule_error(SECOND_DOCUMENT):
        link_rcv_document(_group_of(inv), doc)


def test_second_rcv_in_factura_is_second_rcv(imp):
    inv = _purchase("123", 119000)
    _rcv(imp, 123, 119000)
    extra = _rcv(imp, 124, 119000)
    run_fiscal_match()
    group = _group_of(inv)
    assert group.rcv_documents.count() == 1
    extra.refresh_from_db()

    with _rule_error(SECOND_RCV):
        link_rcv_document(group, extra)
    with _rule_error(SECOND_RCV):
        link_invoice(extra.fiscal_match, inv)


def test_boleta_rcv_accumulate(tenv):
    at = timezone.now().replace(hour=12, minute=0, second=0, microsecond=0) - timedelta(days=1)
    draft = _draft_boleta(tenv, 5000, at)
    day = timezone.localdate(at)
    first = _rcv_boleta(day, 5000, 83001)
    second = _rcv_boleta(day, 5000, 83002)
    _ensure()
    first.refresh_from_db()
    target = link_invoice(first.fiscal_match, draft)
    second.refresh_from_db()

    result = link_rcv_document(target, second)

    assert result.rcv_documents.count() == 2


def test_other_rut_invoice_links_and_group_is_diff(imp):
    inv = _purchase("999", 119000)
    doc = _rcv(imp, 124, 119000, rut="7777777-7")
    _ensure()

    result = link_rcv_document(_group_of(inv), RCVDocument.objects.get(pk=doc.pk))

    doc.refresh_from_db()
    assert doc.fiscal_match_id == result.pk
    assert result.status == FiscalMatchStatus.DIFF
