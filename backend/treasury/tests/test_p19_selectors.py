"""
P1-9: selectors de tesorería — cash_flows con orden+LIMIT en SQL,
overview con balance agrupado + select_related, y grupo de conciliación
resuelto desde relations prefetched (sin consultas por línea/movimiento).
"""

from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model

from accounting.models import Account, AccountType, JournalEntry, JournalItem
from treasury.models import (
    Bank,
    BankStatement,
    BankStatementLine,
    PaymentMethod,
    ReconciliationMatch,
    TerminalBatch,
    TreasuryAccount,
    TreasuryMovement,
)
from treasury.selectors import BankSelector, ReconciliationMatchSelector, TreasuryDashboardSelector
from treasury.views import BankStatementLineViewSet

User = get_user_model()
TODAY = date.today()


@pytest.mark.django_db
def test_overview_bounded_queries_and_balances(django_assert_max_num_queries):
    bank = Bank.objects.create(name="Banco Test")
    account = Account.objects.create(name="Caja", code="1.1.01.999", account_type=AccountType.ASSET)
    account2 = Account.objects.create(
        name="Banco", code="1.1.02.999", account_type=AccountType.ASSET
    )
    ta1 = TreasuryAccount.objects.create(
        name="Cuenta Corriente", account_type=TreasuryAccount.Type.CHECKING, currency="CLP", bank=bank, account=account, account_number="123456"
    )
    ta2 = TreasuryAccount.objects.create(
        name="Cuenta Corriente 2",
        account_type=TreasuryAccount.Type.CHECKING,
        currency="CLP",
        bank=bank,
        account=account2,
        account_number="654321",
    )

    entry = JournalEntry.objects.create(
        date=TODAY, description="Apertura", status=JournalEntry.Status.POSTED
    )
    JournalItem.objects.create(entry=entry, account=account, debit=Decimal("1000"))
    JournalItem.objects.create(entry=entry, account=account2, debit=Decimal("2500"))

    with django_assert_max_num_queries(18):
        overview = BankSelector.get_overview(bank)

    balances = {a["id"]: a["current_balance"] for a in overview["accounts"]}
    assert balances[ta1.id] == 1000.0
    assert balances[ta2.id] == 2500.0
    assert overview["summary"]["total_accounts"] == 2


@pytest.mark.django_db
def test_cash_flows_capped_and_ordered_in_db(django_assert_max_num_queries):
    bank = Bank.objects.create(name="Banco Test")
    account = Account.objects.create(name="Caja", code="1.1.01.999", account_type=AccountType.ASSET)
    ta = TreasuryAccount.objects.create(
        name="Cuenta Corriente", account_type=TreasuryAccount.Type.CHECKING, currency="CLP", bank=bank, account=account, account_number="123456"
    )
    for i in range(55):
        TreasuryMovement.objects.create(
            movement_type=TreasuryMovement.Type.INBOUND,
            payment_method=TreasuryMovement.Method.CASH,
            amount=Decimal("10"),
            date=TODAY - timedelta(days=i),
            to_account=ta,
        )

    with django_assert_max_num_queries(2):
        flows = TreasuryDashboardSelector.get_cash_flows(flow_type="third_party")

    assert len(flows) == 50
    dates = [f["date"] for f in flows]
    assert dates == sorted(dates, reverse=True)
    assert flows[0]["date"] == TODAY
    assert flows[-1]["date"] == TODAY - timedelta(days=49)


@pytest.mark.django_db
def test_get_group_data_prefetched_zero_queries(django_assert_num_queries):
    user = User.objects.create_user(username="testuser", password="x")
    bank = Bank.objects.create(name="Banco Test")
    account = Account.objects.create(name="Caja", code="1.1.01.999", account_type=AccountType.ASSET)
    ta = TreasuryAccount.objects.create(
        name="Cuenta Corriente", account_type=TreasuryAccount.Type.CHECKING, currency="CLP", bank=bank, account=account, account_number="123456"
    )
    stmt = BankStatement.objects.create(
        treasury_account=ta,
        statement_date=TODAY,
        opening_balance=Decimal("0"),
        closing_balance=Decimal("0"),
        imported_by=user,
    )
    line = BankStatementLine.objects.create(
        statement=stmt,
        line_number=1,
        transaction_date=TODAY,
        description="Movimiento",
        credit=Decimal("100"),
        balance=Decimal("100"),
        reconciliation_status=BankStatementLine.ReconciliationStatus.MATCHED,
    )
    match = ReconciliationMatch.objects.create(treasury_account=ta, is_confirmed=True)
    line.reconciliation_match = match
    line.save()

    pm = PaymentMethod.objects.create(
        name="Terminal", method_type=PaymentMethod.Type.CREDIT_CARD, treasury_account=ta
    )
    batch = TerminalBatch.objects.create(
        payment_method=pm,
        sales_date=TODAY,
        settlement_date=TODAY,
        gross_amount=Decimal("100"),
        commission_base=Decimal("0"),
        commission_tax=Decimal("0"),
        commission_total=Decimal("0"),
        net_amount=Decimal("100"),
    )

    m1 = TreasuryMovement.objects.create(
        movement_type=TreasuryMovement.Type.INBOUND,
        payment_method=TreasuryMovement.Method.CARD,
        amount=Decimal("50"),
        date=TODAY,
        reconciliation_match=match,
    )
    TreasuryMovement.objects.create(
        movement_type=TreasuryMovement.Type.INBOUND,
        payment_method=TreasuryMovement.Method.CARD,
        amount=Decimal("50"),
        date=TODAY,
        reconciliation_match=match,
        terminal_batch=batch,
        bank_statement_line=line,
    )

    fetched = list(BankStatementLineViewSet.queryset.filter(pk=line.pk))[0]

    with django_assert_num_queries(0):
        data = ReconciliationMatchSelector.get_group_data(fetched)

    assert data["id"] == match.id
    assert data["difference_amount"] == float(fetched.difference_amount)
    assert {m["id"] for m in data["movements"]} == {m1.id}
    assert [b["id"] for b in data["batches"]] == [batch.id]


@pytest.mark.django_db
def test_get_group_data_without_prefetch_still_works(db):
    user = User.objects.create_user(username="testuser2", password="x")
    bank = Bank.objects.create(name="Banco Test")
    account = Account.objects.create(name="Caja", code="1.1.01.999", account_type=AccountType.ASSET)
    ta = TreasuryAccount.objects.create(
        name="Cuenta Corriente", account_type=TreasuryAccount.Type.CHECKING, currency="CLP", bank=bank, account=account, account_number="123456"
    )
    stmt = BankStatement.objects.create(
        treasury_account=ta,
        statement_date=TODAY,
        opening_balance=Decimal("0"),
        closing_balance=Decimal("0"),
        imported_by=user,
    )
    match = ReconciliationMatch.objects.create(treasury_account=ta)
    line = BankStatementLine.objects.create(
        statement=stmt,
        line_number=1,
        transaction_date=TODAY,
        description="x",
        credit=Decimal("10"),
        balance=Decimal("10"),
        reconciliation_match=match,
    )
    TreasuryMovement.objects.create(
        movement_type=TreasuryMovement.Type.INBOUND,
        payment_method=TreasuryMovement.Method.CASH,
        amount=Decimal("10"),
        date=TODAY,
        reconciliation_match=match,
    )

    data = ReconciliationMatchSelector.get_group_data(line)
    assert data["id"] == match.id
    assert len(data["movements"]) == 1
