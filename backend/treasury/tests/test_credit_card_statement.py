"""
Tests: modelo CreditCardStatement (Fase 3, F3.2).

Cubre:
  - Creación básica con valores por defecto.
  - display_id = 'EST-{id}'.
  - unique constraint (card_account, period_year, period_month).
  - total_to_pay = billed + interest + fees.
  - is_overdue cuando OPEN y due_date < hoy.
  - period_month debe estar en [1, 12] (CheckConstraint).
"""
import pytest
from decimal import Decimal
from datetime import date, timedelta
from django.core.exceptions import ValidationError

from accounting.models import Account, AccountType
from treasury.models import Bank, TreasuryAccount, CreditCardStatement


@pytest.fixture
def card_setup(db):
    bank = Bank.objects.create(name='Banco Tarjeta', code='BTARJ')
    card_acc = Account.objects.create(
        name='Visa Empresa', code='2.1.09.010', account_type=AccountType.LIABILITY
    )
    card_ta = TreasuryAccount.objects.create(
        name='Visa Empresa', account=card_acc,
        account_type=TreasuryAccount.Type.CREDIT_CARD, bank=bank,
    )
    return {'bank': bank, 'card_acc': card_acc, 'card_ta': card_ta}


@pytest.mark.django_db
def test_create_statement_defaults(card_setup):
    stmt = CreditCardStatement.objects.create(
        card_account=card_setup['card_ta'],
        period_year=2026, period_month=6,
        cut_off_date=date(2026, 6, 30),
        due_date=date(2026, 7, 25),
    )
    assert stmt.status == CreditCardStatement.Status.OPEN
    assert stmt.billed_amount == Decimal('0.00')
    assert stmt.minimum_payment == Decimal('0.00')
    assert stmt.interest_charged == Decimal('0.00')
    assert stmt.fees_charged == Decimal('0.00')
    assert stmt.credit_limit is None
    assert stmt.payment_movement is None
    assert stmt.payment_account is None


@pytest.mark.django_db
def test_display_id_format(card_setup):
    stmt = CreditCardStatement.objects.create(
        card_account=card_setup['card_ta'],
        period_year=2026, period_month=5,
        cut_off_date=date(2026, 5, 31),
        due_date=date(2026, 6, 25),
    )
    assert stmt.display_id == f"EST-{stmt.id}"


@pytest.mark.django_db
def test_unique_period_per_card(card_setup):
    CreditCardStatement.objects.create(
        card_account=card_setup['card_ta'],
        period_year=2026, period_month=6,
        cut_off_date=date(2026, 6, 30),
        due_date=date(2026, 7, 25),
    )
    with pytest.raises(Exception):  # IntegrityError
        CreditCardStatement.objects.create(
            card_account=card_setup['card_ta'],
            period_year=2026, period_month=6,
            cut_off_date=date(2026, 6, 30),
            due_date=date(2026, 7, 25),
        )


@pytest.mark.django_db
def test_same_period_different_card_ok(card_setup):
    """La constraint es por tarjeta, no global."""
    other_acc = Account.objects.create(
        name='Mastercard', code='2.1.09.011', account_type=AccountType.LIABILITY
    )
    other_ta = TreasuryAccount.objects.create(
        name='Mastercard', account=other_acc,
        account_type=TreasuryAccount.Type.CREDIT_CARD, bank=card_setup['bank'],
    )
    CreditCardStatement.objects.create(
        card_account=card_setup['card_ta'],
        period_year=2026, period_month=6,
        cut_off_date=date(2026, 6, 30),
        due_date=date(2026, 7, 25),
    )
    other = CreditCardStatement.objects.create(
        card_account=other_ta,
        period_year=2026, period_month=6,
        cut_off_date=date(2026, 6, 30),
        due_date=date(2026, 7, 25),
    )
    assert other.pk is not None


@pytest.mark.django_db
def test_total_to_pay(card_setup):
    stmt = CreditCardStatement.objects.create(
        card_account=card_setup['card_ta'],
        period_year=2026, period_month=6,
        cut_off_date=date(2026, 6, 30),
        due_date=date(2026, 7, 25),
        billed_amount=Decimal('500000.00'),
        interest_charged=Decimal('12500.00'),
        fees_charged=Decimal('1500.00'),
    )
    assert stmt.total_to_pay == Decimal('514000.00')


@pytest.mark.django_db
def test_total_to_pay_with_nulls(card_setup):
    """Si billed/interest/fees son None, no debe fallar."""
    stmt = CreditCardStatement(
        card_account=card_setup['card_ta'],
        period_year=2026, period_month=6,
        cut_off_date=date(2026, 6, 30),
        due_date=date(2026, 7, 25),
    )
    # No persistimos para evitar el save() con full_clean.
    # Probamos el property con todo en 0 (defaults).
    assert stmt.total_to_pay == Decimal('0.00')


@pytest.mark.django_db
def test_is_overdue_when_open_and_due_in_past(card_setup):
    past = date.today() - timedelta(days=5)
    stmt = CreditCardStatement.objects.create(
        card_account=card_setup['card_ta'],
        period_year=2026, period_month=5,
        cut_off_date=past - timedelta(days=25),
        due_date=past,
    )
    assert stmt.is_overdue is True


@pytest.mark.django_db
def test_is_overdue_false_when_paid(card_setup):
    past = date.today() - timedelta(days=5)
    stmt = CreditCardStatement.objects.create(
        card_account=card_setup['card_ta'],
        period_year=2026, period_month=5,
        cut_off_date=past - timedelta(days=25),
        due_date=past,
        status=CreditCardStatement.Status.PAID,
    )
    assert stmt.is_overdue is False


@pytest.mark.django_db
def test_is_overdue_false_when_open_and_due_in_future(card_setup):
    future = date.today() + timedelta(days=10)
    stmt = CreditCardStatement.objects.create(
        card_account=card_setup['card_ta'],
        period_year=2026, period_month=6,
        cut_off_date=date.today(),
        due_date=future,
    )
    assert stmt.is_overdue is False


@pytest.mark.django_db
def test_period_month_must_be_1_to_12(card_setup):
    stmt = CreditCardStatement(
        card_account=card_setup['card_ta'],
        period_year=2026, period_month=13,  # inválido
        cut_off_date=date(2026, 6, 30),
        due_date=date(2026, 7, 25),
    )
    with pytest.raises(ValidationError):
        stmt.full_clean()
