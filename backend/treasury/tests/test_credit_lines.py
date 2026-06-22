"""
Tests del modelo CreditLine: creación, propiedades drawn/available,
validaciones, y auto-creación via data migration.
"""
from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError

from accounting.models import Account, AccountType
from treasury.models import (
    Bank, BankLoan, CreditLine, LoanInstallment, TreasuryAccount,
)
from treasury.loan_service import LoanService


User = None  # resolved in fixture


@pytest.fixture
def base(db):
    from django.contrib.auth import get_user_model
    global User
    User = get_user_model()
    user = User.objects.create_user(username='cluser', password='x')
    bank = Bank.objects.create(name='Banco Líneas', code='BLN')

    Account.objects.create(
        name='Efectivo y Equivalentes', code='1.1.01',
        account_type=AccountType.ASSET,
    )
    bank_acc = Account.objects.create(
        name='Cta Líneas', code='1.1.01.090',
        account_type=AccountType.ASSET,
    )
    bank_ta = TreasuryAccount.objects.create(
        name='Cta Líneas', account=bank_acc,
        account_type=TreasuryAccount.Type.CHECKING,
        bank=bank, account_number='901',
    )

    liab_acc = Account.objects.create(
        name='Pasivo Líneas', code='2.1.02',
        account_type=AccountType.LIABILITY,
    )
    liab_ta = TreasuryAccount.objects.create(
        name='Pasivo Líneas', account=liab_acc,
        account_type=TreasuryAccount.Type.LOAN,
        bank=bank,
    )

    interest_acc = Account.objects.create(
        name='Gasto Int Líneas', code='5.2.02',
        account_type=AccountType.EXPENSE,
    )
    insurance_acc = Account.objects.create(
        name='Gasto Seg Líneas', code='5.2.03',
        account_type=AccountType.EXPENSE,
    )

    return {
        'user': user, 'bank': bank,
        'bank_ta': bank_ta, 'liab_ta': liab_ta,
        'interest_acc': interest_acc, 'insurance_acc': insurance_acc,
    }


def _make_credit_line(**overrides):
    defaults = {
        'bank_id': 1,
        'code': 'LINEA-001',
        'credit_line_type': CreditLine.Type.REVOLVING,
        'currency': 'CLP',
        'approved_amount': Decimal('100000000'),
        'interest_rate': Decimal('0.80'),
        'rate_basis': 'MONTHLY',
        'spread': Decimal('0'),
        'valid_from': date(2026, 1, 1),
        'valid_until': date(2028, 1, 1),
        'status': CreditLine.Status.ACTIVE,
    }
    defaults.update(overrides)
    return CreditLine.objects.create(**defaults)


def _make_loan(base, credit_line=None, **overrides):
    defaults = {
        'lender': base['bank'],
        'loan_number': 'OP-002',
        'currency': BankLoan.Currency.CLP,
        'principal': Decimal('30000000'),
        'interest_rate': Decimal('1.00'),
        'rate_basis': BankLoan.RateBasis.MONTHLY,
        'amortization_system': BankLoan.AmortizationSystem.FRENCH,
        'term_months': 12,
        'start_date': date(2026, 6, 1),
        'first_due_date': date(2026, 7, 1),
        'disbursement_account': base['bank_ta'],
        'liability_account': base['liab_ta'],
        'status': BankLoan.Status.DRAFT,
        'created_by': base['user'],
    }
    if credit_line:
        defaults['credit_line'] = credit_line
    defaults.update(overrides)
    return BankLoan.objects.create(**defaults)


# ─── Tests ───────────────────────────────────────────────────────────────────


