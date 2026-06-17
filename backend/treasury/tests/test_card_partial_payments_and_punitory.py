"""
Tests: pagos parciales e interés punitorio (Onda 3, ADR-0044).

Cubre:
  - Pago parcial: status pasa a PARTIALLY_PAID, amount_paid sube.
  - Segundo pago parcial: status PARTIALLY_PAID, amount_paid += segundo pago.
  - Pago final: status pasa a PAID, amount_paid == total.
  - amount > outstanding se trunca al saldo.
  - amount = None paga el total (retrocompatibilidad).
  - amount <= 0 rechazado.
  - card_minimum_payment_block rechaza pagos parciales.
  - compute_punitory_interest: cálculo, rate=0, no-vencido, sin saldo.
  - apply_punitory_interest: imputa ADJUSTMENT, idempotente por mes.
  - Task compute_overdue_card_interest: procesa vencidos, suma interés.
"""
from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError

from accounting.models import Account, AccountType, AccountingSettings
from treasury.models import Bank, TreasuryAccount, CreditCardStatement, TreasuryMovement
from treasury.card_service import CardService
from treasury.services import TreasuryService


User = get_user_model()


@pytest.fixture
def env(db):
    user = User.objects.create_user(username='ccw', password='x')
    bank = Bank.objects.create(name='Banco W', code='BW')

    bank_acc = Account.objects.create(
        name='Cta Cte', code='1.1.01.130', account_type=AccountType.ASSET,
    )
    bank_ta = TreasuryAccount.objects.create(
        name='Cta Cte', account=bank_acc,
        account_type=TreasuryAccount.Type.CHECKING,
        bank=bank, account_number='444',
    )

    card_acc = Account.objects.create(
        name='Visa W', code='2.1.09.050',
        account_type=AccountType.LIABILITY,
    )
    card_ta = TreasuryAccount.objects.create(
        name='Visa W', account=card_acc,
        account_type=TreasuryAccount.Type.CREDIT_CARD, bank=bank,
    )

    # Cargar checking con $1.000.000 vía INBOUND + AR.
    from contacts.models import Contact
    from billing.models import Invoice
    ar = Account.objects.create(
        name='AR W', code='1.1.02.030', account_type=AccountType.ASSET,
    )
    customer = Contact.objects.create(
        name='Cliente W', tax_id='76.444.444-4',
    )
    inv = Invoice.objects.create(
        contact=customer, date=date(2026, 6, 1), number='FAC-W-FUND-1',
    )
    TreasuryService.create_movement(
        amount=Decimal('1000000'),
        movement_type=TreasuryMovement.Type.INBOUND,
        to_account=bank_ta,
        partner=customer,
        date=date(2026, 6, 1),
        created_by=user, invoice=inv,
    )

    return {
        'user': user, 'bank': bank, 'bank_ta': bank_ta, 'card_ta': card_ta,
    }


def _open(env, billed=Decimal('100000'), due=None, period=(2026, 6)):
    if due is None:
        due = date(2026, 7, 25)
    return CreditCardStatement.objects.create(
        card_account=env['card_ta'],
        period_year=period[0], period_month=period[1],
        cut_off_date=date(period[0], period[1], 28),
        due_date=due,
        billed_amount=billed,
        minimum_payment=Decimal('10000'),
        created_by=env['user'],
    )


# ── Pagos parciales ────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_pay_partial_marks_partially_paid(env):
    stmt = _open(env, billed=Decimal('100000'))
    stmt = CardService.pay_statement(
        stmt, payment_account=env['bank_ta'],
        amount=Decimal('40000'), date=date(2026, 6, 15),
        created_by=env['user'],
    )
    stmt.refresh_from_db()
    assert stmt.status == CreditCardStatement.Status.PARTIALLY_PAID
    assert stmt.amount_paid == Decimal('40000.00')
    assert stmt.outstanding_balance == Decimal('60000.00')
    assert stmt.total_to_pay == Decimal('100000.00')


