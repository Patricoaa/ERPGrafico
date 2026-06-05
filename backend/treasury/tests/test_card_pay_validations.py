"""
Tests: validaciones de pay_statement (Gap 1.3, ADR-0037).

Cubre:
  - Rechaza `payment_account` que no sea CHECKING o CASH.
  - Rechaza CHECKING sin saldo suficiente.
  - Acepta CASH con saldo suficiente.
  - Acepta CHECKING con saldo exacto (sin fondos extra).
"""
from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError

from accounting.models import Account, AccountType
from contacts.models import Contact
from treasury.models import Bank, TreasuryAccount, CreditCardStatement, TreasuryMovement
from treasury.card_service import CardService
from treasury.services import TreasuryService


User = get_user_model()


@pytest.fixture
def env(db):
    user = User.objects.create_user(username='ccv', password='x')
    bank = Bank.objects.create(name='Banco Val', code='BVL')

    bank_acc = Account.objects.create(
        name='Cta Cte', code='1.1.01.120', account_type=AccountType.ASSET
    )
    bank_ta = TreasuryAccount.objects.create(
        name='Cta Cte', account=bank_acc,
        account_type=TreasuryAccount.Type.CHECKING,
        bank=bank, account_number='333',
    )

    cash_acc = Account.objects.create(
        name='Caja Física', code='1.1.01.005', account_type=AccountType.ASSET
    )
    cash_ta = TreasuryAccount.objects.create(
        name='Caja Física', account=cash_acc,
        account_type=TreasuryAccount.Type.CASH,
    )

    card_acc = Account.objects.create(
        name='Visa Val', code='2.1.09.040',
        account_type=AccountType.LIABILITY,
    )
    card_ta = TreasuryAccount.objects.create(
        name='Visa Val', account=card_acc,
        account_type=TreasuryAccount.Type.CREDIT_CARD, bank=bank,
    )

    # Cuenta puente (BRIDGE) — no es ASSET cash-like, no debería servir.
    bridge_acc = Account.objects.create(
        name='Puente', code='1.1.04.001', account_type=AccountType.ASSET
    )
    bridge_ta = TreasuryAccount.objects.create(
        name='Puente', account=bridge_acc,
        account_type=TreasuryAccount.Type.BRIDGE,
    )

    return {
        'user': user, 'bank': bank, 'bank_ta': bank_ta, 'card_ta': card_ta,
        'cash_ta': cash_ta, 'bridge_ta': bridge_ta,
    }


def _open(env, billed=Decimal('0')):
    return CreditCardStatement.objects.create(
        card_account=env['card_ta'],
        period_year=2026, period_month=6,
        cut_off_date=date(2026, 6, 30),
        due_date=date(2026, 7, 25),
        billed_amount=billed,
        created_by=env['user'],
    )


@pytest.mark.django_db
def test_pay_statement_rejects_bridge_account(env):
    stmt = _open(env, billed=Decimal('100000'))
    with pytest.raises(ValidationError, match='cuenta bancaria'):
        CardService.pay_statement(stmt, payment_account=env['bridge_ta'])


@pytest.mark.django_db
def test_pay_statement_rejects_credit_card_as_payment(env):
    """Una tarjeta de crédito propia NO puede ser la cuenta de pago."""
    other_card_acc = Account.objects.create(
        name='Otra Tarjeta', code='2.1.09.041',
        account_type=AccountType.LIABILITY,
    )
    other_card_ta = TreasuryAccount.objects.create(
        name='Mastercard', account=other_card_acc,
        account_type=TreasuryAccount.Type.CREDIT_CARD, bank=env['bank'],
    )
    stmt = _open(env, billed=Decimal('100000'))
    with pytest.raises(ValidationError, match='cuenta bancaria'):
        CardService.pay_statement(stmt, payment_account=other_card_ta)


