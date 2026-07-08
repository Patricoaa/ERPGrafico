"""
Tests: la tarjeta de crédito propia (CREDIT_CARD) debe vincularse a una cuenta de
PASIVO, no a Efectivo (1.1.01). Verifica también que no hay regresión en los tipos
cash-equivalent ni en la provisión vía servicio.
"""

import pytest
from django.core.exceptions import ValidationError

from accounting.models import Account, AccountType
from treasury.models import Bank, TreasuryAccount
from treasury.provisioning_service import TreasuryProvisioningService


@pytest.fixture
def base(db):
    bank = Bank.objects.create(name="Banco CC", code="BCC")

    def asset(code):
        return Account.objects.create(
            name=f"Activo {code}", code=code, account_type=AccountType.ASSET
        )

    def liability(code):
        return Account.objects.create(
            name=f"Pasivo {code}", code=code, account_type=AccountType.LIABILITY
        )

    return {"bank": bank, "asset": asset, "liability": liability}


@pytest.mark.django_db
def test_credit_card_with_liability_account_is_valid(base):
    acc = base["liability"]("2.1.09.001")
    ta = TreasuryAccount.objects.create(
        name="Visa Empresa",
        account=acc,
        account_type=TreasuryAccount.Type.CREDIT_CARD,
        bank=base["bank"],
    )
    assert ta.pk is not None
    assert ta.account.account_type == AccountType.LIABILITY


@pytest.mark.django_db
def test_credit_card_with_asset_account_is_rejected(base):
    acc = base["asset"]("1.1.01.070")  # efectivo → inválido para tarjeta de crédito
    with pytest.raises(ValidationError) as exc:
        TreasuryAccount.objects.create(
            name="Visa Mal",
            account=acc,
            account_type=TreasuryAccount.Type.CREDIT_CARD,
            bank=base["bank"],
        )
    assert "PASIVO" in str(exc.value)


@pytest.mark.django_db
def test_cash_and_checking_still_require_asset_1101(base):
    # CASH con 1.1.01 → válido
    cash = TreasuryAccount.objects.create(
        name="Caja",
        account=base["asset"]("1.1.01.071"),
        account_type=TreasuryAccount.Type.CASH,
    )
    assert cash.pk is not None

    # CHECKING con 1.1.01 → válido
    checking = TreasuryAccount.objects.create(
        name="BCI Cte",
        account=base["asset"]("1.1.01.072"),
        account_type=TreasuryAccount.Type.CHECKING,
        bank=base["bank"],
        account_number="123",
    )
    assert checking.pk is not None

    # CHECKING con una cuenta de pasivo → rechazado (sigue exigiendo 1.1.01)
    with pytest.raises(ValidationError):
        TreasuryAccount.objects.create(
            name="BCI Mal",
            account=base["liability"]("2.1.09.002"),
            account_type=TreasuryAccount.Type.CHECKING,
            bank=base["bank"],
            account_number="456",
        )


@pytest.mark.django_db
def test_provision_credit_card_with_liability(base):
    acc = base["liability"]("2.1.09.003")
    account, methods = TreasuryProvisioningService.provision(
        account_data={
            "name": "Mastercard Empresa",
            "account_id": acc.id,
            "account_type": TreasuryAccount.Type.CREDIT_CARD,
            "bank_id": base["bank"].id,
        },
        tenders=None,  # tender fijo del tipo → CREDIT_CARD
    )
    assert account.account.account_type == AccountType.LIABILITY
    assert [m.method_type for m in methods] == ["CREDIT_CARD"]
    # Tarjeta de crédito empresa → solo compras (PaymentMethod.clean())
    assert methods[0].allow_for_sales is False
    assert methods[0].allow_for_purchases is True
