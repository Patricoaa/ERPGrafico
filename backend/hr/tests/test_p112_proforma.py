from datetime import date

import pytest

from accounting.models import Account, AccountType
from contacts.models import Contact
from hr.models import (
    Employee,
    EmployeeConceptAmount,
    GlobalHRSettings,
    Payroll,
    PayrollConcept,
)
from hr.services import PayrollService


@pytest.fixture
def payroll_setup(db):
    account = Account.objects.create(
        code="5.1.01.001",
        name="Gastos de Remuneraciones",
        account_type=AccountType.EXPENSE,
    )
    GlobalHRSettings.objects.create(
        uf_current_value="37000",
        utm_current_value="65000",
        min_wage_value="500000",
    )
    contact = Contact.objects.create(name="Juan Pérez", tax_id="11111111-1")
    employee = Employee.objects.create(
        contact=contact,
        base_salary=900000,
        dias_pactados=30,
        start_date=date(2020, 1, 1),
    )
    concepts = [
        PayrollConcept.objects.create(
            name="Sueldo Base",
            category=PayrollConcept.Category.HABER_IMPONIBLE,
            account=account,
            formula_type=PayrollConcept.FormulaType.FIXED,
            default_amount=900000,
            is_system=True,
        ),
        PayrollConcept.objects.create(
            name="Bono Colación",
            category=PayrollConcept.Category.HABER_IMPONIBLE,
            account=account,
            formula_type=PayrollConcept.FormulaType.EMPLOYEE_SPECIFIC,
        ),
        PayrollConcept.objects.create(
            name="Movilización",
            category=PayrollConcept.Category.HABER_NO_IMPONIBLE,
            account=account,
            formula_type=PayrollConcept.FormulaType.EMPLOYEE_SPECIFIC,
        ),
        PayrollConcept.objects.create(
            name="Descuento Previsión",
            category=PayrollConcept.Category.DESCUENTO_LEGAL_TRABAJADOR,
            account=account,
            formula_type=PayrollConcept.FormulaType.PERCENTAGE,
            default_amount=7,
        ),
        PayrollConcept.objects.create(
            name="Bono Antigüedad",
            category=PayrollConcept.Category.HABER_IMPONIBLE,
            account=account,
            formula_type=PayrollConcept.FormulaType.FORMULA,
            formula="BASE * 0.05",
        ),
    ]
    extras = [
        PayrollConcept.objects.create(
            name=f"Bono Extra {i}",
            category=PayrollConcept.Category.HABER_IMPONIBLE,
            account=account,
            formula_type=PayrollConcept.FormulaType.EMPLOYEE_SPECIFIC,
        )
        for i in range(8)
    ]
    EmployeeConceptAmount.objects.create(employee=employee, concept=concepts[1], amount=30000)
    for extra in extras:
        EmployeeConceptAmount.objects.create(employee=employee, concept=extra, amount=10000)
    return {"employee": employee, "account": account, "concepts": concepts + extras}


def _draft_payroll(employee, year=2026, month=8):
    return Payroll.objects.create(
        employee=employee,
        period_year=year,
        period_month=month,
        status=Payroll.Status.DRAFT,
    )


def test_proforma_generates_items_bounded(payroll_setup, django_assert_num_queries):
    employee = payroll_setup["employee"]
    payroll = _draft_payroll(employee)

    with django_assert_num_queries(32, exact=False):
        result = PayrollService.generate_proforma_payroll(payroll=payroll)

    assert result.pk == payroll.pk
    payroll.refresh_from_db()
    assert payroll.status == Payroll.Status.DRAFT
    assert payroll.worked_days == 30
    assert payroll.total_haberes > 0
    assert payroll.net_salary > 0

    items = list(payroll.items.all())
    assert len(items) >= 11
    by_name = {item.concept.name: item for item in items}
    assert by_name["Sueldo Base"].amount == 900000
    assert by_name["Bono Colación"].amount == 30000
    assert by_name["Bono Antigüedad"].amount == 45000
    assert "Descuento Previsión" in by_name
    assert "Movilización" not in by_name


def test_proforma_employee_specific_extra_amounts(payroll_setup):
    employee = payroll_setup["employee"]
    payroll = _draft_payroll(employee)

    PayrollService.generate_proforma_payroll(payroll=payroll)

    items = list(payroll.items.all())
    by_name = {item.concept.name: item for item in items}
    for i in range(8):
        assert by_name[f"Bono Extra {i}"].amount == 10000


def test_proforma_regeneration_replaces_items(payroll_setup):
    employee = payroll_setup["employee"]
    payroll = _draft_payroll(employee)

    PayrollService.generate_proforma_payroll(payroll=payroll)
    first_count = payroll.items.count()

    PayrollService.generate_proforma_payroll(payroll=payroll)

    payroll.refresh_from_db()
    assert payroll.items.count() == first_count
    items = list(payroll.items.all())
    assert len({item.concept_id for item in items}) == len(items)


def test_proforma_creates_new_payroll_when_no_draft(payroll_setup, django_assert_num_queries):
    employee = payroll_setup["employee"]

    with django_assert_num_queries(42, exact=False):
        payroll = PayrollService.generate_proforma_payroll(
            employee_id=employee.pk, year=2026, month=9
        )

    payroll.refresh_from_db()
    assert payroll.status == Payroll.Status.DRAFT
    assert payroll.period_month == 9
    assert payroll.items.count() >= 11


def test_proforma_rejects_posted_payroll(payroll_setup):
    employee = payroll_setup["employee"]
    payroll = _draft_payroll(employee)
    payroll.status = Payroll.Status.POSTED
    payroll.save()

    with pytest.raises(Exception) as exc_info:
        PayrollService.generate_proforma_payroll(payroll=payroll)

    assert "contabilizada" in str(exc_info.value)
