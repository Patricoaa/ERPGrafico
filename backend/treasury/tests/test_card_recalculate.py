"""
Tests: CardService.recalculate_billed_amount (Gap 1.2, ADR-0037).

Cubre:
  - Suma OUTBOUND sobre la card_account dentro del período.
  - NO incluye los ADJUSTMENT de interés/comisiones (E3): viven en
    interest_charged/fees_charged y total_to_pay los suma aparte.
  - No incluye OUTBOUND fuera del período (antes del period_start
    o después del cut_off_date).
  - Idempotente: una segunda llamada no duplica el monto.
  - commit=False sólo calcula, no persiste.
  - Notas: si difiere, deja trail de la fecha de recálculo.
"""
from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model

from accounting.models import Account, AccountType
from contacts.models import Contact
from treasury.models import Bank, TreasuryAccount, CreditCardStatement, TreasuryMovement
from treasury.card_service import CardService
from treasury.services import TreasuryService


User = get_user_model()


@pytest.fixture
def env(db):
    user = User.objects.create_user(username='ccr', password='x')
    bank = Bank.objects.create(name='Banco Cálculo', code='BCC')

    bank_acc = Account.objects.create(
        name='Cta Cte', code='1.1.01.110', account_type=AccountType.ASSET
    )
    bank_ta = TreasuryAccount.objects.create(
        name='Cta Cte', account=bank_acc,
        account_type=TreasuryAccount.Type.CHECKING,
        bank=bank, account_number='222',
    )

    card_acc = Account.objects.create(
        name='Visa Recalc', code='2.1.09.030',
        account_type=AccountType.LIABILITY,
    )
    card_ta = TreasuryAccount.objects.create(
        name='Visa Recalc', account=card_acc,
        account_type=TreasuryAccount.Type.CREDIT_CARD, bank=bank,
    )

    payable_acc = Account.objects.create(
        name='Proveedor Recalc', code='2.1.01.005',
        account_type=AccountType.LIABILITY,
    )
    supplier = Contact.objects.create(
        name='Proveedor Recalc', tax_id='76.555.555-5',
        account_payable=payable_acc,
    )

    return {
        'user': user, 'bank': bank, 'bank_ta': bank_ta, 'bank_acc': bank_acc,
        'card_ta': card_ta, 'card_acc': card_acc,
        'supplier': supplier, 'payable_acc': payable_acc,
    }


def _purchase(env, amount, date_value):
    """Helper: crea una compra con tarjeta (OUTBOUND sobre card_ta)."""
    return TreasuryService.create_movement(
        amount=amount,
        movement_type=TreasuryMovement.Type.OUTBOUND,
        payment_method=TreasuryMovement.Method.CARD,
        from_account=env['card_ta'],
        date=date_value,
        created_by=env['user'],
        partner=env['supplier'],
    )


@pytest.mark.django_db
def test_recalculate_aggregates_outbound_in_period(env):
    stmt = CreditCardStatement.objects.create(
        card_account=env['card_ta'],
        period_year=2026, period_month=6,
        cut_off_date=date(2026, 6, 30),
        due_date=date(2026, 7, 25),
        created_by=env['user'],
    )

    _purchase(env, Decimal('50000'), date(2026, 6, 5))
    _purchase(env, Decimal('80000'), date(2026, 6, 15))
    _purchase(env, Decimal('20000'), date(2026, 6, 28))

    new_amount = CardService.recalculate_billed_amount(stmt)

    assert new_amount == Decimal('150000')
    stmt.refresh_from_db()
    assert stmt.billed_amount == Decimal('150000')


@pytest.mark.django_db
def test_recalculate_excludes_outbound_outside_period(env):
    """OUTBOUND antes del período o después del cut_off se ignoran."""
    stmt = CreditCardStatement.objects.create(
        card_account=env['card_ta'],
        period_year=2026, period_month=6,
        cut_off_date=date(2026, 6, 30),
        due_date=date(2026, 7, 25),
        created_by=env['user'],
    )

    # Antes del período (mayo): no cuenta
    _purchase(env, Decimal('99999'), date(2026, 5, 30))
    # En el período: cuenta
    _purchase(env, Decimal('50000'), date(2026, 6, 10))
    # Después del cut_off (julio): no cuenta
    _purchase(env, Decimal('88888'), date(2026, 7, 5))

    new_amount = CardService.recalculate_billed_amount(stmt)
    assert new_amount == Decimal('50000')


