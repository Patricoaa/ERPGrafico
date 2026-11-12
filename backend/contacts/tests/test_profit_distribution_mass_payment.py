"""POST /api/contacts/profit-distributions/{id}/mass_payment/ (MassPaymentWizard), end to end."""

import uuid
from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from rest_framework.test import APIClient

from accounting.models import Account, AccountingSettings, AccountType, FiscalYear, JournalEntry
from contacts.models import Contact
from contacts.partner_models import (
    PartnerEquityStake,
    PartnerTransaction,
    ProfitDistributionLine,
    ProfitDistributionLineDestination,
    ProfitDistributionPayment,
    ProfitDistributionResolution,
)
from contacts.profit_distribution_service import ProfitDistributionService
from treasury.models import Bank, TreasuryAccount, TreasuryMovement

pytestmark = pytest.mark.django_db

User = get_user_model()
DIVIDEND = ProfitDistributionLineDestination.Destination.DIVIDEND_PAYABLE


@pytest.fixture
def dividends_account():
    account = Account.objects.create(name="Dividendos", code="2.1.09.980", account_type=AccountType.LIABILITY)
    settings = AccountingSettings.get_solo()
    settings.partner_dividends_payable_account = account
    settings.save()
    return account


@pytest.fixture
def bank_account():
    Account.objects.get_or_create(
        code=Account.CASH_GROUP_CODE, defaults={"name": "Efectivo y Equivalentes", "account_type": AccountType.ASSET}
    )
    ledger = Account.objects.create(name="Cta Cte", code="1.1.01.980", account_type=AccountType.ASSET)
    account = TreasuryAccount.objects.create(
        name="Cta Cte",
        account=ledger,
        account_type=TreasuryAccount.Type.CHECKING,
        bank=Bank.objects.create(name="Banco", code="BCO"),
        account_number="1",
    )
    _fund(account, Decimal("5000"))
    return account


@pytest.fixture
def resolution(dividends_account):
    return ProfitDistributionResolution.objects.create(
        fiscal_year=2025, resolution_date=date(2026, 4, 30), net_result=Decimal("1000"), status="EXECUTED"
    )


@pytest.fixture
def client():
    api_client = APIClient()
    api_client.force_authenticate(user=User.objects.create_superuser(username="tesorero", password="x"))
    return api_client


def _fund(account, amount):
    capital = Account.objects.create(
        name="Capital", code=f"3.1.01.{account.pk}", account_type=AccountType.EQUITY
    )
    entry = JournalEntry.objects.create(date=date(2026, 1, 1), description="Aporte", status=JournalEntry.Status.POSTED)
    entry.items.create(account=account.account, debit=amount, credit=Decimal("0"))
    entry.items.create(account=capital, debit=Decimal("0"), credit=amount)


def _partner(resolution, name, tax_id, dividend):
    partner = Contact.objects.create(name=name, tax_id=tax_id, is_partner=True)
    line = ProfitDistributionLine.objects.create(
        resolution=resolution,
        partner=partner,
        percentage_at_date=Decimal("50"),
        gross_amount=dividend,
        net_amount=dividend,
    )
    ProfitDistributionLineDestination.objects.create(line=line, destination=DIVIDEND, amount=dividend)
    PartnerTransaction.objects.create(
        partner=partner,
        transaction_type=PartnerTransaction.Type.DIVIDEND,
        amount=dividend,
        date=date(2026, 4, 30),
        distribution_resolution=resolution,
    )
    return partner


def _pay(client, resolution, bank_account, *payments, key=None):
    return client.post(
        f"/api/contacts/profit-distributions/{resolution.pk}/mass_payment/",
        {
            "treasury_account_id": bank_account.pk,
            "payments_data": [{"partner_id": partner.pk, "amount": amount} for partner, amount in payments],
        },
        format="json",
        headers={"Idempotency-Key": key or str(uuid.uuid4())},
    )


