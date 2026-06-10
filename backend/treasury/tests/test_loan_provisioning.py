"""
test_loan_provisioning.py — Tests para `get_or_create_loan_treasury_account`.

Cubre:
  - Crea nueva TreasuryAccount LOAN cuando no existe.
  - Retorna la existente para el mismo (bank, account) sin duplicar.
  - Rechaza cuenta contable de tipo no-LIABILITY.
  - Rechaza cuenta no-hoja.
  - Rechaza cuando la cuenta ya está usada por otra TreasuryAccount de
    tipo distinto a LOAN.
"""
from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError

from accounting.models import Account, AccountType
from treasury.models import Bank, TreasuryAccount
from treasury.loan_provisioning import get_or_create_loan_treasury_account


@pytest.fixture
def bank(db):
    return Bank.objects.create(name='Banco Test', code='BT')


@pytest.fixture
def liability(db, bank):
    acc = Account.objects.create(
        name='Préstamo por Pagar', code='2.1.04.010',
        account_type=AccountType.LIABILITY,
    )
    return acc


@pytest.mark.django_db
def test_creates_new_loan_treasury_account(bank, liability):
    assert not TreasuryAccount.objects.filter(account_type=TreasuryAccount.Type.LOAN).exists()

    ta = get_or_create_loan_treasury_account(
        bank=bank, accounting_account=liability, currency='CLP',
    )

    assert ta.account_type == TreasuryAccount.Type.LOAN
    assert ta.bank_id == bank.id
    assert ta.account_id == liability.id
    assert ta.currency == 'CLP'
    assert ta.name == f"{bank.name} — Préstamo Bancario (CLP)"
    assert TreasuryAccount.objects.filter(account_type=TreasuryAccount.Type.LOAN).count() == 1


@pytest.mark.django_db
def test_returns_existing_loan_treasury_account(bank, liability):
    pre = TreasuryAccount.objects.create(
        name='Wrapper Editado Manualmente',
        account=liability, bank=bank,
        account_type=TreasuryAccount.Type.LOAN,
    )

    ta = get_or_create_loan_treasury_account(
        bank=bank, accounting_account=liability, currency='CLP',
    )

    assert ta.id == pre.id
    # El nombre NO se pisa (se respeta la edición manual)
    assert ta.name == 'Wrapper Editado Manualmente'
    assert TreasuryAccount.objects.filter(account_type=TreasuryAccount.Type.LOAN).count() == 1


@pytest.mark.django_db
def test_rejects_non_liability_account(bank, db):
    asset = Account.objects.create(
        name='Caja', code='1.1.01.001', account_type=AccountType.ASSET,
    )
    with pytest.raises(ValidationError):
        get_or_create_loan_treasury_account(
            bank=bank, accounting_account=asset,
        )


@pytest.mark.django_db
def test_rejects_non_selectable_account(bank, db):
    # Para que `is_selectable` devuelva False, la cuenta debe tener hijas.
    parent = Account.objects.create(
        name='Pasivos Corrientes', code='2.1', account_type=AccountType.LIABILITY,
    )
    Account.objects.create(
        name='Préstamo por Pagar', code='2.1.01', account_type=AccountType.LIABILITY,
        parent=parent,
    )
    parent.refresh_from_db()
    assert parent.is_selectable is False

    with pytest.raises(ValidationError):
        get_or_create_loan_treasury_account(
            bank=bank, accounting_account=parent,
        )


@pytest.mark.django_db
def test_rejects_account_already_used_by_other_type(bank, liability):
    TreasuryAccount.objects.create(
        name='Cta crédito', account=liability, bank=bank,
        account_type=TreasuryAccount.Type.CREDIT_CARD,
    )
    with pytest.raises(ValidationError):
        get_or_create_loan_treasury_account(
            bank=bank, accounting_account=liability,
        )
