"""
Tests para CheckService: receive, deposit, clear, bounce, void, issue,
mark_cashed y transiciones.

Nota: los tests de `endorse()` (F4.2 endoso) se removieron en ADR-0039.
"""

from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError

from accounting.models import Account, AccountType
from contacts.models import Contact
from treasury.check_service import CheckService
from treasury.models import Bank, Check, Checkbook, TreasuryAccount, TreasuryMovement

User = get_user_model()


@pytest.fixture
def base(db):
    user = User.objects.create_user(username="checkuser", password="x")
    bank = Bank.objects.create(name="Banco Cheques", code="BCH")

    portfolio_acc = Account.objects.create(
        name="Cheques en Cartera", code="1.1.03.001", account_type=AccountType.ASSET
    )
    bank_acc = Account.objects.create(
        name="Banco BCI", code="1.1.01.080", account_type=AccountType.ASSET
    )
    issued_checks_acc = Account.objects.create(
        name="Cheques Girados por Pagar", code="2.1.05.001", account_type=AccountType.LIABILITY
    )

    # Cuenta puente de tesorería (tipo CHECK_PORTFOLIO)
    portfolio_ta = TreasuryAccount.objects.create(
        name="Cheques en Cartera",
        account=portfolio_acc,
        account_type=TreasuryAccount.Type.CHECK_PORTFOLIO,
    )
    bank_ta = TreasuryAccount.objects.create(
        name="BCI Cte",
        account=bank_acc,
        account_type=TreasuryAccount.Type.CHECKING,
        bank=bank,
        account_number="123",
    )
    issued_checks_ta = TreasuryAccount.objects.create(
        name="Cheques Girados por Pagar",
        account=issued_checks_acc,
        account_type=TreasuryAccount.Type.ISSUED_CHECKS,
    )
    supplier = Contact.objects.create(
        name="Proveedor Cheques",
        tax_id="12345678-9",
        roles=["SUPPLIER"],
        email="prov@cheques.cl",
    )
    return {
        "user": user,
        "bank": bank,
        "portfolio_ta": portfolio_ta,
        "bank_ta": bank_ta,
        "issued_checks_ta": issued_checks_ta,
        "supplier": supplier,
    }


def _receive(base, check_number, amount, **kwargs):
    """Helper: recibe un cheque pasando la cuenta puente explícita."""
    return CheckService.receive(
        bank_id=base["bank"].id,
        check_number=check_number,
        amount=Decimal(str(amount)),
        issue_date="2026-06-01",
        due_date="2026-07-01",
        portfolio_account=base["portfolio_ta"],
        **kwargs,
    )


@pytest.mark.django_db
def test_receive_creates_check_and_movement(base):
    check = _receive(base, "0001234", "500000", created_by=base["user"])

    assert check.pk is not None
    assert check.status == Check.Status.IN_PORTFOLIO
    assert check.receipt_movement is not None
    assert check.receipt_movement.movement_type == TreasuryMovement.Type.INBOUND
    assert check.receipt_movement.to_account == check.portfolio_account
    assert check.receipt_movement.amount == Decimal("500000")


@pytest.mark.django_db
def test_deposit_transfers_to_bank(base):
    check = _receive(base, "0002000", "200000", created_by=base["user"])
    check = CheckService.deposit(check, base["bank_ta"], created_by=base["user"])

    assert check.status == Check.Status.DEPOSITED
    assert check.deposit_account == base["bank_ta"]
    assert check.settlement_movement is not None
    assert check.settlement_movement.movement_type == TreasuryMovement.Type.TRANSFER
    assert check.settlement_movement.from_account == check.portfolio_account
    assert check.settlement_movement.to_account == base["bank_ta"]


@pytest.mark.django_db
def test_clear_marks_as_cleared(base):
    check = _receive(base, "0003000", "100000")
    check = CheckService.deposit(check, base["bank_ta"])
    check = CheckService.clear(check)

    assert check.status == Check.Status.CLEARED
    assert check.cleared_at is not None


@pytest.mark.django_db
def test_bounce_creates_reversal_movements(base):
    check = _receive(base, "0004000", "300000", created_by=base["user"])
    check = CheckService.deposit(check, base["bank_ta"], created_by=base["user"])
    initial_count = TreasuryMovement.objects.count()
    check = CheckService.bounce(check, notes="Fondos insuficientes", created_by=base["user"])

    assert check.status == Check.Status.BOUNCED
    assert check.bounced_at is not None
    # 2 reversas: depósito (banco→cartera) + recepción (cartera→externo)
    assert TreasuryMovement.objects.count() == initial_count + 2


