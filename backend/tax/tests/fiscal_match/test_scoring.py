"""Puntaje y advertencias de coincidencia del cuadre (spec §5.2, §7b, §7c). Puro: sin BD."""

from datetime import date, datetime
from datetime import timezone as dt_tz
from decimal import Decimal
from types import SimpleNamespace

from tax.fiscal_match.scoring import CandidateFacts, Reference, reference_for, score_candidate

D = date(2026, 11, 10)


def ref(**kw) -> Reference:
    base = dict(
        direction="sale",
        sii_code=33,
        date=D,
        rut="76123456-7",
        amount=Decimal("1000"),
        free_payment_amounts=frozenset(),
        folio=None,
    )
    return Reference(**{**base, **kw})


def cand(kind="rcv", **kw) -> CandidateFacts:
    base = dict(
        kind=kind,
        direction="sale",
        sii_code=33,
        date=D,
        rut="76.123.456-7",
        amount=Decimal("1000"),
        folio=None,
        payment_type=None,
        status=None,
    )
    return CandidateFacts(**{**base, **kw})


def codes(warnings):
    return {w.code for w in warnings}


def test_perfect_match_is_100_without_warnings():
    score, warnings = score_candidate(ref(), cand())
    assert (score, warnings) == (100, [])


def test_amount_differs_loses_40_and_warns_non_blocking():
    score, warnings = score_candidate(ref(), cand(amount=Decimal("999")))
    assert score == 60
    assert [(w.code, w.label, w.blocking) for w in warnings] == [
        ("OTHER_AMOUNT", "Otro monto", False)
    ]


def test_tuu_amount_matches_any_free_payment():
    r = ref(free_payment_amounts=frozenset({Decimal("300"), Decimal("700")}))
    c = cand("tuu", rut=None, amount=Decimal("700"), payment_type="CARD", status="COMPLETED")
    assert score_candidate(r, c) == (100, [])


def test_tuu_amount_differs_from_all_free_payments():
    r = ref(free_payment_amounts=frozenset({Decimal("300")}))
    c = cand("tuu", rut=None, amount=Decimal("700"), payment_type="CARD", status="COMPLETED")
    score, warnings = score_candidate(r, c)
    assert score == 60 and codes(warnings) == {"OTHER_AMOUNT"}


def test_day_decay():
    for days, expected in [(0, 25), (1, 12), (2, 9), (5, 0), (9, 0)]:
        c = cand(date=date(2026, 11, 10 + days))
        score, warnings = score_candidate(ref(), c)
        assert score == 75 + expected
        assert (codes(warnings) == {"OTHER_DAY"}) == (days > 0)


def test_other_day_label_not_blocking():
    _, warnings = score_candidate(ref(), cand(date=date(2026, 11, 11)))
    assert [(w.label, w.blocking) for w in warnings] == [("Otro día", False)]


def test_other_rut_warns_in_invoices_and_loses_20():
    score, warnings = score_candidate(ref(), cand(rut="11111111-1"))
    assert score == 80
    assert [(w.code, w.label, w.blocking) for w in warnings] == [("OTHER_RUT", "Otro RUT", False)]


def test_rut_is_normalized():
    assert score_candidate(ref(rut="76123456-7"), cand(rut="76.123.456-7"))[0] == 100


def test_part_without_rut_gets_the_20():
    c = cand("tuu", rut=None, payment_type="CARD", status="COMPLETED")
    assert score_candidate(ref(), c) == (100, [])


def test_boletas_get_the_rut_points_even_with_other_rut():
    r = ref(sii_code=39, rut="1-9")
    c = cand(sii_code=39, rut="2-7")
    assert score_candidate(r, c) == (100, [])


def test_other_direction_blocks():
    score, warnings = score_candidate(ref(), cand(direction="purchase"))
    assert codes(warnings) == {"OTHER_DIRECTION"}
    assert [w.blocking for w in warnings] == [True]
    assert warnings[0].label == "Otra dirección"


def test_other_type_blocks_and_loses_15():
    score, warnings = score_candidate(ref(), cand(sii_code=61))
    assert score == 85
    assert [(w.code, w.label, w.blocking) for w in warnings] == [
        ("TYPE_INCOMPATIBLE", "Tipo distinto", True)
    ]


def test_tuu_cash_to_invoice_blocks_with_cash_label():
    c = cand("tuu", rut=None, payment_type="CASH", status="COMPLETED")
    score, warnings = score_candidate(ref(sii_code=33), c)
    assert score == 85
    assert [(w.code, w.label, w.blocking) for w in warnings] == [
        ("TYPE_INCOMPATIBLE", "Efectivo solo en boletas", True)
    ]


