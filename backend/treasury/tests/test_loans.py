"""
Tests del LoanService: generate_schedule (francés/lineal), disburse,
pay_installment (CLP y UF), prepay.

Cubre:
  - Sistema francés: 12 cuotas, suma de capital = principal, saldo final 0.
  - Sistema lineal: capital constante, interés decreciente.
  - Desembolso: 1 INBOUND al banco, status=ACTIVE, N cuotas PENDING.
  - Pago CLP: pasivo baja por principal; interés y seguro van a gasto.
  - Pago UF: conversión a CLP usando IndicatorValue; trazabilidad.
  - Prepago: saldo 0, status=PAID, cuotas CANCELED.
  - Refinanciación: status=REFINANCED, cuotas CANCELED.
"""
from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db.models import Sum

from accounting.models import Account, AccountType, JournalItem
from finances.models import IndicatorValue
from treasury.models import (
    Bank, BankLoan, LoanInstallment, TreasuryAccount, TreasuryMovement,
)
from treasury.loan_service import LoanService


User = get_user_model()


# ── Fixtures ───────────────────────────────────────────────────────────────


@pytest.fixture
def base(db):
    user = User.objects.create_user(username='loanuser', password='x')
    bank = Bank.objects.create(name='Banco Préstamos', code='BPR')

    # Banco: cuenta corriente (ASSET, 1.1.01)
    bank_acc = Account.objects.create(
        name='BCI Cte Préstamos', code='1.1.01.090',
        account_type=AccountType.ASSET,
    )
    bank_ta = TreasuryAccount.objects.create(
        name='BCI Cte Préstamos',
        account=bank_acc,
        account_type=TreasuryAccount.Type.CHECKING,
        bank=bank, account_number='900',
    )

    # Pasivo: cuenta de tesorería tipo LOAN (vinculada a cuenta LIABILITY)
    liab_acc = Account.objects.create(
        name='Préstamo BCI por Pagar', code='2.1.01.050',
        account_type=AccountType.LIABILITY,
    )
    liab_ta = TreasuryAccount.objects.create(
        name='Préstamo BCI por Pagar',
        account=liab_acc,
        account_type=TreasuryAccount.Type.LOAN,
        bank=bank,
    )

    # Cuentas de gasto
    interest_acc = Account.objects.create(
        name='Gasto Interés Bancario', code='5.2.01.010',
        account_type=AccountType.EXPENSE,
    )
    insurance_acc = Account.objects.create(
        name='Gasto Seguro Bancario', code='5.2.01.020',
        account_type=AccountType.EXPENSE,
    )

    return {
        'user': user, 'bank': bank,
        'bank_ta': bank_ta, 'liab_ta': liab_ta,
        'interest_acc': interest_acc, 'insurance_acc': insurance_acc,
    }


def _make_loan(base, **overrides):
    defaults = {
        'lender': base['bank'],
        'loan_number': 'OP-001',
        'currency': BankLoan.Currency.CLP,
        'principal': Decimal('12000000'),
        'interest_rate': Decimal('1.00'),  # 1% mensual
        'rate_basis': BankLoan.RateBasis.MONTHLY,
        'amortization_system': BankLoan.AmortizationSystem.FRENCH,
        'term_months': 12,
        'start_date': date(2026, 6, 1),
        'first_due_date': date(2026, 7, 1),
        'insurance_monthly': Decimal('5000'),
        'disbursement_account': base['bank_ta'],
        'liability_account': base['liab_ta'],
        'status': BankLoan.Status.DRAFT,
        'created_by': base['user'],
    }
    defaults.update(overrides)
    return BankLoan.objects.create(**defaults)


# ── F2.4 generate_schedule ───────────────────────────────────────────────


@pytest.mark.django_db
def test_french_schedule_sums_correctly(base):
    loan = _make_loan(base)
    rows = LoanService.generate_schedule(loan)

    assert len(rows) == 12
    total_principal = sum(r.principal_amount for r in rows)
    assert total_principal == Decimal('12000000.00')

    # Primera cuota: interés = principal · i = 12000000 · 0.01 = 120000
    assert rows[0].interest_amount == Decimal('120000.00')
    # Saldo final 0
    assert rows[-1].outstanding_balance == Decimal('0.00')


@pytest.mark.django_db
def test_linear_schedule_constant_capital(base):
    loan = _make_loan(
        base,
        amortization_system=BankLoan.AmortizationSystem.LINEAR,
        interest_rate=Decimal('0.00'),  # 0% para verificar capital constante
        insurance_monthly=Decimal('0'),
    )
    rows = LoanService.generate_schedule(loan)

    capital_const = Decimal('12000000') / Decimal('12')
    assert all(r.principal_amount == capital_const.quantize(Decimal('0.01')) for r in rows)
    assert all(r.interest_amount == Decimal('0.00') for r in rows)
    assert rows[-1].outstanding_balance == Decimal('0.00')


