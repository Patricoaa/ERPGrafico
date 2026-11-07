"""record_dividend_payment read `is_bank` without defining it: every payment raised NameError."""

from datetime import date
from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError

from accounting.models import Account, AccountingSettings, AccountType, JournalEntry
from contacts.models import Contact
from contacts.partner_service import PartnerService
from treasury.models import Bank, TreasuryAccount

pytestmark = pytest.mark.django_db


def _configure_partner_accounts():
    Account.objects.get_or_create(
        code=Account.CASH_GROUP_CODE, defaults={"name": "Efectivo y Equivalentes", "account_type": AccountType.ASSET}
    )
    settings = AccountingSettings.get_solo()
    settings.partner_dividends_payable_account = Account.objects.create(
        name="Dividendos", code="2.1.09.970", account_type=AccountType.LIABILITY
    )
    settings.partner_provisional_withdrawal_account = Account.objects.create(
        name="Retiros", code="3.1.09.970", account_type=AccountType.EQUITY
    )
    settings.save()


def _account(account_type, code, funds=Decimal("0"), **account_fields):
    _configure_partner_accounts()
    ledger = Account.objects.create(name="Pago", code=code, account_type=AccountType.ASSET)
    if funds:
        capital = Account.objects.create(name="Capital", code=f"3.1.01.{code}", account_type=AccountType.EQUITY)
        entry = JournalEntry.objects.create(
            date=date(2026, 1, 1), description="Aporte", status=JournalEntry.Status.POSTED
        )
        entry.items.create(account=ledger, debit=funds, credit=Decimal("0"))
        entry.items.create(account=capital, debit=Decimal("0"), credit=funds)
    return TreasuryAccount.objects.create(name="Pago", account=ledger, account_type=account_type, **account_fields)


def _record(account, amount=Decimal("100"), when=date(2026, 6, 1)):
    partner = Contact.objects.create(name="Socia", tax_id="22222222-2", is_partner=True)
    return PartnerService.record_dividend_payment(
        partner=partner, amount=amount, date=when, treasury_account_id=account.pk
    )


def _pay(account_type, code, **account_fields):
    account = _account(account_type, code, funds=Decimal("100"), **account_fields)
    return _record(account).journal_entry.items.get(account=account.account).label


def test_cash_payment_is_labelled_as_cash():
    assert "Efectivo" in _pay(TreasuryAccount.Type.CASH, "1.1.01.971")


def test_bank_payment_is_labelled_as_bank():
    bank = Bank.objects.create(name="Banco", code="BCO")
    assert "Banco" in _pay(TreasuryAccount.Type.CHECKING, "1.1.01.972", account_number="1", bank=bank)


def test_rejects_payment_above_the_account_balance():
    account = _account(TreasuryAccount.Type.CASH, "1.1.01.973", funds=Decimal("99"))

    with pytest.raises(ValidationError, match="Saldo insuficiente"):
        _record(account)

    assert not JournalEntry.objects.filter(status=JournalEntry.Status.POSTED, description__icontains="dividend").exists()


def test_rejects_payment_dated_in_a_closed_period(monkeypatch):
    account = _account(TreasuryAccount.Type.CASH, "1.1.01.974", funds=Decimal("100"))
    monkeypatch.setattr("tax.services.AccountingPeriodService.is_period_closed", lambda _date: True)

    with pytest.raises(ValidationError, match="cerrado"):
        _record(account)
