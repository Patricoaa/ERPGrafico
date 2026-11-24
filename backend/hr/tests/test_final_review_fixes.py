# ruff: noqa: F811 — los fixtures se importan de otros módulos de test
"""Hallazgos de la revisión final de la rama de movimientos (ADR-0156)."""

import importlib
from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from rest_framework.test import APIClient

from core.models import GroupProfile
from hr.models import EmployeeMovement, PayrollItem
from hr.movement_services import EmployeeMovementService, TreasuryPayload
from hr.services import post_payroll
from hr.tests.test_employee_movement_service import _loan, cash, employee, hr_accounts  # noqa: F401
from hr.tests.test_employee_movement_service import _payroll as svc_payroll
from hr.tests.test_post_payroll_allocations import _movement, _payroll, world  # noqa: F401

pytestmark = pytest.mark.django_db


def test_deallocating_a_non_last_installment_keeps_numbers_unique(employee):
    movement = _loan(employee)
    EmployeeMovement.objects.filter(pk=movement.pk).update(status="POSTED")
    movement.refresh_from_db()
    payroll = svc_payroll(employee, 10, net=900000, haberes=900000)
    first = EmployeeMovementService.allocate(movement, payroll)
    EmployeeMovementService.allocate(movement, payroll)
    EmployeeMovementService.deallocate(first)  # antes: IntegrityError (renumeraba sobre la cuota #2 asignada)
    numbers = list(movement.installments.order_by("number").values_list("number", flat=True))
    assert numbers == sorted(set(numbers)) and len(numbers) == 6
    assert movement.allocations.count() == 1


def test_post_payroll_rejects_allocations_above_net_after_recalculation(world):
    payroll = _payroll(world)
    EmployeeMovementService.allocate(_movement(world, "ADVANCE", 400000), payroll, 400000)
    PayrollItem.objects.filter(payroll=payroll).update(amount=Decimal("100000"))
    with pytest.raises(ValidationError, match="asignaciones"):
        post_payroll(payroll)


def test_loan_disbursement_requires_the_loan_account(employee, cash):  # noqa: F811
    from accounting.models import AccountingSettings

    AccountingSettings.get_solo()  # sin cuentas de RRHH configuradas
    with pytest.raises(ValidationError, match="Préstamos"):
        _loan_with_treasury(employee, cash)


def _loan_with_treasury(employee, cash):
    from hr.movement_services import LoanTerms

    terms = LoanTerms(rate=Decimal("0.01"), rate_period="MONTHLY", installments=6, first_year=2026, first_month=10)
    return EmployeeMovementService.create(
        employee, "LOAN", date(2026, 9, 1), 600000, loan=terms, treasury=TreasuryPayload(treasury_account_id=cash.id)
    )


def test_advance_disbursement_requires_the_advance_account(employee, cash):  # noqa: F811
    with pytest.raises(ValidationError, match="Anticipos"):
        EmployeeMovementService.create(
            employee, "ADVANCE", date(2026, 9, 1), 1000, treasury=TreasuryPayload(treasury_account_id=cash.id)
        )


def test_movement_history_endpoint_exists(employee):
    movement = EmployeeMovement.objects.create(employee=employee, kind="ADVANCE", date=date(2026, 9, 1), amount=1000)
    client = APIClient()
    client.force_authenticate(get_user_model().objects.create_superuser(username="hist_admin", password="x"))
    assert client.get(f"/api/hr/employee-movements/{movement.pk}/history/").status_code == 200


def test_role_bundles_rename_migration_replaces_the_dead_key():
    from django.contrib.auth.models import Group

    migration = importlib.import_module("core.migrations.0019_rename_salary_advances_bundle")
    group = Group.objects.create(name="RRHH test")
    GroupProfile.objects.update_or_create(group=group, defaults={"kind": "ROLE", "bundles": ["hr.read", "hr.salary_advances", "hr.employee_movements"]})
    migration.rename_bundle(__import__("django.apps", fromlist=["apps"]).apps, None)
    assert GroupProfile.objects.get(group=group).bundles == ["hr.read", "hr.employee_movements"]
