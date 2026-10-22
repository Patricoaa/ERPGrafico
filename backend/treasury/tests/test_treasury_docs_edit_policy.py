"""ADR-0091 — statement lines, terminal batches and card pending charges."""

from datetime import date
from decimal import Decimal
from types import SimpleNamespace

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from accounting.models import Account, AccountType
from core.edit_policy import DocumentLockedError
from treasury.card_service import CardService
from treasury.models import (
    Bank,
    BankStatement,
    BankStatementLine,
    CardPendingCharge,
    PaymentMethod,
    TerminalBatch,
    TreasuryAccount,
)

User = get_user_model()
TODAY = date(2026, 9, 15)


@pytest.fixture
def user(db):
    return User.objects.create_superuser("trdocs", "t@x.cl", "x")


@pytest.fixture
def client(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


@pytest.fixture
def account(db):
    acc = Account.objects.create(name="Banco", code="1.1.01.940", account_type=AccountType.ASSET)
    return TreasuryAccount.objects.create(
        name="Cuenta Corriente", account_type=TreasuryAccount.Type.CHECKING,
        bank=Bank.objects.create(name="Banco Test"), account=acc, account_number="940",
    )


def _line(account, user, status):
    statement = BankStatement.objects.create(
        treasury_account=account, statement_date=TODAY,
        opening_balance=Decimal("0"), closing_balance=Decimal("0"), imported_by=user,
    )
    return BankStatementLine.objects.create(
        statement=statement, line_number=1, transaction_date=TODAY, description="Abono",
        credit=Decimal("100"), balance=Decimal("100"), reconciliation_status=status,
    )


def _url(line):
    return f"/api/treasury/statement-lines/{line.pk}/"


@pytest.mark.django_db
def test_reconciled_line_rejects_edits_but_accepts_notes(client, account, user):
    line = _line(account, user, "RECONCILED")
    assert client.patch(_url(line), {"credit": "1"}, format="json").status_code == 422
    res = client.patch(_url(line), {"reconciliation_status": "UNRECONCILED"}, format="json")
    assert res.status_code == 422
    assert client.patch(_url(line), {"notes": "ok"}, format="json").status_code == 200
    assert client.delete(_url(line)).status_code == 422


@pytest.mark.django_db
def test_exclude_and_restore_flow_still_works(client, account, user):
    line = _line(account, user, "UNRECONCILED")
    res = client.patch(
        _url(line),
        {"reconciliation_status": "EXCLUDED", "exclusion_reason": "DUPLICATE", "exclusion_notes": "x"},
        format="json",
    )
    assert res.status_code == 200, res.data
    res = client.patch(
        _url(line),
        {"reconciliation_status": "UNRECONCILED", "exclusion_reason": None, "exclusion_notes": None},
        format="json",
    )
    assert res.status_code == 200, res.data


@pytest.mark.django_db
def test_line_cannot_be_marked_reconciled_by_patch(client, account, user):
    line = _line(account, user, "UNRECONCILED")
    assert client.patch(_url(line), {"reconciliation_status": "RECONCILED"}, format="json").status_code == 400
    line.refresh_from_db()
    assert line.reconciliation_status == "UNRECONCILED"


@pytest.mark.django_db
def test_settled_terminal_batch_is_locked(client, account):
    pm = PaymentMethod.objects.create(
        name="Terminal", method_type=PaymentMethod.Type.CREDIT_CARD, treasury_account=account
    )
    batch = TerminalBatch.objects.create(
        payment_method=pm, sales_date=TODAY, settlement_date=TODAY,
        gross_amount=Decimal("100"), commission_base=0, commission_tax=0,
        commission_total=0, net_amount=Decimal("100"), status="SETTLED",
    )
    url = f"/api/treasury/terminal-batches/{batch.pk}/"
    assert client.patch(url, {"gross_amount": "1"}, format="json").status_code == 422
    assert client.delete(url).status_code == 422
    client.patch(url, {"status": "PENDING"}, format="json")
    batch.refresh_from_db()
    assert batch.status == "SETTLED"


@pytest.mark.django_db
def test_billed_card_charge_cannot_be_changed_or_deleted(account, user):
    charge = CardPendingCharge.objects.create(
        card_account=account, amount=Decimal("500"), charge_type="FEE", date=TODAY, is_billed=True
    )
    request = SimpleNamespace(data={"id": charge.pk, "amount": "1"}, user=user)
    with pytest.raises(DocumentLockedError):
        CardService.update_charge_from_request(request)
    with pytest.raises(DocumentLockedError):
        CardService.delete_charge_from_request(SimpleNamespace(data={"id": charge.pk}, user=user))
    assert CardPendingCharge.objects.filter(pk=charge.pk, amount=Decimal("500")).exists()
