from datetime import date
from decimal import Decimal

import pytest

from accounting.models import Account, AccountType, JournalEntry, JournalItem
from accounting.selectors import DEFAULT_LEDGER_LIMIT, get_account_ledger
from contacts.models import Contact


@pytest.fixture
def cash_account(db):
    return Account.objects.create(
        code="1.1.01", name="Caja General", account_type=AccountType.ASSET
    )


def _entry(date_, description, items):
    entry = JournalEntry.objects.create(
        date=date_, description=description, status=JournalEntry.Status.POSTED
    )
    for item in items:
        JournalItem.objects.create(
            entry=entry,
            account=item["account"],
            debit=Decimal(item.get("debit", "0")),
            credit=Decimal(item.get("credit", "0")),
            partner=item.get("partner"),
        )
    return entry


@pytest.mark.django_db
class TestLedger:
    def test_running_balance_and_totals(self, cash_account):
        _entry(date(2026, 1, 5), "A", [{"account": cash_account, "debit": "1000"}])
        _entry(date(2026, 1, 10), "B", [{"account": cash_account, "credit": "300"}])
        _entry(date(2026, 1, 15), "C", [{"account": cash_account, "debit": "200"}])

        data = get_account_ledger(account=cash_account, start_date=None, end_date=None)

        assert data["opening_balance"] == 0.0
        assert data["period_debit"] == 1200.0
        assert data["period_credit"] == 300.0
        assert data["closing_balance"] == 900.0
        assert data["truncated"] is False
        assert [m["balance"] for m in data["movements"]] == [1000.0, 700.0, 900.0]

    def test_opening_balance_with_start_date(self, cash_account):
        _entry(date(2026, 1, 5), "A", [{"account": cash_account, "debit": "1000"}])
        _entry(date(2026, 1, 10), "B", [{"account": cash_account, "credit": "300"}])
        _entry(date(2026, 1, 15), "C", [{"account": cash_account, "debit": "200"}])

        data = get_account_ledger(
            account=cash_account, start_date="2026-01-10", end_date="2026-01-31"
        )

        assert data["opening_balance"] == 1000.0
        assert data["period_debit"] == 200.0
        assert data["period_credit"] == 300.0
        assert data["closing_balance"] == 900.0
        assert [m["balance"] for m in data["movements"]] == [700.0, 900.0]

    def test_hard_cap_truncates_but_totals_stay_exact(self, cash_account):
        items = [{"account": cash_account, "debit": "1"}] * (DEFAULT_LEDGER_LIMIT + 10)
        _entry(date(2026, 2, 1), "Masivo", items)

        data = get_account_ledger(account=cash_account, start_date=None, end_date=None)

        assert data["truncated"] is True
        assert len(data["movements"]) == DEFAULT_LEDGER_LIMIT
        assert data["period_debit"] == float(DEFAULT_LEDGER_LIMIT + 10)
        assert data["closing_balance"] == float(DEFAULT_LEDGER_LIMIT + 10)

    def test_custom_limit_capped(self, cash_account):
        _entry(date(2026, 2, 1), "Masivo", [{"account": cash_account, "debit": "1"}] * 50)

        data = get_account_ledger(account=cash_account, start_date=None, end_date=None, limit=10)
        assert len(data["movements"]) == 10
        assert data["truncated"] is True

        data = get_account_ledger(account=cash_account, start_date=None, end_date=None, limit="not-a-number")
        assert len(data["movements"]) == 50
        assert data["truncated"] is False

    def test_partner_prefetch_bounded_queries(self, cash_account, django_assert_max_num_queries):
        partners = [
            Contact.objects.create(name=f"Partner {i}", tax_id=f"11{i}111-{i}") for i in range(3)
        ]
        for i in range(3):
            _entry(
                date(2026, 3, i + 1),
                f"Mov {i}",
                [{"account": cash_account, "debit": "100", "partner": partners[i]}],
            )

        with django_assert_max_num_queries(5):
            data = get_account_ledger(account=cash_account, start_date=None, end_date=None)

        assert [m["partner"] for m in data["movements"]] == [
            "Partner 0", "Partner 1", "Partner 2",
        ]
        assert [m["balance"] for m in data["movements"]] == [100.0, 200.0, 300.0]
