"""Migración de datos 0018: SalaryAdvance y PayrollPayment SALARIO → EmployeeMovement (reversible).

Los tests corren con `--nomigrations` sobre SQLite (la cadena completa de migraciones usa SQL de Postgres),
así que se ejercitan las funciones `forward`/`reverse` de la migración con el registro de apps real.
La cadena completa se verifica en el servidor de desarrollo (Postgres).
"""

import importlib
from datetime import date

import pytest
from django.apps import apps as real_apps

from accounting.models import JournalEntry
from contacts.models import Contact
from hr.models import Employee, EmployeeMovement, Payroll, PayrollAllocation, PayrollPayment, SalaryAdvance

migration = importlib.import_module("hr.migrations.0018_migrate_advances_and_salary_payments")

pytestmark = pytest.mark.django_db


@pytest.fixture
def seeded():
    contact = Contact.objects.create(name="Ana Pérez", tax_id="11111111-1")
    employee = Employee.objects.create(contact=contact, base_salary=500000)
    payroll = Payroll.objects.create(employee=employee, period_year=2026, period_month=9, base_salary=500000)
    entry = JournalEntry.objects.create(date=date(2026, 9, 10), description="Anticipo", status=JournalEntry.State.POSTED)
    for i, status in enumerate(["DRAFT", "PAID", "DISCOUNTED", "CANCELLED"]):
        SalaryAdvance.objects.create(
            employee=employee, amount=10000 + i, date=date(2026, 9, 10), status=status,
            payroll=payroll if status == "DISCOUNTED" else None,
            journal_entry=entry if status == "PAID" else None,
        )
    PayrollPayment.objects.create(payroll=payroll, payment_type="SALARIO", amount=450000, date=date(2026, 9, 30))
    PayrollPayment.objects.create(payroll=payroll, payment_type="PREVIRED", amount=70000, date=date(2026, 10, 10))
    return {"employee": employee, "payroll": payroll, "entry": entry}


def test_forward_maps_advance_states_and_allocations(seeded):
    migration.forward(real_apps, None)
    advances = EmployeeMovement.objects.filter(kind="ADVANCE")
    assert set(advances.values_list("status", flat=True)) == {"DRAFT", "POSTED", "SETTLED", "CANCELLED"}
    discounted = advances.get(status="SETTLED")
    allocation = PayrollAllocation.objects.get(movement=discounted)
    assert allocation.payroll_id == seeded["payroll"].id
    assert (allocation.amount, allocation.principal_part, allocation.interest_part) == (discounted.amount, discounted.amount, 0)
    assert PayrollAllocation.objects.filter(movement__kind="ADVANCE").exclude(movement=discounted).count() == 0


def test_forward_keeps_journal_entry_links(seeded):
    migration.forward(real_apps, None)
    assert EmployeeMovement.objects.get(kind="ADVANCE", status="POSTED").journal_entry_id == seeded["entry"].id


def test_forward_converts_salary_payments_only(seeded):
    migration.forward(real_apps, None)
    payment = EmployeeMovement.objects.get(kind="PAYMENT")
    assert (payment.amount, payment.status, payment.employee_id) == (450000, "POSTED", seeded["employee"].id)
    assert payment.allocations.get().payroll_id == seeded["payroll"].id
    assert PayrollPayment.objects.filter(payment_type="PREVIRED").count() == 1


def test_reverse_restores_original_rows(seeded):
    migration.forward(real_apps, None)
    migration.reverse(real_apps, None)
    assert sorted(SalaryAdvance.objects.values_list("status", flat=True)) == ["CANCELLED", "DISCOUNTED", "DRAFT", "PAID"]
    assert SalaryAdvance.objects.get(status="DISCOUNTED").payroll_id == seeded["payroll"].id
    assert sorted(PayrollPayment.objects.values_list("payment_type", flat=True)) == ["PREVIRED", "SALARIO"]
    assert EmployeeMovement.objects.count() == 0
