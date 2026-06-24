"""
Tests del Gap 1.6 (ADR-0037): `CardService.reverse_statement`.

Cubre la reversa contable transaccional de cargos + pago, la
actualización de saldos de la tarjeta y banco, la idempotencia y
los rechazos por movimientos reconciliados.
"""

from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError
from django.utils import timezone

from accounting.models import Account, AccountingSettings, AccountType, JournalEntry, JournalItem
from treasury.card_service import CardService
from treasury.models import (
    CreditCardStatement,
    TreasuryMovement,
)


def _env_setup():
    """Crea el banco, la tarjeta, las cuentas de gasto y los settings
    necesarios para aplicar cargos financieros. Carga el banco con
    $1.000.000 mediante un JE de aporte de capital para que
    `pay_statement` (Gap 1.3) encuentre fondos suficientes."""
    from django.contrib.auth import get_user_model

    from accounting.models import JournalEntry
    from treasury.models import Bank, TreasuryAccount

    User = get_user_model()
    user = User.objects.create_user(username="u_rev", email="r@x.test", password="x")

    bank = Bank.objects.create(name="Banco Reversa")

    bank_acc = Account.objects.create(
        code="1.1.01.10",
        name="Banco Cta Cte",
        account_type=AccountType.ASSET,
    )
    card_acc = Account.objects.create(
        code="2.1.09.01",
        name="Visa Pasivo",
        account_type=AccountType.LIABILITY,
    )
    bank_ta = TreasuryAccount.objects.create(
        bank=bank,
        name="Cuenta Corriente",
        account=bank_acc,
        account_type=TreasuryAccount.Type.CHECKING,
        account_number="0001",
    )
    card_ta = TreasuryAccount.objects.create(
        bank=bank,
        name="Visa",
        account=card_acc,
        account_type=TreasuryAccount.Type.CREDIT_CARD,
    )
    card_ta_liability = card_ta.account  # pasivo asociado

    settings_obj, _ = AccountingSettings.objects.get_or_create()
    interest_exp = Account.objects.create(
        code="6.1.01.01",
        name="Intereses Pagados",
        account_type=AccountType.EXPENSE,
    )
    fees_exp = Account.objects.create(
        code="6.1.01.02",
        name="Comisiones Bancarias",
        account_type=AccountType.EXPENSE,
    )
    settings_obj.interest_expense_account = interest_exp
    settings_obj.bank_commission_account = fees_exp
    settings_obj.save()

    # Cargar el banco con $1.000.000 vía aporte de capital (Haber
    # patrimonio, Debe banco).
    equity = Account.objects.create(
        code="3.1.01.01",
        name="Aportes",
        account_type=AccountType.EQUITY,
    )
    je = JournalEntry.objects.create(
        date=timezone.now().date(),
        description="Aporte inicial de capital",
        status=JournalEntry.Status.POSTED,
    )
    JournalItem.objects.create(entry=je, account=bank_acc, debit=Decimal("1000000"))
    JournalItem.objects.create(entry=je, account=equity, credit=Decimal("1000000"))

    return {
        "user": user,
        "bank": bank,
        "bank_ta": bank_ta,
        "card_ta": card_ta,
        "card_ta_liability": card_ta_liability,
        "interest_exp": interest_exp,
        "fees_exp": fees_exp,
    }


def _open_statement(env, period="2026-06", billed_amount=Decimal("130000")):
    year, month = map(int, period.split("-"))
    cutoff = timezone.now().date().replace(year=year, month=month, day=15)
    due = cutoff.replace(day=25)
    stmt = CardService.open_statement(
        card_account=env["card_ta"],
        period_year=year,
        period_month=month,
        cut_off_date=cutoff,
        due_date=due,
        billed_amount=billed_amount,
        created_by=env["user"],
    )
    stmt.interest_charged = Decimal("15000")
    stmt.fees_charged = Decimal("5000")
    stmt.save()
    return stmt


@pytest.mark.django_db
def test_reverse_statement_open_without_movements():
    """OPEN sin cargos ni pago: sólo cambia status a CANCELED."""
    env = _env_setup()
    stmt = _open_statement(env)

    result = CardService.reverse_statement(stmt)

    stmt.refresh_from_db()
    assert stmt.status == CreditCardStatement.Status.CANCELED
    assert result.id == stmt.id


