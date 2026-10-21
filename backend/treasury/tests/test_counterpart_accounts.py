"""Outbound payments owned by HR or tax documents debit their own liability, not payables."""

from decimal import Decimal

import pytest
from django.utils import timezone

from accounting.models import Account, AccountingSettings, AccountType, JournalEntry, JournalItem
from contacts.models import Contact
from hr.models import Employee, Payroll
from tax.models import F29Declaration, TaxPeriod
from tax.services import F29PaymentService
from treasury.models import TreasuryAccount, TreasuryMovement
from treasury.services import TreasuryService


@pytest.fixture
def setup(db):
    names = {
        "bank": ("1.1.01.920", AccountType.ASSET),
        "payable": ("2.1.01.920", AccountType.LIABILITY),
        "salaries": ("2.1.02.920", AccountType.LIABILITY),
        "previred": ("2.1.04.920", AccountType.LIABILITY),
        "advances": ("1.1.05.920", AccountType.ASSET),
        "vat": ("2.1.03.920", AccountType.LIABILITY),
    }
    acc = {k: Account.objects.create(code=c, name=k, account_type=t) for k, (c, t) in names.items()}
    s = AccountingSettings.get_solo()
    s.default_payable_account = acc["payable"]
    s.account_remuneraciones_por_pagar = acc["salaries"]
    s.account_previred_por_pagar = acc["previred"]
    s.account_anticipos = acc["advances"]
    s.vat_payable_account = acc["vat"]
    s.save()
    bank = TreasuryAccount.objects.create(
        name="Banco", account=acc["bank"], account_type=TreasuryAccount.Type.CASH
    )
    return acc, bank


def _debit_account(entry):
    return entry.items.get(debit__gt=0).account


@pytest.mark.django_db
@pytest.mark.parametrize(
    "payment_type, expected",
    [
        (TreasuryMovement.PayrollPaymentType.SALARY, "salaries"),
        (TreasuryMovement.PayrollPaymentType.PREVIRED, "previred"),
        (TreasuryMovement.PayrollPaymentType.ADVANCE, "advances"),
    ],
)
def test_payroll_payments_debit_their_liability(setup, payment_type, expected):
    acc, bank = setup
    contact = Contact.objects.create(name="Empleado", tax_id="55555555-5")
    employee = Employee.objects.create(contact=contact, base_salary=1, dias_pactados=30)
    payroll = Payroll.objects.create(
        employee=employee, period_year=2026, period_month=9, status="POSTED", base_salary=1
    )
    movement = TreasuryService.create_movement(
        amount=Decimal("1000"),
        movement_type=TreasuryMovement.Type.OUTBOUND,
        from_account=bank,
        payroll=None if payment_type == TreasuryMovement.PayrollPaymentType.ADVANCE else payroll,
        payroll_payment_type=payment_type,
        partner=contact,
        date=timezone.localdate(),
    )
    assert _debit_account(movement.journal_entry) == acc[expected]


@pytest.mark.django_db
def test_f29_payment_creates_a_single_vat_entry_linked_to_the_payment(setup):
    acc, bank = setup
    declaration = F29Declaration.objects.create(
        tax_period=TaxPeriod.objects.create(year=2026, month=8),
        declaration_date=timezone.localdate(),
        sales_taxed=Decimal("100000"),
        journal_entry=JournalEntry.objects.create(
            date=timezone.localdate(), description="decl", status=JournalEntry.State.POSTED
        ),
    )
    payment = F29PaymentService.register_payment(
        declaration.pk, {"amount": Decimal("19000"), "treasury_account_id": bank.pk}
    )

    bank_credits = JournalItem.objects.filter(account=acc["bank"], credit__gt=0)
    assert bank_credits.count() == 1
    assert _debit_account(payment.journal_entry) == acc["vat"]
    assert payment.journal_entry.treasury_movement.amount == Decimal("19000")