@pytest.mark.django_db
def test_pay_statement_rejects_checking_with_insufficient_funds(env):
    """Si el banco no tiene saldo, rechaza con mensaje claro."""
    # Cargar el banco con sólo $50.000
    customer_ar = Account.objects.create(
        name='AR Val', code='1.1.02.010', account_type=AccountType.ASSET
    )
    customer = Contact.objects.create(
        name='Cliente Val', tax_id='76.222.222-2',
        account_receivable=customer_ar,
    )
    from billing.models import Invoice
    invoice = Invoice.objects.create(
        contact=customer, date=date(2026, 6, 1), number='FAC-VAL-1',
    )
    TreasuryService.create_movement(
        amount=Decimal('50000'),
        movement_type=TreasuryMovement.Type.INBOUND,
        to_account=env['bank_ta'],
        partner=customer,
        date=date(2026, 6, 1),
        created_by=env['user'],
        invoice=invoice,
    )
    stmt = _open(env, billed=Decimal('100000'))

    with pytest.raises(ValidationError, match='Saldo insuficiente'):
        CardService.pay_statement(stmt, payment_account=env['bank_ta'])


@pytest.mark.django_db
def test_pay_statement_accepts_checking_with_exact_funds(env):
    """Si el banco tiene saldo EXACTO, paga OK."""
    customer_ar = Account.objects.create(
        name='AR Val2', code='1.1.02.011', account_type=AccountType.ASSET
    )
    customer = Contact.objects.create(
        name='Cliente Val2', tax_id='76.222.222-3',
        account_receivable=customer_ar,
    )
    from billing.models import Invoice
    invoice = Invoice.objects.create(
        contact=customer, date=date(2026, 6, 1), number='FAC-VAL-2',
    )
    TreasuryService.create_movement(
        amount=Decimal('100000'),
        movement_type=TreasuryMovement.Type.INBOUND,
        to_account=env['bank_ta'],
        partner=customer,
        date=date(2026, 6, 1),
        created_by=env['user'],
        invoice=invoice,
    )
    stmt = _open(env, billed=Decimal('100000'))
    CardService.pay_statement(stmt, payment_account=env['bank_ta'])
    stmt.refresh_from_db()
    assert stmt.status == CreditCardStatement.Status.PAID


@pytest.mark.django_db
def test_pay_statement_accepts_cash(env):
    """CASH es una cuenta válida para pagar la tarjeta."""
    # Cargar la caja con una donación/venta menor
    customer_ar = Account.objects.create(
        name='AR Val3', code='1.1.02.012', account_type=AccountType.ASSET
    )
    customer = Contact.objects.create(
        name='Cliente Val3', tax_id='76.222.222-4',
        account_receivable=customer_ar,
    )
    from billing.models import Invoice
    invoice = Invoice.objects.create(
        contact=customer, date=date(2026, 6, 1), number='FAC-VAL-3',
    )
    TreasuryService.create_movement(
        amount=Decimal('200000'),
        movement_type=TreasuryMovement.Type.INBOUND,
        to_account=env['cash_ta'],
        partner=customer,
        date=date(2026, 6, 1),
        created_by=env['user'],
        invoice=invoice,
    )
    stmt = _open(env, billed=Decimal('100000'))
    CardService.pay_statement(stmt, payment_account=env['cash_ta'])
    stmt.refresh_from_db()
    assert stmt.status == CreditCardStatement.Status.PAID


@pytest.mark.django_db
def test_pay_statement_zero_total_skips_funds_check(env):
    """Statement con total=0: marca PAID sin chequear fondos (sin movimiento)."""
    stmt = _open(env, billed=Decimal('0'))
    # bank_ta tiene saldo 0 — pero como total=0, debe funcionar.
    CardService.pay_statement(stmt, payment_account=env['bank_ta'])
    stmt.refresh_from_db()
    assert stmt.status == CreditCardStatement.Status.PAID
    assert stmt.payment_movement is None
