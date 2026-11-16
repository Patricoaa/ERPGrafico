"""Resolución del documento de venta según medio de pago (ADR-0138 D3)."""

from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError

from billing.sale_documents import (
    FOLIO_EXEMPT_DTE_TYPES,
    DocumentPlan,
    PaymentPortion,
    plan_sale_documents,
)

D = Decimal


def P(amount, integrated, index):
    return PaymentPortion(D(amount), integrated, index)


def plan(dte, amount, idx):
    return DocumentPlan(dte, D(amount), tuple(idx))


def test_cash_only_boleta():
    assert plan_sale_documents("BOLETA", [P(10000, False, 0)], D(10000)) == [plan("BOLETA", 10000, (0,))]


def test_integrated_only_is_48():
    assert plan_sale_documents("BOLETA", [P(10000, True, 0)], D(10000)) == [
        plan("COMPROBANTE_PAGO", 10000, (0,))
    ]


def test_mixed_splits():
    out = plan_sale_documents("BOLETA", [P(6000, True, 0), P(4000, False, 1)], D(10000))
    assert out == [plan("COMPROBANTE_PAGO", 6000, (0,)), plan("BOLETA", 4000, (1,))]


def test_overpayment_capped():
    assert plan_sale_documents("BOLETA", [P(12000, True, 0)], D(10000)) == [
        plan("COMPROBANTE_PAGO", 10000, (0,))
    ]
    out = plan_sale_documents("BOLETA", [P(8000, True, 0), P(5000, False, 1)], D(10000))
    assert out == [plan("COMPROBANTE_PAGO", 8000, (0,)), plan("BOLETA", 2000, (1,))]
    assert sum(p.amount for p in out) == D(10000)


def test_partial_card_rest_on_credit():
    out = plan_sale_documents("BOLETA", [P(3000, True, 0)], D(10000))
    assert out == [plan("BOLETA", 7000, ()), plan("COMPROBANTE_PAGO", 3000, (0,))]


def test_tie_puts_boleta_first():
    out = plan_sale_documents("BOLETA", [P(5000, True, 0), P(5000, False, 1)], D(10000))
    assert [p.dte_type for p in out] == ["BOLETA", "COMPROBANTE_PAGO"]


def test_legacy_single_payment_index_none():
    assert plan_sale_documents("BOLETA", [P(10000, False, None)], D(10000)) == [
        plan("BOLETA", 10000, (None,))
    ]


@pytest.mark.parametrize("cls", ["FACTURA", "FACTURA_EXENTA", "BOLETA_EXENTA"])
def test_other_classes_ignore_terminal(cls):
    out = plan_sale_documents(cls, [P(6000, True, 0), P(4000, False, 1)], D(10000))
    assert out == [plan(cls, 10000, (0, 1))]


def test_no_portions_boleta():
    assert plan_sale_documents("BOLETA", [], D(5000)) == [plan("BOLETA", 5000, ())]


def test_zero_total_with_portions_yields_boleta():
    expected = [plan("BOLETA", 0, (0,))]
    assert plan_sale_documents("BOLETA", [P(0, False, 0)], D(0)) == expected
    assert plan_sale_documents("BOLETA", [P(5000, True, 0)], D(0)) == expected


def test_unknown_class():
    with pytest.raises(ValidationError):
        plan_sale_documents("NOPE", [], D(1))


def test_folio_exempt_types():
    assert FOLIO_EXEMPT_DTE_TYPES == ("BOLETA", "BOLETA_EXENTA", "COMPROBANTE_PAGO")


def test_two_integrated_portions_two_48():
    out = plan_sale_documents("BOLETA", [P(3000, True, 0), P(3000, True, 1), P(4000, False, 2)], D(10000))
    assert out == [
        plan("BOLETA", 4000, (2,)),
        plan("COMPROBANTE_PAGO", 3000, (0,)),
        plan("COMPROBANTE_PAGO", 3000, (1,)),
    ]


def test_integrated_portions_capped_in_input_order():
    out = plan_sale_documents("BOLETA", [P(7000, True, 0), P(5000, True, 1), P(2000, True, 2)], D(10000))
    # La segunda se recorta a lo que queda (3000); la tercera recibe 0 y no genera documento.
    assert out == [plan("COMPROBANTE_PAGO", 7000, (0,)), plan("COMPROBANTE_PAGO", 3000, (1,))]
    assert sum(p.amount for p in out) == D(10000)


def test_two_integrated_partial_rest_on_credit():
    out = plan_sale_documents("BOLETA", [P(2000, True, 0), P(3000, True, 1)], D(10000))
    assert out == [
        plan("BOLETA", 5000, ()),
        plan("COMPROBANTE_PAGO", 3000, (1,)),
        plan("COMPROBANTE_PAGO", 2000, (0,)),
    ]
