"""
Tests para CheckService: receive, deposit, clear, bounce, void y transiciones.
"""
import pytest
from decimal import Decimal
from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model

from accounting.models import Account, AccountType
from treasury.models import Bank, TreasuryAccount, TreasuryMovement, Check
from treasury.check_service import CheckService

User = get_user_model()


@pytest.fixture
def base(db):
    user = User.objects.create_user(username='checkuser', password='x')
    bank = Bank.objects.create(name='Banco Cheques', code='BCH')

    portfolio_acc = Account.objects.create(
        name='Cheques en Cartera', code='1.1.03.001', account_type=AccountType.ASSET
    )
    bank_acc = Account.objects.create(
        name='Banco BCI', code='1.1.01.080', account_type=AccountType.ASSET
    )

    # Cuenta puente de tesorería (tipo CHECK_PORTFOLIO)
    portfolio_ta = TreasuryAccount.objects.create(
        name='Cheques en Cartera',
        account=portfolio_acc,
        account_type=TreasuryAccount.Type.CHECK_PORTFOLIO,
    )
    bank_ta = TreasuryAccount.objects.create(
        name='BCI Cte', account=bank_acc,
        account_type=TreasuryAccount.Type.CHECKING,
        bank=bank, account_number='123',
    )
    return {
        'user': user, 'bank': bank,
        'portfolio_ta': portfolio_ta,
        'bank_ta': bank_ta,
    }


def _receive(base, check_number, amount, **kwargs):
    """Helper: recibe un cheque pasando la cuenta puente explícita."""
    return CheckService.receive(
        bank_id=base['bank'].id,
        check_number=check_number,
        amount=Decimal(str(amount)),
        issue_date='2026-06-01',
        due_date='2026-07-01',
        portfolio_account=base['portfolio_ta'],
        **kwargs,
    )


@pytest.mark.django_db
def test_receive_creates_check_and_movement(base):
    check = _receive(base, '0001234', '500000', created_by=base['user'])

    assert check.pk is not None
    assert check.status == Check.Status.IN_PORTFOLIO
    assert check.receipt_movement is not None
    assert check.receipt_movement.movement_type == TreasuryMovement.Type.INBOUND
    assert check.receipt_movement.to_account == check.portfolio_account
    assert check.receipt_movement.amount == Decimal('500000')


@pytest.mark.django_db
def test_deposit_transfers_to_bank(base):
    check = _receive(base, '0002000', '200000', created_by=base['user'])
    check = CheckService.deposit(check, base['bank_ta'], created_by=base['user'])

    assert check.status == Check.Status.DEPOSITED
    assert check.deposit_account == base['bank_ta']
    assert check.settlement_movement is not None
    assert check.settlement_movement.movement_type == TreasuryMovement.Type.TRANSFER
    assert check.settlement_movement.from_account == check.portfolio_account
    assert check.settlement_movement.to_account == base['bank_ta']


@pytest.mark.django_db
def test_clear_marks_as_cleared(base):
    check = _receive(base, '0003000', '100000')
    check = CheckService.deposit(check, base['bank_ta'])
    check = CheckService.clear(check)

    assert check.status == Check.Status.CLEARED
    assert check.cleared_at is not None


@pytest.mark.django_db
def test_bounce_creates_reversal_movements(base):
    check = _receive(base, '0004000', '300000', created_by=base['user'])
    check = CheckService.deposit(check, base['bank_ta'], created_by=base['user'])
    initial_count = TreasuryMovement.objects.count()
    check = CheckService.bounce(check, notes='Fondos insuficientes', created_by=base['user'])

    assert check.status == Check.Status.BOUNCED
    assert check.bounced_at is not None
    # 2 reversas: depósito (banco→cartera) + recepción (cartera→externo)
    assert TreasuryMovement.objects.count() == initial_count + 2


@pytest.mark.django_db
def test_void_from_portfolio(base):
    check = _receive(base, '0005000', '50000')
    check = CheckService.void(check, notes='Error de captura')

    assert check.status == Check.Status.VOIDED


@pytest.mark.django_db
def test_invalid_transition_raises(base):
    check = _receive(base, '0006000', '10000')
    with pytest.raises(ValidationError):
        CheckService.clear(check)  # no se puede cobrar sin depositar


@pytest.mark.django_db
def test_receive_without_portfolio_account_raises(db):
    """Sin AccountingSettings ni cuenta puente explícita → error claro."""
    bank = Bank.objects.create(name='BNoConfig', code='BNC')
    with pytest.raises(ValidationError, match='Cheques en Cartera'):
        CheckService.receive(
            bank_id=bank.id, check_number='9999',
            amount=Decimal('1000'), issue_date='2026-06-01', due_date='2026-06-30',
        )
