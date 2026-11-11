"""Movimientos de caja y cierre atribuidos al operador. Spec 2026-11-10 §5.2 y §5.5."""

from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from rest_framework.test import APIClient

from accounting.models import Account, AccountType
from treasury.models import (
    POSOperatorPass,
    POSTerminal,
    TreasuryAccount,
    TreasuryMovement,
)
from treasury.pos_service import POSService
from treasury.services import TreasuryService

User = get_user_model()
HEADER = "HTTP_X_POS_OPERATOR_PASS"


def _seller(username):
    u = User.objects.create_user(username=username, password="x")
    u.user_permissions.add(Permission.objects.get(codename="add_saleorder", content_type__app_label="sales"))
    return u


@pytest.fixture
def cash_account(db):
    acc = Account.objects.create(code="1.1.01.100", name="Caja Chica", account_type=AccountType.ASSET)
    return TreasuryAccount.objects.create(name="Caja Física", account_type="CASH", account=acc)


@pytest.fixture
def safe_account(db):
    acc = Account.objects.create(code="1.1.01.200", name="Caja Fuerte", account_type=AccountType.ASSET)
    return TreasuryAccount.objects.create(name="Caja Fuerte", account_type="CASH", account=acc)


@pytest.fixture
def terminal(db, cash_account):
    return POSTerminal.objects.create(name="Caja 1", code="CAJA-1", default_treasury_account=cash_account)


@pytest.fixture
def cashier(db):
    return _seller("cashier")  # abre la sesión y también es un operador elegible


@pytest.fixture
def ana(db):
    return _seller("ana")


@pytest.fixture
def api(cashier):
    c = APIClient()
    c.force_authenticate(user=cashier)
    return c


def _open(cashier, terminal, cash_account, mode):
    income = Account.objects.create(code="4.9.99", name="Ingreso", account_type=AccountType.INCOME)
    TreasuryService.create_movement(
        movement_type=TreasuryMovement.Type.INBOUND, amount=Decimal("100000"),
        to_account=cash_account, created_by=cashier, counterpart_account=income,
        payment_method=TreasuryMovement.Method.CASH,
    )
    return POSService.open_session(
        user=cashier, terminal_id=terminal.id, opening_balance=Decimal("100000"), mode=mode
    )


@pytest.fixture
def multi(cashier, terminal, cash_account):
    return _open(cashier, terminal, cash_account, "MULTI")


@pytest.fixture
def single(cashier, terminal, cash_account):
    return _open(cashier, terminal, cash_account, "SINGLE")


def _identify(api, session, operator, purpose, tab="t1"):
    r = api.post(
        f"/api/treasury/pos-sessions/{session.id}/identify_operator/",
        {"operator_id": operator.id, "tab_key": tab, "purpose": purpose}, format="json",
    )
    assert r.status_code == 201, r.content
    return r.json()


def _move(api, session, safe, amount="1000", **headers):
    return api.post(
        f"/api/treasury/pos-sessions/{session.id}/register_manual_movement/",
        {"type": "TRANSFER", "amount": amount, "is_inflow": False, "target_account_id": safe.id},
        format="json", **headers,
    )


def _close(api, session, **headers):
    return api.post(
        f"/api/treasury/pos-sessions/{session.id}/close_session/",
        {"actual_cash": "100000"}, format="json", **headers,
    )


def _last_movement(session):
    return TreasuryMovement.objects.filter(pos_session=session).order_by("-id").first()


def _error(response):
    return response.json()["error"]


def test_movement_without_pass_is_403_with_code(api, multi, safe_account):
    r = _move(api, multi, safe_account)
    assert r.status_code == 403
    err = _error(r)
    assert err["details"]["code"] == "pos_operator_required"
    assert err["details"]["purpose"] == "CASH_MOVEMENT"
    assert "operador" in err["message"].lower()


def test_movement_attributed_to_operator_and_pass_consumed(api, multi, safe_account, ana, cashier):
    p = _identify(api, multi, ana, "CASH_MOVEMENT")
    r = _move(api, multi, safe_account, **{HEADER: p["token"]})
    assert r.status_code == 200, r.content
    assert _last_movement(multi).created_by == ana
    stored = POSOperatorPass.objects.get(pk=p["pass_id"])
    assert stored.end_reason == "CONSUMED" and stored.device_user == cashier


def test_consumed_pass_cannot_be_reused(api, multi, safe_account, ana):
    p = _identify(api, multi, ana, "CASH_MOVEMENT")
    assert _move(api, multi, safe_account, **{HEADER: p["token"]}).status_code == 200
    again = _move(api, multi, safe_account, **{HEADER: p["token"]})
    assert again.status_code == 403
    assert _error(again)["details"]["code"] == "pos_operator_required"