@pytest.mark.django_db
def test_second_partial_accumulates_amount_paid(env):
    stmt = _open(env, billed=Decimal('100000'))
    CardService.pay_statement(
        stmt, payment_account=env['bank_ta'],
        amount=Decimal('30000'), date=date(2026, 6, 15),
        created_by=env['user'],
    )
    stmt.refresh_from_db()
    CardService.pay_statement(
        stmt, payment_account=env['bank_ta'],
        amount=Decimal('30000'), date=date(2026, 6, 20),
        created_by=env['user'],
    )
    stmt.refresh_from_db()
    assert stmt.status == CreditCardStatement.Status.PARTIALLY_PAID
    assert stmt.amount_paid == Decimal('60000.00')
    assert stmt.outstanding_balance == Decimal('40000.00')
    # Dos pagos parciales asociados.
    assert stmt.payment_movements.count() == 2


@pytest.mark.django_db
def test_pay_partial_then_full_marks_paid(env):
    stmt = _open(env, billed=Decimal('100000'))
    CardService.pay_statement(
        stmt, payment_account=env['bank_ta'],
        amount=Decimal('30000'), date=date(2026, 6, 15),
        created_by=env['user'],
    )
    stmt.refresh_from_db()
    # Pago el saldo restante: amount = outstanding.
    CardService.pay_statement(
        stmt, payment_account=env['bank_ta'],
        amount=stmt.outstanding_balance, date=date(2026, 6, 25),
        created_by=env['user'],
    )
    stmt.refresh_from_db()
    assert stmt.status == CreditCardStatement.Status.PAID
    assert stmt.amount_paid == Decimal('100000.00')
    assert stmt.outstanding_balance == Decimal('0.00')


@pytest.mark.django_db
def test_pay_amount_greater_than_outstanding_truncates(env):
    stmt = _open(env, billed=Decimal('100000'))
    CardService.pay_statement(
        stmt, payment_account=env['bank_ta'],
        amount=Decimal('30000'), date=date(2026, 6, 15),
        created_by=env['user'],
    )
    stmt.refresh_from_db()
    # amount > outstanding → truncar al saldo.
    CardService.pay_statement(
        stmt, payment_account=env['bank_ta'],
        amount=Decimal('999999'), date=date(2026, 6, 25),
        created_by=env['user'],
    )
    stmt.refresh_from_db()
    assert stmt.status == CreditCardStatement.Status.PAID
    assert stmt.amount_paid == Decimal('100000.00')


@pytest.mark.django_db
def test_pay_amount_none_pays_full_backward_compat(env):
    """Omitempty / None = pagar el total (retrocompatibilidad)."""
    stmt = _open(env, billed=Decimal('100000'))
    stmt = CardService.pay_statement(
        stmt, payment_account=env['bank_ta'],
        amount=None, date=date(2026, 6, 15),
        created_by=env['user'],
    )
    stmt.refresh_from_db()
    assert stmt.status == CreditCardStatement.Status.PAID
    assert stmt.amount_paid == Decimal('100000.00')


@pytest.mark.django_db
def test_pay_amount_zero_or_negative_rejected(env):
    stmt = _open(env, billed=Decimal('100000'))
    with pytest.raises(ValidationError):
        CardService.pay_statement(
            stmt, payment_account=env['bank_ta'],
            amount=Decimal('0'), date=date(2026, 6, 15),
            created_by=env['user'],
        )
    with pytest.raises(ValidationError):
        CardService.pay_statement(
            stmt, payment_account=env['bank_ta'],
            amount=Decimal('-100'), date=date(2026, 6, 15),
            created_by=env['user'],
        )


@pytest.mark.django_db
def test_pay_partial_blocked_when_minimum_payment_block_enabled(env):
    AccountingSettings.objects.update_or_create(
        defaults={'card_minimum_payment_block': True},
    )
    stmt = _open(env, billed=Decimal('100000'))
    # Pago menor al mínimo (10.000) → bloqueado.
    with pytest.raises(ValidationError) as exc:
        CardService.pay_statement(
            stmt, payment_account=env['bank_ta'],
            amount=Decimal('5000'), date=date(2026, 6, 15),
            created_by=env['user'],
        )
    assert 'minimum' in str(exc.value).lower() or 'mínimo' in str(exc.value).lower()


