"""ADR-0091 — salary advance lifecycle: DRAFT → PAID → DISCOUNTED · CANCELLED."""

from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.utils import timezone
from rest_framework.test import APIClient

from accounting.models import Account, AccountType, JournalEntry, JournalItem
from contacts.models import Contact
from hr.models import Employee, Payroll, SalaryAdvance
from hr.services import post_payroll
from treasury.models import TreasuryAccount, TreasuryMovement

User = get_user_model()


@pytest.fixture
def client(db):
    c = APIClient()
    c.force_authenticate(User.objects.create_superuser("advpol", "a@x.cl", "x"))
    return c


@pytest.fixture
def employee(db):
    return Employee.objects.create(
        contact=Contact.objects.create(name="Luis Rojas", tax_id="22222222-2"),
        base_salary=500000,
        dias_pactados=30,
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
    acc = Account.objects.create(name="Caja", code="1.1.01.902", account_type=AccountType.ASSET)
    return TreasuryAccount.objects.create(
        name="Caja", account=acc, account_type=TreasuryAccount.Type.CASH
    )


def _advance(employee, **kw):
    return SalaryAdvance.objects.create(
        employee=employee, amount=Decimal("50000"), date=timezone.localdate(), **kw
    )


def _paid_advance(employee, cash):
    """Advance with an outbound movement and a balanced posted journal entry."""
    advances_acc = Account.objects.create(
        name="Anticipos", code="1.1.05.901", account_type=AccountType.ASSET
    )
    entry = JournalEntry.objects.create(
        date=timezone.localdate(), description="Anticipo", status=JournalEntry.State.POSTED
    )
    JournalItem.objects.create(entry=entry, account=advances_acc, debit=Decimal("50000"), credit=0)
    JournalItem.objects.create(entry=entry, account=cash.account, debit=0, credit=Decimal("50000"))
    movement = TreasuryMovement.objects.create(
        movement_type=TreasuryMovement.Type.OUTBOUND,
        from_account=cash,
        amount=Decimal("50000"),
        journal_entry=entry,
        status="POSTED",
    )
    advance = _advance(employee, journal_entry=entry, status=SalaryAdvance.Status.PAID)
    return advance, movement


def _payroll(employee, status=Payroll.Status.DRAFT, month=9):
    return Payroll.objects.create(
        employee=employee, period_year=2026, period_month=month, status=status, base_salary=500000
    )


def _url(advance, suffix=""):
    return f"/api/hr/advances/{advance.pk}/{suffix}"


# ── Edit policy ─────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_draft_advance_is_editable_and_deletable(client, employee):
    adv = _advance(employee)
    assert client.patch(_url(adv), {"amount": "60000"}, format="json").status_code == 200
    assert client.delete(_url(adv)).status_code == 204


@pytest.mark.django_db
def test_paid_advance_rejects_amount_and_delete_but_accepts_notes(client, employee, cash):
    adv, _ = _paid_advance(employee, cash)
    res = client.patch(_url(adv), {"amount": "1"}, format="json")
    assert res.status_code == 422
    assert res.data["error"]["code"] == "DOCUMENT_LOCKED"
    assert client.delete(_url(adv)).status_code == 422
    assert client.patch(_url(adv), {"notes": "ok"}, format="json").status_code == 200
    assert client.get(_url(adv)).data["is_editable"] is False


@pytest.mark.django_db
def test_journal_entry_and_status_are_read_only(client, employee):
    adv = _advance(employee)
    client.patch(_url(adv), {"status": "DISCOUNTED"}, format="json")
    adv.refresh_from_db()
    assert adv.status == SalaryAdvance.Status.DRAFT


# ── Payroll link ────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_paid_advance_links_and_unlinks_with_draft_payroll(client, employee, cash):
    adv, _ = _paid_advance(employee, cash)
    payroll = _payroll(employee)
    assert client.patch(_url(adv), {"payroll": payroll.pk}, format="json").status_code == 200
    assert client.patch(_url(adv), {"payroll": None}, format="json").status_code == 200


@pytest.mark.django_db
def test_unpaid_advance_cannot_be_linked(client, employee):
    adv = _advance(employee)
    res = client.patch(_url(adv), {"payroll": _payroll(employee).pk}, format="json")
    assert res.status_code == 400


@pytest.mark.django_db
def test_cannot_unlink_from_posted_payroll(client, employee, cash):
    adv, _ = _paid_advance(employee, cash)
    adv.payroll = _payroll(employee, Payroll.Status.POSTED)
    adv.save()
    assert client.patch(_url(adv), {"payroll": None}, format="json").status_code == 400


@pytest.mark.django_db
def test_cannot_link_to_other_employee_payroll(client, employee, cash):
    adv, _ = _paid_advance(employee, cash)
    other = Employee.objects.create(
        contact=Contact.objects.create(name="Otro", tax_id="33333333-3"),
        base_salary=500000,
        dias_pactados=30,
    )
    assert client.patch(_url(adv), {"payroll": _payroll(other).pk}, format="json").status_code == 400


@pytest.mark.django_db
def test_posting_payroll_requires_paid_advances(employee):
    payroll = _payroll(employee)
    _advance(employee, payroll=payroll)
    with pytest.raises(ValidationError, match="anticipos pagados"):
        post_payroll(payroll)


# ── Annul ───────────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_annul_paid_advance_reverses_movement(client, employee, cash):
    adv, movement = _paid_advance(employee, cash)
    res = client.post(_url(adv, "annul/"), {"reason": "monto erróneo"}, format="json")
    assert res.status_code == 200, res.data
    assert res.data["status"] == "CANCELLED"
    movement.refresh_from_db()
    assert movement.status == "CANCELLED"
    assert JournalEntry.objects.filter(reversal_of=adv.journal_entry).exists()


@pytest.mark.django_db
def test_annul_requires_reason_and_unlinked_paid_advance(client, employee, cash):
    adv, _ = _paid_advance(employee, cash)
    assert client.post(_url(adv, "annul/"), {}, format="json").status_code == 400
    adv.payroll = _payroll(employee)
    adv.save()
    assert client.post(_url(adv, "annul/"), {"reason": "x"}, format="json").status_code == 400
    assert client.post(_url(_advance(employee), "annul/"), {"reason": "x"}, format="json").status_code == 400