@pytest.mark.django_db
def test_schedule_is_idempotent_for_pending(base):
    loan = _make_loan(base)
    LoanService.generate_schedule(loan)
    count_1 = loan.installments.count()
    # Segunda llamada: borra PENDING y regenera.
    LoanService.generate_schedule(loan)
    count_2 = loan.installments.count()
    assert count_1 == count_2 == 12


@pytest.mark.django_db
def test_zero_interest_french(base):
    loan = _make_loan(base, interest_rate=Decimal('0'), insurance_monthly=Decimal('0'))
    rows = LoanService.generate_schedule(loan)
    assert all(r.interest_amount == Decimal('0.00') for r in rows)
    # Cuota = capital + 0 + 0 = 1.000.000
    assert all(r.total_amount == Decimal('1000000.00') for r in rows)


# ── F2.5 disburse ─────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_disburse_creates_movement_and_marks_active(base):
    loan = _make_loan(base)
    LoanService.disburse(loan, created_by=base['user'])

    loan.refresh_from_db()
    assert loan.status == BankLoan.Status.ACTIVE
    assert loan.installments.count() == 12
    # Movimiento INBOUND al banco por el principal.
    mv = TreasuryMovement.objects.filter(
        movement_type=TreasuryMovement.Type.INBOUND,
        to_account=base['bank_ta'],
        reference=loan.display_id,
    )
    assert mv.count() == 1
    assert mv.first().amount == Decimal('12000000.00')


@pytest.mark.django_db
def test_disburse_books_balanced_liability_entry(base):
    """El desembolso debe asentar Debe banco / Haber pasivo (no descartarse)."""
    from accounting.models import JournalItem
    loan = _make_loan(base)
    LoanService.disburse(loan, created_by=base['user'])

    movement = TreasuryMovement.objects.get(reference=loan.display_id)
    entry = movement.journal_entry
    assert entry is not None, "El desembolso no generó asiento (bug histórico)."
    assert entry.status == 'POSTED'
    assert entry.items.count() == 2

    debit_bank = JournalItem.objects.filter(
        entry=entry, account=base['bank_ta'].account,
    ).aggregate(s=Sum('debit'))['s']
    credit_liab = JournalItem.objects.filter(
        entry=entry, account=base['liab_ta'].account,
    ).aggregate(s=Sum('credit'))['s']
    assert debit_bank == Decimal('12000000.00')
    assert credit_liab == Decimal('12000000.00')

    # El pasivo (LIABILITY: credit - debit) refleja la deuda recién nacida.
    base['liab_ta'].account.refresh_from_db()
    assert base['liab_ta'].account.balance == Decimal('12000000.00')


@pytest.mark.django_db
def test_loan_rejects_non_loan_liability_account(base):
    """La liability_account de un crédito debe ser tipo LOAN (ADR-0041)."""
    # Reusar la cuenta bancaria (CHECKING) como pasivo → debe fallar el clean().
    bad = BankLoan(
        lender=base['bank'],
        currency=BankLoan.Currency.CLP,
        principal=Decimal('1000000'),
        interest_rate=Decimal('1.00'),
        rate_basis=BankLoan.RateBasis.MONTHLY,
        amortization_system=BankLoan.AmortizationSystem.FRENCH,
        term_months=6,
        start_date=date(2026, 6, 1),
        first_due_date=date(2026, 7, 1),
        disbursement_account=base['bank_ta'],
        liability_account=base['bank_ta'],  # CHECKING, no LOAN
    )
    with pytest.raises(ValidationError):
        bad.full_clean()


@pytest.mark.django_db
def test_disburse_is_idempotent(base):
    loan = _make_loan(base)
    LoanService.disburse(loan, created_by=base['user'])
    LoanService.disburse(loan, created_by=base['user'])
    # No debe crear un segundo movimiento.
    n = TreasuryMovement.objects.filter(reference=loan.display_id).count()
    assert n == 1


@pytest.mark.django_db
def test_disburse_paid_loan_raises(base):
    loan = _make_loan(base, status=BankLoan.Status.PAID)
    with pytest.raises(ValidationError):
        LoanService.disburse(loan)


