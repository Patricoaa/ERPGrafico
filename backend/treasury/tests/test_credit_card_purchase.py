"""
Tests: gasto con tarjeta de crédito propia (Fase 3, F3.1).

Al pagar una compra con la tarjeta de crédito propia, el OUTBOUND tiene
`from_account` = la cuenta `CREDIT_CARD` (LIABILITY). El asiento
contable debe:

  - Acreditar la `liability_account`  → sube la deuda (más pasivo).
  - Debitar el gasto / proveedor     → según el documento asignado.

El `current_balance` de la `TreasuryAccount` (que delega a
`account.balance`) debe crecer en positivo, ya que para cuentas
`LIABILITY` el balance se calcula como `credit - debit`.
"""

from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model

from accounting.models import Account, AccountType
from treasury.models import Bank, TreasuryAccount, TreasuryMovement
from treasury.services import TreasuryService

User = get_user_model()


@pytest.fixture
def fixture(db):
    user = User.objects.create_user(username="ccuser", password="x")

    bank = Bank.objects.create(name="Banco CC", code="BCC")

    # Banco real (CHECKING) — Asset
    bank_acc = Account.objects.create(
        name="Banco Cta Cte", code="1.1.01.090", account_type=AccountType.ASSET
    )
    bank_ta = TreasuryAccount.objects.create(
        name="Cta Cte Banco",
        account=bank_acc,
        account_type=TreasuryAccount.Type.CHECKING,
        bank=bank,
        account_number="123456",
    )

    # Tarjeta de crédito propia (LIABILITY) — la deuda
    card_acc = Account.objects.create(
        name="Visa Empresa", code="2.1.09.001", account_type=AccountType.LIABILITY
    )
    card_ta = TreasuryAccount.objects.create(
        name="Visa Empresa",
        account=card_acc,
        account_type=TreasuryAccount.Type.CREDIT_CARD,
        bank=bank,
    )

    # Proveedor con cuenta por pagar (simula la compra)
    payable_acc = Account.objects.create(
        name="Proveedor Nacional", code="2.1.01.001", account_type=AccountType.LIABILITY
    )
    from contacts.models import Contact

    supplier = Contact.objects.create(
        name="Proveedor Demo",
        tax_id="76.123.456-7",
    )

    return {
        "user": user,
        "bank": bank,
        "bank_ta": bank_ta,
        "bank_acc": bank_acc,
        "card_ta": card_ta,
        "card_acc": card_acc,
        "supplier": supplier,
        "payable_acc": payable_acc,
    }


@pytest.mark.django_db
def test_purchase_with_credit_card_increases_liability(fixture):
    """
    OUTBOUND desde CREDIT_CARD → Haber liability, Debe proveedor.
    La deuda (current_balance) crece.
    """
    initial_balance = fixture["card_ta"].current_balance

    movement = TreasuryService.create_movement(
        amount=Decimal("150000"),
        movement_type=TreasuryMovement.Type.OUTBOUND,
        payment_method=TreasuryMovement.Method.CARD,
        from_account=fixture["card_ta"],
        date="2026-06-15",
        created_by=fixture["user"],
        partner=fixture["supplier"],
        reference="Compra con tarjeta",
        notes="Compra en tienda retail",
    )

    movement.refresh_from_db()
    assert movement.from_account_id == fixture["card_ta"].id
    assert movement.to_account_id is None
    assert movement.journal_entry is not None

    entry = movement.journal_entry
    items = list(entry.items.all())
    assert len(items) == 2, f"Esperaba 2 items, hay {len(items)}: {items}"

    # 1) Haber liability_account (CREDIT) → sube deuda
    liability_line = next((it for it in items if it.account_id == fixture["card_acc"].id), None)
    assert liability_line is not None, "No se encontró la línea del pasivo (tarjeta)"
    assert liability_line.credit == Decimal("150000.00")
    assert liability_line.debit == 0

    # 2) Debe cuenta por pagar del proveedor
    payable_line = next((it for it in items if it.account_id == fixture["payable_acc"].id), None)
    assert payable_line is not None, "No se encontró la línea del proveedor"
    assert payable_line.debit == Decimal("150000.00")
    assert payable_line.credit == 0

    # El balance de la tarjeta (LIABILITY) crece.
    fixture["card_ta"].refresh_from_db()
    final_balance = fixture["card_ta"].current_balance
    assert final_balance > initial_balance
    # Para LIABILITY, balance = credit - debit → exactamente el monto cargado.
    assert final_balance == initial_balance + Decimal("150000.00")


@pytest.mark.django_db
def test_purchase_with_credit_card_no_touches_bank(fixture):
    """
    OUTBOUND desde CREDIT_CARD NO debe tocar la cuenta bancaria (CHECKING).
    El banco mantiene su saldo.
    """
    initial_bank = fixture["bank_ta"].current_balance

    TreasuryService.create_movement(
        amount=Decimal("50000"),
        movement_type=TreasuryMovement.Type.OUTBOUND,
        payment_method=TreasuryMovement.Method.CARD,
        from_account=fixture["card_ta"],
        date="2026-06-15",
        created_by=fixture["user"],
        partner=fixture["supplier"],
    )

    fixture["bank_ta"].refresh_from_db()
    assert fixture["bank_ta"].current_balance == initial_bank


@pytest.mark.django_db
def test_two_credit_card_purchases_accumulate_debt(fixture):
    """
    Dos compras sucesivas con tarjeta suman sus montos a la deuda.
    """
    for amt in (Decimal("10000"), Decimal("25000")):
        TreasuryService.create_movement(
            amount=amt,
            movement_type=TreasuryMovement.Type.OUTBOUND,
            payment_method=TreasuryMovement.Method.CARD,
            from_account=fixture["card_ta"],
            date="2026-06-15",
            created_by=fixture["user"],
            partner=fixture["supplier"],
        )

    fixture["card_ta"].refresh_from_db()
    assert fixture["card_ta"].current_balance == Decimal("35000.00")
