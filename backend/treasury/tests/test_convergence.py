"""
Tests para la convergencia de cuentas legacy (DEBIT_CARD/CHECKBOOK → CHECKING).

Cubre: conversión de tarjeta de débito a cuenta corriente + método, omisión
defensiva de chequera sin banco/número, idempotencia y dry-run sin cambios.
"""
import pytest

from accounting.models import Account, AccountType
from treasury.convergence import converge_accounts
from treasury.models import Bank, PaymentMethod, TreasuryAccount


@pytest.fixture
def base(db):
    bank = Bank.objects.create(name="Banco Conv", code="BC")

    def make_account(code):
        return Account.objects.create(name=f"Cta {code}", code=code, account_type=AccountType.ASSET)

    return {"bank": bank, "make_account": make_account}


@pytest.mark.django_db
def test_debit_card_account_converges(base):
    acc = base["make_account"]("1.1.01.060")
    legacy = TreasuryAccount.objects.create(
        name="Visa Débito Empresa",
        account=acc,
        account_type=TreasuryAccount.Type.DEBIT_CARD,
        bank=base["bank"],
        account_number="445566",
    )

    report = converge_accounts(apply=True)

    legacy.refresh_from_db()
    assert legacy.account_type == TreasuryAccount.Type.CHECKING
    method = legacy.payment_methods.get(method_type=PaymentMethod.Type.DEBIT_CARD)
    assert method.allow_for_sales is False  # débito empresa → solo compras
    assert method.allow_for_purchases is True
    assert len(report.converted) == 1
    assert report.remaining == 0


@pytest.mark.django_db
def test_checkbook_without_bank_is_skipped(base):
    acc = base["make_account"]("1.1.01.061")
    legacy = TreasuryAccount.objects.create(
        name="Chequera Caja",
        account=acc,
        account_type=TreasuryAccount.Type.CHECKBOOK,
        # sin banco ni número → no puede re-tiparse a CHECKING
    )

    report = converge_accounts(apply=True)

    legacy.refresh_from_db()
    assert legacy.account_type == TreasuryAccount.Type.CHECKBOOK  # intacta
    assert len(report.skipped) == 1
    assert report.remaining == 1
    assert legacy.payment_methods.count() == 0


@pytest.mark.django_db
def test_dry_run_makes_no_changes(base):
    acc = base["make_account"]("1.1.01.063")
    legacy = TreasuryAccount.objects.create(
        name="Débito DryRun",
        account=acc,
        account_type=TreasuryAccount.Type.DEBIT_CARD,
        bank=base["bank"],
        account_number="111",
    )

    report = converge_accounts(apply=False)

    legacy.refresh_from_db()
    assert legacy.account_type == TreasuryAccount.Type.DEBIT_CARD  # sin cambios
    assert legacy.payment_methods.count() == 0
    assert len(report.converted) == 1  # reporta lo que haría
    assert report.remaining == 1


@pytest.mark.django_db
def test_convergence_is_idempotent(base):
    acc = base["make_account"]("1.1.01.064")
    TreasuryAccount.objects.create(
        name="Débito Idem",
        account=acc,
        account_type=TreasuryAccount.Type.DEBIT_CARD,
        bank=base["bank"],
        account_number="222",
    )

    first = converge_accounts(apply=True)
    second = converge_accounts(apply=True)

    assert len(first.converted) == 1
    assert len(second.converted) == 0
    assert second.remaining == 0
    # No se duplican métodos al re-ejecutar
    assert PaymentMethod.objects.filter(method_type=PaymentMethod.Type.DEBIT_CARD).count() == 1
