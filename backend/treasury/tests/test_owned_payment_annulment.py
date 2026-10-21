"""ADR-0091 — payments owned by HR/tax documents are annulled through the document;
treasury refuses to annul or cancel their movement directly."""

from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from accounting.models import Account, AccountingSettings, AccountType, JournalEntry
from contacts.models import Contact
from hr.models import Employee, Payroll, PayrollPayment
from hr.serializers import PayrollListSerializer
from tax.models import F29Declaration, F29Payment, TaxPeriod
from tax.services import F29PaymentService
from treasury.models import TreasuryAccount, TreasuryMovement
from treasury.services import TreasuryService

User = get_user_model()


@pytest.fixture
def client(db):
    c = APIClient()
    c.force_authenticate(User.objects.create_superuser("annulown", "o@x.cl", "x"))
    return c


@pytest.fixture
def bank(db):
    acc = {
        k: Account.objects.create(code=c, name=k, account_type=t)
        for k, c, t in [
            ("bank", "1.1.01.930", AccountType.ASSET),
            ("salaries", "2.1.02.930", AccountType.LIABILITY),
            ("vat", "2.1.03.930", AccountType.LIABILITY),
        ]
    }
    s = AccountingSettings.get_solo()
    s.account_remuneraciones_por_pagar = acc["salaries"]
    s.vat_payable_account = acc["vat"]
    s.save()
    return TreasuryAccount.objects.create(
        name="Banco", account=acc["bank"], account_type=TreasuryAccount.Type.CASH
    )


@pytest.fixture
def salary_payment(db, bank):
    contact = Contact.objects.create(name="Empleada", tax_id="66666666-6")
    employee = Employee.objects.create(contact=contact, base_salary=1, dias_pactados=30)
    payroll = Payroll.objects.create(
        employee=employee, period_year=2026, period_month=9, status="POSTED", base_salary=1
    )
    movement = TreasuryService.create_movement(
        amount=Decimal("1000"),
        movement_type=TreasuryMovement.Type.OUTBOUND,
        from_account=bank,
        payroll=payroll,
        payroll_payment_type=TreasuryMovement.PayrollPaymentType.SALARY,
        partner=contact,
        date=timezone.localdate(),
    )
    return PayrollPayment.objects.create(
        payroll=payroll, amount=Decimal("1000"), date=timezone.localdate(),
        journal_entry=movement.journal_entry,
    )


@pytest.fixture
def f29_payment(db, bank):
    declaration = F29Declaration.objects.create(
        tax_period=TaxPeriod.objects.create(year=2026, month=8),
        declaration_date=timezone.localdate(),
        sales_taxed=Decimal("100000"),
        journal_entry=JournalEntry.objects.create(
            date=timezone.localdate(), description="decl", status=JournalEntry.State.POSTED
        ),
    )
    return F29PaymentService.register_payment(
        declaration.pk, {"amount": Decimal("19000"), "treasury_account_id": bank.pk}
    )


def _movement(payment):
    return payment.journal_entry.treasury_movement


@pytest.mark.django_db
def test_annul_salary_payment_reverses_movement_and_frees_balance(client, salary_payment):
    res = client.post(
        f"/api/hr/payroll-payments/{salary_payment.pk}/annul/", {"reason": "cuenta errada"}, format="json"
    )
    assert res.status_code == 200, res.data
    assert res.data["status"] == "CANCELLED"
    movement = _movement(salary_payment)
    movement.refresh_from_db()
    assert movement.status == "CANCELLED"
    assert JournalEntry.objects.filter(reversal_of=salary_payment.journal_entry).exists()
    data = PayrollListSerializer(salary_payment.payroll).data
    assert Decimal(str(data["remuneration_paid_amount"])) == 0


@pytest.mark.django_db
def test_annul_payroll_payment_requires_reason(client, salary_payment):
    res = client.post(f"/api/hr/payroll-payments/{salary_payment.pk}/annul/", {}, format="json")
    assert res.status_code == 400


@pytest.mark.django_db
def test_annul_f29_payment(client, f29_payment):
    res = client.post(f"/api/tax/payments/{f29_payment.pk}/annul/", {"reason": "duplicado"}, format="json")
    assert res.status_code == 200, res.data
    f29_payment.refresh_from_db()
    assert f29_payment.status == F29Payment.Status.CANCELLED
    assert _movement(f29_payment).status == "CANCELLED"


@pytest.mark.django_db
@pytest.mark.parametrize("payment_fixture", ["salary_payment", "f29_payment"])
@pytest.mark.parametrize("action", ["annul", "cancel"])
def test_treasury_refuses_owned_movement(client, request, payment_fixture, action):
    payment = request.getfixturevalue(payment_fixture)
    movement = _movement(payment)
    res = client.post(f"/api/treasury/movements/{movement.pk}/{action}/", {"reason": "x"}, format="json")
    assert res.status_code == 400
    assert "anúlelo desde ese documento" in str(res.data)
    movement.refresh_from_db()
    assert movement.status == "POSTED"
