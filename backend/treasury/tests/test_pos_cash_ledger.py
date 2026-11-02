"""
Libro de caja POS (ADR-0109): el efectivo esperado de los informes X/Z se deriva
de los movimientos de la cuenta de la caja, incluidos los registrados fuera de
la sesión, y el uso externo de una caja con sesión abierta exige motivo.
"""

import json
from decimal import Decimal
from urllib.parse import quote, unquote

import pytest
from django.core.exceptions import ValidationError
from rest_framework.test import APIClient

from accounting.models import Account, AccountType
from treasury.models import POSSession, POSTerminal, TreasuryAccount, TreasuryMovement
from treasury.pos_external_guard import CHALLENGE_HEADER
from treasury.pos_service import POSService
from treasury.selectors import POSSelector
from treasury.services import TreasuryService


@pytest.fixture
def cash_account_fixture(db):
    acc = Account.objects.create(code="1.1.01.100", name="Caja Chica", account_type=AccountType.ASSET)
    return TreasuryAccount.objects.create(name="Caja Física", account_type="CASH", account=acc)


@pytest.fixture
def terminal(db, cash_account_fixture):
    return POSTerminal.objects.create(name="Caja 1", code="CAJA-1", default_treasury_account=cash_account_fixture)


@pytest.fixture
def cashier(django_user_model):
    return django_user_model.objects.create_user(username="cashier", password="x")


@pytest.fixture
def expense_account(db):
    return Account.objects.create(code="5.9.99", name="Gasto", account_type=AccountType.EXPENSE)


@pytest.fixture
def income_account(db):
    return Account.objects.create(code="4.9.99", name="Ingreso", account_type=AccountType.INCOME)


@pytest.fixture
def safe_account(db):
    acc = Account.objects.create(code="1.1.01.200", name="Caja Fuerte", account_type=AccountType.ASSET)
    return TreasuryAccount.objects.create(name="Caja Fuerte", account_type="CASH", account=acc)


def _open(user, terminal, amount="0"):
    return POSService.open_session(user=user, terminal_id=terminal.id, opening_balance=Decimal(amount))


def _outflow(account, user, counterpart, amount, **kwargs):
    return TreasuryService.create_movement(
        movement_type=TreasuryMovement.Type.OUTBOUND,
        amount=Decimal(amount),
        from_account=account,
        created_by=user,
        counterpart_account=counterpart,
        payment_method=TreasuryMovement.Method.CASH,
        **kwargs,
    )


def _inflow(account, user, counterpart, amount, **kwargs):
    return TreasuryService.create_movement(
        movement_type=TreasuryMovement.Type.INBOUND,
        amount=Decimal(amount),
        to_account=account,
        created_by=user,
        counterpart_account=counterpart,
        payment_method=TreasuryMovement.Method.CASH,
        **kwargs,
    )


@pytest.mark.django_db
def test_open_session_starts_cash_ledger(cashier, terminal):
    session = _open(cashier, terminal)
    assert session.uses_cash_ledger
    assert session.ledger_baseline_at is not None


@pytest.mark.django_db
def test_outside_session_outflow_reduces_expected_cash(cashier, terminal, cash_account_fixture, expense_account, income_account):
    _inflow(cash_account_fixture, cashier, income_account, "100000")  # saldo previo en libros
    session = _open(cashier, terminal, "100000")

    _outflow(cash_account_fixture, cashier, expense_account, "30000")  # p.ej. pago de OC, sin pos_session

    session.refresh_from_db()
    assert session.expected_cash == Decimal("70000")

    summary = POSSelector.get_summary(session)
    assert summary["cash_ledger_mode"] is True
    assert summary["expected_cash"] == Decimal("70000")
    assert summary["cash_breakdown"]["external_outflow"] == Decimal("30000")
    rows = summary["out_of_session_movements"]
    assert [(r["event"], r["direction"], r["amount"]) for r in rows] == [("EXTERNAL", "OUT", Decimal("30000"))]


@pytest.mark.django_db
def test_annul_in_session_reverts_expected_cash(cashier, terminal, cash_account_fixture, income_account):
    session = _open(cashier, terminal)
    movement = _inflow(cash_account_fixture, cashier, income_account, "50000", pos_session=session)
    session.refresh_from_db()
    assert session.expected_cash == Decimal("50000")

    TreasuryService.annul_movement(movement, user=cashier, reason="error", from_owner=True)

    session.refresh_from_db()
    assert session.expected_cash == Decimal("0")
    assert POSSelector.get_summary(session)["cash_breakdown"]["annulments"] == Decimal("-50000")


@pytest.mark.django_db
def test_annul_of_movement_created_before_session_counts_in_window(cashier, terminal, cash_account_fixture, income_account):
    earlier = _inflow(cash_account_fixture, cashier, income_account, "20000")
    session = _open(cashier, terminal, "20000")

    TreasuryService.annul_movement(earlier, user=cashier, reason="devolución", from_owner=True)

    session.refresh_from_db()
    assert session.expected_cash == Decimal("0")


@pytest.mark.django_db
def test_list_endpoint_uses_annotated_ledger(cashier, terminal, cash_account_fixture, expense_account, income_account):
    _inflow(cash_account_fixture, cashier, income_account, "10000")
    session = _open(cashier, terminal, "10000")
    _outflow(cash_account_fixture, cashier, expense_account, "4000")

    client = APIClient()
    client.force_authenticate(user=cashier)
    response = client.get("/api/treasury/pos-sessions/", {"status": "OPEN"})
    assert response.status_code == 200
    row = next(r for r in response.json()["results"] if r["id"] == session.id)
    assert Decimal(row["expected_cash"]) == Decimal("6000")