@pytest.mark.django_db
def test_disburse_with_fees_nets_cash_and_books_expense(base):
    """Comisión + ITE: el banco recibe el neto y el pasivo nace por el principal."""
    from accounting.models import AccountingSettings
    commission_acc = Account.objects.create(
        name='Comisión Préstamo', code='5.2.01.030', account_type=AccountType.EXPENSE)
    stamp_acc = Account.objects.create(
        name='Impuesto Timbres', code='5.2.01.040', account_type=AccountType.EXPENSE)
    s = AccountingSettings.get_solo()
    s.loan_commission_expense_account = commission_acc
    s.loan_stamp_tax_expense_account = stamp_acc
    s.save()

    loan = _make_loan(base, opening_fee=Decimal('120000'), stamp_tax=Decimal('80000'))
    LoanService.disburse(loan, created_by=base['user'])

    movement = TreasuryMovement.objects.get(reference=loan.display_id)
    assert movement.amount == Decimal('11800000.00')  # 12.000.000 − 120.000 − 80.000
    entry = movement.journal_entry
    assert entry.items.count() == 4
    bank_debit = JournalItem.objects.filter(
        entry=entry, account=base['bank_ta'].account).aggregate(s=Sum('debit'))['s']
    liab_credit = JournalItem.objects.filter(
        entry=entry, account=base['liab_ta'].account).aggregate(s=Sum('credit'))['s']
    comm_debit = JournalItem.objects.filter(
        entry=entry, account=commission_acc).aggregate(s=Sum('debit'))['s']
    stamp_debit = JournalItem.objects.filter(
        entry=entry, account=stamp_acc).aggregate(s=Sum('debit'))['s']
    assert bank_debit == Decimal('11800000.00')
    assert liab_credit == Decimal('12000000.00')
    assert comm_debit == Decimal('120000.00')
    assert stamp_debit == Decimal('80000.00')


@pytest.mark.django_db
def test_disburse_fee_without_account_raises(base):
    """Comisión > 0 sin cuenta de gasto configurada → falla (fail-loud)."""
    loan = _make_loan(base, opening_fee=Decimal('50000'))
    with pytest.raises(ValidationError, match='Configure'):
        LoanService.disburse(loan, created_by=base['user'])


@pytest.mark.django_db
def test_pay_overdue_installment_charges_penalty(base):
    """Cuota vencida con tasa de mora: línea de mora, total mayor y penalty_paid."""
    from accounting.models import AccountingSettings
    penalty_acc = Account.objects.create(
        name='Gasto Mora', code='5.2.01.050', account_type=AccountType.EXPENSE)
    s = AccountingSettings.get_solo()
    s.loan_penalty_expense_account = penalty_acc
    s.save()

    loan = _make_loan(
        base, penalty_rate=Decimal('3.00'), insurance_monthly=Decimal('0'), term_months=2)
    LoanService.disburse(loan, created_by=base['user'])
    inst = loan.installments.first()
    inst.status = LoanInstallment.Status.OVERDUE
    inst.save()
    pay_date = inst.due_date + timedelta(days=30)

    paid = LoanService.pay_installment(
        loan, inst, payment_account=base['bank_ta'], date=pay_date, created_by=base['user'])
    paid.refresh_from_db()

    # mora = total cuota × 3% × 30/30.
    expected_penalty = (inst.total_amount * Decimal('0.03')).quantize(Decimal('0.01'))
    assert paid.penalty_paid == expected_penalty
    penalty_debit = JournalItem.objects.filter(
        account=penalty_acc, debit__gt=0).aggregate(s=Sum('debit'))['s']
    assert penalty_debit == expected_penalty
    # El OUTBOUND total incluye la mora.
    assert paid.payment_movement.amount == (inst.total_amount + expected_penalty)


# ── F2.6 / F2.7 pay_installment ───────────────────────────────────────────


@pytest.mark.django_db
def test_pay_installment_clp_splits_entry(base):
    loan = _make_loan(base)
    LoanService.disburse(loan, created_by=base['user'])
    inst = loan.installments.first()
    paid = LoanService.pay_installment(
        loan, inst,
        payment_account=base['bank_ta'],
        interest_expense_account=base['interest_acc'],
        insurance_expense_account=base['insurance_acc'],
        created_by=base['user'],
    )
    paid.refresh_from_db()
    assert paid.status == LoanInstallment.Status.PAID
    assert paid.payment_movement is not None
    # El asiento debe tener 4 líneas: pasivo (debe), interés (debe),
    # seguro (debe), banco (haber).
    entry = paid.payment_movement.journal_entry
    assert entry.status == 'POSTED'
    assert entry.items.count() == 4


