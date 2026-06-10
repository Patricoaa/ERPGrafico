"""
Tests para TreasuryService.cancel_movement y annul_movement.
"""
import pytest
from decimal import Decimal
from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model

from accounting.models import Account, AccountType
from treasury.models import TreasuryAccount, TreasuryMovement
from treasury.services import TreasuryService

User = get_user_model()


@pytest.fixture
def env(db):
    user = User.objects.create_user(username='cancelmov', password='x')

    asset_acc = Account.objects.create(
        name='Caja General', code='1.1.01.001', account_type=AccountType.ASSET,
    )
    ta = TreasuryAccount.objects.create(
        name='Caja General', account=asset_acc,
        account_type=TreasuryAccount.Type.CASH,
    )

    return {'user': user, 'ta': ta}


def _movimiento(env, **overrides):
    kwargs = dict(
        movement_type=TreasuryMovement.Type.INBOUND,
        to_account=env['ta'],
        amount=Decimal('100000'),
        created_by=env['user'],
    )
    kwargs.update(overrides)
    return TreasuryMovement.objects.create(**kwargs)


@pytest.mark.django_db
def test_cancel_draft_movement_sin_je(env):
    m = _movimiento(env)
    assert m.status == TreasuryMovement.MovementStatus.DRAFT

    result = TreasuryService.cancel_movement(m)

    assert result.status == TreasuryMovement.MovementStatus.CANCELLED
    assert result.pk == m.pk
    result.refresh_from_db()
    assert result.status == TreasuryMovement.MovementStatus.CANCELLED


@pytest.mark.django_db
def test_cancel_cancelled_movement_idempotente(env):
    m = _movimiento(env, status=TreasuryMovement.MovementStatus.CANCELLED)

    result = TreasuryService.cancel_movement(m)

    assert result.status == TreasuryMovement.MovementStatus.CANCELLED
    assert result == m


@pytest.mark.django_db
def test_cancel_reconciled_raises_error(env):
    m = _movimiento(env, is_reconciled=True)

    with pytest.raises(ValidationError, match='conciliado'):
        TreasuryService.cancel_movement(m)


@pytest.mark.django_db
def test_annul_movement_delega_a_cancel(env):
    m = _movimiento(env)

    TreasuryService.annul_movement(m)

    m.refresh_from_db()
    assert m.status == TreasuryMovement.MovementStatus.CANCELLED


@pytest.mark.django_db
def test_cancel_outbound_movement(env):
    m = _movimiento(
        env,
        movement_type=TreasuryMovement.Type.OUTBOUND,
        from_account=env['ta'],
        to_account=None,
    )

    result = TreasuryService.cancel_movement(m)

    assert result.status == TreasuryMovement.MovementStatus.CANCELLED
