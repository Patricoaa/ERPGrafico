from datetime import date
from unittest.mock import patch

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from accounting.models import Account, AccountType
from contacts.models import Contact
from hr.models import (
    Employee,
    GlobalHRSettings,
    Payroll,
    PayrollConcept,
)
from hr.tasks import create_monthly_draft_payrolls


def _account():
    return Account.objects.create(
        code="5.1.02.001",
        name="Gastos de Remuneraciones",
        account_type=AccountType.EXPENSE,
    )


def _employee(contact_name, tax_id, active=True):
    contact = Contact.objects.create(name=contact_name, tax_id=tax_id)
    return Employee.objects.create(
        contact=contact,
        base_salary=500000,
        dias_pactados=30,
        status=Employee.Status.ACTIVE if active else Employee.Status.INACTIVE,
    )


@pytest.fixture
def batch_setup(db):
    GlobalHRSettings.objects.create(
        uf_current_value="37000",
        utm_current_value="65000",
        min_wage_value="500000",
    )
    account = _account()
    concepts = [
        PayrollConcept.objects.create(
            name="Sueldo Base",
            category=PayrollConcept.Category.HABER_IMPONIBLE,
            account=account,
            formula_type=PayrollConcept.FormulaType.FIXED,
            default_amount=500000,
            is_system=True,
        ),
        PayrollConcept.objects.create(
            name="Bono Colación",
            category=PayrollConcept.Category.HABER_IMPONIBLE,
            account=account,
            formula_type=PayrollConcept.FormulaType.FIXED,
            default_amount=20000,
        ),
    ]
    return {"concepts": concepts}


def test_batch_creates_drafts_and_skips_existing(db, batch_setup):
    with patch("django.utils.timezone.localdate", return_value=date(2026, 8, 1)):
        e1 = _employee("A", "11111111-1")
        e2 = _employee("B", "22222222-2")
        _employee("C", "33333333-3", active=False)

        result = create_monthly_draft_payrolls()

        assert result["created"] == 2
        assert result["skipped"] == 0
        for employee in (e1, e2):
            payroll = Payroll.objects.get(employee=employee, period_year=2026, period_month=8)
            assert payroll.status == Payroll.Status.DRAFT
            assert payroll.items.count() == 2

        result = create_monthly_draft_payrolls()
        assert result["created"] == 0
        assert result["skipped"] == 2


def test_batch_queries_do_not_scale_with_concepts(db, batch_setup):
    _employee("A", "11111111-1")
    _employee("B", "22222222-2")

    with patch("django.utils.timezone.localdate", return_value=date(2026, 8, 1)):
        with CaptureQueriesContext(connection) as ctx:
            create_monthly_draft_payrolls()
    q1 = len(ctx)

    account = batch_setup["concepts"][0].account
    for i in range(6):
        PayrollConcept.objects.create(
            name=f"Bono Extra {i}",
            category=PayrollConcept.Category.HABER_IMPONIBLE,
            account=account,
            formula_type=PayrollConcept.FormulaType.FIXED,
            default_amount=1000,
        )

    with patch("django.utils.timezone.localdate", return_value=date(2026, 9, 1)):
        with CaptureQueriesContext(connection) as ctx:
            create_monthly_draft_payrolls()
    q2 = len(ctx)

    assert q2 <= q1 + 4