@pytest.mark.django_db
def test_pay_partial_allowed_when_minimum_payment_block_disabled(env):
    AccountingSettings.objects.update_or_create(
        defaults={'card_minimum_payment_block': False},
    )
    stmt = _open(env, billed=Decimal('100000'))
    stmt = CardService.pay_statement(
        stmt, payment_account=env['bank_ta'],
        amount=Decimal('40000'), date=date(2026, 6, 15),
        created_by=env['user'],
    )
    assert stmt.status == CreditCardStatement.Status.PARTIALLY_PAID


@pytest.mark.django_db
def test_partial_pay_from_overdue_status(env):
    """Pago parcial desde un statement ya OVERDUE."""
    stmt = _open(env, billed=Decimal('100000'),
                 due=date(2026, 5, 1))  # ya vencido
    stmt.status = CreditCardStatement.Status.OVERDUE
    stmt.save()
    stmt = CardService.pay_statement(
        stmt, payment_account=env['bank_ta'],
        amount=Decimal('50000'), date=date(2026, 6, 15),
        created_by=env['user'],
    )
    stmt.refresh_from_db()
    # Pasa a PARTIALLY_PAID (no a PAID — sigue debiendo).
    assert stmt.status == CreditCardStatement.Status.PARTIALLY_PAID
    assert stmt.amount_paid == Decimal('50000.00')


# ── Interés punitorio ──────────────────────────────────────────────────────


@pytest.mark.django_db
def test_compute_punitory_interest_zero_when_not_overdue(env):
    stmt = _open(env, billed=Decimal('100000'),
                 due=date(2026, 8, 1))  # no vencido
    AccountingSettings.objects.update_or_create(
        defaults={'card_punitory_monthly_rate': Decimal('0.10')},
    )
    interest = CardService.compute_punitory_interest(
        stmt, as_of_date=date(2026, 7, 15),
    )
    assert interest == Decimal('0')


@pytest.mark.django_db
def test_compute_punitory_interest_zero_when_rate_zero(env):
    stmt = _open(env, billed=Decimal('100000'),
                 due=date(2026, 5, 1))  # vencido
    AccountingSettings.objects.update_or_create(
        defaults={'card_punitory_monthly_rate': Decimal('0')},
    )
    interest = CardService.compute_punitory_interest(
        stmt, as_of_date=date(2026, 6, 15),
    )
    assert interest == Decimal('0')


@pytest.mark.django_db
def test_compute_punitory_interest_one_month(env):
    """30 días de mora → 1 mes, 10% de 100.000 = 10.000."""
    stmt = _open(env, billed=Decimal('100000'), due=date(2026, 5, 1))
    AccountingSettings.objects.update_or_create(
        defaults={'card_punitory_monthly_rate': Decimal('0.10')},
    )
    # 45 días de mora → floor(45/30) = 1 mes.
    interest = CardService.compute_punitory_interest(
        stmt, as_of_date=date(2026, 6, 15),
    )
    assert interest == Decimal('10000.00')


@pytest.mark.django_db
def test_compute_punitory_interest_multiple_months(env):
    """75 días de mora → floor(75/30) = 2 meses, 10% × 2 × 100.000 = 20.000."""
    stmt = _open(env, billed=Decimal('100000'), due=date(2026, 5, 1))
    AccountingSettings.objects.update_or_create(
        defaults={'card_punitory_monthly_rate': Decimal('0.10')},
    )
    interest = CardService.compute_punitory_interest(
        stmt, as_of_date=date(2026, 7, 15),
    )
    assert interest == Decimal('20000.00')


@pytest.mark.django_db
def test_compute_punitory_interest_on_outstanding_not_total(env):
    """Aplica al saldo impago, no al total facturado."""
    stmt = _open(env, billed=Decimal('100000'), due=date(2026, 5, 1))
    AccountingSettings.objects.update_or_create(
        defaults={'card_punitory_monthly_rate': Decimal('0.10')},
    )
    # Pago parcial de 40.000 → outstanding 60.000.
    CardService.pay_statement(
        stmt, payment_account=env['bank_ta'],
        amount=Decimal('40000'), date=date(2026, 5, 15),
        created_by=env['user'],
    )
    stmt.refresh_from_db()
    interest = CardService.compute_punitory_interest(
        stmt, as_of_date=date(2026, 6, 15),
    )
    # 1 mes × 10% × 60.000 = 6.000
    assert interest == Decimal('6000.00')


