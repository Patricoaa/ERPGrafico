"""Modelos de movimientos con el empleado: movimiento, asignación y cuota."""

from datetime import date
from decimal import Decimal

import pytest
from django.db import IntegrityError, transaction

from contacts.models import Contact
from hr.models import EmployeeMovement, LoanInstallment, Payroll, PayrollAllocation

pytestmark = pytest.mark.django_db


@pytest.fixture
def employee():
    from hr.models import Employee

    contact = Contact.objects.create(name="Ana Pérez", tax_id="11111111-1")
    return Employee.objects.create(contact=contact, base_salary=500000)


def _payroll(employee, month, status=Payroll.Status.DRAFT):
    return Payroll.objects.create(employee=employee, period_year=2026, period_month=month, base_salary=500000, status=status)


def _movement(employee, kind=EmployeeMovement.Kind.ADVANCE, amount=100000, status=EmployeeMovement.Status.POSTED):
    return EmployeeMovement.objects.create(employee=employee, kind=kind, date=date(2026, 9, 1), amount=amount, status=status)


def test_movement_defaults_and_display_id(employee):
    movement = EmployeeMovement.objects.create(employee=employee, kind="ADVANCE", date=date(2026, 9, 1), amount=50000)
    assert movement.status == EmployeeMovement.Status.DRAFT
    assert movement.display_id.startswith("MOV-")
    assert movement.balance == Decimal("50000")


def test_allocation_check_constraint_rejects_inconsistent_parts(employee):
    movement = _movement(employee)
    payroll = _payroll(employee, 9)
    with pytest.raises(IntegrityError), transaction.atomic():
        PayrollAllocation.objects.create(movement=movement, payroll=payroll, amount=1000, principal_part=400, interest_part=400)


def test_installment_unique_per_movement(employee):
    movement = _movement(employee, kind=EmployeeMovement.Kind.LOAN)
    LoanInstallment.objects.create(movement=movement, number=1, year=2026, month=10, principal=90, interest=10, amount=100)
    with pytest.raises(IntegrityError), transaction.atomic():
        LoanInstallment.objects.create(movement=movement, number=1, year=2026, month=11, principal=90, interest=10, amount=100)


def test_balance_counts_only_posted_payrolls(employee):
    movement = _movement(employee)
    draft = _payroll(employee, 9)
    posted = _payroll(employee, 10, status=Payroll.Status.POSTED)
    PayrollAllocation.objects.create(movement=movement, payroll=draft, amount=30000, principal_part=30000, interest_part=0)
    assert movement.balance == Decimal("100000")
    PayrollAllocation.objects.create(movement=movement, payroll=posted, amount=40000, principal_part=40000, interest_part=0)
    assert movement.balance == Decimal("60000")
    assert movement.applied_principal == Decimal("40000")


def test_payment_movement_has_no_balance(employee):
    assert _movement(employee, kind=EmployeeMovement.Kind.PAYMENT).balance == 0
