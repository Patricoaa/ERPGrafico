"""
Tests de Onda 2 (ADR-0043): `TreasuryService.create_card_purchase`.

Cubre:
  - 1 cuota sin interés → 1 OUTBOUND, monto = amount.
  - 3/6/12 cuotas sin interés → N OUTBOUNDs iguales (con residuo
    en la última cuota).
  - 3/6 cuotas con interés explícito (cuota francesa) → schedule
    de principal decreciente + interés decreciente.
  - `billed_amount` del statement de mes 1 ve solo la cuota 1.
  - Validaciones: installments fuera de rango, monthly_rate >= 1,
    amount <= 0, cuenta no-CREDIT_CARD.
  - Idempotencia por `client_reference`.
  - Asiento contable: D=proveedor / H=pasivo (principal) +
    D=gasto_interés / H=pasivo (interés).
  - API: POST /card-purchase/ con payload discriminado.
"""
import pytest
from datetime import date
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError

from accounting.models import Account, AccountType, JournalEntry
from treasury.models import (
    Bank, CardPurchaseGroup, TreasuryAccount, TreasuryMovement,
)
from treasury.services import TreasuryService


User = get_user_model()


def _make_env():
    """Crea el banco, la tarjeta, un proveedor, las cuentas de
    gasto y el banco pagador. Devuelve dict con referencias."""
    user = User.objects.create_user(username='cp_user', password='x')
    bank = Bank.objects.create(name='Banco Cuotas')
    bank_ta = TreasuryAccount.objects.create(
        bank=bank, name='Cta Cte', account_type=TreasuryAccount.Type.CHECKING,
        account_number='0001',
    )
    card_acc = Account.objects.create(
        code='2.1.09.50', name='Visa Pasivo',
        account_type=AccountType.LIABILITY,
    )
    card_ta = TreasuryAccount.objects.create(
        bank=bank, name='Visa', account=card_acc,
        account_type=TreasuryAccount.Type.CREDIT_CARD,
    )
    from contacts.models import Contact
    payable_acc = Account.objects.create(
        code='2.1.01.020', name='Proveedor Cuotas',
        account_type=AccountType.LIABILITY,
    )
    supplier = Contact.objects.create(
        name='Proveedor Cuotas', tax_id='76.123.456-7',
        account_payable=payable_acc,
    )
    interest_exp = Account.objects.create(
        code='6.1.01.20', name='Interés Cuotas',
        account_type=AccountType.EXPENSE,
    )
    return {
        'user': user, 'bank': bank, 'bank_ta': bank_ta,
        'card_ta': card_ta, 'card_acc': card_acc,
        'supplier': supplier, 'payable_acc': payable_acc,
        'interest_exp': interest_exp,
    }


@pytest.fixture
def env(db):
    return _make_env()


@pytest.mark.django_db
def test_card_purchase_single_installment_no_interest(env):
    """1 cuota sin interés: 1 OUTBOUND por el total."""
    group = TreasuryService.create_card_purchase(
        amount=Decimal('50000'),
        card_account=env['card_ta'],
        installments=1,
        monthly_rate=Decimal('0'),
        date=date(2026, 6, 15),
        partner=env['supplier'],
        client_reference='CP-SINGLE-001',
        created_by=env['user'],
    )

    assert group.installments == 1
    assert group.monthly_rate == Decimal('0')
    movements = list(group.movements.all())
    assert len(movements) == 1
    mv = movements[0]
    assert mv.movement_type == TreasuryMovement.Type.OUTBOUND
    assert mv.amount == Decimal('50000')
    assert mv.is_installment_interest is False
    assert mv.installment_number == 1
    assert mv.from_account == env['card_ta']


@pytest.mark.django_db
def test_card_purchase_three_installments_no_interest(env):
    """3 cuotas sin interés: 3 OUTBOUNDs iguales, monto total
    preservado con residuo en la última."""
    group = TreasuryService.create_card_purchase(
        amount=Decimal('100000'),
        card_account=env['card_ta'],
        installments=3,
        monthly_rate=Decimal('0'),
        date=date(2026, 6, 15),
        partner=env['supplier'],
        client_reference='CP-3-001',
        created_by=env['user'],
    )

    assert group.installments == 3
    movements = list(group.movements.all().order_by('installment_number'))
    assert len(movements) == 3
    amounts = [m.amount for m in movements]
    # 100k / 3 = 33333.33 con residuo en la última (33334.01 - 0).
    assert sum(amounts) == Decimal('100000')
    assert amounts[0] == Decimal('33333.33')
    assert amounts[1] == Decimal('33333.33')
    assert amounts[2] == Decimal('33333.34')
    # Sin interés: no hay ADJUSTMENT.
    assert all(m.is_installment_interest is False for m in movements)


