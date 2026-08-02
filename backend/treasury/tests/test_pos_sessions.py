"""
Tests para el ciclo de vida de sesiones POS (POSService.open_session) y la
resolución de la cuenta de tesorería (snapshot + fallback al terminal).

Cubre ADR-0063: el terminal es la fuente de verdad al abrir; treasury_account
es un snapshot inmutable copiado de terminal.default_treasury_account.
"""

from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError

from treasury.models import POSTerminal, POSSession, TreasuryAccount
from treasury.pos_service import POSService
from treasury.serializers import POSSessionSerializer

User = get_user_model()


@pytest.fixture
def cash_account_fixture(db):
    from accounting.models import Account, AccountType

    acc = Account.objects.create(
        code="1.1.01.100", name="Caja Chica", account_type=AccountType.ASSET
    )
    return TreasuryAccount.objects.create(
        name="Caja Física", account_type="CASH", account=acc
    )


@pytest.fixture
def terminal(db, cash_account_fixture):
    return POSTerminal.objects.create(
        name="Caja 1",
        code="CAJA-1",
        default_treasury_account=cash_account_fixture,
    )


@pytest.fixture
def terminal_no_account(db):
    return POSTerminal.objects.create(name="Caja Sin Cta", code="CAJA-0")


@pytest.fixture
def cashier(db):
    return User.objects.create_user(username="cashier", password="x")


@pytest.mark.django_db
def test_open_session_requires_terminal(cashier):
    with pytest.raises(ValidationError, match="Terminal"):
        POSService.open_session(
            user=cashier, terminal_id=None, opening_balance=Decimal("0")
        )


@pytest.mark.django_db
def test_open_session_rejects_legacy_treasury_account_id(cashier, cash_account_fixture):
    with pytest.raises(TypeError, match="treasury_account_id"):
        POSService.open_session(
            user=cashier,
            terminal_id=None,
            treasury_account_id=cash_account_fixture.id,
            opening_balance=Decimal("0"),
        )


@pytest.mark.django_db
def test_open_session_rejects_inactive_terminal(cashier, terminal):
    terminal.is_active = False
    terminal.save()
    with pytest.raises(ValidationError, match="Terminal"):
        POSService.open_session(
            user=cashier, terminal_id=terminal.id, opening_balance=Decimal("0")
        )


@pytest.mark.django_db
def test_open_session_requires_terminal_default_account(cashier, terminal_no_account):
    with pytest.raises(ValidationError, match="cuenta de tesorería por defecto"):
        POSService.open_session(
            user=cashier,
            terminal_id=terminal_no_account.id,
            opening_balance=Decimal("0"),
        )


@pytest.mark.django_db
def test_open_session_snapshots_terminal_default_account(cashier, terminal, cash_account_fixture):
    session = POSService.open_session(
        user=cashier, terminal_id=terminal.id, opening_balance=Decimal("0")
    )
    assert session.terminal == terminal
    assert session.treasury_account == cash_account_fixture


@pytest.mark.django_db
def test_open_session_blocks_second_open_session(cashier, terminal):
    POSService.open_session(user=cashier, terminal_id=terminal.id, opening_balance=Decimal("0"))
    with pytest.raises(ValidationError, match="sesión abierta"):
        POSService.open_session(
            user=cashier, terminal_id=terminal.id, opening_balance=Decimal("0")
        )


@pytest.mark.django_db
def test_open_session_endpoint_rejects_treasury_account_id(cashier, cash_account_fixture):
    from rest_framework.test import APIClient

    client = APIClient()
    client.force_authenticate(user=cashier)
    response = client.post(
        "/api/treasury/pos-sessions/open_session/",
        {"treasury_account_id": cash_account_fixture.id, "opening_balance": "0"},
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_serializer_resolves_treasury_account_name_via_terminal_fallback(
    cashier, terminal, cash_account_fixture, terminal_no_account
):
    session = POSService.open_session(
        user=cashier, terminal_id=terminal.id, opening_balance=Decimal("0")
    )
    session.treasury_account = None
    session.save()

    data = POSSessionSerializer(session).data
    assert data["treasury_account_name"] == cash_account_fixture.name
    assert data["treasury_account"] is None

    terminal.default_treasury_account = None
    terminal.save()
    session = POSSession.objects.select_related("treasury_account", "terminal").get(id=session.id)
    data = POSSessionSerializer(session).data
    assert data["treasury_account_name"] is None


@pytest.mark.django_db
def test_serializer_prefers_snapshot_over_terminal_default(
    cashier, terminal, cash_account_fixture
):
    from accounting.models import Account, AccountType

    other_acc = Account.objects.create(
        code="1.1.01.200", name="Caja Dos", account_type=AccountType.ASSET
    )
    other_treasury = TreasuryAccount.objects.create(
        name="Otra Caja", account_type="CASH", account=other_acc
    )
    terminal.default_treasury_account = other_treasury
    terminal.save()

    session = POSService.open_session(
        user=cashier, terminal_id=terminal.id, opening_balance=Decimal("0")
    )
    assert session.treasury_account == other_treasury
    assert session.treasury_account != cash_account_fixture

    data = POSSessionSerializer(session).data
    assert data["treasury_account_name"] == other_treasury.name