@pytest.mark.django_db
def test_recalculate_excludes_interest_and_fees(env):
    """E3: el interés/comisiones aplicados (apply_charges) NO se suman a
    `billed_amount` — viven en interest_charged/fees_charged y `total_to_pay`
    los agrega aparte. Incluirlos en `billed_amount` los contaría dos veces."""
    stmt = CreditCardStatement.objects.create(
        card_account=env['card_ta'],
        period_year=2026, period_month=6,
        cut_off_date=date(2026, 6, 30),
        due_date=date(2026, 7, 25),
        interest_charged=Decimal('10000'),
        fees_charged=Decimal('2000'),
        created_by=env['user'],
    )
    interest_exp = Account.objects.create(
        name='Int', code='5.2.01.010', account_type=AccountType.EXPENSE
    )
    fees_exp = Account.objects.create(
        name='Com', code='5.2.01.011', account_type=AccountType.EXPENSE
    )
    CardService.apply_charges(
        stmt,
        interest_expense_account=interest_exp,
        fees_expense_account=fees_exp,
    )

    _purchase(env, Decimal('30000'), date(2026, 6, 10))

    new_amount = CardService.recalculate_billed_amount(stmt)
    # Solo el principal de compras (30k); los 12k de interés+comisiones NO
    # entran en billed_amount.
    assert new_amount == Decimal('30000')
    stmt.refresh_from_db()
    # total_to_pay cuenta el interés+comisiones UNA sola vez: 30k + 12k.
    assert stmt.total_to_pay == Decimal('42000')


@pytest.mark.django_db
def test_recalculate_idempotent(env):
    stmt = CreditCardStatement.objects.create(
        card_account=env['card_ta'],
        period_year=2026, period_month=6,
        cut_off_date=date(2026, 6, 30),
        due_date=date(2026, 7, 25),
        created_by=env['user'],
    )
    _purchase(env, Decimal('50000'), date(2026, 6, 10))

    CardService.recalculate_billed_amount(stmt)
    CardService.recalculate_billed_amount(stmt)
    stmt.refresh_from_db()
    # Sigue siendo 50k, no se duplica.
    assert stmt.billed_amount == Decimal('50000')


@pytest.mark.django_db
def test_recalculate_commit_false_does_not_persist(env):
    stmt = CreditCardStatement.objects.create(
        card_account=env['card_ta'],
        period_year=2026, period_month=6,
        cut_off_date=date(2026, 6, 30),
        due_date=date(2026, 7, 25),
        billed_amount=Decimal('1'),
        created_by=env['user'],
    )
    _purchase(env, Decimal('50000'), date(2026, 6, 10))

    new_amount = CardService.recalculate_billed_amount(stmt, commit=False)
    assert new_amount == Decimal('50000')
    stmt.refresh_from_db()
    # billed_amount no fue modificado.
    assert stmt.billed_amount == Decimal('1')
    assert '[RECALC]' not in (stmt.notes or '')


@pytest.mark.django_db
def test_recalculate_records_note_when_differs(env):
    stmt = CreditCardStatement.objects.create(
        card_account=env['card_ta'],
        period_year=2026, period_month=6,
        cut_off_date=date(2026, 6, 30),
        due_date=date(2026, 7, 25),
        billed_amount=Decimal('1'),  # valor arbitrario inicial
        created_by=env['user'],
    )
    _purchase(env, Decimal('50000'), date(2026, 6, 10))

    CardService.recalculate_billed_amount(stmt)
    stmt.refresh_from_db()
    assert '[RECALC]' in stmt.notes
    assert '1' in stmt.notes
    assert '50000' in stmt.notes


@pytest.mark.django_db
def test_recalculate_no_movements_yields_zero(env):
    stmt = CreditCardStatement.objects.create(
        card_account=env['card_ta'],
        period_year=2026, period_month=6,
        cut_off_date=date(2026, 6, 30),
        due_date=date(2026, 7, 25),
        created_by=env['user'],
    )
    new_amount = CardService.recalculate_billed_amount(stmt)
    assert new_amount == Decimal('0')
    stmt.refresh_from_db()
    assert stmt.billed_amount == Decimal('0')


@pytest.mark.django_db
def test_recalculate_rejects_cutoff_before_period_start(env):
    """cut_off_date no puede ser anterior al primer día del mes."""
    stmt = CreditCardStatement.objects.create(
        card_account=env['card_ta'],
        period_year=2026, period_month=6,
        cut_off_date=date(2026, 5, 30),  # anterior a 2026-06-01
        due_date=date(2026, 6, 15),
        created_by=env['user'],
    )
    import pytest as _pytest
    from django.core.exceptions import ValidationError
    with _pytest.raises(ValidationError):
        CardService.recalculate_billed_amount(stmt)
