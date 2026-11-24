"""Servicio de movimientos con el empleado (ADR-0156): asignaciones, plan de cuotas, saldo único."""

from datetime import date
from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError
from django.utils import timezone

from accounting.models import Account, AccountingSettings, AccountType
from contacts.models import Contact
from hr.models import Employee, EmployeeMovement, GlobalHRSettings, Payroll, PayrollAllocation
from hr.movement_services import (
    EmployeeMovementService,
    LoanTerms,
    TreasuryPayload,
    payroll_balance,
)
from treasury.models import TreasuryAccount

pytestmark = pytest.mark.django_db


@pytest.fixture
def employee():
    return Employee.objects.create(contact=Contact.objects.create(name="Luis Rojas", tax_id="22222222-2"), base_salary=500000)


@pytest.fixture
def cash(monkeypatch):
    monkeypatch.setattr(Account, "get_cash_pool_accounts", classmethod(lambda cls: cls.objects.all()))
    if not Account.objects.filter(code=Account.CASH_GROUP_CODE).exists():
        Account.objects.create(code=Account.CASH_GROUP_CODE, name="Efectivo y Equivalentes", account_type=AccountType.ASSET)
    acc = Account.objects.create(name="Caja", code="1.1.01.902", account_type=AccountType.ASSET)
    return TreasuryAccount.objects.create(name="Caja", account=acc, account_type=TreasuryAccount.Type.CASH)


@pytest.fixture
def hr_accounts():
    settings = AccountingSettings.get_solo()
    mk = lambda name, code, kind: Account.objects.create(name=name, code=code, account_type=kind)  # noqa: E731
    settings.account_anticipos = mk("Anticipos", "1.1.05.901", AccountType.ASSET)
    settings.account_prestamos_trabajadores = mk("Préstamos", "1.1.05.902", AccountType.ASSET)
    settings.account_intereses_prestamos = mk("Intereses", "4.2.01.901", AccountType.INCOME)
    settings.account_remuneraciones_por_pagar = mk("Rem por pagar", "2.1.05.901", AccountType.LIABILITY)
    settings.save()
    return settings


def _payroll(employee, month=9, net=500000, status=Payroll.Status.DRAFT, haberes=500000):
    payroll = Payroll.objects.create(employee=employee, period_year=2026, period_month=month, base_salary=500000, status=status)
    Payroll.objects.filter(pk=payroll.pk).update(net_salary=net, total_haberes=haberes)
    payroll.refresh_from_db()
    return payroll


def _posted(employee, kind=EmployeeMovement.Kind.ADVANCE, amount=100000):
    return EmployeeMovement.objects.create(employee=employee, kind=kind, date=date(2026, 9, 1), amount=amount, status=EmployeeMovement.Status.POSTED)


def _loan(employee, amount=600000, rate="0.01", n=6, first=(2026, 10)):
    terms = LoanTerms(rate=Decimal(rate), rate_period="MONTHLY", installments=n, first_year=first[0], first_month=first[1])
    return EmployeeMovementService.create(employee, EmployeeMovement.Kind.LOAN, date(2026, 9, 1), amount, loan=terms)


def test_advance_partial_allocations_across_two_payrolls(employee):
    movement = _posted(employee)
    first, second = _payroll(employee, 9), _payroll(employee, 10)
    EmployeeMovementService.allocate(movement, first, 40000)
    EmployeeMovementService.allocate(movement, second, 60000)
    assert sorted(movement.allocations.values_list("amount", flat=True)) == [40000, 60000]
    with pytest.raises(ValidationError):
        EmployeeMovementService.allocate(movement, _payroll(employee, 11), 1)


def test_allocation_default_amount_is_remaining_balance(employee):
    movement = _posted(employee)
    EmployeeMovementService.allocate(movement, _payroll(employee, 9), 30000)
    allocation = EmployeeMovementService.allocate(movement, _payroll(employee, 10))
    assert allocation.amount == 70000


def test_allocation_exceeding_net_salary_is_rejected(employee):
    movement = _posted(employee, amount=900000)
    with pytest.raises(ValidationError):
        EmployeeMovementService.allocate(movement, _payroll(employee, net=300000), 400000)


def test_allocation_requires_draft_payroll_same_employee_and_posted_movement(employee):
    other = Employee.objects.create(contact=Contact.objects.create(name="Otro", tax_id="33333333-3"), base_salary=1)
    movement = _posted(employee)
    with pytest.raises(ValidationError):
        EmployeeMovementService.allocate(movement, _payroll(employee, status=Payroll.Status.POSTED), 1000)
    with pytest.raises(ValidationError):
        EmployeeMovementService.allocate(movement, _payroll(other), 1000)
    draft = EmployeeMovement.objects.create(employee=employee, kind="ADVANCE", date=date(2026, 9, 1), amount=1000)
    with pytest.raises(ValidationError):
        EmployeeMovementService.allocate(draft, _payroll(employee, 11), 1000)


