"""
Tests para PaymentOrchestrator CHECK integration (F4.4).
Verifica que pagos con método CHECK crean Check + TreasuryMovement.
"""

from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model

from accounting.models import Account, AccountingSettings, AccountType
from contacts.models import Contact
from treasury.models import Bank, Check, PaymentMethod, TreasuryAccount, TreasuryMovement
from treasury.orchestrator import PaymentOrchestrator

User = get_user_model()


@pytest.fixture
def base(db):
    user = User.objects.create_user(username="orchuser", password="x")
    bank = Bank.objects.create(name="BancoOrch", code="BOR")

    # Bank account (CHECKING)
    bank_acc = Account.objects.create(
        name="Banco Orch", code="1.1.01.090", account_type=AccountType.ASSET
    )
    bank_ta = TreasuryAccount.objects.create(
        name="Banco Orch Cte",
        account=bank_acc,
        account_type=TreasuryAccount.Type.CHECKING,
        bank=bank,
        account_number="789",
    )

    # CHECK_PORTFOLIO account for receive()
    portfolio_acc = Account.objects.create(
        name="Cheques en Cartera", code="1.1.03.002", account_type=AccountType.ASSET
    )
    TreasuryAccount.objects.create(
        name="Cheques en Cartera",
        account=portfolio_acc,
        account_type=TreasuryAccount.Type.CHECK_PORTFOLIO,
    )

    # AccountingSettings with check_portfolio_account
    settings = AccountingSettings.get_solo()
    settings.check_portfolio_account = portfolio_acc
    settings.save(update_fields=["check_portfolio_account"])

    # PaymentMethod CHECK linked to the bank account
    pm_check = PaymentMethod.objects.create(
        name="Cheque Banco",
        method_type=PaymentMethod.Type.CHECK,
        treasury_account=bank_ta,
        settlement_account=bank_ta,
    )

    # PaymentMethod CASH for regression test
    cash_acc = Account.objects.create(
        name="Caja", code="1.1.01.001", account_type=AccountType.ASSET
    )
    cash_ta = TreasuryAccount.objects.create(
        name="Caja Principal",
        account=cash_acc,
        account_type=TreasuryAccount.Type.CASH,
    )
    pm_cash = PaymentMethod.objects.create(
        name="Efectivo",
        method_type=PaymentMethod.Type.CASH,
        treasury_account=cash_ta,
        settlement_account=cash_ta,
    )

    supplier = Contact.objects.create(
        name="Proveedor Orch",
        tax_id="87654321-K",
        roles=["SUPPLIER"],
        email="prov@orch.cl",
    )
    customer = Contact.objects.create(
        name="Cliente Orch",
        tax_id="11223344-5",
        roles=["CUSTOMER"],
        email="cli@orch.cl",
    )

    return {
        "user": user,
        "bank": bank,
        "bank_ta": bank_ta,
        "cash_ta": cash_ta,
        "pm_check": pm_check,
        "pm_cash": pm_cash,
        "supplier": supplier,
        "customer": customer,
    }


# ── CHECK: INBOUND (venta) → CheckService.receive ───────────────────────


@pytest.mark.django_db
def test_orchestrator_check_inbound_creates_check(base):
    """Pago con CHECK + INBOUND → Check IN_PORTFOLIO + movement INBOUND."""
    initial_checks = Check.objects.count()
    initial_movements = TreasuryMovement.objects.count()

    result = PaymentOrchestrator.create_movement(
        payment_method_obj=base["pm_check"],
        amount=Decimal("250000"),
        movement_type=TreasuryMovement.Type.INBOUND,
        partner=base["customer"],
        date="2026-06-15",
        created_by=base["user"],
        check_number="CH-REC-001",
        check_issue_date="2026-06-15",
        check_due_date="2026-07-15",
        notes="Venta con cheque",
    )

    assert isinstance(result, Check)
    assert result.status == Check.Status.IN_PORTFOLIO
    assert result.direction == Check.Direction.RECEIVED
    assert result.check_number == "CH-REC-001"
    assert result.amount == Decimal("250000")
    assert result.bank == base["bank"]
    assert Check.objects.count() == initial_checks + 1
    assert TreasuryMovement.objects.count() == initial_movements + 1

    movement = TreasuryMovement.objects.order_by("-id").first()
    assert movement.movement_type == TreasuryMovement.Type.INBOUND
    assert movement.to_account == result.portfolio_account


# ── CHECK: OUTBOUND (compra) → CheckService.issue ──────────────────────