def test_tuu_cash_to_boleta_is_fine():
    r = ref(sii_code=39)
    c = cand("tuu", sii_code=None, rut=None, payment_type="CASH", status="COMPLETED")
    assert score_candidate(r, c) == (100, [])


def test_tuu_document_type_mismatch_blocks():
    c = cand("tuu", rut=None, payment_type="CARD", status="COMPLETED", tuu_document_type=34)
    _, warnings = score_candidate(ref(sii_code=33), c)
    assert [(w.code, w.label) for w in warnings] == [("TYPE_INCOMPATIBLE", "Tipo distinto")]


def test_reversed_sale_blocks():
    c = cand("tuu", rut=None, payment_type="CARD", status="REVERSED")
    _, warnings = score_candidate(ref(), c)
    assert [(w.code, w.label, w.blocking) for w in warnings] == [
        ("NOT_COMPLETED", "Venta anulada", True)
    ]


def test_cash_tuu_reference_vs_erp_invoice_candidate_blocks():
    r = ref(sii_code=None, rut="", payment_type="CASH", kind="tuu")
    c = cand("erp", sii_code=33, folio=5)
    _, warnings = score_candidate(r, c)
    assert [(w.code, w.label) for w in warnings] == [
        ("TYPE_INCOMPATIBLE", "Efectivo solo en boletas")
    ]


def test_rcv_reference_vs_erp_other_type_blocks():
    r = ref(kind="rcv", sii_code=33)
    _, warnings = score_candidate(r, cand("erp", sii_code=34))
    assert codes(warnings) == {"TYPE_INCOMPATIBLE"}


def test_folio_equal_is_100_only_with_same_direction_and_type():
    r = ref(folio=77)
    assert score_candidate(r, cand(folio=77, amount=Decimal("1"), date=date(2026, 1, 1)))[0] == 100
    assert score_candidate(r, cand(folio=77, direction="purchase", amount=Decimal("1")))[0] < 100
    assert score_candidate(r, cand(folio=77, sii_code=61, amount=Decimal("1")))[0] < 100
    assert score_candidate(r, cand(folio=78, amount=Decimal("1")))[0] < 100


def test_folio_equal_keeps_warnings():
    r = ref(folio=77)
    score, warnings = score_candidate(r, cand(folio=77, amount=Decimal("1")))
    assert score == 100 and codes(warnings) == {"OTHER_AMOUNT"}


def test_score_is_clamped_0_100():
    score, _ = score_candidate(
        ref(),
        cand(
            direction="purchase", sii_code=61, amount=Decimal("1"), date=date(2020, 1, 1), rut="2-7"
        ),
    )
    assert score == 0


def test_reference_for_document_uses_group_fields():
    group = SimpleNamespace(
        direction="sale",
        dte_type=33,
        issue_date=D,
        counterparty_rut="76.123.456-7",
        erp_amount=Decimal("1000"),
    )
    got = reference_for(
        group, kind="erp", folio=12, free_payment_amounts=frozenset({Decimal("1000")})
    )
    assert got == Reference(
        direction="sale",
        sii_code=33,
        date=D,
        rut="76123456-7",
        amount=Decimal("1000"),
        free_payment_amounts=frozenset({Decimal("1000")}),
        folio=12,
        kind="erp",
    )


def test_reference_for_orphan_tuu_uses_its_first_sale():
    group = SimpleNamespace(direction="sale")
    sale = SimpleNamespace(
        transaction_at=datetime(2026, 11, 10, 15, 0, tzinfo=dt_tz.utc),
        sale_amount=Decimal("500"),
        document_type=39,
        payment_type="CASH",
    )
    got = reference_for(group, kind="tuu", sale=sale)
    assert (got.kind, got.sii_code, got.amount, got.rut, got.payment_type) == (
        "tuu",
        39,
        Decimal("500"),
        "",
        "CASH",
    )
    assert got.date == date(2026, 11, 10)


def test_reference_for_orphan_rcv_uses_its_first_record():
    group = SimpleNamespace(direction="purchase")
    rcv = SimpleNamespace(
        dte_type=33,
        issue_date=D,
        counterparty_rut="76123456-7",
        total_amount=Decimal("900"),
        folio=44,
    )
    got = reference_for(group, kind="rcv", rcv=rcv)
    assert (got.kind, got.direction, got.folio, got.amount) == (
        "rcv",
        "purchase",
        44,
        Decimal("900"),
    )


def test_reference_for_rcv_credit_note_uses_absolute_amount():
    group = SimpleNamespace(direction="sale")
    rcv = SimpleNamespace(
        dte_type=61,
        issue_date=D,
        counterparty_rut="76123456-7",
        total_amount=Decimal("-900"),
        folio=45,
    )
    assert reference_for(group, kind="rcv", rcv=rcv).amount == Decimal("900")
