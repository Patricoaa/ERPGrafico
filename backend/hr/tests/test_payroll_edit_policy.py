"""ADR-0091 — a posted payroll and its lines reject edits through the API."""

from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from accounting.models import Account, AccountType
from contacts.models import Contact
from hr.models import Employee, Payroll, PayrollConcept, PayrollItem, PayrollPayment

User = get_user_model()


@pytest.fixture
def client(db):
    c = APIClient()
    c.force_authenticate(User.objects.create_superuser("payrollpol", "p@x.cl", "x"))
    return c


@pytest.fixture
def concept(db):
    account = Account.objects.create(
        code="5.1.02.901", name="Remuneraciones", account_type=AccountType.EXPENSE
    )
    return PayrollConcept.objects.create(
        name="Bono",
        category=PayrollConcept.Category.HABER_IMPONIBLE,
        account=account,
        formula_type=PayrollConcept.FormulaType.FIXED,
        default_amount=10000,
    )


@pytest.fixture
def employee(db):
    contact = Contact.objects.create(name="Ana Pérez", tax_id="11111111-1")
    return Employee.objects.create(contact=contact, base_salary=500000, dias_pactados=30)


def _payroll(employee, concept, status):
    payroll = Payroll.objects.create(
        employee=employee, period_year=2026, period_month=9, status=status, base_salary=500000
    )
    item = PayrollItem.objects.create(payroll=payroll, concept=concept, amount=Decimal("10000"))
    return payroll, item


def _url(payroll, suffix=""):
    return f"/api/hr/payrolls/{payroll.pk}/{suffix}"


@pytest.mark.django_db
def test_posted_payroll_rejects_economic_edit_but_accepts_notes(client, employee, concept):
    payroll, _ = _payroll(employee, concept, Payroll.Status.POSTED)
    res = client.patch(_url(payroll), {"base_salary": "900000"}, format="json")
    assert res.status_code == 422
    assert res.data["error"]["code"] == "DOCUMENT_LOCKED"
    assert client.patch(_url(payroll), {"notes": "obs"}, format="json").status_code == 200


@pytest.mark.django_db
def test_posted_payroll_cannot_be_deleted_or_recalculated(client, employee, concept):
    payroll, _ = _payroll(employee, concept, Payroll.Status.POSTED)
    assert client.delete(_url(payroll)).status_code == 422
    assert client.post(_url(payroll, "recalculate/")).status_code == 422
    assert Payroll.objects.filter(pk=payroll.pk).exists()


@pytest.mark.django_db
def test_draft_payroll_can_be_deleted(client, employee, concept):
    payroll, _ = _payroll(employee, concept, Payroll.Status.DRAFT)
    assert client.delete(_url(payroll)).status_code == 204


@pytest.mark.django_db
def test_posted_payroll_items_are_locked(client, employee, concept):
    payroll, item = _payroll(employee, concept, Payroll.Status.POSTED)
    item_url = _url(payroll, f"items/{item.pk}/")
    assert client.patch(item_url, {"amount": "1"}, format="json").status_code == 422
    assert client.delete(item_url).status_code == 422
    res = client.post(
        _url(payroll, "items/"),
        {"payroll": payroll.pk, "concept": concept.pk, "amount": "5"},
        format="json",
    )
    assert res.status_code == 422
    item.refresh_from_db()
    assert item.amount == Decimal("10000")


@pytest.mark.django_db
def test_draft_payroll_items_are_editable(client, employee, concept):
    payroll, item = _payroll(employee, concept, Payroll.Status.DRAFT)
    res = client.patch(_url(payroll, f"items/{item.pk}/"), {"amount": "20000"}, format="json")
    assert res.status_code == 200, res.data
    item.refresh_from_db()
    assert item.amount == Decimal("20000")


@pytest.mark.django_db
def test_payroll_payments_api_is_read_only(client, employee, concept):
    payroll, _ = _payroll(employee, concept, Payroll.Status.POSTED)
    payment = PayrollPayment.objects.create(
        payroll=payroll, amount=Decimal("1000"), date="2026-09-30"
    )
    url = f"/api/hr/payroll-payments/{payment.pk}/"
    assert client.patch(url, {"amount": "1"}, format="json").status_code == 405
    assert client.delete(url).status_code == 405
    body = {"payroll": payroll.pk, "amount": "1", "date": "2026-09-30"}
    assert client.post("/api/hr/payroll-payments/", body, format="json").status_code == 405
    assert client.get(url).status_code == 200


@pytest.mark.django_db
def test_detail_exposes_is_editable(client, employee, concept):
    draft, _ = _payroll(employee, concept, Payroll.Status.DRAFT)
    assert client.get(_url(draft)).data["is_editable"] is True