@pytest.mark.django_db
def test_void_from_portfolio(base):
    check = _receive(base, "0005000", "50000")
    check = CheckService.void(check, notes="Error de captura")

    assert check.status == Check.Status.VOIDED


@pytest.mark.django_db
def test_invalid_transition_raises(base):
    check = _receive(base, "0006000", "10000")
    with pytest.raises(ValidationError):
        CheckService.clear(check)  # no se puede cobrar sin depositar


@pytest.mark.django_db
def test_receive_without_portfolio_account_raises(db):
    """Sin AccountingSettings ni cuenta puente explícita → error claro."""
    bank = Bank.objects.create(name="BNoConfig", code="BNC")
    with pytest.raises(ValidationError, match="Cheques en Cartera"):
        CheckService.receive(
            bank_id=bank.id,
            check_number="9999",
            amount=Decimal("1000"),
            issue_date="2026-06-01",
            due_date="2026-06-30",
        )


# ─────────────────────────────────────────────────────────────────────────
# F4.1: Cheques propios girados (direction=ISSUED)
# ─────────────────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_issue_creates_check_issued(base):
    """issue() crea un Check con status=ISSUED y OUTBOUND desde pasivo."""
    check = CheckService.issue(
        bank_id=base["bank"].id,
        check_number="P-0001",
        amount=Decimal("200000"),
        issue_date="2026-06-01",
        due_date="2026-07-01",
        counterparty_id=base["supplier"].id,
        payment_account=base["bank_ta"],
        issued_check_account=base["issued_checks_ta"],
        created_by=base["user"],
    )
    assert check.pk is not None
    assert check.status == Check.Status.ISSUED
    assert check.direction == Check.Direction.ISSUED
    assert check.payment_account == base["bank_ta"]
    assert check.issued_check_account == base["issued_checks_ta"]
    assert check.receipt_movement is not None
    assert check.receipt_movement.movement_type == TreasuryMovement.Type.OUTBOUND
    assert check.receipt_movement.from_account == base["issued_checks_ta"]


@pytest.mark.django_db
def test_issue_without_payment_account_raises(base):
    """Sin payment_account → error."""
    with pytest.raises(ValidationError, match="payment_account"):
        CheckService.issue(
            bank_id=base["bank"].id,
            check_number="P-0002",
            amount=Decimal("50000"),
            issue_date="2026-06-01",
            due_date="2026-07-01",
        )


@pytest.mark.django_db
def test_mark_cashed_transfers_to_bank(base):
    """mark_cashed() genera TRANSFER pasivo→banco y status=CLEARED."""
    check = CheckService.issue(
        bank_id=base["bank"].id,
        check_number="P-0003",
        amount=Decimal("150000"),
        issue_date="2026-06-01",
        due_date="2026-07-01",
        counterparty_id=base["supplier"].id,
        payment_account=base["bank_ta"],
        issued_check_account=base["issued_checks_ta"],
    )
    initial_count = TreasuryMovement.objects.count()
    check = CheckService.mark_cashed(check, date="2026-07-01", created_by=base["user"])

    assert check.status == Check.Status.CLEARED
    assert check.cleared_at is not None
    # 1 movement: TRANSFER pasivo→banco
    assert TreasuryMovement.objects.count() == initial_count + 1
    transfer = TreasuryMovement.objects.order_by("-id").first()
    assert transfer.movement_type == TreasuryMovement.Type.TRANSFER
    assert transfer.from_account == base["issued_checks_ta"]
    assert transfer.to_account == base["bank_ta"]


@pytest.mark.django_db
def test_void_issued_check_reverses(base):
    """Anular un cheque ISSUED genera reversa INBOUND al pasivo."""
    check = CheckService.issue(
        bank_id=base["bank"].id,
        check_number="P-0004",
        amount=Decimal("100000"),
        issue_date="2026-06-01",
        due_date="2026-07-01",
        counterparty_id=base["supplier"].id,
        payment_account=base["bank_ta"],
        issued_check_account=base["issued_checks_ta"],
    )
    initial_count = TreasuryMovement.objects.count()
    check = CheckService.void(check, notes="Proveedor canceló")

    assert check.status == Check.Status.VOIDED
    assert TreasuryMovement.objects.count() == initial_count + 1
    reversal = TreasuryMovement.objects.order_by("-id").first()
    assert reversal.movement_type == TreasuryMovement.Type.INBOUND
    assert reversal.to_account == base["issued_checks_ta"]