@pytest.mark.django_db
def test_reverse_statement_with_charges_only():
    """Reversar cargo de $20k (interés+comisión) reduce el pasivo y
    borra el `charges_movement` con su JE marcado REVERSAL."""
    env = _env_setup()
    stmt = _open_statement(env)
    CardService.apply_charges(
        stmt,
        interest_expense_account=env["interest_exp"],
        fees_expense_account=env["fees_exp"],
        created_by=env["user"],
    )

    # Sanity: pasivo subió $20k y hay un ADJUSTMENT.
    env["card_ta_liability"].refresh_from_db()
    assert env["card_ta_liability"].balance == Decimal("20000")
    charges_mv = stmt.charges_movement
    assert charges_mv is not None
    original_je = charges_mv.journal_entry
    assert original_je.status == JournalEntry.Status.POSTED

    CardService.reverse_statement(stmt)

    stmt.refresh_from_db()
    assert stmt.status == CreditCardStatement.Status.CANCELED
    assert stmt.charges_movement is None

    # Pasivo y tarjeta vuelven a su estado original.
    env["card_ta_liability"].refresh_from_db()
    assert env["card_ta_liability"].balance == Decimal("0")
    env["card_ta"].refresh_from_db()
    assert env["card_ta"].current_balance == Decimal("0")

    # El JE original tiene ahora su reverso.
    original_je.refresh_from_db()
    reversals = JournalEntry.objects.filter(reversal_of=original_je)
    assert reversals.count() == 1
    assert reversals.first().status == JournalEntry.Status.REVERSAL

    # El movimiento original fue borrado.
    assert not TreasuryMovement.objects.filter(pk=charges_mv.pk).exists()


@pytest.mark.django_db
def test_reverse_statement_with_charges_and_payment():
    """Reversar tanto el cargo como el pago. El banco recupera los
    $130k transferidos y el pasivo vuelve a $0."""
    env = _env_setup()
    stmt = _open_statement(env)
    CardService.apply_charges(
        stmt,
        interest_expense_account=env["interest_exp"],
        fees_expense_account=env["fees_exp"],
        created_by=env["user"],
    )
    CardService.pay_statement(stmt, payment_account=env["bank_ta"])

    bank_before = env["bank_ta"].current_balance
    # Total: 130k billed + 15k interest + 5k fees = 150k.
    assert bank_before == Decimal("1000000") - Decimal("150000")

    CardService.reverse_statement(stmt)

    env["bank_ta"].refresh_from_db()
    assert env["bank_ta"].current_balance == Decimal("1000000")
    env["card_ta_liability"].refresh_from_db()
    assert env["card_ta_liability"].balance == Decimal("0")

    stmt.refresh_from_db()
    assert stmt.payment_movement is None
    assert stmt.payment_account is None
    assert stmt.paid_at is None
    assert stmt.charges_movement is None
    assert stmt.status == CreditCardStatement.Status.CANCELED


@pytest.mark.django_db
def test_reverse_statement_idempotent_on_canceled():
    """Si ya está CANCELED, retorna el mismo statement sin cambios."""
    env = _env_setup()
    stmt = _open_statement(env)
    CardService.reverse_statement(stmt)
    stmt.refresh_from_db()
    assert stmt.status == CreditCardStatement.Status.CANCELED

    # Segunda llamada: no-op.
    result = CardService.reverse_statement(stmt)
    stmt.refresh_from_db()
    assert result.id == stmt.id
    assert stmt.status == CreditCardStatement.Status.CANCELED


@pytest.mark.django_db
def test_reverse_statement_rejects_reconciled_charges():
    """Si el cargo está conciliado contra el banco, rechaza la
    reversa hasta que se des-reconcílie."""
    env = _env_setup()
    stmt = _open_statement(env)
    CardService.apply_charges(
        stmt,
        interest_expense_account=env["interest_exp"],
        fees_expense_account=env["fees_exp"],
        created_by=env["user"],
    )
    stmt.refresh_from_db()
    stmt.charges_movement.is_reconciled = True
    stmt.charges_movement.save()

    with pytest.raises(ValidationError, match="conciliado"):
        CardService.reverse_statement(stmt)

    # Statement sigue OPEN (no se anuló).
    stmt.refresh_from_db()
    assert stmt.status == CreditCardStatement.Status.OPEN
    assert stmt.charges_movement is not None


@pytest.mark.django_db
def test_reverse_statement_rejects_reconciled_payment():
    """Si el pago está conciliado, rechaza la reversa."""
    env = _env_setup()
    stmt = _open_statement(env)
    CardService.apply_charges(
        stmt,
        interest_expense_account=env["interest_exp"],
        fees_expense_account=env["fees_exp"],
        created_by=env["user"],
    )
    CardService.pay_statement(stmt, payment_account=env["bank_ta"])
    stmt.refresh_from_db()
    stmt.payment_movement.is_reconciled = True
    stmt.payment_movement.save()

    with pytest.raises(ValidationError, match="conciliado"):
        CardService.reverse_statement(stmt)


@pytest.mark.django_db
def test_reverse_statement_preserves_audit_trail():
    """El campo `notes` debe contener el log de reversa con timestamp
    y los IDs de los movimientos revertidos."""
    env = _env_setup()
    stmt = _open_statement(env)
    CardService.apply_charges(
        stmt,
        interest_expense_account=env["interest_exp"],
        fees_expense_account=env["fees_exp"],
        created_by=env["user"],
    )

    CardService.reverse_statement(stmt, notes="Cargué el estado equivocado")

    stmt.refresh_from_db()
    assert "[REVERSAL]" in stmt.notes
    assert "reversados" in stmt.notes
    assert "Cargué el estado equivocado" in stmt.notes
