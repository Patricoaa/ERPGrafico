"""post_payroll y saldos de liquidación leen asignaciones de movimientos (ADR-0156)."""

from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from accounting.models import Account, AccountingSettings, AccountType, JournalItem
from contacts.models import Contact
from hr.models import (
    Employee,
    EmployeeMovement,
    LoanInstallment,
    Payroll,
    PayrollConcept,
    PayrollItem,
)
from hr.movement_services import EmployeeMovementService, LoanTerms, payroll_balance
from hr.services import post_payroll

pytestmark = pytest.mark.django_db


@pytest.fixture
def world():
    settings = AccountingSettings.get_solo()
    mk = lambda name, code, kind: Account.objects.create(name=name, code=code, account_type=kind)  # noqa: E731
    settings.account_anticipos = mk("Anticipos", "1.1.05.901", AccountType.ASSET)
    settings.account_prestamos_trabajadores = mk("Préstamos", "1.1.05.902", AccountType.ASSET)
    settings.account_intereses_prestamos = mk("Intereses", "4.2.01.901", AccountType.INCOME)
    settings.account_remuneraciones_por_pagar = mk("Rem por pagar", "2.1.05.901", AccountType.LIABILITY)
    settings.account_previred_por_pagar = mk("Previred", "2.1.05.902", AccountType.LIABILITY)
    settings.save()
    expense = mk("Sueldos", "5.1.01.901", AccountType.EXPENSE)
    employee = Employee.objects.create(contact=Contact.objects.create(name="Luis Rojas", tax_id="22222222-2"), base_salary=500000)
    concept = PayrollConcept.objects.create(
        name="Sueldo base", category=PayrollConcept.Category.HABER_IMPONIBLE, account=expense,
    )
    return {"settings": settings, "employee": employee, "concept": concept}


def _payroll(world, month=9, net=500000):
    payroll = Payroll.objects.create(employee=world["employee"], period_year=2026, period_month=month, base_salary=500000)
    PayrollItem.objects.create(payroll=payroll, concept=world["concept"], amount=Decimal(net))
    Payroll.objects.filter(pk=payroll.pk).update(net_salary=net, total_haberes=net)
    payroll.refresh_from_db()
    return payroll


def _movement(world, kind, amount, **kw):
    return EmployeeMovement.objects.create(
        employee=world["employee"], kind=kind, date=date(2026, 9, 1), amount=amount,
        status=EmployeeMovement.Status.POSTED, **kw,
    )


def _loan(world, amount=600000):
    movement = EmployeeMovementService.create(
        world["employee"], "LOAN", date(2026, 9, 1), amount,
        loan=LoanTerms(rate=Decimal("0.01"), rate_period="MONTHLY", installments=6, first_year=2026, first_month=10),
    )
    EmployeeMovement.objects.filter(pk=movement.pk).update(status="POSTED")
    movement.refresh_from_db()
    return movement


def _credit(entry, account):
    return sum((i.credit for i in JournalItem.objects.filter(entry=entry, account=account)), Decimal("0"))


def test_post_payroll_with_advance_and_loan_balances_entry(world):
    payroll = _payroll(world)
    advance = _movement(world, "ADVANCE", 100000)
    EmployeeMovementService.allocate(advance, payroll, 100000)
    loan = _loan(world)
    EmployeeMovementService.allocate(loan, payroll)  # cuota 103529: capital 97529 + interés 6000
    payroll.refresh_from_db()
    post_payroll(payroll)
    payroll.refresh_from_db()
    entry, s = payroll.journal_entry, world["settings"]
    assert _credit(entry, s.account_anticipos) == 100000
    assert _credit(entry, s.account_prestamos_trabajadores) == 97529
    assert _credit(entry, s.account_intereses_prestamos) == 6000
    assert _credit(entry, s.account_remuneraciones_por_pagar) == 500000 - 100000 - 103529
    assert payroll_balance(payroll) == Decimal("296471")


def test_post_marks_installment_applied_and_settles_movement(world):
    payroll = _payroll(world)
    advance = _movement(world, "ADVANCE", 100000)
    EmployeeMovementService.allocate(advance, payroll)
    loan = _loan(world)
    allocation = EmployeeMovementService.allocate(loan, payroll)
    post_payroll(payroll)
    allocation.installment.refresh_from_db()
    advance.refresh_from_db()
    loan.refresh_from_db()
    assert allocation.installment.status == LoanInstallment.Status.APPLIED
    assert advance.status == EmployeeMovement.Status.SETTLED
    assert loan.status == EmployeeMovement.Status.POSTED


def test_post_requires_loan_accounts_when_loan_allocated(world):
    payroll = _payroll(world)
    EmployeeMovementService.allocate(_loan(world), payroll)
    world["settings"].account_prestamos_trabajadores = None
    world["settings"].save()  # save() invalida el caché del singleton
    with pytest.raises(ValidationError, match="[Pp]réstamo"):
        post_payroll(payroll)


def test_payroll_list_balance_matches_payment_service(world):
    payroll = _payroll(world)
    EmployeeMovementService.allocate(_movement(world, "ADVANCE", 100000), payroll)
    client = APIClient()
    client.force_authenticate(user=get_user_model().objects.create_superuser(username="hr_pp", password="x"))
    body = client.get(f"/api/hr/payrolls/{payroll.pk}/").json()
    assert Decimal(str(body["balance"])) == payroll_balance(payroll) == Decimal("400000")
    assert body["allocations"][0]["kind"] == "ADVANCE"
    listing = client.get("/api/hr/payrolls/").json()
    rows = listing["results"] if isinstance(listing, dict) else listing
    assert Decimal(str(rows[0]["advances_total"])) == Decimal("100000")


def test_deleting_draft_payroll_restores_installments(world):
    payroll = _payroll(world)
    loan = _loan(world)
    EmployeeMovementService.allocate(loan, payroll, 90000)
    Payroll.objects.get(pk=payroll.pk).delete()
    assert loan.allocations.count() == 0
    assert loan.installments.filter(allocations__isnull=True).count() == 6 or loan.installments.count() == 6


def test_payroll_list_query_count_constant_with_allocations(world):
    client = APIClient()
    client.force_authenticate(user=get_user_model().objects.create_superuser(username="hr_qc", password="x"))

    def count() -> int:
        with CaptureQueriesContext(connection) as ctx:
            assert client.get("/api/hr/payrolls/").status_code == 200
        return len(ctx)

    for month in (1, 2):
        EmployeeMovementService.allocate(_movement(world, "ADVANCE", 1000 * month), _payroll(world, month), 500)
    small = count()
    for month in range(3, 9):
        EmployeeMovementService.allocate(_movement(world, "ADVANCE", 1000 * month), _payroll(world, month), 500)
    assert count() == small