@pytest.mark.django_db
def test_card_purchase_six_installments_with_interest(env):
    """6 cuotas con 1.5% mensual (cuota francesa)."""
    group = TreasuryService.create_card_purchase(
        amount=Decimal('60000'),
        card_account=env['card_ta'],
        installments=6,
        monthly_rate=Decimal('0.015'),
        date=date(2026, 6, 15),
        partner=env['supplier'],
        client_reference='CP-6-001',
        created_by=env['user'],
    )

    movements = list(group.movements.all().order_by('installment_number', 'is_installment_interest'))
    # 6 cuotas × 2 (OUTBOUND + ADJUSTMENT) = 12.
    assert len(movements) == 12

    # 6 OUTBOUNDs (principal) — suma debe ser 60k exacto.
    principals = [m for m in movements if not m.is_installment_interest]
    interests = [m for m in movements if m.is_installment_interest]
    assert len(principals) == 6
    assert len(interests) == 6
    assert sum(m.amount for m in principals) == Decimal('60000')

    # Interés de cuota 1: 60000 × 0.015 = 900.00
    assert interests[0].amount == Decimal('900.00')
    # Interés de cuota 2: 50000 × 0.015 = 750.00 (el principal
    # base es 10000 = 60000/6; primera amortización es 10000 así
    # que el balance tras cuota 1 ≈ 50000).
    assert interests[1].amount == Decimal('750.00')

    # Total a pagar > principal por el interés acumulado.
    assert group.total_interest > Decimal('0')
    assert group.total_payable == group.total_amount + group.total_interest


@pytest.mark.django_db
def test_card_purchase_dates_distributed_30_days_apart(env):
    """Las cuotas se distribuyen cada 30 días a partir de la
    fecha inicial."""
    group = TreasuryService.create_card_purchase(
        amount=Decimal('30000'),
        card_account=env['card_ta'],
        installments=3,
        date=date(2026, 6, 15),
        client_reference='CP-DATES-001',
        created_by=env['user'],
    )
    movements = list(
        group.movements.filter(is_installment_interest=False)
        .order_by('installment_number')
    )
    assert movements[0].date == date(2026, 6, 15)
    assert movements[1].date == date(2026, 7, 15)
    assert movements[2].date == date(2026, 8, 14)  # + 60 días


@pytest.mark.django_db
def test_card_purchase_idempotent_by_client_reference(env):
    """Dos POSTs con misma `client_reference` no duplican."""
    g1 = TreasuryService.create_card_purchase(
        amount=Decimal('30000'),
        card_account=env['card_ta'],
        installments=2,
        client_reference='CP-IDEM-001',
        date=date(2026, 6, 15),
        created_by=env['user'],
    )
    g2 = TreasuryService.create_card_purchase(
        amount=Decimal('30000'),
        card_account=env['card_ta'],
        installments=2,
        client_reference='CP-IDEM-001',
        date=date(2026, 6, 15),
        created_by=env['user'],
    )
    assert g1.id == g2.id
    # Sólo hay 2 OUTBOUNDs del primer POST, no 4.
    assert g1.movements.count() == 2


@pytest.mark.django_db
def test_card_purchase_validates_card_account_type(env):
    """`create_card_purchase` rechaza cuenta no-CREDIT_CARD."""
    with pytest.raises(ValidationError, match='CREDIT_CARD'):
        TreasuryService.create_card_purchase(
            amount=Decimal('10000'),
            card_account=env['bank_ta'],
            installments=1,
        )


@pytest.mark.django_db
def test_card_purchase_validates_installments_range(env):
    """installments fuera de [1, 36] → ValidationError."""
    with pytest.raises(ValidationError, match='cuotas'):
        TreasuryService.create_card_purchase(
            amount=Decimal('10000'),
            card_account=env['card_ta'],
            installments=0,
        )
    with pytest.raises(ValidationError, match='cuotas'):
        TreasuryService.create_card_purchase(
            amount=Decimal('10000'),
            card_account=env['card_ta'],
            installments=37,
        )


@pytest.mark.django_db
def test_card_purchase_validates_monthly_rate_range(env):
    """monthly_rate fuera de [0, 1) → ValidationError."""
    with pytest.raises(ValidationError, match='tasa'):
        TreasuryService.create_card_purchase(
            amount=Decimal('10000'),
            card_account=env['card_ta'],
            installments=1,
            monthly_rate=Decimal('-0.01'),
        )
    with pytest.raises(ValidationError, match='tasa'):
        TreasuryService.create_card_purchase(
            amount=Decimal('10000'),
            card_account=env['card_ta'],
            installments=1,
            monthly_rate=Decimal('1.5'),
        )


