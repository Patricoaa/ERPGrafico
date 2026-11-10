"""Modo de caja por dispositivo (cuenta) de la sesión POS. Spec 2026-11-10 §5.1, ajustado:
el modo ya no es de la sesión; lo elige cada dispositivo al abrirla o unirse a ella."""

from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from rest_framework.test import APIClient

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


@pytest.fixture
def joiner(db):
    return User.objects.create_user(username="joiner", password="x")


def _open(cashier, terminal, **kw):
    return POSService.open_session(
        user=cashier, terminal_id=terminal.id, opening_balance=Decimal("0"), **kw
    )


def test_open_session_defaults_to_single_for_the_opening_device(cashier, terminal):
    s = _open(cashier, terminal)
    assert s.mode_for(cashier) == "SINGLE" and s.is_multi_user_for(cashier) is False


def test_open_session_multi_only_marks_the_opening_device(cashier, joiner, terminal):
    s = _open(cashier, terminal, mode="MULTI")
    assert s.is_multi_user_for(cashier) is True
    assert s.is_multi_user_for(joiner) is False  # otro dispositivo no hereda el modo


def test_open_session_rejects_unknown_mode(cashier, terminal):
    with pytest.raises(ValidationError, match="Modo de caja"):
        _open(cashier, terminal, mode="X")


def test_each_device_joins_in_its_own_mode(cashier, joiner, terminal):
    s = _open(cashier, terminal, mode="SINGLE")
    POSService.join_session(session=s, user=joiner, mode="MULTI")
    assert s.is_multi_user_for(joiner) is True
    assert s.is_multi_user_for(cashier) is False


def test_join_rejects_closed_session_and_unknown_mode(cashier, joiner, terminal):
    s = _open(cashier, terminal)
    with pytest.raises(ValidationError, match="Modo de caja"):
        POSService.join_session(session=s, user=joiner, mode="X")
    s.status = "CLOSED"
    s.save()
    with pytest.raises(ValidationError, match="cerrada"):
        POSService.join_session(session=s, user=joiner, mode="MULTI")


def test_serializer_exposes_my_mode_for_the_request_user(cashier, joiner, terminal):
    s = _open(cashier, terminal, mode="MULTI")

    class Req:
        def __init__(self, user):
            self.user = user

    assert POSSessionSerializer(s, context={"request": Req(cashier)}).data["my_mode"] == "MULTI"
    assert POSSessionSerializer(s, context={"request": Req(joiner)}).data["my_mode"] == "SINGLE"
    assert "mode" not in POSSessionSerializer(s, context={"request": Req(cashier)}).data


def test_open_session_from_request_reads_mode(cashier, terminal):
    class Req:
        user = cashier
        data = {"terminal_id": terminal.id, "opening_balance": "0", "mode": "MULTI"}

    assert POSService.open_session_from_request(Req).is_multi_user_for(cashier) is True


def test_join_session_endpoint_sets_the_callers_mode(cashier, joiner, terminal):
    s = _open(cashier, terminal)
    api = APIClient()
    api.force_authenticate(user=joiner)
    r = api.post(f"/api/treasury/pos-sessions/{s.id}/join_session/", {"mode": "MULTI"}, format="json")
    assert r.status_code == 200, r.content
    assert r.json()["my_mode"] == "MULTI"
    assert s.is_multi_user_for(joiner) is True and s.is_multi_user_for(cashier) is False
