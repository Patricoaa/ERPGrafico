"""
Tests for group-level difference tracking (ADR: difference lives on ReconciliationMatch).
"""
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model

from accounting.models import Account, AccountType
from treasury.matching_service import MatchingService
from treasury.models import BankStatement, BankStatementLine, TreasuryAccount, TreasuryMovement

User = get_user_model()


@pytest.fixture
def setup_data(db):
    user = User.objects.create_user(username="testuser", password="password")

    acc = Account.objects.create(
        name="Bank Account", code="1.1.01.001", account_type=AccountType.ASSET
    )

    from treasury.models import Bank
    bank = Bank.objects.create(name="Test Bank", code="TB")

    treasury_acc = TreasuryAccount.objects.create(
        name="Main Bank",
        account=acc,
        account_type=TreasuryAccount.Type.CHECKING,
        bank=bank,
        account_number="123456",
    )

    statement = BankStatement.objects.create(
        treasury_account=treasury_acc,
        statement_date="2026-01-01",
        opening_balance=0,
        closing_balance=1000,
        imported_by=user,
    )

    return {"user": user, "treasury_acc": treasury_acc, "statement": statement}


@pytest.mark.django_db
def test_difference_stored_at_group_level(setup_data):
    """
    Total lines (600+400=1000) vs payment (900) → difference 100 stored on group.
    Lines themselves carry no difference_amount.
    """
    user = setup_data["user"]
    statement = setup_data["statement"]

    l1 = BankStatementLine.objects.create(
        statement=statement, line_number=1,
        transaction_date="2026-01-01", description="Line 1",
        credit=Decimal("600.00"), debit=0, balance=Decimal("600.00"),
    )
    l2 = BankStatementLine.objects.create(
        statement=statement, line_number=2,
        transaction_date="2026-01-01", description="Line 2",
        credit=Decimal("400.00"), debit=0, balance=Decimal("1000.00"),
    )
    p1 = TreasuryMovement.objects.create(
        movement_type="INBOUND", to_account=setup_data["treasury_acc"],
        amount=Decimal("900.00"), date="2026-01-01", created_by=user,
    )

    group = MatchingService.create_match_group(
        line_ids=[l1.id, l2.id], movement_ids=[p1.id], user=user, difference_reason="COMMISSION"
    )

    group.refresh_from_db()
    assert group.difference_amount == Decimal("100.00")
    assert group.difference_reason == "COMMISSION"


@pytest.mark.django_db
def test_difference_multiple_lines_and_payments(setup_data):
    """
    N lines vs M payments — total difference = sum(lines) - sum(payments).
    """
    user = setup_data["user"]
    statement = setup_data["statement"]

    l1 = BankStatementLine.objects.create(
        statement=statement, line_number=3,
        transaction_date="2026-01-01", description="L1",
        credit=Decimal("333.33"), debit=0, balance=Decimal("333.33"),
    )
    l2 = BankStatementLine.objects.create(
        statement=statement, line_number=4,
        transaction_date="2026-01-01", description="L2",
        credit=Decimal("333.33"), debit=0, balance=Decimal("666.66"),
    )
    l3 = BankStatementLine.objects.create(
        statement=statement, line_number=5,
        transaction_date="2026-01-01", description="L3",
        credit=Decimal("333.34"), debit=0, balance=Decimal("1000.00"),
    )
    p1 = TreasuryMovement.objects.create(
        movement_type="INBOUND", to_account=setup_data["treasury_acc"],
        amount=Decimal("900.00"), date="2026-01-01", created_by=user,
    )

    group = MatchingService.create_match_group(
        line_ids=[l1.id, l2.id, l3.id], movement_ids=[p1.id], user=user
    )

    group.refresh_from_db()
    assert group.difference_amount == Decimal("100.00")


@pytest.mark.django_db
def test_adjustment_entry_is_draft(setup_data):
    from accounting.models import AccountingSettings, JournalEntry
    from treasury.difference_service import DifferenceService

    user = setup_data["user"]
    statement = setup_data["statement"]

    settings = AccountingSettings.get_solo()
    acc_diff = Account.objects.create(
        name="Commision Account", code="5.1.01.001", account_type=AccountType.EXPENSE
    )
    settings.bank_commission_account = acc_diff
    settings.save()

    l1 = BankStatementLine.objects.create(
        statement=statement, line_number=6,
        transaction_date="2026-01-01", description="Diff Line",
        credit=Decimal("100.00"), debit=0, balance=Decimal("100.00"),
    )
    p1 = TreasuryMovement.objects.create(
        movement_type="INBOUND", to_account=setup_data["treasury_acc"],
        amount=Decimal("90.00"), date="2026-01-01", created_by=user,
    )

    group = MatchingService.create_match_group(
        line_ids=[l1.id], movement_ids=[p1.id], user=user
    )

    entry = DifferenceService.create_difference_adjustment(
        group=group, difference_type=DifferenceService.COMMISSION, user=user
    )

    group.refresh_from_db()
    assert entry.status == JournalEntry.State.DRAFT
    assert group.difference_journal_entry == entry