def test_failed_movement_keeps_pass_alive(api, multi, safe_account, ana):
    p = _identify(api, multi, ana, "CASH_MOVEMENT")
    r = _move(api, multi, safe_account, amount="0", **{HEADER: p["token"]})
    assert r.status_code >= 400
    assert POSOperatorPass.objects.get(pk=p["pass_id"]).ended_at is None


def test_close_requires_session_close_pass(api, multi, ana):
    p = _identify(api, multi, ana, "CASH_MOVEMENT")
    r = _close(api, multi, **{HEADER: p["token"]})
    assert r.status_code == 403
    assert _error(r)["details"]["purpose"] == "SESSION_CLOSE"
    multi.refresh_from_db()
    assert multi.status == "OPEN"


def test_close_by_opener_operator_sets_closed_by(api, multi, cashier):
    p = _identify(api, multi, cashier, "SESSION_CLOSE")
    r = _close(api, multi, **{HEADER: p["token"]})
    assert r.status_code == 200, r.content
    multi.refresh_from_db()
    assert multi.status == "CLOSED" and multi.closed_by == cashier
    assert POSOperatorPass.objects.get(pk=p["pass_id"]).end_reason == "CONSUMED"


def test_close_by_other_operator_is_denied_and_pass_survives(api, multi, ana):
    p = _identify(api, multi, ana, "SESSION_CLOSE")
    r = _close(api, multi, **{HEADER: p["token"]})
    assert r.status_code == 403
    assert "Solo quien abrió" in _error(r)["message"]
    multi.refresh_from_db()
    assert multi.status == "OPEN"
    assert POSOperatorPass.objects.get(pk=p["pass_id"]).ended_at is None


def test_close_ends_all_live_passes(api, multi, cashier, ana):
    other = _identify(api, multi, ana, "CASH_MOVEMENT", tab="t2")
    p = _identify(api, multi, cashier, "SESSION_CLOSE", tab="t1")
    assert _close(api, multi, **{HEADER: p["token"]}).status_code == 200
    assert POSOperatorPass.objects.filter(session=multi, ended_at__isnull=True).count() == 0
    assert POSOperatorPass.objects.get(pk=other["pass_id"]).end_reason == "EXPIRED"


def test_closed_session_returns_closed_error_not_500(api, multi, safe_account, cashier):
    p = _identify(api, multi, cashier, "SESSION_CLOSE")
    assert _close(api, multi, **{HEADER: p["token"]}).status_code == 200
    r = _move(api, multi, safe_account, **{HEADER: p["token"]})
    assert r.status_code == 403
    assert _error(r)["details"] != {"code": "pos_operator_required", "purpose": "CASH_MOVEMENT"}
    assert "no está activa" in _error(r)["message"]


def test_single_mode_unchanged(api, single, safe_account, cashier):
    r = _move(api, single, safe_account)
    assert r.status_code == 200, r.content
    assert _last_movement(single).created_by == cashier
    # El cierre declara $100.000 tras sacar $1.000: sobrante sin motivo → cuenta genérica (ADR-0130)
    from accounting.services import AccountingService
    settings = AccountingService.get_or_create_current_settings()
    settings.pos_cash_difference_gain_account = Account.objects.create(
        code="4.2.05", name="Sobrante de caja", account_type=AccountType.INCOME
    )
    settings.save()
    assert _close(api, single).status_code == 200
    single.refresh_from_db()
    assert single.closed_by == cashier


# ─── ADR-0126: cierre contra el esperado que el operador vio ─────────────────


def test_close_with_stale_expected_cash_is_409_and_keeps_session_open(api, single, safe_account):
    seen = str(single.expected_cash)
    assert _move(api, single, safe_account, "1000").status_code in (200, 201)  # el esperado baja
    r = api.post(
        f"/api/treasury/pos-sessions/{single.id}/close_session/",
        {"actual_cash": seen, "expected_cash_seen": seen}, format="json",
    )
    assert r.status_code == 409
    err = _error(r)
    assert err["details"]["code"] == "pos_expected_cash_changed"
    assert Decimal(err["details"]["expected_cash"]) == Decimal(seen) - Decimal("1000")
    single.refresh_from_db()
    assert single.status == "OPEN"


def test_close_with_matching_expected_cash_closes(api, single):
    seen = str(single.expected_cash)
    r = api.post(
        f"/api/treasury/pos-sessions/{single.id}/close_session/",
        {"actual_cash": seen, "expected_cash_seen": seen}, format="json",
    )
    assert r.status_code == 200, r.content
