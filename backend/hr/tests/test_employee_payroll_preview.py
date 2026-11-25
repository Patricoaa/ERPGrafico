"""Vista de la propia liquidación desde el perfil: asignaciones y saldo como en la ficha (ADR-0156)."""

from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from accounting.models import Account, AccountType
from contacts.models import Contact
from hr.models import Employee, EmployeeMovement, Payroll, PayrollConcept, PayrollItem
from hr.movement_services import EmployeeMovementService

pytestmark = pytest.mark.django_db


@pytest.fixture
def posted_payroll():
    expense = Account.objects.create(name="Sueldos", code="5.1.01.911", account_type=AccountType.EXPENSE)
    concept = PayrollConcept.objects.create(name="Sueldo base", category=PayrollConcept.Category.HABER_IMPONIBLE, account=expense)
    contact = Contact.objects.create(name="Ana Soto", tax_id="11111111-1")
    employee = Employee.objects.create(contact=contact, base_salary=700000)
    payroll = Payroll.objects.create(employee=employee, period_year=2026, period_month=9, base_salary=700000)
    PayrollItem.objects.create(payroll=payroll, concept=concept, amount=Decimal("700000"))
    Payroll.objects.filter(pk=payroll.pk).update(net_salary=700000, total_haberes=700000)
    payroll.refresh_from_db()
    advance = EmployeeMovement.objects.create(
        employee=employee, kind="ADVANCE", date=date(2026, 9, 5), amount=200000, status=EmployeeMovement.Status.POSTED,
    )
    EmployeeMovementService.allocate(advance, payroll, 200000)
    Payroll.objects.filter(pk=payroll.pk).update(status=Payroll.Status.POSTED)
    user = get_user_model().objects.create_user(username="ana", password="x", contact=contact)
    return user, payroll


def test_preview_returns_allocations_and_balance(posted_payroll):
    user, payroll = posted_payroll
    client = APIClient()
    client.force_authenticate(user)

    res = client.get(f"/api/core/auth/my-profile/payrolls/{payroll.id}/preview/")

    assert res.status_code == 200
    assert [(a["kind"], a["amount"], a["movement_date"]) for a in res.data["allocations"]] == [("ADVANCE", "200000", "2026-09-05")]
    assert Decimal(res.data["balance"]) == Decimal("500000")
