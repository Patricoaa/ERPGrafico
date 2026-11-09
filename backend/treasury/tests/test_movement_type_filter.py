"""
Regression for issue #225: list_treasury_movements ignored the movement_type and
payment_method params sent by the frontend's UnifiedSearchBar.
"""
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from accounting.models import Account, AccountType
from treasury.models import TreasuryAccount, TreasuryMovement

User = get_user_model()

pytestmark = pytest.mark.django_db


@pytest.fixture
def superuser(db):
    return User.objects.create_superuser(username="admin_mv_type_test", password="x")


@pytest.fixture
def client_auth(superuser):
    c = APIClient()
    c.force_authenticate(superuser)
    return c


@pytest.fixture
def account(db):
    asset = Account.objects.create(name="Caja Test", code="1.1.99.001", account_type=AccountType.ASSET)
    return TreasuryAccount.objects.create(
        name="Caja Test",
        account=asset,
        account_type=TreasuryAccount.Type.CASH,
    )


@pytest.fixture
def inbound(account, db):
    return TreasuryMovement.objects.create(
        to_account=account,
        movement_type=TreasuryMovement.Type.INBOUND,
        amount=Decimal("100"),
    )


@pytest.fixture
def outbound(account, db):
    return TreasuryMovement.objects.create(
        from_account=account,
        movement_type=TreasuryMovement.Type.OUTBOUND,
        amount=Decimal("50"),
    )


def test_movement_type_filter_single(client_auth, inbound, outbound):
    """?movement_type=INBOUND returns only INBOUND movements."""
    r = client_auth.get("/api/treasury/movements/", {"movement_type": "INBOUND"})
    assert r.status_code == 200
    ids = [item["id"] for item in r.data["results"]]
    assert inbound.id in ids
    assert outbound.id not in ids


def test_movement_type_filter_csv(client_auth, inbound, outbound):
    """?movement_type=INBOUND,OUTBOUND returns both."""
    r = client_auth.get("/api/treasury/movements/", {"movement_type": "INBOUND,OUTBOUND"})
    assert r.status_code == 200
    ids = [item["id"] for item in r.data["results"]]
    assert inbound.id in ids
    assert outbound.id in ids


def test_movement_type_filter_unknown_returns_empty(client_auth, inbound, outbound):
    """?movement_type=BOGUS must return 200 with empty results, not 500."""
    r = client_auth.get("/api/treasury/movements/", {"movement_type": "BOGUS"})
    assert r.status_code == 200
    ids = [item["id"] for item in r.data["results"]]
    assert inbound.id not in ids
    assert outbound.id not in ids


def test_payment_method_filter_does_not_500(client_auth, inbound):
    """?payment_method=CASH must return 200 (was silently ignored before fix)."""
    r = client_auth.get("/api/treasury/movements/", {"payment_method": "CASH"})
    assert r.status_code == 200