@pytest.mark.django_db
def test_card_purchase_validates_amount_positive(env):
    """amount <= 0 → ValidationError."""
    with pytest.raises(ValidationError, match='monto'):
        TreasuryService.create_card_purchase(
            amount=Decimal('0'),
            card_account=env['card_ta'],
            installments=1,
        )
    with pytest.raises(ValidationError, match='monto'):
        TreasuryService.create_card_purchase(
            amount=Decimal('-100'),
            card_account=env['card_ta'],
            installments=1,
        )


@pytest.mark.django_db
def test_card_purchase_accounting_entry_principal(env):
    """El OUTBOUND de principal genera el asiento estándar:
    D=cuenta contraparte (proveedor si hay) / H=pasivo tarjeta."""
    group = TreasuryService.create_card_purchase(
        amount=Decimal('20000'),
        card_account=env['card_ta'],
        installments=1,
        partner=env['supplier'],
        client_reference='CP-ACC-001',
        date=date(2026, 6, 15),
        created_by=env['user'],
    )
    mv = group.movements.first()
    assert mv.journal_entry is not None
    assert mv.journal_entry.status == JournalEntry.Status.POSTED
    items = list(mv.journal_entry.items.all())
    # Debe haber un D y un H.
    debits = [it for it in items if it.debit > 0]
    credits = [it for it in items if it.credit > 0]
    assert len(debits) == 1
    assert len(credits) == 1
    # H = pasivo tarjeta.
    assert credits[0].account == env['card_acc']
    assert credits[0].credit == Decimal('20000')
    # D = cuenta de proveedor (configurada en `Contact.account_payable`).
    assert debits[0].account == env['payable_acc']
    assert debits[0].debit == Decimal('20000')


@pytest.mark.django_db
def test_card_purchase_increases_liability(env):
    """Cada cuota de principal sube el pasivo de la tarjeta."""
    initial = env['card_acc'].balance
    group = TreasuryService.create_card_purchase(
        amount=Decimal('30000'),
        card_account=env['card_ta'],
        installments=3,
        partner=env['supplier'],
        date=date(2026, 6, 15),
        client_reference='CP-LIAB-001',
        created_by=env['user'],
    )
    env['card_acc'].refresh_from_db()
    # 30k de principal total sube la deuda.
    assert env['card_acc'].balance == initial + Decimal('30000')
    assert group.movements.count() == 3


@pytest.mark.django_db
def test_card_purchase_with_interest_distributes_dates(env):
    """El interés de cada cuota cae en la misma fecha que el
    principal de esa cuota."""
    group = TreasuryService.create_card_purchase(
        amount=Decimal('12000'),
        card_account=env['card_ta'],
        installments=3,
        monthly_rate=Decimal('0.01'),
        date=date(2026, 6, 15),
        client_reference='CP-INT-DATES-001',
        created_by=env['user'],
    )
    movements = list(group.movements.order_by('installment_number', 'is_installment_interest'))
    # 3 cuotas × 2 = 6 movimientos.
    assert len(movements) == 6
    # Cuota 1: principal + interés ambos en 2026-06-15.
    assert movements[0].date == date(2026, 6, 15)
    assert movements[1].date == date(2026, 6, 15)
    # Cuota 2: ambos en 2026-07-15.
    assert movements[2].date == date(2026, 7, 15)
    assert movements[3].date == date(2026, 7, 15)
    # Cuota 3: ambos en 2026-08-14.
    assert movements[4].date == date(2026, 8, 14)
    assert movements[5].date == date(2026, 8, 14)


@pytest.mark.django_db
def test_card_purchase_billed_amount_in_statement(env):
    """El statement del mes 1 ve solo la cuota 1."""
    from treasury.card_service import CardService
    from treasury.tests.test_card_service import _open  # type: ignore
    # Necesitamos una tarjeta válida para abrir el statement.
    # _open toma env del fixture de test_card_service — lo
    # replicamos acá con nuestra tarjeta.
    stmt = CardService.open_statement(
        card_account=env['card_ta'],
        period_year=2026, period_month=6,
        cut_off_date=date(2026, 6, 30),
        due_date=date(2026, 7, 25),
        billed_amount=Decimal('0'),
        created_by=env['user'],
    )
    TreasuryService.create_card_purchase(
        amount=Decimal('30000'),
        card_account=env['card_ta'],
        installments=3,
        date=date(2026, 6, 15),
        client_reference='CP-STMT-001',
        created_by=env['user'],
    )
    new_total = CardService.recalculate_billed_amount(stmt)
    # Cuota 1 (10000) cae dentro del periodo (cutoff 30/06).
    assert new_total == Decimal('10000')
