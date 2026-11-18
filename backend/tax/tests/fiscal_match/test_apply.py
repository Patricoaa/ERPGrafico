"""Guardado atómico de la ficha de cuadre en columnas (spec §5.3, §7b, §7c)."""

from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.core.cache import cache
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from accounting.models import RCVDocument, RCVImport
from billing.models import Invoice
from core.fiscal_match import PartState
from tax.fiscal_match.groups import ensure_groups
from tax.fiscal_match.services import (
    MOVED,
    NOT_ALLOWED,
    OTHER_DOCUMENT_PAYMENT,
    PAYMENT_REQUIRED,
    TYPE_INCOMPATIBLE,
    FiscalMatchBusy,
    FiscalMatchRuleError,
    apply_changes,
    link_invoice,
    link_terminal_sale,
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


@pytest.fixture
def tenv(db):
    set_match_settings(timezone.localdate() - timedelta(days=5), window=15)
    cache.delete(FISCAL_MATCH_LOCK_KEY)
    yield make_terminal_env()
    cache.delete(FISCAL_MATCH_LOCK_KEY)


def _at():
    return timezone.now().replace(hour=12, minute=0, second=0, microsecond=0) - timedelta(days=1)


def _ensure():
    ensure_groups(date(2000, 1, 1))


def _group_of(invoice: Invoice) -> FiscalMatch:
    return FiscalMatch.objects.get(invoice=invoice)


def _orphan_of(record) -> FiscalMatch:
    record.refresh_from_db()
    return record.fiscal_match


def _payment(tenv, invoice: Invoice, amount: int, *, method: str = "CARD") -> TreasuryMovement:
    return TreasuryMovement.objects.create(
        movement_type=TreasuryMovement.Type.INBOUND,
        payment_method=method,
        payment_method_new=tenv.card if method == "CARD" else tenv.cash,
        amount=Decimal(amount),
        created_by=tenv.user,
        contact=tenv.customer,
        to_account=tenv.cash_account,
        invoice=invoice,
        sale_order=invoice.sale_order,
        pos_session=tenv.session,
        date=invoice.date,
    )


def _rcv_boleta(day, total, folio, *, dte_type=39):
    imp = RCVImport.objects.create(
        direction=RCVImport.Direction.SALES,
        year=day.year,
        month=day.month,
        trigger=RCVImport.Trigger.MANUAL,
        status=RCVImport.Status.SUCCESS,
    )
    return RCVDocument.objects.create(
        direction=RCVImport.Direction.SALES,
        company_rut="11111111-1",
        period=f"{day:%Y%m}",
        dte_type=dte_type,
        folio=folio,
        counterparty_rut="66666666-6",
        issue_date=day,
        total_amount=Decimal(total),
        first_import=imp,
        last_import=imp,
    )


def _rule_error(code: str, index: int | None = None):
    return pytest.raises(
        FiscalMatchRuleError, check=lambda e: e.code == code and e.change_index == index
    )


def _boleta(tenv, total: int, at):
    return make_pos_document(tenv, total, at, dte_type=Invoice.DTEType.BOLETA)


def test_apply_links_erp_tuu_rcv_in_one_call(tenv):
    at = _at()
    inv = _boleta(tenv, 6000, at)
    m1 = TreasuryMovement.objects.get(invoice=inv)
    m2 = _payment(tenv, inv, 4000)
    own = make_terminal_sale(tenv, 6000, at + timedelta(hours=3), document_type=39)
    extra = make_terminal_sale(tenv, 4000, at + timedelta(hours=4), document_type=39)
    doc = _rcv_boleta(timezone.localdate(at), 6000, 91001)
    _ensure()
    orphan = _orphan_of(own)

    # Desordenados a propósito: el servicio aplica ERP, luego TUU y RCV.
    result = apply_changes(
        orphan,
        [
            {"op": "link", "part": "rcv", "id": doc.pk},
            {"op": "link", "part": "tuu", "id": extra.pk, "movement": m2.pk},
            {"op": "link", "part": "erp", "id": inv.pk},
        ],
    )

    assert result.pk == _group_of(inv).pk
    own.refresh_from_db()
    extra.refresh_from_db()
    doc.refresh_from_db()
    assert (own.fiscal_match_id, own.matched_movement_id) == (result.pk, m1.pk)
    assert (extra.fiscal_match_id, extra.matched_movement_id) == (result.pk, m2.pk)
    assert doc.fiscal_match_id == result.pk
    assert not FiscalMatch.objects.filter(pk=orphan.pk).exists()
    assert result.tuu_state == PartState.MATCHED


def test_apply_rolls_back_all_when_one_fails(tenv):
    at = _at()
    inv = _boleta(tenv, 6000, at)
    other = _boleta(tenv, 4000, at)
    own = make_terminal_sale(tenv, 6000, at + timedelta(hours=3), document_type=39)
    extra = make_terminal_sale(tenv, 4000, at + timedelta(hours=4), document_type=39)
    _ensure()
    orphan = _orphan_of(own)
    extra_orphan = _orphan_of(extra)
    foreign = TreasuryMovement.objects.get(invoice=other)

    # El cambio 0 se aplica después del 1 (orden ERP → TUU) y falla: nada queda aplicado.
    with _rule_error(OTHER_DOCUMENT_PAYMENT, 0):
        apply_changes(
            orphan,
            [
                {"op": "link", "part": "tuu", "id": extra.pk, "movement": foreign.pk},
                {"op": "link", "part": "erp", "id": inv.pk},
            ],
        )

    own.refresh_from_db()
    extra.refresh_from_db()
    assert (own.fiscal_match_id, own.matched_movement_id, own.linked_manually) == (
        orphan.pk,
        None,
        False,
    )
    assert extra.fiscal_match_id == extra_orphan.pk
    assert FiscalMatch.objects.filter(pk=orphan.pk).exists()
    assert cache.get(FISCAL_MATCH_LOCK_KEY) is None


def test_apply_orphan_two_sales_payment_map(tenv):
    at = _at()
    inv = _boleta(tenv, 12000, at)
    TreasuryMovement.objects.filter(invoice=inv).update(amount=Decimal(6000))
    m1 = TreasuryMovement.objects.get(invoice=inv)
    m2 = _payment(tenv, inv, 6000)
    s1 = make_terminal_sale(tenv, 6000, at + timedelta(hours=3), document_type=39)
    s2 = make_terminal_sale(tenv, 6000, at + timedelta(hours=4), document_type=39)
    _ensure()
    orphan = _orphan_of(s1)
    lone = _orphan_of(s2)
    TerminalSale.objects.filter(pk=s2.pk).update(fiscal_match=orphan)
    lone.delete()

    with _rule_error(PAYMENT_REQUIRED, 0):
        apply_changes(orphan, [{"op": "link", "part": "erp", "id": inv.pk}])

    result = apply_changes(
        orphan,
        [
            {"op": "link", "part": "erp", "id": inv.pk, "payments": {s1.pk: m2.pk, s2.pk: m1.pk}},
        ],
    )

    s1.refresh_from_db()
    s2.refresh_from_db()
    assert (s1.fiscal_match_id, s1.matched_movement_id) == (result.pk, m2.pk)
    assert (s2.fiscal_match_id, s2.matched_movement_id) == (result.pk, m1.pk)


def test_apply_moved_record_reports_index(tenv):
    at = _at()
    inv = _boleta(tenv, 6000, at)
    rival = _boleta(tenv, 4000, at)
    m2 = _payment(tenv, inv, 4000)
    extra = make_terminal_sale(tenv, 4000, at + timedelta(hours=4), document_type=39)
    doc = _rcv_boleta(timezone.localdate(at), 6000, 91002)
    _ensure()
    group = _group_of(inv)
    # El motor corrió entre la carga de la ficha y el guardado: la venta ya está en otro documento.
    TerminalSale.objects.filter(pk=extra.pk).update(fiscal_match=_group_of(rival))

    with _rule_error(MOVED, 1):
        apply_changes(
            group,
            [
                {"op": "link", "part": "rcv", "id": doc.pk},
                {"op": "link", "part": "tuu", "id": extra.pk, "movement": m2.pk},
            ],
        )

    doc.refresh_from_db()
    assert doc.fiscal_match.invoice_id is None  # el cambio 0 también se revirtió


def test_apply_unlink_erp_not_allowed(tenv):
    inv = _boleta(tenv, 6000, _at())
    _ensure()

    with pytest.raises(
        FiscalMatchRuleError,
        check=lambda e: (
            e.code == NOT_ALLOWED
            and e.change_index == 0
            and e.messages == ["El documento ERP no se quita del cuadre"]
        ),
    ):
        apply_changes(_group_of(inv), [{"op": "unlink", "part": "erp", "id": inv.pk}])


def test_apply_busy_engine_409(tenv):
    at = _at()
    inv = _boleta(tenv, 6000, at)
    own = make_terminal_sale(tenv, 6000, at + timedelta(hours=3), document_type=39)
    _ensure()
    orphan = _orphan_of(own)
    cache.add(FISCAL_MATCH_LOCK_KEY, "engine", timeout=540)

    with pytest.raises(FiscalMatchBusy) as exc:
        apply_changes(orphan, [{"op": "link", "part": "erp", "id": inv.pk}])

    assert exc.value.status_code == 409
    own.refresh_from_db()
    assert own.fiscal_match_id == orphan.pk
    assert cache.get(FISCAL_MATCH_LOCK_KEY) == "engine"


def _tuu_links(tenv, n: int) -> tuple[FiscalMatch, list[dict]]:
    """Un documento con ``n`` cobros y ``n`` ventas TUU huérfanas, una por cobro."""
    at = _at()
    amounts = [1000 * (i + 1) for i in range(n)]
    inv = _boleta(tenv, sum(amounts), at)
    TreasuryMovement.objects.filter(invoice=inv).update(amount=Decimal(amounts[0]))
    movements = [TreasuryMovement.objects.get(invoice=inv)]
    movements += [_payment(tenv, inv, a) for a in amounts[1:]]
    sales = [
        make_terminal_sale(tenv, a, at + timedelta(hours=3, minutes=i), document_type=39)
        for i, a in enumerate(amounts)
    ]
    _ensure()
    changes = [
        {"op": "link", "part": "tuu", "id": s.pk, "movement": m.pk}
        for s, m in zip(sales, movements, strict=True)
    ]
    return _group_of(inv), changes


# Consultas propias de cada unión TUU: cobro tomado, guardar la venta y llevar su RCV
# huérfano (¿el documento tiene RCV?, RCV del huérfano). La carga, los candados y la
# re-derivación son fijas.
QUERIES_PER_TUU_LINK = 4


def test_apply_query_count_bounded(tenv):
    warm, warm_changes = _tuu_links(tenv, 1)
    apply_changes(warm, warm_changes)  # la primera lectura de RCVSettings queda en caché
    group2, changes2 = _tuu_links(tenv, 2)
    group4, changes4 = _tuu_links(tenv, 4)

    with CaptureQueriesContext(connection) as two:
        apply_changes(group2, changes2)
    with CaptureQueriesContext(connection) as four:
        apply_changes(group4, changes4)

    assert TerminalSale.objects.filter(fiscal_match=group4).count() == 4
    assert len(four) - len(two) == 2 * QUERIES_PER_TUU_LINK


# --- reglas de la unión manual (Rulings C y D) --------------------------------------


def test_tuu_sale_of_other_amount_links_with_warning(tenv):
    at = _at()
    inv = _boleta(tenv, 6000, at)
    sale = make_terminal_sale(tenv, 5000, at + timedelta(hours=3), document_type=39)
    _ensure()

    result = link_terminal_sale(
        _group_of(inv),
        TerminalSale.objects.get(pk=sale.pk),
        TreasuryMovement.objects.get(invoice=inv),
    )

    sale.refresh_from_db()
    assert sale.fiscal_match_id == result.pk
    assert result.tuu_state == PartState.DIFF


def test_cash_tuu_sale_only_backs_cash_payment(tenv):
    at = _at()
    inv = _boleta(tenv, 6000, at)  # boleta pagada con tarjeta
    sale = make_terminal_sale(
        tenv,
        6000,
        at + timedelta(hours=3),
        payment_type=TerminalSale.PaymentType.CASH,
        document_type=39,
    )
    _ensure()

    with _rule_error(TYPE_INCOMPATIBLE):
        link_terminal_sale(
            _group_of(inv),
            TerminalSale.objects.get(pk=sale.pk),
            TreasuryMovement.objects.get(invoice=inv),
        )


def test_link_invoice_leaves_reversed_sales_behind(tenv):
    at = _at()
    inv = _boleta(tenv, 6000, at)
    live = make_terminal_sale(tenv, 6000, at + timedelta(hours=3), document_type=39)
    reversed_sale = make_terminal_sale(tenv, 6000, at + timedelta(hours=4), document_type=39)
    _ensure()
    orphan = _orphan_of(live)
    lone = _orphan_of(reversed_sale)
    TerminalSale.objects.filter(pk=reversed_sale.pk).update(
        fiscal_match=orphan, status=TerminalSale.Status.REVERSED
    )
    lone.delete()

    target = link_invoice(orphan, inv)

    live.refresh_from_db()
    reversed_sale.refresh_from_db()
    assert live.fiscal_match_id == target.pk
    assert reversed_sale.fiscal_match_id == orphan.pk


def test_carry_orphan_rcv_stays_when_it_cannot_move(tenv):
    at = _at()
    inv = make_pos_document(tenv, 6000, at)  # comprobante 48
    sale = make_terminal_sale(tenv, 6000, at + timedelta(hours=3), document_type=None)
    doc = _rcv_boleta(timezone.localdate(at), 6000, 91003)  # boleta 39: otro tipo
    _ensure()
    orphan = _orphan_of(sale)
    RCVDocument.objects.filter(pk=doc.pk).update(fiscal_match=orphan)

    result = link_terminal_sale(
        _group_of(inv),
        TerminalSale.objects.get(pk=sale.pk),
        TreasuryMovement.objects.get(invoice=inv),
    )

    sale.refresh_from_db()
    doc.refresh_from_db()
    assert sale.fiscal_match_id == result.pk
    assert doc.fiscal_match_id == orphan.pk
    assert FiscalMatch.objects.filter(pk=orphan.pk).exists()