class TestCreditLineModel:

    def test_create_credit_line(self, base):
        cl = _make_credit_line(bank=base['bank'])
        assert cl.display_id == 'CL-LINEA-001'
        assert cl.status == CreditLine.Status.ACTIVE
        assert cl.approved_amount == Decimal('100000000')
        assert cl.drawn_amount == Decimal('0')
        assert cl.available_amount == Decimal('100000000')
        assert cl.utilization_rate == Decimal('0')

    def test_drawn_amount_increases_after_disbursement(self, base):
        cl = _make_credit_line(bank=base['bank'])
        loan = _make_loan(base, credit_line=cl)
        assert cl.drawn_amount == Decimal('0')

        LoanService.disburse(loan, created_by=base['user'])
        cl.refresh_from_db()
        assert cl.drawn_amount > Decimal('0')
        assert cl.available_amount < cl.approved_amount

    def test_drawn_amount_excludes_paid_loans(self, base):
        cl = _make_credit_line(bank=base['bank'], approved_amount=Decimal('1000000'))
        # term_months=360 → first installment principal is tiny, so
        # outstanding_balance ≈ full principal → drawn_amount > 0.
        loan = _make_loan(base, credit_line=cl, principal=Decimal('1000000'), term_months=360)
        LoanService.disburse(loan, created_by=base['user'])

        cl.refresh_from_db()
        drawn_before = cl.drawn_amount
        assert drawn_before > 0

        # Fully prepay the loan
        LoanService.prepay(loan, payment_account=base['bank_ta'],
                           interest_expense_account=base['interest_acc'],
                           insurance_expense_account=base['insurance_acc'],
                           created_by=base['user'])
        loan.refresh_from_db()
        assert loan.status == BankLoan.Status.PAID

        cl.refresh_from_db()
        assert cl.drawn_amount == Decimal('0')
        assert cl.available_amount == cl.approved_amount

    def test_available_amount_decreases_with_multiple_loans(self, base):
        cl = _make_credit_line(bank=base['bank'], approved_amount=Decimal('50000000'))
        loan1 = _make_loan(base, credit_line=cl, principal=Decimal('20000000'), term_months=6)
        loan2 = _make_loan(base, credit_line=cl, principal=Decimal('15000000'), term_months=6)

        LoanService.disburse(loan1, created_by=base['user'])
        cl.refresh_from_db()
        after_one = cl.available_amount

        LoanService.disburse(loan2, created_by=base['user'])
        cl.refresh_from_db()

        assert cl.drawn_amount > 0
        assert cl.available_amount < after_one

    def test_validation_valid_until_before_valid_from(self, base):
        cl = CreditLine(
            bank=base['bank'], code='ERR-LINEA',
            credit_line_type=CreditLine.Type.REVOLVING,
            approved_amount=Decimal('10000000'),
            valid_from=date(2026, 6, 1),
            valid_until=date(2026, 1, 1),
        )
        with pytest.raises(ValidationError):
            cl.full_clean()

    def test_validation_auto_renewal_without_term(self, base):
        cl = CreditLine(
            bank=base['bank'], code='ERR-LINEA',
            credit_line_type=CreditLine.Type.REVOLVING,
            approved_amount=Decimal('10000000'),
            valid_from=date(2026, 1, 1),
            valid_until=date(2028, 1, 1),
            auto_renewal=True,
            renewal_term_months=None,
        )
        with pytest.raises(ValidationError):
            cl.full_clean()

    def test_auto_renewal_with_term_valid(self, base):
        cl = _make_credit_line(bank=base['bank'], auto_renewal=True, renewal_term_months=12)
        cl.full_clean()  # should not raise
        assert cl.renewal_term_months == 12

    def test_display_id_without_code(self, base):
        cl = _make_credit_line(bank=base['bank'], code='')
        assert cl.display_id.startswith('CL-')

    def test_utilization_rate_none_when_no_approved(self, base):
        cl = _make_credit_line(bank=base['bank'], approved_amount=Decimal('0'))
        assert cl.utilization_rate is None

    def test_loan_validation_exceeds_available(self, base):
        cl = _make_credit_line(bank=base['bank'], approved_amount=Decimal('10000000'))
        loan = BankLoan(
            lender=base['bank'], loan_number='OP-EXCESO',
            currency=BankLoan.Currency.CLP,
            principal=Decimal('20000000'),
            interest_rate=Decimal('1.00'), term_months=12,
            start_date=date(2026, 6, 1), first_due_date=date(2026, 7, 1),
            disbursement_account=base['bank_ta'],
            liability_account=base['liab_ta'],
            credit_line=cl, status=BankLoan.Status.DRAFT,
            created_by=base['user'],
        )
        with pytest.raises(ValidationError, match='excede el cupo disponible'):
            loan.full_clean()

    def test_disburse_validation_exceeds_available(self, base):
        cl = _make_credit_line(bank=base['bank'], approved_amount=Decimal('10000000'))
        # Long term → first installment principal ~0 → outstanding ≈ principal → drawn ≈ 10MM
        loan = _make_loan(base, credit_line=cl, principal=Decimal('10000000'), term_months=360)
        LoanService.disburse(loan, created_by=base['user'])

        loan2 = _make_loan(base, credit_line=cl, principal=Decimal('10000000'))
        with pytest.raises(ValidationError, match='excede el cupo disponible'):
            LoanService.disburse(loan2, created_by=base['user'])

    def test_paid_loan_frees_available_amount(self, base):
        cl = _make_credit_line(bank=base['bank'], approved_amount=Decimal('10000000'))
        # Long term → drawn_amount ≈ principal
        loan = _make_loan(base, credit_line=cl, principal=Decimal('10000000'), term_months=360)
        LoanService.disburse(loan, created_by=base['user'])

        cl.refresh_from_db()
        assert cl.drawn_amount > 0
        assert cl.available_amount < cl.approved_amount

        LoanService.prepay(loan, payment_account=base['bank_ta'],
                           interest_expense_account=base['interest_acc'],
                           insurance_expense_account=base['insurance_acc'],
                           created_by=base['user'])
        cl.refresh_from_db()
        assert cl.drawn_amount == Decimal('0')
        assert cl.available_amount == cl.approved_amount