@pytest.mark.django_db
def test_orchestrator_check_outbound_creates_check(base):
    """Pago con CHECK + OUTBOUND → Check ISSUED + movement OUTBOUND."""
    initial_checks = Check.objects.count()

    result = PaymentOrchestrator.create_movement(
        payment_method_obj=base["pm_check"],
        amount=Decimal("180000"),
        movement_type=TreasuryMovement.Type.OUTBOUND,
        partner=base["supplier"],
        date="2026-06-15",
        created_by=base["user"],
        check_number="CH-EMI-001",
        check_issue_date="2026-06-15",
        check_due_date="2026-08-01",
        notes="Compra con cheque propio",
    )

    assert isinstance(result, Check)
    assert result.status == Check.Status.ISSUED
    assert result.direction == Check.Direction.ISSUED
    assert result.check_number == "CH-EMI-001"
    assert result.amount == Decimal("180000")
    assert result.payment_account == base["bank_ta"]
    assert Check.objects.count() == initial_checks + 1


# ── CHECK: sin banco → error ───────────────────────────────────────────


@pytest.mark.django_db
def test_orchestrator_check_resolves_bank_from_settlement(base):
    """CHECK PaymentMethod linked to CHECKING → bank se resuelve del settlement."""
    result = PaymentOrchestrator.create_movement(
        payment_method_obj=base["pm_check"],
        amount=Decimal("10000"),
        movement_type=TreasuryMovement.Type.INBOUND,
        partner=base["customer"],
        check_number="CH-X002",
        check_issue_date="2026-06-15",
        check_due_date="2026-07-15",
    )
    assert isinstance(result, Check)
    assert result.bank == base["bank"]  # resolved from settlement (bank_ta.bank)


# ── Non-CHECK: regression test ─────────────────────────────────────────


@pytest.mark.django_db
def test_orchestrator_cash_inbound_unchanged(base):
    """CASH + INBOUND → movement normal (sin Check)."""
    initial_checks = Check.objects.count()
    initial_movements = TreasuryMovement.objects.count()

    result = PaymentOrchestrator.create_movement(
        payment_method_obj=base["pm_cash"],
        amount=Decimal("50000"),
        movement_type=TreasuryMovement.Type.INBOUND,
        partner=base["customer"],
        date="2026-06-15",
        created_by=base["user"],
    )

    assert isinstance(result, TreasuryMovement)
    assert result.movement_type == TreasuryMovement.Type.INBOUND
    assert result.to_account == base["cash_ta"]
    assert Check.objects.count() == initial_checks
    assert TreasuryMovement.objects.count() == initial_movements + 1


@pytest.mark.django_db
def test_orchestrator_transfer_unchanged(base):
    """TRANSFER → movement normal (sin Check)."""
    result = PaymentOrchestrator.create_movement(
        payment_method_obj=base["pm_cash"],
        amount=Decimal("30000"),
        movement_type=TreasuryMovement.Type.OUTBOUND,
        date="2026-06-15",
        created_by=base["user"],
    )

    assert isinstance(result, TreasuryMovement)


# ── CHECK: con checkbook ────────────────────────────────────────────────


@pytest.mark.django_db
def test_orchestrator_check_with_checkbook(base):
    """CHECK OUTBOUND con checkbook → auto-folio."""
    from treasury.models import Checkbook

    cb = Checkbook.objects.create(
        bank_account=base["bank_ta"],
        bank=base["bank"],
        start_folio=5000,
        end_folio=5100,
        next_folio=5000,
    )

    result = PaymentOrchestrator.create_movement(
        payment_method_obj=base["pm_check"],
        amount=Decimal("90000"),
        movement_type=TreasuryMovement.Type.OUTBOUND,
        partner=base["supplier"],
        date="2026-06-15",
        checkbook_id=cb.id,
        created_by=base["user"],
    )

    assert isinstance(result, Check)
    assert result.check_number == "5000"
    assert result.checkbook == cb
    cb.refresh_from_db()
    assert cb.next_folio == 5001


# ── CHECK: sin settlement account → error ──────────────────────────────


@pytest.mark.django_db
def test_orchestrator_check_on_cash_account(base):
    """CHECK con settlement bank (CHECKING) + check_bank_id explícito → funciona."""
    result = PaymentOrchestrator.create_movement(
        payment_method_obj=base["pm_check"],
        amount=Decimal("10000"),
        movement_type=TreasuryMovement.Type.INBOUND,
        partner=base["customer"],
        check_bank_id=base["bank"].id,
        check_number="CH-X001",
        check_issue_date="2026-06-15",
        check_due_date="2026-07-15",
    )
    assert isinstance(result, Check)
    assert result.bank == base["bank"]
