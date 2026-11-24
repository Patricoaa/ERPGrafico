"""API de movimientos con el empleado (ADR-0156)."""

from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient

from accounting.models import Account, AccountingSettings, AccountType
from contacts.models import Contact
from hr.models import Employee, EmployeeMovement, Payroll
from treasury.models import TreasuryAccount

pytestmark = pytest.mark.django_db
BASE = "/api/hr/employee-movements/"


@pytest.fixture
def client():
    c = APIClient()
    c.force_authenticate(get_user_model().objects.create_superuser(username="mv_admin", password="x"))
    return c


@pytest.fixture
def employee():
    return Employee.objects.create(contact=Contact.objects.create(name="Luis Rojas", tax_id="22222222-2"), base_salary=500000)


@pytest.fixture
def cash(monkeypatch):
    monkeypatch.setattr(Account, "get_cash_pool_accounts", classmethod(lambda cls: cls.objects.all()))
    if not Account.objects.filter(code=Account.CASH_GROUP_CODE).exists():
        Account.objects.create(code=Account.CASH_GROUP_CODE, name="Efectivo y Equivalentes", account_type=AccountType.ASSET)
    acc = Account.objects.create(name="Caja", code="1.1.01.902", account_type=AccountType.ASSET)
    settings = AccountingSettings.get_solo()
    settings.account_anticipos = Account.objects.create(name="Anticipos", code="1.1.05.901", account_type=AccountType.ASSET)
    settings.account_prestamos_trabajadores = Account.objects.create(name="Préstamos", code="1.1.05.902", account_type=AccountType.ASSET)
    settings.save()
    return TreasuryAccount.objects.create(name="Caja", account=acc, account_type=TreasuryAccount.Type.CASH)


def _payroll(employee, month=9):
    payroll = Payroll.objects.create(employee=employee, period_year=2026, period_month=month, base_salary=500000)
    Payroll.objects.filter(pk=payroll.pk).update(net_salary=500000, total_haberes=500000)
    return payroll


def _posted(employee, kind="ADVANCE", amount=100000, day=1):
    return EmployeeMovement.objects.create(
        employee=employee, kind=kind, date=date(2026, 9, day), amount=amount, status="POSTED"
    )


def test_create_advance_with_treasury_is_posted(client, employee, cash):
    body = {"employee": employee.id, "kind": "ADVANCE", "date": str(timezone.localdate()), "amount": "50000", "treasury_account_id": cash.id}
    response = client.post(BASE, body, format="json")
    assert response.status_code == 201, response.content
    assert response.json()["status"] == "POSTED"


def test_create_loan_returns_schedule(client, employee):
    body = {
        "employee": employee.id, "kind": "LOAN", "date": "2026-09-01", "amount": "600000",
        "rate": "0.01", "rate_period": "MONTHLY", "installments_count": 6,
        "first_installment_year": 2026, "first_installment_month": 10,
    }
    response = client.post(BASE, body, format="json")
    assert response.status_code == 201, response.content
    data = response.json()
    assert len(data["installments"]) == 6 and data["installments"][0]["amount"] in (103529, "103529", "103529.00", 103529.0)
    assert data["status"] == "DRAFT"


def test_loan_requires_terms(client, employee):
    response = client.post(BASE, {"employee": employee.id, "kind": "LOAN", "date": "2026-09-01", "amount": "1000"}, format="json")
    assert response.status_code == 400


def test_preview_schedule_matches_build_schedule(client):
    body = {"amount": 600000, "rate": "0.01", "rate_period": "MONTHLY", "installments": 6, "first_year": 2026, "first_month": 10}
    response = client.post(BASE + "preview-schedule/", body, format="json")
    assert response.status_code == 200, response.content
    rows = response.json()
    assert len(rows) == 6 and rows[0]["amount"] == 103529 and rows[0]["interest"] == 6000


def test_allocate_and_deallocate_actions(client, employee):
    movement = _posted(employee)
    payroll = _payroll(employee)
    response = client.post(f"{BASE}{movement.id}/allocate/", {"payroll": payroll.id, "amount": 40000}, format="json")
    assert response.status_code == 200, response.content
    allocation_id = response.json()["allocations"][0]["id"]
    assert Decimal(str(response.json()["balance"])) == Decimal("100000")  # nada contabilizado aún
    response = client.post(f"{BASE}{movement.id}/deallocate/", {"allocation": allocation_id}, format="json")
    assert response.status_code == 200 and response.json()["allocations"] == []


def test_allocate_over_balance_is_400(client, employee):
    movement = _posted(employee)
    response = client.post(f"{BASE}{movement.id}/allocate/", {"payroll": _payroll(employee).id, "amount": 999999}, format="json")
    assert response.status_code == 400


def test_annul_posted_movement_without_treasury_is_400(client, employee):
    movement = _posted(employee)
    assert client.post(f"{BASE}{movement.id}/annul/", {"reason": "x"}, format="json").status_code == 400


def test_archived_employee_cannot_receive_movement(client, employee):
    Employee.objects.filter(pk=employee.pk).update(is_active=False)
    response = client.post(BASE, {"employee": employee.id, "kind": "ADVANCE", "date": "2026-09-01", "amount": "1000"}, format="json")
    assert response.status_code == 400


def test_permission_required_to_create(employee):
    user = get_user_model().objects.create_user(username="mv_viewer", password="x")
    user.user_permissions.add(Permission.objects.get(codename="view_employeemovement"))
    c = APIClient()
    c.force_authenticate(user)
    assert c.get(BASE).status_code == 200
    assert c.post(BASE, {"employee": employee.id, "kind": "ADVANCE", "date": "2026-09-01", "amount": "1"}, format="json").status_code == 403


def test_list_filters_by_kind_and_query_count_is_constant(client, employee):
    _posted(employee, "ADVANCE")
    _posted(employee, "LOAN", 500)

    def run(url):
        with CaptureQueriesContext(connection) as ctx:
            response = client.get(url)
        assert response.status_code == 200
        body = response.json()
        return (body["results"] if isinstance(body, dict) else body), len(ctx)

    rows, small = run(BASE + "?kind=LOAN")
    assert [r["kind"] for r in rows] == ["LOAN"]
    for day in range(2, 8):
        _posted(employee, "ADVANCE", 1000, day)
    rows, large = run(BASE)
    assert len(rows) == 8 and large == run(BASE)[1]
    assert large <= small + 2


def test_employee_history_endpoint_mixes_kinds_newest_first(client, employee):
    _posted(employee, "ADVANCE", 1000, 1)
    _posted(employee, "LOAN", 2000, 5)
    EmployeeMovement.objects.create(employee=employee, kind="PAYMENT", date=date(2026, 9, 3), amount=3000, status="POSTED")
    response = client.get(f"/api/hr/employees/{employee.id}/movements/")
    assert response.status_code == 200, response.content
    body = response.json()
    rows = body["results"] if isinstance(body, dict) else body
    assert [r["kind"] for r in rows] == ["LOAN", "PAYMENT", "ADVANCE"]
    assert "balance" in rows[0] and "status_display" in rows[0]
