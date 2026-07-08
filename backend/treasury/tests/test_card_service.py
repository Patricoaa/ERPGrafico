"""
Tests: card_service (CardService) — F3.3 + F3.4 + Gap 1.5b.

Cubre:
  - open_statement con defaults y validaciones.
  - apply_charges: imputa interés y comisiones, sube la deuda,
    genera el asiento con desglose.
  - apply_charges idempotente: no duplica cargos.
  - apply_charges con cuenta de gasto: el desglose D=expense, C=liability.
  - apply_charges sin cuenta de gasto en settings: ValidationError
    (Gap 1.5b, ADR-0037 — ya NO usa el workaround del pasivo).
  - pay_statement: TRANSFER banco→tarjeta, baja la deuda y el banco.
  - pay_statement idempotente.
  - pay_statement con total = 0: marca PAID sin movimiento.
  - cancel_statement desde OPEN.
"""

from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError

from accounting.models import Account, AccountType
from treasury.card_service import CardService
from treasury.models import Bank, CreditCardStatement, TreasuryAccount, TreasuryMovement
from treasury.services import TreasuryService

User = get_user_model()


@pytest.fixture
def env(db):
    user = User.objects.create_user(username="carduser", password="x")
    bank = Bank.objects.create(name="Banco Tarjeta", code="BTJ")

    # Banco real
    bank_acc = Account.objects.create(
        name="Cta Cte", code="1.1.01.100", account_type=AccountType.ASSET
    )
    bank_ta = TreasuryAccount.objects.create(
        name="Cta Cte Banco",
        account=bank_acc,
        account_type=TreasuryAccount.Type.CHECKING,
        bank=bank,
        account_number="111",
    )

    # Tarjeta de crédito (LIABILITY)
    card_acc = Account.objects.create(
        name="Visa Empresa", code="2.1.09.020", account_type=AccountType.LIABILITY
    )
    card_ta = TreasuryAccount.objects.create(
        name="Visa Empresa",
        account=card_acc,
        account_type=TreasuryAccount.Type.CREDIT_CARD,
        bank=bank,
    )

    # Cuentas de gasto financiero
    interest_exp = Account.objects.create(
        name="Interés Tarjeta", code="5.2.01.001", account_type=AccountType.EXPENSE
    )
    fees_exp = Account.objects.create(
        name="Comisiones Tarjeta", code="5.2.01.002", account_type=AccountType.EXPENSE
    )

    return {
        "user": user,
        "bank": bank,
        "bank_ta": bank_ta,
        "bank_acc": bank_acc,
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
    return CardService.open_statement(**kwargs)


# ── F3.2 / open_statement ───────────────────────────────────────────────────


@pytest.mark.django_db
def test_open_statement_basic(env):
    stmt = _open(env, billed_amount=Decimal("500000"))
    assert stmt.status == CreditCardStatement.Status.OPEN
    assert stmt.billed_amount == Decimal("500000")
    assert stmt.interest_charged == Decimal("0")
    assert stmt.fees_charged == Decimal("0")
    assert stmt.display_id == f"EST-{stmt.id}"


@pytest.mark.django_db
def test_open_statement_duplicate_raises(env):
    _open(env)
    with pytest.raises(ValidationError):
        _open(env)


@pytest.mark.django_db
def test_open_statement_requires_credit_card_type(env):
    with pytest.raises(ValidationError):
        CardService.open_statement(
            card_account=env["bank_ta"],  # CHECKING, no CREDIT_CARD
            period_year=2026,
            period_month=6,
            cut_off_date=date(2026, 6, 30),
            due_date=date(2026, 7, 25),
        )


@pytest.mark.django_db
def test_open_statement_due_before_cutoff_raises(env):
    with pytest.raises(ValidationError):
        CardService.open_statement(
            card_account=env["card_ta"],
            period_year=2026,
            period_month=6,
            cut_off_date=date(2026, 6, 30),
            due_date=date(2026, 6, 25),  # anterior al cierre
        )


# ── F3.3 / apply_charges ────────────────────────────────────────────────────


@pytest.mark.django_db
def test_apply_charges_increases_liability_and_books_expense(env):
    stmt = _open(env, billed_amount=Decimal("500000"))
    stmt.interest_charged = Decimal("12500")
    stmt.fees_charged = Decimal("1500")
    stmt.save()

    CardService.apply_charges(
        stmt,
        interest_expense_account=env["interest_exp"],
        fees_expense_account=env["fees_exp"],
        created_by=env["user"],
    )

    # Deuda subió en 14000 (12500 + 1500)
    env["card_ta"].refresh_from_db()
    assert env["card_ta"].current_balance == Decimal("14000")

    # Buscar el movimiento y su JE
    stmt.refresh_from_db()
    assert stmt.notes.startswith("[CHARGES]")

    movement = TreasuryMovement.objects.filter(
        reference=stmt.display_id,
        movement_type=TreasuryMovement.Type.ADJUSTMENT,
    ).first()
    assert movement is not None
    assert movement.amount == Decimal("14000")
    assert movement.journal_entry is not None

    items = list(movement.journal_entry.items.all())
    # Debe haber 3 líneas: interés, comisiones, liability (Haber)
    assert len(items) == 3
    interest_line = next(it for it in items if it.account_id == env["interest_exp"].id)
    fees_line = next(it for it in items if it.account_id == env["fees_exp"].id)
    liability_line = next(it for it in items if it.account_id == env["card_acc"].id)
    assert interest_line.debit == Decimal("12500")
    assert interest_line.credit == Decimal("0")
    assert fees_line.debit == Decimal("1500")
    assert fees_line.credit == Decimal("0")
    assert liability_line.debit == Decimal("0")
    assert liability_line.credit == Decimal("14000")


@pytest.mark.django_db
def test_apply_charges_without_expense_accounts_raises(env):
    """Gap 1.5b (ADR-0037): sin cuentas de gasto configuradas, NO se
    usa el workaround del pasivo. Se exige configurar settings antes
    de imputar cargos (o pasar las cuentas explícitamente)."""
    from accounting.models import AccountingSettings

    # Forzar que AccountingSettings esté vacío para las cuentas de
    # gasto financiero. (AccountingSettings es singleton; el conftest
    # no la crea automáticamente en cada test.)
    settings_obj, _ = AccountingSettings.objects.get_or_create()
    settings_obj.interest_expense_account = None
    settings_obj.bank_commission_account = None
    settings_obj.save()

    stmt = _open(env)
    stmt.interest_charged = Decimal("8000")
    stmt.fees_charged = Decimal("2000")
    stmt.save()

    with pytest.raises(ValidationError, match="cuenta de gasto por intereses"):
        CardService.apply_charges(
            stmt,
            interest_expense_account=None,
            fees_expense_account=None,
            created_by=env["user"],
        )

    # El balance de la tarjeta NO cambió (la operación se abortó).
    env["card_ta"].refresh_from_db()
    assert env["card_ta"].current_balance == Decimal("0")
    # No se creó movimiento.
    assert not TreasuryMovement.objects.filter(
        reference=stmt.display_id,
        movement_type=TreasuryMovement.Type.ADJUSTMENT,
    ).exists()


@pytest.mark.django_db
def test_apply_charges_no_op_when_zero(env):
    """Si interest=0 y fees=0, no genera movimiento."""
    stmt = _open(env)
    initial = env["card_ta"].current_balance

    result = CardService.apply_charges(stmt, created_by=env["user"])
    env["card_ta"].refresh_from_db()
    assert env["card_ta"].current_balance == initial
    # No debe haber movimiento.
    assert not TreasuryMovement.objects.filter(
        reference=stmt.display_id,
        movement_type=TreasuryMovement.Type.ADJUSTMENT,
    ).exists()
    assert result is stmt


@pytest.mark.django_db
def test_apply_charges_only_interest(env):
    """Solo interés, sin comisiones."""
    stmt = _open(env)
    stmt.interest_charged = Decimal("5000")
    stmt.fees_charged = Decimal("0")
    stmt.save()

    CardService.apply_charges(
        stmt,
        interest_expense_account=env["interest_exp"],
        created_by=env["user"],
    )

    env["card_ta"].refresh_from_db()
    assert env["card_ta"].current_balance == Decimal("5000")


@pytest.mark.django_db
def test_apply_charges_resolves_accounts_from_settings(env):
    """Gap 1.5b: si no se pasan cuentas explícitas, se resuelven de
    `AccountingSettings` (configuración centralizada)."""
    from accounting.models import AccountingSettings

    settings_obj, _ = AccountingSettings.objects.get_or_create()
    settings_obj.interest_expense_account = env["interest_exp"]
    settings_obj.bank_commission_account = env["fees_exp"]
    settings_obj.save()

    stmt = _open(env)
    stmt.interest_charged = Decimal("7000")
    stmt.fees_charged = Decimal("3000")
    stmt.save()

    # Sin pasar cuentas explícitamente: las toma de settings.
    CardService.apply_charges(stmt, created_by=env["user"])

    stmt.refresh_from_db()
    assert stmt.charges_movement is not None
    assert stmt.charges_movement.amount == Decimal("10000")
    items = list(stmt.charges_movement.journal_entry.items.all())
    interest_line = next(i for i in items if i.account_id == env["interest_exp"].id)
    fees_line = next(i for i in items if i.account_id == env["fees_exp"].id)
    assert interest_line.debit == Decimal("7000")
    assert fees_line.debit == Decimal("3000")


@pytest.mark.django_db
def test_apply_charges_only_fees_missing_settings_raises(env):
    """Si sólo hay interés pero falta la cuenta de comisiones en
    settings, y no se pasa explícitamente → ValidationError."""
    from accounting.models import AccountingSettings

    settings_obj, _ = AccountingSettings.objects.get_or_create()
    settings_obj.interest_expense_account = env["interest_exp"]
    settings_obj.bank_commission_account = None
    settings_obj.save()

    stmt = _open(env)
    stmt.interest_charged = Decimal("5000")
    stmt.fees_charged = Decimal("1500")
    stmt.save()

    with pytest.raises(ValidationError, match="cuenta de gasto por comisiones"):
        CardService.apply_charges(stmt, created_by=env["user"])


@pytest.mark.django_db
def test_apply_charges_idempotent(env):
    """Una segunda llamada no duplica cargos (nota '[CHARGES]')."""
    stmt = _open(env)
    stmt.interest_charged = Decimal("5000")
    stmt.save()

    CardService.apply_charges(stmt, interest_expense_account=env["interest_exp"])
    CardService.apply_charges(stmt, interest_expense_account=env["interest_exp"])

    env["card_ta"].refresh_from_db()
    assert env["card_ta"].current_balance == Decimal("5000")
    # Solo 1 movimiento ADJUSTMENT.
    count = TreasuryMovement.objects.filter(
        reference=stmt.display_id,
        movement_type=TreasuryMovement.Type.ADJUSTMENT,
    ).count()
    assert count == 1


@pytest.mark.django_db
def test_apply_charges_paid_statement_raises(env):
    stmt = _open(env)
    stmt.interest_charged = Decimal("5000")
    stmt.save()
    stmt.status = CreditCardStatement.Status.PAID
    stmt.save()

    with pytest.raises(ValidationError):
        CardService.apply_charges(stmt, interest_expense_account=env["interest_exp"])


# ── F3.4 / pay_statement ───────────────────────────────────────────────────


@pytest.mark.django_db
def test_pay_statement_transfers_bank_to_card(env):
    """Pago del statement: TRANSFER banco → tarjeta, baja deuda y banco."""
    # 1) Compra con tarjeta (sube deuda $300.000)
    from contacts.models import Contact

    Account.objects.create(
        name="Proveedor Test", code="2.1.01.099", account_type=AccountType.LIABILITY
    )
    supplier = Contact.objects.create(
        name="Proveedor Test",
        tax_id="76.999.999-9",
    )
    TreasuryService.create_movement(
        amount=Decimal("300000"),
        movement_type=TreasuryMovement.Type.OUTBOUND,
        payment_method=TreasuryMovement.Method.CARD,
        from_account=env["card_ta"],
        date=date(2026, 6, 10),
        created_by=env["user"],
        partner=supplier,
        notes="Compra con tarjeta",
    )

    # 2) Banco con saldo: crear un movimiento TRANSFER entre dos bancos
    #    (o usar un JE directo). Más simple: crear un depósito externo
    #    con CONTACT para que el asiento se cree.
    Account.objects.create(
        name="Cliente Demo", code="1.1.02.001", account_type=AccountType.ASSET
    )
    Account.objects.create(
        name="AR Demo", code="1.1.02.002", account_type=AccountType.ASSET
    )
    customer = Contact.objects.create(
        name="Cliente Demo",
        tax_id="76.111.111-1",
    )
    # INBOUND a banco con venta a cliente → Debe banco, Haber AR.
    from billing.models import Invoice

    invoice = Invoice.objects.create(
        contact=customer,
        date=date(2026, 6, 1),
        number="FAC-TEST-1",
    )
    TreasuryService.create_movement(
        amount=Decimal("500000"),
        movement_type=TreasuryMovement.Type.INBOUND,
        payment_method=TreasuryMovement.Method.TRANSFER,
        to_account=env["bank_ta"],
        partner=customer,
        date=date(2026, 6, 1),
        created_by=env["user"],
        invoice=invoice,
    )

    # 3) Statement del período: $300.000 facturado, $0 intereses
    stmt = _open(env, billed_amount=Decimal("300000"))

    # 4) Pago del statement
    CardService.pay_statement(
        stmt,
        payment_account=env["bank_ta"],
        date=date(2026, 7, 25),
        created_by=env["user"],
    )

    stmt.refresh_from_db()
    assert stmt.status == CreditCardStatement.Status.PAID
    assert stmt.payment_movement is not None
    assert stmt.payment_account_id == env["bank_ta"].id
    assert stmt.paid_at is not None

    # 5) Verificar el movimiento
    mv = stmt.payment_movement
    assert mv.movement_type == TreasuryMovement.Type.TRANSFER
    assert mv.from_account_id == env["bank_ta"].id
    assert mv.to_account_id == env["card_ta"].id
    assert mv.amount == Decimal("300000")

    # 6) El asiento: Debe liability (baja deuda) / Haber banco (baja saldo)
    items = list(mv.journal_entry.items.all())
    assert len(items) == 2
    liability_line = next(it for it in items if it.account_id == env["card_acc"].id)
    bank_line = next(it for it in items if it.account_id == env["bank_acc"].id)
    assert liability_line.debit == Decimal("300000")
    assert liability_line.credit == Decimal("0")
    assert bank_line.debit == Decimal("0")
    assert bank_line.credit == Decimal("300000")

    # 7) Saldos finales
    env["card_ta"].refresh_from_db()
    env["bank_ta"].refresh_from_db()
    assert env["card_ta"].current_balance == Decimal("0")
    assert env["bank_ta"].current_balance == Decimal("200000")  # 500k - 300k


@pytest.mark.django_db
def test_pay_statement_idempotent(env):
    """Una segunda llamada a pay no duplica el movimiento."""
    from billing.models import Invoice
    from contacts.models import Contact

    Account.objects.create(
        name="Proveedor Test", code="2.1.01.099", account_type=AccountType.LIABILITY
    )
    Account.objects.create(
        name="AR Demo", code="1.1.02.003", account_type=AccountType.ASSET
    )
    supplier = Contact.objects.create(
        name="Proveedor Test",
        tax_id="76.999.999-9",
    )
    customer = Contact.objects.create(
        name="Cliente Demo",
        tax_id="76.111.111-2",
    )
    TreasuryService.create_movement(
        amount=Decimal("100000"),
        movement_type=TreasuryMovement.Type.OUTBOUND,
        payment_method=TreasuryMovement.Method.CARD,
        from_account=env["card_ta"],
        date=date(2026, 6, 10),
        created_by=env["user"],
        partner=supplier,
    )
    invoice = Invoice.objects.create(
        contact=customer,
        date=date(2026, 6, 1),
        number="FAC-IDEMP-1",
    )
    TreasuryService.create_movement(
        amount=Decimal("200000"),
        movement_type=TreasuryMovement.Type.INBOUND,
        payment_method=TreasuryMovement.Method.TRANSFER,
        to_account=env["bank_ta"],
        partner=customer,
        date=date(2026, 6, 1),
        created_by=env["user"],
        invoice=invoice,
    )
    stmt = _open(env, billed_amount=Decimal("100000"))
    CardService.pay_statement(stmt, payment_account=env["bank_ta"])
    CardService.pay_statement(stmt, payment_account=env["bank_ta"])

    # Solo 1 movimiento de pago
    count = TreasuryMovement.objects.filter(
        from_account=env["bank_ta"],
        to_account=env["card_ta"],
        movement_type=TreasuryMovement.Type.TRANSFER,
    ).count()
    assert count == 1
    env["bank_ta"].refresh_from_db()
    assert env["bank_ta"].current_balance == Decimal("100000")


@pytest.mark.django_db
def test_pay_statement_with_zero_total_marks_paid_without_movement(env):
    """Statement vacío (sin cargos): se marca PAID sin movimiento."""
    stmt = _open(env, billed_amount=Decimal("0"))
    CardService.pay_statement(stmt, payment_account=env["bank_ta"])
    stmt.refresh_from_db()
    assert stmt.status == CreditCardStatement.Status.PAID
    assert stmt.payment_movement is None


@pytest.mark.django_db
def test_pay_statement_with_interest_and_fees(env):
    """El pago incluye billed + interest + fees."""
    from billing.models import Invoice
    from contacts.models import Contact

    Account.objects.create(
        name="Proveedor Test", code="2.1.01.099", account_type=AccountType.LIABILITY
    )
    Account.objects.create(
        name="AR Demo", code="1.1.02.004", account_type=AccountType.ASSET
    )
    supplier = Contact.objects.create(
        name="Proveedor Test",
        tax_id="76.999.999-9",
    )
    customer = Contact.objects.create(
        name="Cliente Demo",
        tax_id="76.111.111-3",
    )
    # Compras con tarjeta: 200.000 → sube deuda a 200.000
    TreasuryService.create_movement(
        amount=Decimal("200000"),
        movement_type=TreasuryMovement.Type.OUTBOUND,
        payment_method=TreasuryMovement.Method.CARD,
        from_account=env["card_ta"],
        date=date(2026, 6, 10),
        created_by=env["user"],
        partner=supplier,
        notes="Compra con tarjeta",
    )

    stmt = _open(env, billed_amount=Decimal("200000"))
    stmt.interest_charged = Decimal("6000")
    stmt.fees_charged = Decimal("1000")
    stmt.save()

    # Cargar el banco con una venta a cliente (genera JE completo)
    invoice = Invoice.objects.create(
        contact=customer,
        date=date(2026, 6, 1),
        number="FAC-CHG-1",
    )
    TreasuryService.create_movement(
        amount=Decimal("300000"),
        movement_type=TreasuryMovement.Type.INBOUND,
        payment_method=TreasuryMovement.Method.TRANSFER,
        to_account=env["bank_ta"],
        partner=customer,
        date=date(2026, 6, 1),
        created_by=env["user"],
        invoice=invoice,
    )

    # Aplicar cargos primero (sube la deuda a 207k)
    CardService.apply_charges(
        stmt,
        interest_expense_account=env["interest_exp"],
        fees_expense_account=env["fees_exp"],
    )
    env["card_ta"].refresh_from_db()
    assert env["card_ta"].current_balance == Decimal("207000")

    # Pagar todo: 207k
    CardService.pay_statement(stmt, payment_account=env["bank_ta"])
    env["card_ta"].refresh_from_db()
    env["bank_ta"].refresh_from_db()
    assert env["card_ta"].current_balance == Decimal("0")
    # 300k - 207k = 93k
    assert env["bank_ta"].current_balance == Decimal("93000")


@pytest.mark.django_db
def test_pay_canceled_statement_raises(env):
    stmt = _open(env, billed_amount=Decimal("100000"))
    stmt.status = CreditCardStatement.Status.CANCELED
    stmt.save()
    with pytest.raises(ValidationError):
        CardService.pay_statement(stmt, payment_account=env["bank_ta"])


# ── cancel_statement ───────────────────────────────────────────────────────


@pytest.mark.django_db
def test_cancel_statement_open(env):
    stmt = _open(env)
    CardService.cancel_statement(stmt, notes="Error de carga")
    stmt.refresh_from_db()
    assert stmt.status == CreditCardStatement.Status.CANCELED
    assert "Error de carga" in stmt.notes


@pytest.mark.django_db
def test_cancel_statement_paid_raises(env):
    from billing.models import Invoice
    from contacts.models import Contact

    Account.objects.create(
        name="Proveedor Test", code="2.1.01.099", account_type=AccountType.LIABILITY
    )
    Account.objects.create(
        name="AR Demo", code="1.1.02.005", account_type=AccountType.ASSET
    )
    supplier = Contact.objects.create(
        name="Proveedor Test",
        tax_id="76.999.999-9",
    )
    customer = Contact.objects.create(
        name="Cliente Demo",
        tax_id="76.111.111-4",
    )
    TreasuryService.create_movement(
        amount=Decimal("1000"),
        movement_type=TreasuryMovement.Type.OUTBOUND,
        payment_method=TreasuryMovement.Method.CARD,
        from_account=env["card_ta"],
        date=date(2026, 6, 10),
        created_by=env["user"],
        partner=supplier,
    )
    stmt = _open(env, billed_amount=Decimal("1000"))
    invoice = Invoice.objects.create(
        contact=customer,
        date=date(2026, 6, 1),
        number="FAC-CANC-1",
    )
    TreasuryService.create_movement(
        amount=Decimal("5000"),
        movement_type=TreasuryMovement.Type.INBOUND,
        to_account=env["bank_ta"],
        partner=customer,
        date=date(2026, 6, 1),
        created_by=env["user"],
        invoice=invoice,
    )
    CardService.pay_statement(stmt, payment_account=env["bank_ta"])
    with pytest.raises(ValidationError):
        CardService.cancel_statement(stmt)
