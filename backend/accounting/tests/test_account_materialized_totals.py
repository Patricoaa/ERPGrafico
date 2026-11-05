"""Saldos contabilizados materializados en Account (ADR-0115)."""

from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from accounting.balances import refresh_account_totals
from accounting.models import Account, AccountType, JournalEntry, JournalItem


@pytest.fixture
def accounts(db):
    return {
        "a": Account.objects.create(code="1.1.01", name="Caja", account_type=AccountType.ASSET),
        "b": Account.objects.create(code="1.1.02", name="Banco", account_type=AccountType.ASSET),
    }


def _entry(status, items):
    entry = JournalEntry.objects.create(date=date(2026, 8, 1), description="t", status=JournalEntry.Status.DRAFT)
    for account, debit, credit in items:
        JournalItem.objects.create(entry=entry, account=account, debit=Decimal(debit), credit=Decimal(credit))
    entry.status = status
    entry.save()
    return entry


def _totals(account):
    account.refresh_from_db()
    return account.posted_debit_total, account.posted_credit_total, account.posted_items_count


@pytest.mark.django_db
def test_publishing_an_entry_updates_both_accounts(accounts):
    _entry(JournalEntry.Status.POSTED, [(accounts["a"], 100, 0), (accounts["b"], 0, 100)])

    assert _totals(accounts["a"]) == (100, 0, 1)
    assert _totals(accounts["b"]) == (0, 100, 1)


@pytest.mark.django_db
def test_draft_entries_do_not_count(accounts):
    _entry(JournalEntry.Status.DRAFT, [(accounts["a"], 100, 0)])

    assert _totals(accounts["a"]) == (0, 0, 0)


@pytest.mark.django_db
def test_cancelling_a_posted_entry_removes_its_totals(accounts):
    entry = _entry(JournalEntry.Status.POSTED, [(accounts["a"], 100, 0)])
    entry.status = JournalEntry.Status.CANCELLED
    entry.save()

    assert _totals(accounts["a"]) == (0, 0, 0)


@pytest.mark.django_db
def test_item_added_to_posted_entry_is_counted(accounts):
    entry = _entry(JournalEntry.Status.POSTED, [])
    JournalItem.objects.create(entry=entry, account=accounts["a"], debit=Decimal("50"), credit=Decimal("0"))

    assert _totals(accounts["a"]) == (50, 0, 1)


@pytest.mark.django_db
def test_deleting_a_posted_item_updates_totals(accounts):
    entry = _entry(JournalEntry.Status.POSTED, [(accounts["a"], 100, 0), (accounts["a"], 30, 0)])
    JournalItem.objects.filter(entry=entry, debit=Decimal("30")).delete()

    assert _totals(accounts["a"]) == (100, 0, 1)


@pytest.mark.django_db
def test_list_reports_materialized_totals_with_hierarchy(accounts):
    """La lista devuelve los saldos materializados aun con jerarquía (sin joins de suma)."""
    parent = Account.objects.create(code="1", name="Activo", account_type=AccountType.ASSET)
    leaf = Account.objects.create(code="1.1", name="Hijo", account_type=AccountType.ASSET, parent=parent)
    Account.objects.create(code="1.2", name="Hermano", account_type=AccountType.ASSET, parent=parent)
    _entry(JournalEntry.Status.POSTED, [(leaf, 100, 0)])

    user = get_user_model().objects.create_superuser("accts", "accts@test.com", "pass")
    client = APIClient(HTTP_HOST="localhost")
    client.force_authenticate(user=user)
    rows = {row["code"]: row for row in client.get("/api/accounting/accounts/").json()}

    assert Decimal(str(rows["1.1"]["debit_total"])) == Decimal("100")
    assert Decimal(str(rows["1.2"]["debit_total"])) == Decimal("0")


@pytest.mark.django_db
def test_full_recalculation_restores_drifted_totals(accounts):
    _entry(JournalEntry.Status.POSTED, [(accounts["a"], 100, 0)])
    Account.objects.filter(pk=accounts["a"].pk).update(posted_debit_total=999, posted_items_count=7)

    refresh_account_totals([accounts["a"].pk])

    assert _totals(accounts["a"]) == (100, 0, 1)


@pytest.mark.django_db
def test_transition_on_a_reloaded_entry_refreshes_totals(accounts):
    entry = _entry(JournalEntry.Status.POSTED, [(accounts["a"], 100, 0)])
    reloaded = JournalEntry.objects.get(pk=entry.pk)
    reloaded.status = JournalEntry.Status.REVERSAL
    reloaded.save()

    assert _totals(accounts["a"]) == (100, 0, 1)  # reversal still affects balances
    reloaded = JournalEntry.objects.get(pk=entry.pk)
    reloaded.status = JournalEntry.Status.CANCELLED
    reloaded.save()

    assert _totals(accounts["a"]) == (0, 0, 0)
