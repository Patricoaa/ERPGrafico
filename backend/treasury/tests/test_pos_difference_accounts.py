"""ADR-0130: la diferencia de efectivo (apertura y cierre) se contabiliza contra la cuenta del
motivo elegido; sin motivo, contra la genérica de sobrante/faltante de caja; nunca contra
CxC/CxP por omisión; y un traspaso exige su cuenta."""

from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError

from accounting.models import Account, AccountType
from accounting.services import AccountingService
from treasury.models import POSTerminal, TreasuryAccount, TreasuryMovement
from treasury.pos_service import POSService
from treasury.services import TreasuryService

User = get_user_model()


def _acc(code, name, kind):
    return Account.objects.create(code=code, name=name, account_type=kind)


@pytest.fixture
def accounts(db):
    s = AccountingService.get_or_create_current_settings()
    s.default_receivable_account = _acc("1.1.02.01", "Clientes", AccountType.ASSET)
    s.default_payable_account = _acc("2.1.01.01", "Proveedores", AccountType.LIABILITY)
    s.pos_theft_account = _acc("5.2.14", "Robo", AccountType.EXPENSE)
    s.pos_tip_account = _acc("4.2.06", "Propinas", AccountType.INCOME)
    s.pos_cash_difference_gain_account = _acc("4.2.05", "Sobrante de caja", AccountType.INCOME)
    s.pos_cash_difference_loss_account = _acc("5.2.15", "Faltante de caja", AccountType.EXPENSE)
    s.pos_counting_error_account = None
    s.save()
    return s


@pytest.fixture
def cashier(db):
    return User.objects.create_user(username="diff_cashier", password="x")


@pytest.fixture
def box(db):
    return TreasuryAccount.objects.create(
        name="Caja D", account_type="CASH", account=_acc("1.1.01.300", "Caja D", AccountType.ASSET)
    )


@pytest.fixture
def terminal(box):
    return POSTerminal.objects.create(name="Caja D", code="CAJA-D", default_treasury_account=box)


def _fund(box, user, amount):
    TreasuryService.create_movement(
        movement_type=TreasuryMovement.Type.INBOUND, amount=Decimal(amount), to_account=box,
        created_by=user, counterpart_account=_acc("4.9.99", "Ingreso", AccountType.INCOME),
    )


def _counterpart_codes(movement, box):
    return {i.account.code for i in movement.journal_entry.items.all()} - {box.account.code}


def _adjustment(session, kind):
    return TreasuryMovement.objects.get(pos_session=session, reference__contains=kind)


@pytest.mark.django_db
def test_opening_deficit_posts_to_reason_account(accounts, cashier, terminal, box):
    _fund(box, cashier, "10000")
    session = POSService.open_session(
        user=cashier, terminal_id=terminal.id, opening_balance=Decimal("4000"), justify_reason="THEFT"
    )
    assert _counterpart_codes(_adjustment(session, "AJUSTE"), box) == {"5.2.14"}


@pytest.mark.django_db
def test_opening_without_reason_uses_generic_account_not_receivables(accounts, cashier, terminal, box):
    session = POSService.open_session(user=cashier, terminal_id=terminal.id, opening_balance=Decimal("3000"))
    assert _counterpart_codes(_adjustment(session, "AJUSTE"), box) == {"4.2.05"}


@pytest.mark.django_db
def test_reason_without_own_account_falls_back_to_generic(accounts, cashier, terminal, box):
    _fund(box, cashier, "10000")
    session = POSService.open_session(
        user=cashier, terminal_id=terminal.id, opening_balance=Decimal("9000"), justify_reason="COUNTING_ERROR"
    )
    assert _counterpart_codes(_adjustment(session, "AJUSTE"), box) == {"5.2.15"}


@pytest.mark.django_db
def test_closing_surplus_posts_to_reason_account(accounts, cashier, terminal, box):
    session = POSService.open_session(user=cashier, terminal_id=terminal.id, opening_balance=Decimal("0"))
    POSService.close_session(session=session, actual_cash=Decimal("2500"), justify_reason="TIP", user=cashier)
    assert _counterpart_codes(_adjustment(session, "EXCEDENTE"), box) == {"4.2.06"}


@pytest.mark.django_db
def test_difference_without_any_account_is_rejected(accounts, cashier, terminal, box):
    accounts.pos_cash_difference_gain_account = None
    accounts.save()
    session = POSService.open_session(user=cashier, terminal_id=terminal.id, opening_balance=Decimal("0"))
    with pytest.raises(ValidationError, match="No hay cuenta contable"):
        POSService.close_session(session=session, actual_cash=Decimal("500"), user=cashier)
    session.refresh_from_db()
    assert session.status == "OPEN"


@pytest.mark.django_db
def test_transfer_difference_requires_valid_target(accounts, cashier, terminal, box):
    session = POSService.open_session(user=cashier, terminal_id=terminal.id, opening_balance=Decimal("0"))
    with pytest.raises(ValidationError, match="cuenta del traspaso"):
        POSService.close_session(session=session, actual_cash=Decimal("500"), justify_reason="TRANSFER", user=cashier)
    with pytest.raises(ValidationError, match="misma caja"):
        POSService.close_session(
            session=session, actual_cash=Decimal("500"), justify_reason="TRANSFER", justify_target_id=box.id, user=cashier
        )