def test_pays_several_partners_with_one_movement_and_entry(client, resolution, bank_account, dividends_account):
    ana = _partner(resolution, "Ana", "11111111-1", Decimal("600"))
    luis = _partner(resolution, "Luis", "22222222-2", Decimal("400"))

    response = _pay(client, resolution, bank_account, (ana, 600), (luis, 150))

    assert response.status_code == 200, response.content
    movement = TreasuryMovement.objects.get(from_account=bank_account)
    assert movement.movement_type == TreasuryMovement.Type.OUTBOUND
    assert movement.amount == Decimal("750")
    assert movement.journal_entry.status == JournalEntry.Status.POSTED
    assert ProfitDistributionPayment.objects.filter(resolution=resolution).count() == 2
    assert ana.partner_dividends_payable_balance == Decimal("0")
    assert luis.partner_dividends_payable_balance == Decimal("250")

    bank_account.refresh_from_db()
    assert bank_account.current_balance == Decimal("4250")
    # El débito va a la subcuenta de cada socio, no a la cuenta global.
    assert dividends_account.children.count() == 2
    assert sum(child.balance for child in dividends_account.children.all()) == Decimal("-750")


def test_entry_labels_and_partners_match_each_side(client, resolution, bank_account, dividends_account):
    ana = _partner(resolution, "Ana", "11111111-1", Decimal("600"))

    _pay(client, resolution, bank_account, (ana, 600))

    entry = ProfitDistributionPayment.objects.get(resolution=resolution).treasury_movement.journal_entry
    credit = entry.items.get(account=bank_account.account)
    debit = entry.items.get(account__parent=dividends_account)
    assert (credit.credit, credit.debit) == (Decimal("600"), Decimal("0"))
    assert "Banco" in credit.label
    assert (debit.debit, debit.credit) == (Decimal("600"), Decimal("0"))
    assert debit.partner == ana
    assert "Banco" not in debit.label


def test_response_reflects_the_payment(client, resolution, bank_account):
    ana = _partner(resolution, "Ana", "11111111-1", Decimal("600"))

    response = _pay(client, resolution, bank_account, (ana, 200))

    assert Decimal(str(response.json()["lines"][0]["paid_dividend_amount"])) == Decimal("200")


def test_cannot_pay_more_than_pending_across_payments(client, resolution, bank_account):
    ana = _partner(resolution, "Ana", "11111111-1", Decimal("600"))
    assert _pay(client, resolution, bank_account, (ana, 500)).status_code == 200

    response = _pay(client, resolution, bank_account, (ana, 101))

    assert response.status_code == 400
    assert ProfitDistributionPayment.objects.filter(resolution=resolution).count() == 1


def test_repeating_a_partner_cannot_exceed_pending(client, resolution, bank_account):
    ana = _partner(resolution, "Ana", "11111111-1", Decimal("600"))

    response = _pay(client, resolution, bank_account, (ana, 400), (ana, 400))

    assert response.status_code == 400
    assert not TreasuryMovement.objects.exists()


def test_resolution_must_be_executed(client, resolution, bank_account):
    ana = _partner(resolution, "Ana", "11111111-1", Decimal("600"))
    ProfitDistributionResolution.objects.filter(pk=resolution.pk).update(status="APPROVED")

    assert _pay(client, resolution, bank_account, (ana, 100)).status_code == 400
    assert not TreasuryMovement.objects.exists()


def test_missing_dividends_account_writes_nothing(client, resolution, bank_account):
    ana = _partner(resolution, "Ana", "11111111-1", Decimal("600"))
    settings = AccountingSettings.get_solo()
    settings.partner_dividends_payable_account = None
    settings.save()
    entries_before = JournalEntry.objects.count()

    assert _pay(client, resolution, bank_account, (ana, 100)).status_code == 400
    assert JournalEntry.objects.count() == entries_before
    assert not TreasuryMovement.objects.exists()


def test_service_rejects_empty_payment(resolution, bank_account):
    with pytest.raises(ValidationError):
        ProfitDistributionService.execute_mass_payment(resolution, bank_account.pk, [], None)


