"""`current_balance` reads totals loaded with the instance; validations need the stored value (ADR-0115)."""

from datetime import date
from decimal import Decimal

import pytest

from accounting.models import Account, AccountType, JournalEntry
from treasury.models import TreasuryAccount

pytestmark = pytest.mark.django_db


@pytest.fixture
def cash_account():
    Account.objects.get_or_create(
        code=Account.CASH_GROUP_CODE, defaults={"name": "Efectivo y Equivalentes", "account_type": AccountType.ASSET}
    )
    ledger = Account.objects.create(name="Caja", code="1.1.01.950", account_type=AccountType.ASSET)
    return TreasuryAccount.objects.create(name="Caja", account=ledger, account_type=TreasuryAccount.Type.CASH)


def test_fresh_balance_sees_postings_made_after_the_instance_was_loaded(cash_account):
    other = Account.objects.create(name="Ventas", code="4.1.01.950", account_type=AccountType.INCOME)
    entry = JournalEntry.objects.create(date=date(2026, 6, 1), description="Fondeo", status=JournalEntry.State.POSTED)
    assert cash_account.current_balance == Decimal("0")

    entry.items.create(account=cash_account.account, debit=Decimal("700"), credit=Decimal("0"))
    entry.items.create(account=other, debit=Decimal("0"), credit=Decimal("700"))

    assert cash_account.current_balance == Decimal("0")  # snapshot, by design
    assert cash_account.fresh_balance() == Decimal("700")


def test_fresh_balance_without_account_is_zero():
    assert TreasuryAccount(name="Sin cuenta").fresh_balance() == Decimal("0")
