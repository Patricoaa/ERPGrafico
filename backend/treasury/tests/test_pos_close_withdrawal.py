"""ADR-0129: al cerrar, el efectivo sale como traspaso (a otra caja o banco) o como retiro con
motivo (sale de tesorería); se registra en la misma transacción, después del arqueo y antes de
marcar la sesión cerrada, y se valida antes de tocar nada."""

from decimal import Decimal
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError

from treasury.models import POSSession, POSTerminal, TreasuryAccount, TreasuryMovement
from treasury.pos_service import POSService

User = get_user_model()


@pytest.fixture
def pos_account(db):
    from accounting.models import Account, AccountType

    acc = Account.objects.create(code="1.1.01.200", name="Caja POS", account_type=AccountType.ASSET)
    return TreasuryAccount.objects.create(name="Caja POS", account_type="CASH", account=acc)


@pytest.fixture
def safe(db):
    return TreasuryAccount.objects.create(name="Caja Fuerte", account_type="CASH")


@pytest.fixture
def partner(db):
    from contacts.models import Contact

    return Contact.objects.create(name="Socia Uno", tax_id="11111111-1", is_partner=True)


@pytest.fixture
def cashier(db):
    return User.objects.create_user(username="closer", password="x")


@pytest.fixture
def session(cashier, pos_account):
    terminal = POSTerminal.objects.create(name="Caja W", code="CAJA-W", default_treasury_account=pos_account)
    return POSService.open_session(user=cashier, terminal_id=terminal.id, opening_balance=Decimal("0"))


def _close(session, user, **kw):
    # Arqueo exacto: el esperado (0 en la fixture) se fuerza al contado para aislar el retiro.
    with patch.object(POSSession, "expected_cash", new=Decimal("50000")):
        return POSService.close_session(session=session, actual_cash=Decimal("50000"), user=user, **kw)


@pytest.mark.django_db
def test_transfer_on_close_goes_to_destination_inside_session(session, cashier, safe):
    with patch("treasury.pos_service.TreasuryService.create_movement") as create:
        closed, _ = _close(session, cashier, withdrawal_amount=Decimal("30000"), cash_destination_id=safe.id)
    assert closed.status == "CLOSED"
    kwargs = create.call_args.kwargs
    assert kwargs["movement_type"] == TreasuryMovement.Type.TRANSFER
    assert kwargs["to_account"] == safe
    assert kwargs["pos_session"] == session
    assert kwargs["justify_reason"] == "RETIREMENT"


@pytest.mark.django_db
def test_reason_withdrawal_is_outbound_with_reason(session, cashier, partner):
    with patch("treasury.pos_service.TreasuryService._get_reason_account", return_value=object()), \
            patch("treasury.pos_service.TreasuryService.create_movement") as create:
        _close(session, cashier, withdrawal_amount=Decimal("10000"), withdrawal_kind="PARTNER_WITHDRAWAL",
               withdrawal_partner_id=partner.id)
    kwargs = create.call_args.kwargs
    assert kwargs["movement_type"] == TreasuryMovement.Type.OUTBOUND
    assert kwargs["justify_reason"] == "PARTNER_WITHDRAWAL"
    assert kwargs["to_account"] is None
    assert kwargs["partner"] == partner


@pytest.mark.django_db
@pytest.mark.parametrize("kw, message", [
    ({"withdrawal_amount": Decimal("60000"), "cash_destination_id": None}, "más que el efectivo contado"),
    ({"withdrawal_amount": Decimal("1000")}, "cuenta de destino"),
    ({"withdrawal_amount": Decimal("1000"), "withdrawal_kind": "BOGUS"}, "inválido"),
])
def test_invalid_withdrawal_rejected_before_closing(session, cashier, kw, message):
    with pytest.raises(ValidationError, match=message):
        _close(session, cashier, **kw)
    session.refresh_from_db()
    assert session.status == "OPEN"
    assert not hasattr(session, "audit")


@pytest.mark.django_db
def test_transfer_to_same_box_rejected(session, cashier, pos_account):
    with pytest.raises(ValidationError, match="misma caja"):
        _close(session, cashier, withdrawal_amount=Decimal("1000"), cash_destination_id=pos_account.id)


@pytest.mark.django_db
def test_reason_without_configured_account_rejected(session, cashier):
    with patch("treasury.pos_service.TreasuryService._get_reason_account", return_value=None):
        with pytest.raises(ValidationError, match="no configurada"):
            _close(session, cashier, withdrawal_amount=Decimal("1000"), withdrawal_kind="OTHER_OUT")


@pytest.mark.django_db
@pytest.mark.parametrize("partner_id_kind, message", [("none", "Elija el socio"), ("not_partner", "Socio no encontrado")])
def test_partner_withdrawal_requires_a_valid_partner(session, cashier, partner_id_kind, message):
    from contacts.models import Contact

    pid = None if partner_id_kind == "none" else Contact.objects.create(name="Cliente", tax_id="22222222-2", is_partner=False).id
    with patch("treasury.pos_service.TreasuryService._get_reason_account", return_value=object()):
        with pytest.raises(ValidationError, match=message):
            _close(session, cashier, withdrawal_amount=Decimal("1000"), withdrawal_kind="PARTNER_WITHDRAWAL",
                   withdrawal_partner_id=pid)
    session.refresh_from_db()
    assert session.status == "OPEN"


@pytest.mark.django_db
def test_other_out_ignores_partner(session, cashier, partner):
    with patch("treasury.pos_service.TreasuryService._get_reason_account", return_value=object()), \
            patch("treasury.pos_service.TreasuryService.create_movement") as create:
        _close(session, cashier, withdrawal_amount=Decimal("1000"), withdrawal_kind="OTHER_OUT",
               withdrawal_partner_id=partner.id)
    assert create.call_args.kwargs["partner"] is None