@pytest.mark.django_db
def test_apply_punitory_interest_creates_adjustment(env):
    stmt = _open(env, billed=Decimal('100000'), due=date(2026, 5, 1))
    interest_exp = Account.objects.create(
        name='Gasto Interés', code='5.1.01.001',
        account_type=AccountType.EXPENSE,
    )
    AccountingSettings.objects.update_or_create(
        defaults={
            'card_punitory_monthly_rate': Decimal('0.10'),
            'interest_expense_account': interest_exp,
        },
    )

    interest, movement = CardService.apply_punitory_interest(
        stmt, as_of_date=date(2026, 6, 15),
    )
    assert interest == Decimal('10000.00')
    assert movement is not None
    assert movement.movement_type == TreasuryMovement.Type.ADJUSTMENT
    assert movement.amount == Decimal('10000.00')


@pytest.mark.django_db
def test_apply_punitory_interest_idempotent_same_month(env):
    stmt = _open(env, billed=Decimal('100000'), due=date(2026, 5, 1))
    interest_exp = Account.objects.create(
        name='Gasto Interés', code='5.1.01.002',
        account_type=AccountType.EXPENSE,
    )
    AccountingSettings.objects.update_or_create(
        defaults={
            'card_punitory_monthly_rate': Decimal('0.10'),
            'interest_expense_account': interest_exp,
        },
    )

    interest1, mov1 = CardService.apply_punitory_interest(
        stmt, as_of_date=date(2026, 6, 15),
    )
    interest2, mov2 = CardService.apply_punitory_interest(
        stmt, as_of_date=date(2026, 6, 20),  # mismo mes
    )
    assert interest1 == interest2 == Decimal('10000.00')
    assert mov1.id == mov2.id  # misma ADJUSTMENT, no duplica


@pytest.mark.django_db
def test_apply_punitory_interest_no_op_on_paid(env):
    stmt = _open(env, billed=Decimal('100000'))
    CardService.pay_statement(
        stmt, payment_account=env['bank_ta'],
        date=date(2026, 6, 15), created_by=env['user'],
    )
    stmt.refresh_from_db()
    AccountingSettings.objects.update_or_create(
        defaults={'card_punitory_monthly_rate': Decimal('0.10')},
    )
    interest, movement = CardService.apply_punitory_interest(stmt)
    assert interest == Decimal('0')
    assert movement is None


# ── Task monthly ───────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_compute_overdue_card_interest_task_processes_overdue(env):
    from treasury.tasks import compute_overdue_card_interest
    interest_exp = Account.objects.create(
        name='Gasto Interés', code='5.1.01.003',
        account_type=AccountType.EXPENSE,
    )
    AccountingSettings.objects.update_or_create(
        defaults={
            'card_punitory_monthly_rate': Decimal('0.10'),
            'interest_expense_account': interest_exp,
        },
    )

    # Statement vencido.
    _open(env, billed=Decimal('100000'), due=date(2026, 5, 1),
          period=(2026, 5))
    # Statement no vencido — no debería procesarse.
    _open(env, billed=Decimal('50000'), due=date(2026, 8, 1),
          period=(2026, 7))
    # Statement PAID — no debería procesarse.
    paid_stmt = _open(env, billed=Decimal('30000'),
                      period=(2026, 4))
    CardService.pay_statement(
        paid_stmt, payment_account=env['bank_ta'],
        date=date(2026, 6, 15), created_by=env['user'],
    )

    result = compute_overdue_card_interest()
    # El task filtra por status__in (OPEN, OVERDUE, PARTIALLY_PAID) y
    # due_date<today. Por lo tanto:
    # - Statement vencido (period 2026-05, due 2026-05-01): OVERDUE →
    #   procesado, interés 10% × 100.000 = 10.000.
    # - Statement no vencido (period 2026-07, due 2026-08-01): excluido
    #   por la query.
    # - Statement PAID (period 2026-04): excluido por status (no
    #   está en el filtro).
    assert result['processed'] == 1
    assert result['skipped'] == 0
    assert Decimal(result['total_interest']) == Decimal('10000.00')
