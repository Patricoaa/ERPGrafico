"""
Tests: charges_movement FK + reapply_charges (Gap 1.4, ADR-0037).

Cubre:
  - `apply_charges` setea el FK `charges_movement` directamente.
  - Idempotencia: una segunda llamada no duplica (consulta por FK).
  - `reapply_charges` reversa el cargo anterior y crea uno nuevo.
  - `reapply_charges` actualiza el asiento (D/C reflejan nuevos montos).
  - `reapply_charges` sin cargo previo delega a `apply_charges`.
  - `reapply_charges` sobre PAID/CANCELED levanta ValidationError.
"""

from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError

from accounting.models import Account, AccountType, JournalEntry
from treasury.card_service import CardService
from treasury.models import Bank, CreditCardStatement, TreasuryAccount, TreasuryMovement

User = get_user_model()


@pytest.fixture
def env(db):
    user = User.objects.create_user(username="ccr2", password="x")
    bank = Bank.objects.create(name="Banco Reapp", code="BRE")

    card_acc = Account.objects.create(
        name="Visa Reapp",
        code="2.1.09.050",
        account_type=AccountType.LIABILITY,
    )
    card_ta = TreasuryAccount.objects.create(
        name="Visa Reapp",
        account=card_acc,
        account_type=TreasuryAccount.Type.CREDIT_CARD,
        bank=bank,
    )
    interest_exp = Account.objects.create(
        name="Interés Reapp",
        code="5.2.01.020",
        account_type=AccountType.EXPENSE,
    )
    fees_exp = Account.objects.create(
        name="Comisiones Reapp",
        code="5.2.01.021",
        account_type=AccountType.EXPENSE,
    )
    return {
        "user": user,
        "bank": bank,
        "card_ta": card_ta,
        "card_acc": card_acc,
        "interest_exp": interest_exp,
        "fees_exp": fees_exp,
    }


def _open(env, **overrides):
    kwargs = dict(
        card_account=env["card_ta"],
        period_year=2026,
        period_month=6,
        cut_off_date=date(2026, 6, 30),
        due_date=date(2026, 7, 25),
        created_by=env["user"],
    )
    kwargs.update(overrides)
    return CreditCardStatement.objects.create(**kwargs)


# ── charges_movement FK ─────────────────────────────────────────────────────


@pytest.mark.django_db
def test_apply_charges_sets_charges_movement_fk(env):
    stmt = _open(env)
    stmt.interest_charged = Decimal("5000")
    stmt.fees_charged = Decimal("1500")
    stmt.save()

    CardService.apply_charges(
        stmt,
        interest_expense_account=env["interest_exp"],
        fees_expense_account=env["fees_exp"],
    )
    stmt.refresh_from_db()
    assert stmt.charges_movement is not None
    assert stmt.charges_movement.amount == Decimal("6500")
    assert stmt.charges_movement.movement_type == TreasuryMovement.Type.ADJUSTMENT


@pytest.mark.django_db
def test_apply_charges_idempotent_via_fk(env):
    """Segunda llamada: detecta cargo por FK y retorna sin duplicar."""
    stmt = _open(env)
    stmt.interest_charged = Decimal("5000")
    stmt.save()

    CardService.apply_charges(stmt, interest_expense_account=env["interest_exp"])
    stmt.refresh_from_db()
    first_mv = stmt.charges_movement
    first_je = first_mv.journal_entry

    # Segunda llamada
    CardService.apply_charges(stmt, interest_expense_account=env["interest_exp"])
    stmt.refresh_from_db()
    assert stmt.charges_movement_id == first_mv.id
    assert stmt.charges_movement.journal_entry_id == first_je.id


