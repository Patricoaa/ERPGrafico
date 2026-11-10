"""Modo de caja de la sesión POS (SINGLE / MULTI). Spec 2026-11-10 §5.1."""

from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError

from treasury.models import POSTerminal, TreasuryAccount
from treasury.pos_service import POSService
from treasury.serializers import POSSessionSerializer

User = get_user_model()


@pytest.fixture
def terminal(db):
    from accounting.models import Account, AccountType

    acc = Account.objects.create(
        code="1.1.01.100", name="Caja Chica", account_type=AccountType.ASSET
    )
    ta = TreasuryAccount.objects.create(name="Caja Física", account_type="CASH", account=acc)
    return POSTerminal.objects.create(name="Caja 1", code="CAJA-1", default_treasury_account=ta)


@pytest.fixture
def cashier(db):
    return User.objects.create_user(username="cashier", password="x")


def _open(cashier, terminal, **kw):
    return POSService.open_session(
        user=cashier, terminal_id=terminal.id, opening_balance=Decimal("0"), **kw
    )


def test_open_session_defaults_to_single(cashier, terminal):
    s = _open(cashier, terminal)
    assert s.mode == "SINGLE" and s.is_multi_user is False


def test_open_session_multi(cashier, terminal):
    s = _open(cashier, terminal, mode="MULTI")
    assert s.mode == "MULTI" and s.is_multi_user is True


def test_open_session_rejects_unknown_mode(cashier, terminal):
    with pytest.raises(ValidationError, match="Modo de caja"):
        _open(cashier, terminal, mode="X")


def test_mode_is_read_only_in_serializer(cashier, terminal):
    s = _open(cashier, terminal)
    ser = POSSessionSerializer(s, data={"mode": "MULTI"}, partial=True)
    ser.is_valid(raise_exception=True)
    ser.save()
    s.refresh_from_db()
    assert s.mode == "SINGLE"
    assert POSSessionSerializer(s).data["mode"] == "SINGLE"


def test_open_session_from_request_reads_mode(cashier, terminal):
    class Req:
        user = cashier
        data = {"terminal_id": terminal.id, "opening_balance": "0", "mode": "MULTI"}

    assert POSService.open_session_from_request(Req).mode == "MULTI"