@pytest.mark.django_db
def test_pay_installment_reduces_liability(base):
    loan = _make_loan(base)
    LoanService.disburse(loan, created_by=base['user'])
    inst = loan.installments.first()
    LoanService.pay_installment(
        loan, inst,
        payment_account=base['bank_ta'],
        interest_expense_account=base['interest_acc'],
        insurance_expense_account=base['insurance_acc'],
        created_by=base['user'],
    )
    # El pasivo (cuenta contable 2.1.01.050) debe haber bajado
    # en exactamente principal_amount de la primera cuota.
    from accounting.models import JournalItem
    debit_to_pasivo = JournalItem.objects.filter(
        account=base['liab_ta'].account,
        debit__gt=0,
    ).aggregate(total=__import__('django').db.models.Sum('debit'))['total']
    expected_debit = inst.principal_amount
    assert debit_to_pasivo == expected_debit


@pytest.mark.django_db
def test_pay_installment_uf_converts_to_clp(base):
    loan = _make_loan(
        base,
        currency=BankLoan.Currency.UF,
        principal=Decimal('1000.00'),  # 1000 UF
        interest_rate=Decimal('0.50'),  # 0.5% mensual
        insurance_monthly=Decimal('0.50'),  # 0.5 UF/mes
        term_months=2,
    )
    # Cargar UF para la fecha de pago.
    pay_date = date(2026, 7, 1)
    IndicatorValue.objects.create(
        indicator=IndicatorValue.Indicator.UF,
        date=pay_date, value=Decimal('37000'),
    )
    LoanService.disburse(loan, created_by=base['user'])
    inst = loan.installments.first()
    paid = LoanService.pay_installment(
        loan, inst,
        payment_account=base['bank_ta'],
        date=pay_date,
        created_by=base['user'],
    )
    paid.refresh_from_db()
    assert paid.uf_value_used == Decimal('37000')
    # El monto CLP pagado debe ser total_amount_uf · 37000
    expected_clp = paid.total_amount * Decimal('37000')
    assert paid.clp_amount_paid == expected_clp.quantize(Decimal('0.01'))


@pytest.mark.django_db
def test_pay_installment_without_uf_value_raises(base):
    loan = _make_loan(
        base,
        currency=BankLoan.Currency.UF,
        principal=Decimal('100'),
        interest_rate=Decimal('0'),
        insurance_monthly=Decimal('0'),
        term_months=1,
    )
    LoanService.disburse(loan, created_by=base['user'])
    inst = loan.installments.first()
    with pytest.raises(ValidationError, match='UF'):
        LoanService.pay_installment(
            loan, inst,
            payment_account=base['bank_ta'],
            created_by=base['user'],
        )


@pytest.mark.django_db
def test_pay_installment_closes_loan_when_all_paid(base):
    loan = _make_loan(base, term_months=1, insurance_monthly=Decimal('0'))
    LoanService.disburse(loan, created_by=base['user'])
    inst = loan.installments.first()
    LoanService.pay_installment(
        loan, inst, payment_account=base['bank_ta'],
        created_by=base['user'],
    )
    loan.refresh_from_db()
    assert loan.status == BankLoan.Status.PAID


# ── F2.8 prepay / refinance ───────────────────────────────────────────────


@pytest.mark.django_db
def test_prepay_cancels_remaining_and_marks_paid(base):
    loan = _make_loan(base, term_months=3)
    LoanService.disburse(loan, created_by=base['user'])
    # Pagar la primera cuota para que no esté pendiente.
    LoanService.pay_installment(
        loan, loan.installments.first(),
        payment_account=base['bank_ta'],
        created_by=base['user'],
    )
    LoanService.prepay(
        loan, payment_account=base['bank_ta'],
        created_by=base['user'],
    )
    loan.refresh_from_db()
    assert loan.status == BankLoan.Status.PAID
    canceled = loan.installments.filter(status=LoanInstallment.Status.CANCELED).count()
    assert canceled == 2  # cuotas 2 y 3


@pytest.mark.django_db
def test_prepay_uf_converts_with_uf_value(base):
    loan = _make_loan(
        base,
        currency=BankLoan.Currency.UF,
        principal=Decimal('500'),
        interest_rate=Decimal('0'),
        insurance_monthly=Decimal('0'),
        term_months=3,
    )
    IndicatorValue.objects.create(
        indicator=IndicatorValue.Indicator.UF,
        date=date(2026, 6, 15), value=Decimal('38000'),
    )
    LoanService.disburse(loan, created_by=base['user'])
    LoanService.prepay(
        loan, payment_account=base['bank_ta'],
        date=date(2026, 6, 15),
        created_by=base['user'],
    )
    loan.refresh_from_db()
    assert loan.status == BankLoan.Status.PAID
