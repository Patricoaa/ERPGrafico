"""
INT-15 (auditoría documental): anular un pago CON devolución.

Antes: se revertía el asiento del pago (Dr CxC / Cr Caja) Y además se creaba un
movimiento de devolución con su propio asiento (Dr CxC / Cr Caja): la caja y la CxC
quedaban afectadas dos veces. Lo usan cancel_sale_order, annul_invoice(force) y la
cancelación de OC (devolución a la misma cuenta del pago).

Regla corregida: tras anular con devolución, la contabilidad, el saldo de la cuenta
de tesorería y el pagado de la orden deben quedar como si el pago nunca hubiera
existido, salvo que el dinero salga de OTRA cuenta (se traslada entre cuentas).
"""

from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError

from accounting.models import Account, AccountingSettings, AccountType
from contacts.models import Contact
from inventory.models import Warehouse
from purchasing.models import PurchaseOrder
from sales.models import SaleOrder
from treasury.models import TreasuryAccount, TreasuryMovement
from treasury.services import TreasuryService

User = get_user_model()


@pytest.fixture
def env(db):
    user = User.objects.create_user(username="int15", password="x")
    receivable = Account.objects.create(name="Clientes", code="1.1.03.015", account_type=AccountType.ASSET)
    payable = Account.objects.create(name="Proveedores", code="2.1.01.015", account_type=AccountType.LIABILITY)
    settings = AccountingSettings.get_solo()
    settings.default_receivable_account = receivable
    settings.default_payable_account = payable
    settings.save()

    def cash(name, code):
        acc = Account.objects.create(name=name, code=code, account_type=AccountType.ASSET)
        return TreasuryAccount.objects.create(name=name, account=acc, account_type=TreasuryAccount.Type.CASH)

    contact = Contact.objects.create(name="Cliente INT15", tax_id="11111111-1")
    return {
        "user": user, "receivable": receivable, "payable": payable, "contact": contact,
        "cash": cash("Caja", "1.1.01.015"), "bank": cash("Banco", "1.1.02.015"),
    }


def _balance(account):
    account.refresh_from_db()
    return account.balance


def _sale_payment(env, amount="100"):
    order = SaleOrder.objects.create(customer=env["contact"], date=date(2026, 10, 1))
    payment = TreasuryService.create_movement(
        amount=Decimal(amount), movement_type=TreasuryMovement.Type.INBOUND,
        to_account=env["cash"], partner=env["contact"], sale_order=order, created_by=env["user"],
    )
    payment.refresh_from_db()
    assert payment.journal_entry and payment.journal_entry.status == "POSTED", "precondición: pago contabilizado"
    return order, payment


@pytest.mark.django_db
def test_annul_with_full_refund_same_account_nets_to_zero(env):
    cash0, recv0 = _balance(env["cash"].account), _balance(env["receivable"])
    order, payment = _sale_payment(env)
    assert _balance(env["cash"].account) == cash0 + 100

    TreasuryService.annul_movement(payment, reason="cancelación OV", treasury_account_id=env["cash"].id)

    assert _balance(env["cash"].account) == cash0
    assert _balance(env["receivable"]) == recv0
    order.refresh_from_db()
    assert order.total_paid == 0


@pytest.mark.django_db
def test_annul_with_refund_from_other_account_moves_money_between_accounts(env):
    cash0, bank0, recv0 = (
        _balance(env["cash"].account), _balance(env["bank"].account), _balance(env["receivable"])
    )
    order, payment = _sale_payment(env)

    TreasuryService.annul_movement(payment, reason="devuelto por banco", treasury_account_id=env["bank"].id)

    # El dinero cobrado sigue en Caja; la devolución salió del Banco.
    assert _balance(env["cash"].account) == cash0 + 100
    assert _balance(env["bank"].account) == bank0 - 100
    assert _balance(env["receivable"]) == recv0
    order.refresh_from_db()
    assert order.total_paid == 0


@pytest.mark.django_db
def test_annul_without_refund_only_reverses(env):
    cash0, recv0 = _balance(env["cash"].account), _balance(env["receivable"])
    order, payment = _sale_payment(env)

    TreasuryService.annul_movement(payment, reason="registrado por error")

    assert _balance(env["cash"].account) == cash0
    assert _balance(env["receivable"]) == recv0
    assert not TreasuryMovement.objects.filter(reference__endswith=f"-{payment.id}").exclude(pk=payment.pk).exists()


@pytest.mark.django_db
def test_annul_with_partial_refund_is_rejected(env):
    _, payment = _sale_payment(env)

    with pytest.raises(ValidationError, match="parcial"):
        TreasuryService.annul_movement(
            payment, reason="parcial", treasury_account_id=env["cash"].id, amount=Decimal("40")
        )


@pytest.mark.django_db
def test_annul_purchase_payment_with_refund_same_account_nets_to_zero(env):
    warehouse = Warehouse.objects.create(name="Bodega", code="WH-15")
    po = PurchaseOrder.objects.create(
        number="PO-15", supplier=env["contact"], warehouse=warehouse, total=0, total_net=0, total_tax=0
    )
    TreasuryService.create_movement(
        amount=Decimal("500"), movement_type=TreasuryMovement.Type.INBOUND, to_account=env["cash"],
        created_by=env["user"],
    )  # fondos previos para poder pagar
    cash0, pay0 = _balance(env["cash"].account), _balance(env["payable"])
    payment = TreasuryService.create_movement(
        amount=Decimal("100"), movement_type=TreasuryMovement.Type.OUTBOUND, from_account=env["cash"],
        partner=env["contact"], purchase_order=po, created_by=env["user"],
    )

    TreasuryService.annul_movement(payment, reason="cancelación OC", treasury_account_id=env["cash"].id)

    assert _balance(env["cash"].account) == cash0
    assert _balance(env["payable"]) == pay0
    po.refresh_from_db()
    assert po.total_paid == 0