@pytest.mark.django_db
def test_mark_cashed_on_received_check_raises(base):
    """mark_cashed no aplica a cheques recibidos."""
    check = _receive(base, "0007000", "50000")
    with pytest.raises(ValidationError, match="direction=ISSUED"):
        CheckService.mark_cashed(check)


@pytest.mark.django_db
def test_issue_creates_valid_check(base):
    """El check emitido tiene campos correctos."""
    check = CheckService.issue(
        bank_id=base["bank"].id,
        check_number="P-0005",
        amount=Decimal("80000"),
        issue_date="2026-06-01",
        due_date="2026-08-01",
        counterparty_id=base["supplier"].id,
        drawer_name="Mi Empresa SpA",
        payment_account=base["bank_ta"],
        issued_check_account=base["issued_checks_ta"],
    )
    assert check.check_number == "P-0005"
    assert check.drawer_name == "Mi Empresa SpA"
    assert check.amount == Decimal("80000")


@pytest.mark.django_db
def test_void_issued_check_from_cleared_raises(base):
    """No se puede anular un cheque que ya está CLEARED."""
    check = CheckService.issue(
        bank_id=base["bank"].id,
        check_number="P-0006",
        amount=Decimal("60000"),
        issue_date="2026-06-01",
        due_date="2026-07-01",
        payment_account=base["bank_ta"],
        issued_check_account=base["issued_checks_ta"],
    )
    check = CheckService.mark_cashed(check, date="2026-07-01")
    assert check.status == Check.Status.CLEARED
    with pytest.raises(ValidationError):
        CheckService.void(check)


# ─────────────────────────────────────────────────────────────────────────
# F4.2: Endoso de cheques recibidos
# ─────────────────────────────────────────────────────────────────────────
# Removido en ADR-0039. El estado ENDORSED, los campos endorsed_to y
# endorsement_movement, y el servicio CheckService.endorse ya no existen.
# Si se reintroduce el endoso, escribir los tests en un nuevo bloque F4.2-bis
# con un ADR explícito que justifique la reversión.

# ─────────────────────────────────────────────────────────────────────────
# ADR-0040: Democión de factura/orden al protestar o anular un cheque
# ─────────────────────────────────────────────────────────────────────────


@pytest.fixture
def posted_invoice(base):
    """Crea una Invoice POSTED de 119.000 CLP (100.000 neto + 19% IVA)."""
    from billing.models import Invoice

    customer = Contact.objects.create(
        name="Cliente Cheque",
        tax_id="11111111-1",
        roles=["CUSTOMER"],
        email="cli@cheques.cl",
    )
    return Invoice.objects.create(
        dte_type=Invoice.DTEType.FACTURA,
        number="F-100",
        status=Invoice.Status.POSTED,
        contact=customer,
        total_net=Decimal("100000"),
        total_tax=Decimal("19000"),
        total=Decimal("119000"),
    )


@pytest.mark.django_db
def test_bounce_demotes_invoice_to_posted(base, posted_invoice):
    """
    bounce() sobre un cheque que pagó una factura debe demover la factura
    a POSTED (matemática firmada: INBOUND 119k - OUTBOUND 119k = 0 < 119k).
    """
    check = _receive(
        base,
        "0008001",
        "119000",
        invoice_id=posted_invoice.id,
        created_by=base["user"],
    )
    check = CheckService.deposit(check, base["bank_ta"], created_by=base["user"])
    posted_invoice.refresh_from_db()
    assert posted_invoice.status == posted_invoice.Status.PAID

    CheckService.bounce(check, notes="Sin fondos", created_by=base["user"])

    posted_invoice.refresh_from_db()
    assert posted_invoice.status == posted_invoice.Status.POSTED


@pytest.mark.django_db
def test_void_demotes_invoice_to_posted(base, posted_invoice):
    """
    void() sobre un cheque en cartera que pagó una factura debe demover la
    factura a POSTED.
    """
    check = _receive(
        base,
        "0008002",
        "119000",
        invoice_id=posted_invoice.id,
        created_by=base["user"],
    )
    posted_invoice.refresh_from_db()
    assert posted_invoice.status == posted_invoice.Status.PAID

    CheckService.void(check, notes="Anulado por operador")

    posted_invoice.refresh_from_db()
    assert posted_invoice.status == posted_invoice.Status.POSTED