def test_full_flow_from_draft_to_payment(client, bank_account, dividends_account):
    """Create, approve and execute through the services: the wizard only ever sees executed resolutions."""
    settings = AccountingSettings.get_solo()
    settings.partner_current_year_earnings_account = Account.objects.create(
        name="Utilidad del Ejercicio", code="3.1.09.981", account_type=AccountType.EQUITY
    )
    settings.partner_retained_earnings_account = Account.objects.create(
        name="Utilidades Retenidas", code="3.1.09.982", account_type=AccountType.EQUITY
    )
    settings.save()
    fiscal_year = FiscalYear.objects.create(year=2025, start_date=date(2025, 1, 1), end_date=date(2025, 12, 31))
    user = User.objects.create_superuser(username="directora", password="x")
    partner = Contact.objects.create(name="Ana", tax_id="11111111-1", is_partner=True)
    PartnerEquityStake.objects.create(
        partner=partner, percentage=Decimal("100"), effective_from=date(2020, 1, 1)
    )

    resolution = ProfitDistributionService.create_draft_resolution(
        fiscal_year.pk, Decimal("1000"), date(2026, 4, 30), created_by=user
    )
    line = resolution.lines.get()
    ProfitDistributionService.update_draft_line_destinations(
        resolution,
        [{"line_id": line.pk, "destinations": [{"destination": "DIVIDEND", "amount": "1000"}]}],
    )
    ProfitDistributionService.approve_resolution(resolution, user)
    ProfitDistributionService.execute_resolution(resolution, user)
    partner.refresh_from_db()
    assert partner.partner_dividends_payable_balance == Decimal("1000")

    response = _pay(client, resolution, bank_account, (partner, 1000))

    assert response.status_code == 200, response.content
    assert partner.partner_dividends_payable_balance == Decimal("0")
    dividends_account.refresh_from_db()
    assert dividends_account.balance == Decimal("0")


def test_same_key_applies_the_payment_once(client, resolution, bank_account):
    ana = _partner(resolution, "Ana", "11111111-1", Decimal("600"))
    key = str(uuid.uuid4())

    first = _pay(client, resolution, bank_account, (ana, 100), key=key)
    second = _pay(client, resolution, bank_account, (ana, 100), key=key)

    assert first.status_code == second.status_code == 200
    # The stored response renders decimals as text: same value, different JSON type.
    assert Decimal(str(second.json()["lines"][0]["paid_dividend_amount"])) == Decimal("100")
    assert ProfitDistributionPayment.objects.filter(resolution=resolution).count() == 1
    assert ana.partner_dividends_payable_balance == Decimal("500")


def test_different_keys_are_different_payments(client, resolution, bank_account):
    ana = _partner(resolution, "Ana", "11111111-1", Decimal("600"))

    _pay(client, resolution, bank_account, (ana, 100))
    _pay(client, resolution, bank_account, (ana, 100))

    assert ana.partner_dividends_payable_balance == Decimal("400")


def test_key_is_required(client, resolution, bank_account):
    ana = _partner(resolution, "Ana", "11111111-1", Decimal("600"))

    response = client.post(
        f"/api/contacts/profit-distributions/{resolution.pk}/mass_payment/",
        {"treasury_account_id": bank_account.pk, "payments_data": [{"partner_id": ana.pk, "amount": 100}]},
        format="json",
    )

    assert response.status_code == 400
    assert not TreasuryMovement.objects.exists()


def test_rejects_payment_above_the_account_balance(client, resolution, bank_account):
    ana = _partner(resolution, "Ana", "11111111-1", Decimal("6000"))

    response = _pay(client, resolution, bank_account, (ana, 5001))

    assert response.status_code == 400
    assert "Saldo insuficiente" in response.json()["error"]["message"]
    assert not TreasuryMovement.objects.exists()


def test_accepts_payment_of_the_exact_balance(client, resolution, bank_account):
    ana = _partner(resolution, "Ana", "11111111-1", Decimal("6000"))

    assert _pay(client, resolution, bank_account, (ana, 5000)).status_code == 200


def test_rejects_payment_in_a_closed_period(client, resolution, bank_account, monkeypatch):
    ana = _partner(resolution, "Ana", "11111111-1", Decimal("600"))
    monkeypatch.setattr("tax.services.AccountingPeriodService.is_period_closed", lambda _date: True)

    response = _pay(client, resolution, bank_account, (ana, 100))

    assert response.status_code == 400
    assert "cerrado" in response.json()["error"]["message"]
    assert not TreasuryMovement.objects.exists()
