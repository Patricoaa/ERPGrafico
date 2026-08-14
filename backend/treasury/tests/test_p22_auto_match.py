from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model

from accounting.models import Account, AccountType
from treasury.matching_service import MatchingService
from treasury.models import (
    Bank,
    BankStatement,
    BankStatementLine,
    ReconciliationSettings,
    TreasuryAccount,
    TreasuryMovement,
)
from treasury.tasks import auto_match_statement_task

User = get_user_model()


class _StubResultBackend:
    def store_result(self, *args, **kwargs):
        return None

    def get_task_meta(self, *args, **kwargs):
        return {"status": "SUCCESS", "result": None}

    def mark_as_started(self, *args, **kwargs):
        return None

    def mark_as_done(self, *args, **kwargs):
        return None


@pytest.fixture
def auto_match_setup(db):
    user = User.objects.create_user(username="automatcher", password="password")

    account = Account.objects.create(
        name="Bank Account", code="1.1.01.001", account_type=AccountType.ASSET
    )
    bank = Bank.objects.create(name="Test Bank", code="TB")
    treasury = TreasuryAccount.objects.create(
        name="Bank Treasury",
        account=account,
        account_type=TreasuryAccount.Type.CHECKING,
        bank=bank,
        account_number="123456",
    )
    ReconciliationSettings.objects.create(
        treasury_account=None,
        amount_weight=40,
        date_weight=30,
        reference_weight=20,
        contact_weight=10,
        confidence_threshold=80,
        date_range_days=30,
    )
    statement = BankStatement.objects.create(
        treasury_account=treasury,
        statement_date=date(2026, 1, 1),
        opening_balance=0,
        closing_balance=1000,
        imported_by=user,
    )

    return {"user": user, "treasury": treasury, "account": account, "statement": statement}


def test_auto_match_task_matches_by_amount_date_and_reference(auto_match_setup):
    statement = auto_match_setup["statement"]
    treasury = auto_match_setup["treasury"]
    user = auto_match_setup["user"]
    account = auto_match_setup["account"]

    line = BankStatementLine.objects.create(
        statement=statement,
        line_number=1,
        transaction_date=date(2026, 1, 1),
        description="Pago recibido",
        transaction_id="TXN-0001",
        credit=Decimal("100.00"),
        debit=0,
        balance=Decimal("100.00"),
    )

    TreasuryMovement.objects.create(
        movement_type=TreasuryMovement.Type.INBOUND,
        to_account=treasury,
        amount=Decimal("100.00"),
        date=date(2026, 1, 1),
        transaction_number="TXN-0001",
        created_by=user,
        account=account,
    )

    auto_match_statement_task.backend = _StubResultBackend()
    result = auto_match_statement_task.apply(args=[statement.id, 80.0]).result

    assert result["matched_count"] == 1
    assert result["total_unreconciled"] == 1
    assert result["matches"][0]["line_id"] == line.id

    line.refresh_from_db()
    assert line.reconciliation_status == BankStatementLine.ReconciliationStatus.MATCHED


def test_calculate_match_score_can_skip_payment_data(auto_match_setup):
    statement = auto_match_setup["statement"]
    treasury = auto_match_setup["treasury"]
    user = auto_match_setup["user"]
    account = auto_match_setup["account"]

    line = BankStatementLine.objects.create(
        statement=statement,
        line_number=1,
        transaction_date=date(2026, 1, 1),
        description="Pago recibido",
        credit=Decimal("100.00"),
        debit=0,
        balance=Decimal("100.00"),
    )
    payment = TreasuryMovement.objects.create(
        movement_type=TreasuryMovement.Type.INBOUND,
        to_account=treasury,
        amount=Decimal("100.00"),
        date=date(2026, 1, 1),
        created_by=user,
        account=account,
    )

    with_serializer = MatchingService._calculate_match_score(line, payment)
    assert with_serializer["payment_data"] is not None

    without_serializer = MatchingService._calculate_match_score(
        line, payment, include_payment_data=False
    )
    assert without_serializer["payment_data"] is None
    assert without_serializer["score"] == with_serializer["score"]
    assert without_serializer["reasons"] == with_serializer["reasons"]
