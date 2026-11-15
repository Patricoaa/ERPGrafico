"""Resolución del documento de venta según medio de pago (ADR-0138 D3)."""

from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError

from accounting.models import Account, AccountType
from billing.sale_documents import (
    FOLIO_EXEMPT_DTE_TYPES,
    DocumentPlan,
    PaymentPortion,
    folio_exempt_for_session,
    plan_sale_documents,
)
from treasury.models import (
    PaymentMethod,
    PaymentTerminalDevice,
    POSSession,
    POSTerminal,
    TreasuryAccount,
)
from treasury.tests.helpers import make_terminal_provider

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


def test_unknown_class():
    with pytest.raises(ValidationError):
        plan_sale_documents("NOPE", [], D(1))


def test_folio_exempt_types():
    assert FOLIO_EXEMPT_DTE_TYPES == ("BOLETA", "BOLETA_EXENTA", "COMPROBANTE_PAGO")


@pytest.mark.django_db
def test_folio_exempt_for_session(django_user_model):
    Account.objects.get_or_create(code=Account.CASH_GROUP_CODE, defaults={"name": "Efectivo", "account_type": AccountType.ASSET})
    acc = Account.objects.create(code="1.1.01.100", name="Caja", account_type=AccountType.ASSET)
    ta = TreasuryAccount.objects.create(name="Caja Física", account_type="CASH", account=acc)
    terminal = POSTerminal.objects.create(name="Caja 1", code="C-1", default_treasury_account=ta)
    user = django_user_model.objects.create_user(username="cajero", password="x")
    session = POSSession.objects.create(user=user, terminal=terminal)

    cash = PaymentMethod.objects.create(name="Efectivo", method_type="CASH", treasury_account=ta)
    terminal.allowed_payment_methods.add(cash)
    assert folio_exempt_for_session(session.id) is False
    assert folio_exempt_for_session(None) is False

    provider = make_terminal_provider()
    device = PaymentTerminalDevice.objects.create(name="D1", serial_number="SN-9", provider=provider)
    card = PaymentMethod.objects.create(
        name="Tarjeta", method_type=PaymentMethod.Type.CARD_TERMINAL,
        treasury_account=ta, linked_terminal_device=device,
    )
    terminal.allowed_payment_methods.add(card)
    assert folio_exempt_for_session(session.id) is True