@pytest.mark.django_db
def test_close_uses_ledger_and_freezes_expected(cashier, terminal, cash_account_fixture, expense_account, income_account):
    _inflow(cash_account_fixture, cashier, income_account, "10000")
    session = _open(cashier, terminal, "10000")
    _outflow(cash_account_fixture, cashier, expense_account, "3000")

    session, audit = POSService.close_session(session=session, actual_cash=Decimal("7000"), user=cashier)

    assert audit.expected_amount == Decimal("7000")
    assert audit.difference == Decimal("0")
    # Movimientos posteriores al cierre no cambian el informe Z
    _outflow(cash_account_fixture, cashier, expense_account, "1000")
    session = POSSession.objects.get(pk=session.pk)
    assert session.expected_cash == Decimal("7000")
    summary = POSSelector.get_summary(session)
    assert summary["opening_balance"] + summary["cash_breakdown"]["net"] == Decimal("7000")


@pytest.mark.django_db
def test_legacy_session_keeps_counter_based_expected_cash(cashier, terminal, cash_account_fixture, expense_account):
    session = POSSession.objects.create(
        terminal=terminal,
        treasury_account=cash_account_fixture,
        user=cashier,
        opening_balance=Decimal("100000"),
        status="OPEN",
    )
    _outflow(cash_account_fixture, cashier, expense_account, "30000")
    session.refresh_from_db()
    assert not session.uses_cash_ledger
    assert session.expected_cash == Decimal("100000")
    assert POSSelector.get_summary(session)["out_of_session_movements"] == []


@pytest.mark.django_db
def test_second_open_session_on_same_cash_account_is_blocked(cashier, terminal, cash_account_fixture, django_user_model):
    _open(cashier, terminal)
    other_terminal = POSTerminal.objects.create(
        name="Caja 2", code="CAJA-2", default_treasury_account=cash_account_fixture
    )
    other_user = django_user_model.objects.create_user(username="cashier2", password="x")
    with pytest.raises(ValidationError, match="ya tiene la sesión"):
        _open(other_user, other_terminal)


@pytest.mark.django_db
def test_opening_adjusts_against_own_book_balance(cashier, terminal, cash_account_fixture, income_account):
    _inflow(cash_account_fixture, cashier, income_account, "8000")
    session = POSService.open_session(
        user=cashier, terminal_id=terminal.id, opening_balance=Decimal("10000"), justify_reason="OTHER_IN"
    )
    adjustment = TreasuryMovement.objects.get(pos_session=session, reference__contains="AJUSTE")
    assert adjustment.amount == Decimal("2000")
    assert adjustment.to_account == cash_account_fixture
    # El ajuste queda antes del inicio del libro: no se cuenta dos veces
    assert session.expected_cash == Decimal("10000")


@pytest.mark.django_db
def test_opening_surplus_transfer_comes_from_target(cashier, terminal, cash_account_fixture, safe_account, income_account):
    _inflow(safe_account, cashier, income_account, "5000")
    session = POSService.open_session(
        user=cashier,
        terminal_id=terminal.id,
        opening_balance=Decimal("5000"),
        justify_reason="TRANSFER",
        justify_target_id=safe_account.id,
    )
    adjustment = TreasuryMovement.objects.get(pos_session=session, reference__contains="AJUSTE")
    assert adjustment.from_account == safe_account
    assert adjustment.to_account == cash_account_fixture


@pytest.mark.django_db
def test_api_movement_on_open_pos_cash_requires_reason(
    cashier, terminal, cash_account_fixture, income_account, django_user_model
):
    _inflow(cash_account_fixture, cashier, income_account, "10000")
    session = _open(cashier, terminal, "10000")
    accountant = django_user_model.objects.create_superuser(username="contador", password="x")
    client = APIClient()
    client.force_authenticate(user=accountant)
    payload = {
        "movement_type": "OUTBOUND",
        "amount": "2500",
        "treasury_account_id": cash_account_fixture.id,
        "payment_method": "CASH",
    }

    first = client.post(
        "/api/treasury/movements/register_movement/", payload, format="json", HTTP_IDEMPOTENCY_KEY="k-1"
    )
    assert first.status_code == 400, first.json()
    challenge = json.loads(unquote(first[CHALLENGE_HEADER]))
    assert challenge["session_id"] == session.id
    assert not TreasuryMovement.objects.filter(amount=Decimal("2500")).exists()

    second = client.post(
        "/api/treasury/movements/register_movement/",
        payload,
        format="json",
        HTTP_IDEMPOTENCY_KEY="k-2",
        HTTP_X_POS_EXTERNAL_REASON=quote("Pago a proveedor en efectivo"),
    )
    assert second.status_code == 201, second.json()
    movement = TreasuryMovement.objects.get(amount=Decimal("2500"))
    assert movement.pos_external_reason == "Pago a proveedor en efectivo"
    assert movement.pos_session_id is None

    summary = POSSelector.get_summary(POSSession.objects.get(pk=session.pk))
    assert summary["out_of_session_movements"][0]["reason"] == "Pago a proveedor en efectivo"


@pytest.mark.django_db
def test_session_own_movements_do_not_require_reason(cashier, terminal, cash_account_fixture, income_account):
    from treasury.pos_external_guard import _request_state

    session = _open(cashier, terminal)

    token = _request_state.set({"reason": "", "challenge": None})  # simula estar dentro de una request
    try:
        movement = _inflow(cash_account_fixture, cashier, income_account, "1000", pos_session=session)
    finally:
        _request_state.reset(token)
    assert movement.pos_external_reason == ""