# ── reapply_charges ────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_reapply_charges_reverses_and_reimputes(env):
    """Edita interest/fees y reaplica: el cargo viejo se reversa y se crea uno nuevo."""
    stmt = _open(env)
    stmt.interest_charged = Decimal("5000")
    stmt.fees_charged = Decimal("1000")
    stmt.save()

    CardService.apply_charges(
        stmt,
        interest_expense_account=env["interest_exp"],
        fees_expense_account=env["fees_exp"],
    )
    stmt.refresh_from_db()
    old_mv = stmt.charges_movement
    old_je = old_mv.journal_entry
    assert old_mv.amount == Decimal("6000")

    # Editar y reaplicar
    stmt.interest_charged = Decimal("8000")
    stmt.fees_charged = Decimal("2500")
    stmt.save()

    CardService.reapply_charges(
        stmt,
        interest_expense_account=env["interest_exp"],
        fees_expense_account=env["fees_exp"],
    )
    stmt.refresh_from_db()

    # El FK apunta a un movimiento NUEVO con el nuevo monto
    assert stmt.charges_movement_id != old_mv.id
    assert stmt.charges_movement.amount == Decimal("10500")
    assert stmt.charges_movement.journal_entry is not None

    # El JE original tiene un reverso (status=REVERSAL)
    old_je.refresh_from_db()
    assert old_je.status in ("POSTED", "CLOSED")  # original sigue POSTED
    reversal = JournalEntry.objects.filter(reversal_of=old_je).first()
    assert reversal is not None
    assert reversal.status == "REVERSAL"

    # El asiento nuevo tiene los items correctos
    new_items = list(stmt.charges_movement.journal_entry.items.all())
    total_debit = sum(i.debit for i in new_items)
    total_credit = sum(i.credit for i in new_items)
    assert total_debit == Decimal("10500")
    assert total_credit == Decimal("10500")
    interest_line = next(i for i in new_items if i.account_id == env["interest_exp"].id)
    fees_line = next(i for i in new_items if i.account_id == env["fees_exp"].id)
    liability_line = next(i for i in new_items if i.account_id == env["card_acc"].id)
    assert interest_line.debit == Decimal("8000")
    assert fees_line.debit == Decimal("2500")
    assert liability_line.credit == Decimal("10500")


@pytest.mark.django_db
def test_reapply_charges_without_previous_charges_just_applies(env):
    """Sin cargo previo, reapply equivale a apply_charges."""
    stmt = _open(env)
    stmt.interest_charged = Decimal("3000")
    stmt.save()

    CardService.reapply_charges(stmt, interest_expense_account=env["interest_exp"])
    stmt.refresh_from_db()
    assert stmt.charges_movement is not None
    assert stmt.charges_movement.amount == Decimal("3000")


@pytest.mark.django_db
def test_reapply_charges_rejects_paid_statement(env):
    stmt = _open(env)
    stmt.interest_charged = Decimal("3000")
    stmt.status = CreditCardStatement.Status.PAID
    stmt.save()

    with pytest.raises(ValidationError):
        CardService.reapply_charges(stmt, interest_expense_account=env["interest_exp"])


@pytest.mark.django_db
def test_reapply_charges_rejects_canceled_statement(env):
    stmt = _open(env)
    stmt.interest_charged = Decimal("3000")
    stmt.status = CreditCardStatement.Status.CANCELED
    stmt.save()

    with pytest.raises(ValidationError):
        CardService.reapply_charges(stmt, interest_expense_account=env["interest_exp"])


@pytest.mark.django_db
def test_reapply_charges_updates_card_balance_correctly(env):
    """El balance de la tarjeta refleja el cargo nuevo después de reaplicar."""
    stmt = _open(env)
    stmt.interest_charged = Decimal("5000")
    stmt.fees_charged = Decimal("1000")
    stmt.save()
    CardService.apply_charges(
        stmt,
        interest_expense_account=env["interest_exp"],
        fees_expense_account=env["fees_exp"],
    )
    env["card_ta"].refresh_from_db()
    assert env["card_ta"].current_balance == Decimal("6000")

    stmt.interest_charged = Decimal("12000")
    stmt.fees_charged = Decimal("3000")
    stmt.save()
    CardService.reapply_charges(
        stmt,
        interest_expense_account=env["interest_exp"],
        fees_expense_account=env["fees_exp"],
    )
    env["card_ta"].refresh_from_db()
    # El cargo viejo (6k) se reversó y el nuevo (15k) se aplicó.
    assert env["card_ta"].current_balance == Decimal("15000")