@pytest.mark.django_db
def test_bounce_without_invoice_is_noop(base):
    """
    bounce() sobre un cheque sin invoice_id ni sale_order_id no debe
    explotar ni afectar el estado de documentos.
    """
    check = _receive(base, "0008003", "50000", created_by=base["user"])
    check = CheckService.deposit(check, base["bank_ta"], created_by=base["user"])

    bounced = CheckService.bounce(check, created_by=base["user"])
    assert bounced.status == Check.Status.BOUNCED


# ─────────────────────────────────────────────────────────────────────────
# F4.3: Chequera con folios correlativos
# ─────────────────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_checkbook_creation(base):
    """Crear una chequera con rango válido."""
    cb = Checkbook.objects.create(
        bank_account=base["bank_ta"],
        bank=base["bank"],
        start_folio=1,
        end_folio=100,
        next_folio=1,
    )
    assert cb.available_folios() == 100
    assert not cb.is_exhausted()


@pytest.mark.django_db
def test_checkbook_invalid_range_raises(db):
    """Rango start > end → error."""
    bank = Bank.objects.create(name="BancoX", code="BX1")
    acc = Account.objects.create(name="Banco X", code="1.1.01.090", account_type=AccountType.ASSET)
    ta = TreasuryAccount.objects.create(
        name="Banco X",
        account=acc,
        account_type=TreasuryAccount.Type.CHECKING,
        bank=bank,
        account_number="456",
    )
    with pytest.raises(ValidationError):
        cb = Checkbook(bank_account=ta, bank=bank, start_folio=100, end_folio=1, next_folio=1)
        cb.full_clean()


@pytest.mark.django_db
def test_checkbook_exhausted(base):
    """Cuando next_folio > end_folio, available_folios = 0."""
    cb = Checkbook.objects.create(
        bank_account=base["bank_ta"],
        bank=base["bank"],
        start_folio=1,
        end_folio=5,
        next_folio=6,
        status=Checkbook.Status.EXHAUSTED,
    )
    assert cb.available_folios() == 0
    assert cb.is_exhausted()


@pytest.mark.django_db
def test_checkbook_closed_no_available(base):
    """Chequera cerrada no tiene folios disponibles."""
    cb = Checkbook.objects.create(
        bank_account=base["bank_ta"],
        bank=base["bank"],
        start_folio=1,
        end_folio=50,
        next_folio=10,
        status=Checkbook.Status.CLOSED,
    )
    assert cb.available_folios() == 0


@pytest.mark.django_db
def test_issue_with_checkbook(base):
    """Emitir cheque con chequera asigna el folio y crea Check."""
    cb = Checkbook.objects.create(
        bank_account=base["bank_ta"],
        bank=base["bank"],
        start_folio=1000,
        end_folio=1100,
        next_folio=1000,
    )
    check = CheckService.issue(
        bank_id=base["bank"].id,
        amount=Decimal("50000"),
        issue_date="2026-06-01",
        due_date="2026-07-01",
        counterparty_id=base["supplier"].id,
        payment_account=base["bank_ta"],
        issued_check_account=base["issued_checks_ta"],
        checkbook=cb,
        created_by=base["user"],
    )
    assert check.checkbook == cb
    assert check.check_number == "1000"
    cb.refresh_from_db()
    assert cb.next_folio == 1001


@pytest.mark.django_db
def test_issue_duplicate_check_number_same_bank_raises(base):
    """Número de cheque duplicado en el mismo banco → error."""
    CheckService.issue(
        bank_id=base["bank"].id,
        check_number="5001",
        amount=Decimal("30000"),
        issue_date="2026-06-01",
        due_date="2026-07-01",
        payment_account=base["bank_ta"],
        issued_check_account=base["issued_checks_ta"],
    )
    with pytest.raises(ValidationError, match="ya existe"):
        CheckService.issue(
            bank_id=base["bank"].id,
            check_number="5001",
            amount=Decimal("25000"),
            issue_date="2026-06-01",
            due_date="2026-07-01",
            payment_account=base["bank_ta"],
            issued_check_account=base["issued_checks_ta"],
        )
