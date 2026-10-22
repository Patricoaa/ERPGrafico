"""ADR-0091 — a registered F29 declaration and a posted F29 payment are locked."""

from decimal import Decimal

import pytest
from django.utils import timezone

from accounting.models import Account, AccountType, JournalEntry
from core.edit_policy import DocumentLockedError
from tax.models import F29Declaration, F29Payment, TaxPeriod
from tax.services import F29CalculationService
from treasury.models import TreasuryAccount


def _entry():
    return JournalEntry.objects.create(
        date=timezone.localdate(), description="F29", status=JournalEntry.State.POSTED
    )


def _declaration(registered, month=8):
    period = TaxPeriod.objects.create(year=2026, month=month)
    return F29Declaration.objects.create(
        tax_period=period,
        declaration_date=timezone.localdate() if registered else None,
        journal_entry=_entry() if registered else None,
    )


@pytest.fixture
def cash(db, monkeypatch):
    monkeypatch.setattr(
        Account, "get_cash_pool_accounts", classmethod(lambda cls: cls.objects.all())
    )
    if not Account.objects.filter(code=Account.CASH_GROUP_CODE).exists():
        Account.objects.create(
            code=Account.CASH_GROUP_CODE, name="Efectivo y Equivalentes", account_type=AccountType.ASSET
        )
    acc = Account.objects.create(name="Banco", code="1.1.01.903", account_type=AccountType.ASSET)
    return TreasuryAccount.objects.create(
        name="Banco", account=acc, account_type=TreasuryAccount.Type.CASH
    )


def _url(dec):
    return f"/api/tax/declarations/{dec.pk}/"


@pytest.mark.django_db
def test_registered_declaration_rejects_amounts_and_delete(api_client):
    dec = _declaration(registered=True)
    res = api_client.patch(_url(dec), {"ppm_amount": "1000"}, format="json")
    assert res.status_code == 422
    assert res.data["error"]["code"] == "DOCUMENT_LOCKED"
    assert api_client.patch(_url(dec), {"notes": "obs"}, format="json").status_code == 200
    assert api_client.delete(_url(dec)).status_code == 422


@pytest.mark.django_db
def test_unregistered_declaration_is_editable_and_deletable(api_client):
    dec = _declaration(registered=False)
    assert api_client.patch(_url(dec), {"ppm_amount": "1000"}, format="json").status_code == 200
    assert api_client.delete(_url(dec)).status_code == 204


@pytest.mark.django_db
def test_recalculating_registered_period_is_rejected():
    dec = _declaration(registered=True)
    with pytest.raises(DocumentLockedError):
        F29CalculationService.create_or_update_declaration(
            2026, 8, manual_fields={"ppm_amount": Decimal("999")}
        )
    dec.refresh_from_db()
    assert dec.ppm_amount != Decimal("999")


@pytest.mark.django_db
def test_posted_f29_payment_is_locked(api_client, cash):
    payment = F29Payment.objects.create(
        declaration=_declaration(registered=True),
        amount=Decimal("5000"),
        treasury_account=cash,
        journal_entry=_entry(),
    )
    url = f"/api/tax/payments/{payment.pk}/"
    assert api_client.patch(url, {"amount": "1"}, format="json").status_code == 422
    assert api_client.delete(url).status_code == 422
