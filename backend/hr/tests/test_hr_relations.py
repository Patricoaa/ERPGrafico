"""Relaciones documentales de RRHH (dominio `hr`): empleado, liquidación, anticipo, inasistencia, pago."""

from datetime import date

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from rest_framework.test import APIClient

from contacts.models import Contact
from hr.models import Absence, Employee, Payroll, PayrollPayment, SalaryAdvance

pytestmark = pytest.mark.django_db


@pytest.fixture
def hr_world(db):
    contact = Contact.objects.create(name="Ana Pérez", tax_id="11111111-1")
    employee = Employee.objects.create(contact=contact, base_salary=500000)
    payroll = Payroll.objects.create(employee=employee, period_year=2026, period_month=9, base_salary=500000)
    advance = SalaryAdvance.objects.create(employee=employee, amount=50000, date=date(2026, 9, 10))
    absence = Absence.objects.create(
        employee=employee, absence_type="AUSENTISMO",
        start_date=date(2026, 9, 2), end_date=date(2026, 9, 3), days=2,
    )
    payment = PayrollPayment.objects.create(
        payroll=payroll, payment_type=PayrollPayment.PaymentType.SALARIO, amount=450000, date=date(2026, 9, 30),
    )
    admin = get_user_model().objects.create_superuser(username="hr_admin", password="x")
    client = APIClient()
    client.force_authenticate(user=admin)
    return {
        "client": client, "employee": employee, "payroll": payroll,
        "advance": advance, "absence": absence, "payment": payment,
    }


def _relations(client, label, pk):
    response = client.get(f"/api/core/documents/{label}/{pk}/relations/")
    assert response.status_code == 200, response.content
    return response.json()["relations"]


def _roles(relations):
    return {r["role"] for r in relations}


def test_employee_relations_list_hr_documents(hr_world):
    relations = _relations(hr_world["client"], "hr.employee", hr_world["employee"].pk)
    assert {"payroll", "salary_advance", "absence", "payroll_payment", "contact"} <= _roles(relations)
    hr_roles = {"payroll", "salary_advance", "absence", "payroll_payment"}
    assert all(r["target"]["domain"] == "hr" for r in relations if r["role"] in hr_roles)


def test_payroll_relations_include_employee(hr_world):
    relations = _relations(hr_world["client"], "hr.payroll", hr_world["payroll"].pk)
    employee_links = [r for r in relations if r["role"] == "employee"]
    assert [r["target"]["label"] for r in employee_links] == ["hr.employee"]


def test_advance_absence_and_payment_point_to_employee_or_payroll(hr_world):
    client = hr_world["client"]
    assert "employee" in _roles(_relations(client, "hr.salaryadvance", hr_world["advance"].pk))
    assert "employee" in _roles(_relations(client, "hr.absence", hr_world["absence"].pk))
    payment_roles = _roles(_relations(client, "hr.payrollpayment", hr_world["payment"].pk))
    assert {"payroll", "employee"} <= payment_roles


def test_archived_employee_with_no_relations_returns_empty(hr_world):
    contact = Contact.objects.create(name="Beto Soto", tax_id="22222222-2")
    archived = Employee.objects.create(contact=contact, base_salary=1, is_active=False)
    relations = _relations(hr_world["client"], "hr.employee", archived.pk)
    assert not [r for r in relations if r["target"]["domain"] == "hr"]


def test_user_without_payroll_permission_sees_inaccessible_refs(hr_world):
    user = get_user_model().objects.create_user(username="viewer", password="x")
    user.user_permissions.add(Permission.objects.get(content_type__app_label="hr", codename="view_employee"))
    client = APIClient()
    client.force_authenticate(user=user)
    relations = _relations(client, "hr.employee", hr_world["employee"].pk)
    payrolls = [r for r in relations if r["role"] == "payroll"]
    assert payrolls
    for link in payrolls:
        assert link["target"]["accessible"] is False
        assert link["target"]["status"] is None
        assert link["target"]["date"] is None


def _add_posted_payroll(employee, month):
    from accounting.models import JournalEntry
    from django.utils import timezone

    entry = JournalEntry.objects.create(date=timezone.localdate(), description=f"Nómina {month}", status=JournalEntry.State.POSTED)
    payroll = Payroll.objects.create(
        employee=employee, period_year=2025, period_month=month, base_salary=1, journal_entry=entry,
    )
    pay_entry = JournalEntry.objects.create(date=timezone.localdate(), description=f"Pago {month}", status=JournalEntry.State.POSTED)
    PayrollPayment.objects.create(
        payroll=payroll, payment_type=PayrollPayment.PaymentType.SALARIO, amount=1, date=date(2025, month, 28),
        journal_entry=pay_entry,
    )


def test_employee_relations_query_count_does_not_grow_with_history(hr_world):
    """Zero N+1 en el proveedor de empleado: ninguna consulta por fila a tablas de RRHH ni
    cargas sueltas de asientos (el costo por asiento de `build_ref` es del núcleo documental)."""
    from django.db import connection
    from django.test.utils import CaptureQueriesContext

    client, employee = hr_world["client"], hr_world["employee"]
    url = f"/api/core/documents/hr.employee/{employee.pk}/relations/"

    def provider_queries() -> int:
        with CaptureQueriesContext(connection) as ctx:
            assert client.get(url).status_code == 200
        return sum(
            1 for q in ctx
            if 'FROM "hr_' in q["sql"]
            or ('FROM "accounting_journalentry"' in q["sql"] and '"accounting_journalentry"."id" =' in q["sql"])
        )

    for month in (1, 2):
        _add_posted_payroll(employee, month)
    small = provider_queries()
    for month in range(3, 9):
        _add_posted_payroll(employee, month)
    assert provider_queries() == small
