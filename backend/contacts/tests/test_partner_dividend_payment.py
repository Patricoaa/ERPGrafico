"""record_dividend_payment read `is_bank` without defining it: every payment raised NameError."""

from datetime import date
from decimal import Decimal

import pytest

from accounting.models import Account, AccountingSettings, AccountType
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


def _pay(account_type, code, **account_fields):
    _configure_partner_accounts()
    ledger = Account.objects.create(name="Pago", code=code, account_type=AccountType.ASSET)
    account = TreasuryAccount.objects.create(name="Pago", account=ledger, account_type=account_type, **account_fields)
    partner = Contact.objects.create(name="Socia", tax_id="22222222-2", is_partner=True)
    transaction = PartnerService.record_dividend_payment(
        partner=partner, amount=Decimal("100"), date=date(2026, 6, 1), treasury_account_id=account.pk
    )
    return transaction.journal_entry.items.get(account=ledger).label


def test_cash_payment_is_labelled_as_cash():
    assert "Efectivo" in _pay(TreasuryAccount.Type.CASH, "1.1.01.971")


def test_bank_payment_is_labelled_as_bank():
    bank = Bank.objects.create(name="Banco", code="BCO")
    assert "Banco" in _pay(TreasuryAccount.Type.CHECKING, "1.1.01.972", account_number="1", bank=bank)