def test_loan_creates_schedule_and_posts_disbursement(employee, cash, hr_accounts):
    terms = LoanTerms(rate=Decimal("0.01"), rate_period="MONTHLY", installments=6, first_year=2026, first_month=10)
    movement = EmployeeMovementService.create(
        employee, EmployeeMovement.Kind.LOAN, timezone.localdate(), 600000, loan=terms,
        treasury=TreasuryPayload(treasury_account_id=cash.id),
    )
    movement.refresh_from_db()
    assert movement.status == EmployeeMovement.Status.POSTED
    assert movement.journal_entry_id is not None
    rows = list(movement.installments.order_by("number"))
    assert len(rows) == 6 and rows[0].amount == 103529 and sum(r.principal for r in rows) == 600000


def test_loan_without_treasury_stays_draft_with_schedule(employee):
    movement = _loan(employee)
    assert movement.status == EmployeeMovement.Status.DRAFT
    assert movement.installments.count() == 6


def test_loan_edited_installment_reschedules_remaining(employee):
    movement = _loan(employee)
    EmployeeMovement.objects.filter(pk=movement.pk).update(status="POSTED")
    movement.refresh_from_db()
    allocation = EmployeeMovementService.allocate(movement, _payroll(employee, 10), 90000)
    assert (allocation.principal_part, allocation.interest_part) == (84000, 6000)
    rows = list(movement.installments.order_by("number"))
    assert [r.number for r in rows] == [1, 2, 3, 4, 5, 6]
    assert rows[0].amount == 90000
    assert sum(r.principal for r in rows) == 600000


def test_installment_below_interest_rejected(employee):
    movement = _loan(employee)
    EmployeeMovement.objects.filter(pk=movement.pk).update(status="POSTED")
    movement.refresh_from_db()
    with pytest.raises(ValidationError):
        EmployeeMovementService.allocate(movement, _payroll(employee, 10), 5000)


def test_installment_that_pays_off_leaves_no_pending_installments(employee):
    movement = _loan(employee, amount=100000, n=3)
    EmployeeMovement.objects.filter(pk=movement.pk).update(status="POSTED")
    movement.refresh_from_db()
    allocation = EmployeeMovementService.allocate(movement, _payroll(employee, 10), 101000)
    assert allocation.principal_part == 100000
    assert movement.installments.filter(allocations__isnull=True).count() == 0


def test_deallocate_restores_schedule_and_balance(employee):
    movement = _loan(employee)
    EmployeeMovement.objects.filter(pk=movement.pk).update(status="POSTED")
    movement.refresh_from_db()
    original = [r.amount for r in movement.installments.order_by("number")]
    allocation = EmployeeMovementService.allocate(movement, _payroll(employee, 10), 90000)
    EmployeeMovementService.deallocate(allocation)
    assert [r.amount for r in movement.installments.order_by("number")] == original
    assert movement.allocations.count() == 0


def test_allocate_twice_does_not_double_assign_same_installment(employee):
    movement = _loan(employee)
    EmployeeMovement.objects.filter(pk=movement.pk).update(status="POSTED")
    movement.refresh_from_db()
    first = EmployeeMovementService.allocate(movement, _payroll(employee, 10))
    second = EmployeeMovementService.allocate(movement, _payroll(employee, 11))
    assert first.installment_id != second.installment_id
    assert second.installment.number == first.installment.number + 1


def test_archived_employee_rejected(employee):
    Employee.objects.filter(pk=employee.pk).update(is_active=False)
    employee.refresh_from_db()
    with pytest.raises(ValidationError):
        EmployeeMovementService.create(employee, EmployeeMovement.Kind.ADVANCE, date(2026, 9, 1), 1000)


def test_annul_blocked_with_allocations(employee):
    movement = _posted(employee)
    EmployeeMovementService.allocate(movement, _payroll(employee), 1000)
    with pytest.raises(ValidationError):
        EmployeeMovementService.annul(movement, reason="x")


def test_pay_payroll_uses_payroll_balance(employee, cash, hr_accounts):
    payroll = _payroll(employee, status=Payroll.Status.POSTED, net=500000)
    advance = _posted(employee, amount=100000)
    PayrollAllocation.objects.create(movement=advance, payroll=payroll, amount=100000, principal_part=100000, interest_part=0)
    assert payroll_balance(payroll) == Decimal("400000")
    payment = EmployeeMovementService.pay_payroll(payroll, treasury_account_id=cash.id, payment_date=timezone.localdate())
    assert payment.kind == EmployeeMovement.Kind.PAYMENT and payment.amount == Decimal("400000")
    assert payroll_balance(payroll) == Decimal("0")
    with pytest.raises(ValidationError):
        EmployeeMovementService.pay_payroll(payroll, treasury_account_id=cash.id, payment_date=timezone.localdate())


def test_cap_warning_when_over_15_percent(employee):
    GlobalHRSettings.objects.get_or_create(pk=1)
    movement = _posted(employee, amount=200000)
    payroll = _payroll(employee, haberes=1000000)
    EmployeeMovementService.allocate(movement, payroll, 100000)
    assert EmployeeMovementService.cap_warning(payroll) is None
    EmployeeMovementService.allocate(movement, payroll, 60000)
    assert "15" in EmployeeMovementService.cap_warning(payroll)
