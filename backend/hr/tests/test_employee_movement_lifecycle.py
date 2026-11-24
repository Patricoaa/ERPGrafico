"""ADR-0091 / ADR-0156 — ciclo de vida de movimientos: DRAFT → POSTED → SETTLED · CANCELLED."""

from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.utils import timezone
from rest_framework.test import APIClient

from accounting.models import Account, AccountingSettings, AccountType
from contacts.models import Contact
from hr.models import Employee, EmployeeMovement, Payroll, PayrollAllocation
from hr.movement_services import EmployeeMovementService, TreasuryPayload
from hr.services import post_payroll
from treasury.models import TreasuryAccount

User = get_user_model()
pytestmark = pytest.mark.django_db


@pytest.fixture
def client():
    c = APIClient()
    c.force_authenticate(User.objects.create_superuser("mvpol", "a@x.cl", "x"))
    return c


@pytest.fixture
def employee():
    return Employee.objects.create(
        contact=Contact.objects.create(name="Luis Rojas", tax_id="22222222-2"), base_salary=500000, dias_pactados=30
    )


@pytest.fixture
def cash(monkeypatch):
    monkeypatch.setattr(Account, "get_cash_pool_accounts", classmethod(lambda cls: cls.objects.all()))
    if not Account.objects.filter(code=Account.CASH_GROUP_CODE).exists():
        Account.objects.create(code=Account.CASH_GROUP_CODE, name="Efectivo y Equivalentes", account_type=AccountType.ASSET)
    acc = Account.objects.create(name="Caja", code="1.1.01.902", account_type=AccountType.ASSET)
    settings = AccountingSettings.get_solo()
    settings.account_anticipos = Account.objects.create(name="Anticipos", code="1.1.05.901", account_type=AccountType.ASSET)
    settings.save()
    return TreasuryAccount.objects.create(name="Caja", account=acc, account_type=TreasuryAccount.Type.CASH)


def _draft(employee, amount=50000):
    return EmployeeMovement.objects.create(employee=employee, kind="ADVANCE", date=timezone.localdate(), amount=amount)


def _paid(employee, cash, amount=50000):
    return EmployeeMovementService.create(
        employee, "ADVANCE", timezone.localdate(), amount, treasury=TreasuryPayload(treasury_account_id=cash.id)
    )


def _payroll(employee, status=Payroll.Status.DRAFT, month=9):
    payroll = Payroll.objects.create(employee=employee, period_year=2026, period_month=month, status=status, base_salary=500000)
    Payroll.objects.filter(pk=payroll.pk).update(net_salary=500000, total_haberes=500000)
    payroll.refresh_from_db()
    return payroll


def _url(movement, suffix=""):
    return f"/api/hr/employee-movements/{movement.pk}/{suffix}"


# ── Edit policy ─────────────────────────────────────────────────────────────


def test_draft_movement_is_editable_and_deletable(client, employee):
    movement = _draft(employee)
    assert client.patch(_url(movement), {"amount": "60000"}, format="json").status_code == 200
    assert client.delete(_url(movement)).status_code == 204


def test_posted_movement_rejects_amount_and_delete_but_accepts_notes(client, employee, cash):
    movement = _paid(employee, cash)
    response = client.patch(_url(movement), {"amount": "1"}, format="json")
    assert response.status_code == 422
    assert response.data["error"]["code"] == "DOCUMENT_LOCKED"
    assert client.delete(_url(movement)).status_code == 422
    assert client.patch(_url(movement), {"notes": "ok"}, format="json").status_code == 200
    assert client.get(_url(movement)).data["is_editable"] is False


def test_status_and_journal_entry_are_read_only(client, employee):
    movement = _draft(employee)
    client.patch(_url(movement), {"status": "SETTLED"}, format="json")
    movement.refresh_from_db()
    assert movement.status == EmployeeMovement.Status.DRAFT


# ── Annulment ───────────────────────────────────────────────────────────────


def test_annul_posted_advance_cancels_it(client, employee, cash):
    movement = _paid(employee, cash)
    response = client.post(_url(movement, "annul/"), {"reason": "error"}, format="json")
    assert response.status_code == 200
    movement.refresh_from_db()
    assert movement.status == EmployeeMovement.Status.CANCELLED


def test_annul_blocked_while_allocated_to_a_payroll(client, employee, cash):
    movement = _paid(employee, cash)
    EmployeeMovementService.allocate(movement, _payroll(employee), 1000)
    assert client.post(_url(movement, "annul/"), {"reason": "x"}, format="json").status_code == 400


# ── Allocation rules ────────────────────────────────────────────────────────


def test_cannot_allocate_to_posted_payroll_or_other_employee(client, employee, cash):
    movement = _paid(employee, cash)
    other = Employee.objects.create(contact=Contact.objects.create(name="Otro", tax_id="33333333-3"), base_salary=500000)
    posted = _payroll(employee, Payroll.Status.POSTED, month=8)
    for payroll in (posted, _payroll(other)):
        response = client.post(_url(movement, "allocate/"), {"payroll": payroll.pk, "amount": 1000}, format="json")
        assert response.status_code == 400


def test_posting_payroll_requires_posted_movements(employee):
    payroll = _payroll(employee)
    movement = _draft(employee)
    PayrollAllocation.objects.create(movement=movement, payroll=payroll, amount=1000, principal_part=1000, interest_part=0)
    with pytest.raises(ValidationError, match="contabilizados"):
        post_payroll(payroll)


def test_movement_dates_default_to_today_when_created_with_treasury(employee, cash):
    movement = _paid(employee, cash)
    assert movement.date == timezone.localdate() and isinstance(movement.date, date)
    assert movement.amount == Decimal("50000")
