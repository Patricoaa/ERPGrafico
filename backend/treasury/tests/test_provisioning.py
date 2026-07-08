"""
Tests para TreasuryProvisioningService (auto-provisión cuenta + métodos de pago).

Cubre: provisión CHECKING con tenders seleccionados, CASH con tender fijo,
defaults de uso (débito → solo compras), flags allows_* derivados, y rollback
atómico cuando la cuenta no pasa validación.
"""

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError

from accounting.models import Account, AccountType
from treasury.models import Bank, PaymentMethod, TreasuryAccount
from treasury.provisioning_service import TreasuryProvisioningService

User = get_user_model()


@pytest.fixture
def base(db):
    user = User.objects.create_user(username="prov", password="x")
    bank = Bank.objects.create(name="Banco Test", code="BT")

    def make_account(code, name="Cuenta Contable"):
        return Account.objects.create(name=name, code=code, account_type=AccountType.ASSET)

    return {"user": user, "bank": bank, "make_account": make_account}


@pytest.mark.django_db
def test_provision_checking_creates_selected_methods(base):
    acc = base["make_account"]("1.1.01.050")
    account, methods = TreasuryProvisioningService.provision(
        account_data={
            "name": "BCI Corriente",
            "account_id": acc.id,
            "account_type": TreasuryAccount.Type.CHECKING,
            "bank_id": base["bank"].id,
            "account_number": "00123456",
        },
        tenders=[PaymentMethod.Type.TRANSFER, PaymentMethod.Type.CHECK],
        usage="both",
        created_by=base["user"],
    )

    assert account.pk is not None
    assert {m.method_type for m in methods} == {"TRANSFER", "CHECK"}
    # Flags allows_* derivados de los tenders
    account.refresh_from_db()
    assert account.allows_transfer is True
    assert account.allows_check is True
    assert account.allows_card is False
    assert account.allows_cash is False


@pytest.mark.django_db
def test_provision_cash_uses_fixed_tender(base):
    acc = base["make_account"]("1.1.01.051")
    account, methods = TreasuryProvisioningService.provision(
        account_data={
            "name": "Caja Principal",
            "account_id": acc.id,
            "account_type": TreasuryAccount.Type.CASH,
        },
        tenders=None,
        created_by=base["user"],
    )

    assert [m.method_type for m in methods] == ["CASH"]
    assert account.allows_cash is True


@pytest.mark.django_db
def test_debit_tender_defaults_to_purchases_only(base):
    acc = base["make_account"]("1.1.01.052")
    _account, methods = TreasuryProvisioningService.provision(
        account_data={
            "name": "Banco con Débito",
            "account_id": acc.id,
            "account_type": TreasuryAccount.Type.CHECKING,
            "bank_id": base["bank"].id,
            "account_number": "999",
        },
        tenders=[PaymentMethod.Type.DEBIT_CARD],
        usage="both",
        created_by=base["user"],
    )

    debit = methods[0]
    # PaymentMethod.clean() fuerza débito empresa → solo compras
    assert debit.allow_for_sales is False
    assert debit.allow_for_purchases is True


@pytest.mark.django_db
def test_unknown_tenders_are_filtered_out(base):
    acc = base["make_account"]("1.1.01.053")
    _account, methods = TreasuryProvisioningService.provision(
        account_data={
            "name": "Caja Filtrada",
            "account_id": acc.id,
            "account_type": TreasuryAccount.Type.CASH,
        },
        # TRANSFER no es válido para CASH → se filtra; cae al tender fijo CASH
        tenders=[PaymentMethod.Type.TRANSFER],
        created_by=base["user"],
    )
    assert [m.method_type for m in methods] == ["CASH"]


@pytest.mark.django_db
def test_provision_is_atomic_on_invalid_account(base):
    acc = base["make_account"]("1.1.01.054")
    # CHECKING sin banco ni número → TreasuryAccount.clean() levanta ValidationError
    with pytest.raises(ValidationError):
        TreasuryProvisioningService.provision(
            account_data={
                "name": "Banco Inválido",
                "account_id": acc.id,
                "account_type": TreasuryAccount.Type.CHECKING,
            },
            tenders=[PaymentMethod.Type.TRANSFER],
            created_by=base["user"],
        )

    assert TreasuryAccount.objects.count() == 0
    assert PaymentMethod.objects.count() == 0


@pytest.mark.django_db
def test_provision_from_payload_maps_api_fields(base):
    acc = base["make_account"]("1.1.01.055")
    account, methods = TreasuryProvisioningService.provision_from_payload(
        {
            "name": "Santander Vista",
            "account": acc.id,
            "account_type": "CHECKING",
            "bank": base["bank"].id,
            "account_number": "555",
            "tenders": ["TRANSFER"],
            "usage": "sales",
        },
        created_by=base["user"],
    )

    assert account.name == "Santander Vista"
    assert [m.method_type for m in methods] == ["TRANSFER"]
    assert methods[0].allow_for_sales is True
    assert methods[0].allow_for_purchases is False
