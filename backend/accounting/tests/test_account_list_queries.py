"""Invariant 14 — the account list costs the same queries for 1 or N accounts."""

from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient

from accounting.models import Account, AccountType, JournalEntry, JournalItem


@pytest.fixture
def client(db):
    c = APIClient()
    c.force_authenticate(get_user_model().objects.create_superuser("acclist", "a@x.cl", "x"))
    return c


def _list_queries(client):
    with CaptureQueriesContext(connection) as ctx:
        res = client.get("/api/accounting/accounts/")
    assert res.status_code == 200
    return len(ctx.captured_queries)


@pytest.mark.django_db
def test_account_list_has_no_per_row_queries(client):
    entry = JournalEntry.objects.create(date=timezone.localdate(), description="x", status="POSTED")

    def add(n, with_items):
        for i in range(n):
            acc = Account.objects.create(
                name=f"Cta {with_items}{i}", code=f"8.{int(with_items)}.{i:02d}{n}",
                account_type=AccountType.ASSET,
            )
            if with_items:
                JournalItem.objects.create(entry=entry, account=acc, debit=Decimal("5"), credit=0)

    add(1, True)
    add(1, False)
    baseline = _list_queries(client)
    add(6, True)
    add(6, False)
    assert _list_queries(client) == baseline


@pytest.mark.django_db
def test_account_totals_are_correct_in_list_and_detail(client):
    acc = Account.objects.create(name="Banco", code="8.9.01", account_type=AccountType.ASSET)
    entry = JournalEntry.objects.create(date=timezone.localdate(), description="x", status="POSTED")
    JournalItem.objects.create(entry=entry, account=acc, debit=Decimal("100"), credit=0)
    JournalItem.objects.create(entry=entry, account=acc, debit=0, credit=Decimal("30"))
    empty = Account.objects.create(name="Vacía", code="8.9.02", account_type=AccountType.ASSET)

    data = client.get("/api/accounting/accounts/").data
    rows = {r["id"]: r for r in (data["results"] if isinstance(data, dict) else data)}
    assert Decimal(rows[acc.pk]["balance"]) == Decimal("70")
    assert Decimal(rows[empty.pk]["balance"]) == Decimal("0")
    detail = client.get(f"/api/accounting/accounts/{acc.pk}/").data
    assert Decimal(detail["balance"]) == Decimal("70")
