"""ADR-0091 — a treasury movement with a journal entry rejects economic edits."""

from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from accounting.models import Account, AccountType, JournalEntry
from treasury.models import TreasuryAccount, TreasuryMovement

User = get_user_model()


@pytest.fixture
def client(db):
    c = APIClient()
    c.force_authenticate(User.objects.create_superuser("editpol", "e@x.cl", "x"))
    return c


@pytest.fixture
def account(db):
    acc = Account.objects.create(name="Caja", code="1.1.01.901", account_type=AccountType.ASSET)
    return TreasuryAccount.objects.create(
        name="Caja", account=acc, account_type=TreasuryAccount.Type.CASH
    )


def _movement(account, **kw):
    return TreasuryMovement.objects.create(
        movement_type=TreasuryMovement.Type.INBOUND,
        to_account=account,
        amount=Decimal("1000"),
        **kw,
    )


def _with_entry(account, entry_status):
    entry = JournalEntry.objects.create(
        date=timezone.localdate(), description="test", status=entry_status
    )
    return _movement(account, journal_entry=entry, status="POSTED")


def _url(m):
    return f"/api/treasury/movements/{m.pk}/"


@pytest.mark.django_db
def test_draft_without_entry_is_editable(client, account):
    m = _movement(account)
    res = client.patch(_url(m), {"amount": "2000"}, format="json")
    assert res.status_code == 200, res.data
    m.refresh_from_db()
    assert m.amount == Decimal("2000")


@pytest.mark.django_db
@pytest.mark.parametrize("entry_status", [JournalEntry.State.POSTED, JournalEntry.State.DRAFT])
def test_movement_with_entry_rejects_amount_change(client, account, entry_status):
    m = _with_entry(account, entry_status)
    res = client.patch(_url(m), {"amount": "2000"}, format="json")
    assert res.status_code == 422
    assert res.data["error"]["code"] == "DOCUMENT_LOCKED"
    m.refresh_from_db()
    assert m.amount == Decimal("1000")


@pytest.mark.django_db
def test_locked_movement_accepts_notes(client, account):
    m = _with_entry(account, JournalEntry.State.POSTED)
    res = client.patch(_url(m), {"notes": "corregida glosa"}, format="json")
    assert res.status_code == 200, res.data
    m.refresh_from_db()
    assert m.notes == "corregida glosa"


@pytest.mark.django_db
def test_retrieve_exposes_is_editable(client, account):
    assert client.get(_url(_movement(account))).data["is_editable"] is True
    locked = _with_entry(account, JournalEntry.State.POSTED)
    assert client.get(_url(locked)).data["is_editable"] is False


@pytest.mark.django_db
def test_cancelled_without_entry_can_be_purged(client, account):
    m = _movement(account, status="CANCELLED")
    assert client.delete(_url(m)).status_code == 204
    assert not TreasuryMovement.objects.filter(pk=m.pk).exists()
