"""
Tests para el signal de auto-provisión de la TreasuryAccount puente
'Cheques en Cartera' cuando se configura AccountingSettings.check_portfolio_account.

Roadmap: docs/50-audit/bancos/fase-1-operativo.md · F1.4
"""
import pytest

from accounting.models import Account, AccountType, AccountingSettings
from treasury.check_service import CheckService
from treasury.models import TreasuryAccount


@pytest.fixture
def portfolio_account(db):
    """Cuenta contable ASSET para usar como cuenta puente."""
    return Account.objects.create(
        name='Cheques en Cartera',
        code='1.1.03.001',
        account_type=AccountType.ASSET,
    )


@pytest.fixture
def alt_portfolio_account(db):
    return Account.objects.create(
        name='Cheques en Cartera (alt)',
        code='1.1.03.002',
        account_type=AccountType.ASSET,
    )


@pytest.mark.django_db
def test_signal_creates_treasury_account_on_settings_save(portfolio_account):
    """Asignar check_portfolio_account crea la TreasuryAccount puente."""
    assert not TreasuryAccount.objects.filter(
        account_type=TreasuryAccount.Type.CHECK_PORTFOLIO
    ).exists()

    s = AccountingSettings.get_solo()
    s.check_portfolio_account = portfolio_account
    s.save()

    portfolio = TreasuryAccount.objects.get(
        account_type=TreasuryAccount.Type.CHECK_PORTFOLIO
    )
    assert portfolio.account_id == portfolio_account.id
    assert portfolio.name == 'Cheques en Cartera'
    assert portfolio.currency == 'CLP'


@pytest.mark.django_db
def test_signal_is_idempotent(portfolio_account):
    """Re-guardar settings sin cambios no duplica la cuenta puente."""
    s = AccountingSettings.get_solo()
    s.check_portfolio_account = portfolio_account
    s.save()

    s.save()  # segundo save: sin cambios
    s.save()  # tercer save: sin cambios

    count = TreasuryAccount.objects.filter(
        account_type=TreasuryAccount.Type.CHECK_PORTFOLIO
    ).count()
    assert count == 1


@pytest.mark.django_db
def test_signal_updates_link_when_account_changes(portfolio_account, alt_portfolio_account):
    """Cambiar la cuenta configurada re-vincula la TreasuryAccount existente."""
    s = AccountingSettings.get_solo()
    s.check_portfolio_account = portfolio_account
    s.save()

    s.check_portfolio_account = alt_portfolio_account
    s.save()

    portfolio = TreasuryAccount.objects.get(
        account_type=TreasuryAccount.Type.CHECK_PORTFOLIO
    )
    assert portfolio.account_id == alt_portfolio_account.id


@pytest.mark.django_db
def test_receive_works_without_explicit_portfolio_account(portfolio_account):
    """Tras configurar settings, CheckService.receive() resuelve la cuenta sola."""
    from decimal import Decimal
    from treasury.models import Bank, Check

    s = AccountingSettings.get_solo()
    s.check_portfolio_account = portfolio_account
    s.save()

    bank = Bank.objects.create(name='Banco Test', code='BTE')
    check = CheckService.receive(
        bank_id=bank.id,
        check_number='12345',
        amount=Decimal('100000'),
        issue_date='2026-06-01',
        due_date='2026-07-01',
    )
    assert check.status == Check.Status.IN_PORTFOLIO
    assert check.portfolio_account.account_type == TreasuryAccount.Type.CHECK_PORTFOLIO


@pytest.mark.django_db
def test_signal_no_op_when_account_unset(db):
    """Si check_portfolio_account=None, no se crea ninguna TreasuryAccount."""
    s = AccountingSettings.get_solo()
    s.check_portfolio_account = None
    s.save()

    assert not TreasuryAccount.objects.filter(
        account_type=TreasuryAccount.Type.CHECK_PORTFOLIO
    ).exists()
