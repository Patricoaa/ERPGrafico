"""La configuración del POS no se modifica ni se archiva mientras hay una sesión abierta."""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from accounting.models import Account, AccountingSettings, AccountType
from treasury.models import PaymentMethod, POSSession, POSTerminal, TreasuryAccount
from treasury.pos_lock import annotate_pos_lock, is_locked_by_open_session
from treasury.tests.helpers import make_pos_session

User = get_user_model()


@pytest.fixture
def pos(db):
    user = User.objects.create_superuser(username="admin", password="x", email="a@a.cl")
    ledger = Account.objects.create(name="Caja chica", code="1.1.01.901", account_type=AccountType.ASSET)
    other_ledger = Account.objects.create(name="Otra", code="1.1.01.902", account_type=AccountType.ASSET)
    cash = TreasuryAccount.objects.create(name="Caja POS", account_type=TreasuryAccount.Type.CASH, account=ledger)
    elsewhere = TreasuryAccount.objects.create(name="Caja bodega", account_type=TreasuryAccount.Type.CASH, account=other_ledger)
    method = PaymentMethod.objects.create(name="Efectivo", method_type="CASH", treasury_account=cash)
    unrelated = PaymentMethod.objects.create(name="Efectivo bodega", method_type="CASH", treasury_account=elsewhere)
    terminal = POSTerminal.objects.create(name="Mostrador", code="POS-01", default_treasury_account=cash)
    terminal.allowed_payment_methods.add(method)
    terminal.allowed_treasury_accounts.add(cash)
    client = APIClient()
    client.force_authenticate(user)
    return {
        "user": user, "client": client, "terminal": terminal, "cash": cash, "elsewhere": elsewhere,
        "method": method, "unrelated": unrelated, "ledger": ledger, "other_ledger": other_ledger,
    }


def _patch(client, url, payload):
    return client.patch(url, payload, format="json")


@pytest.mark.django_db
def test_nothing_is_locked_without_an_open_session(pos):
    for obj in (pos["terminal"], pos["method"], pos["cash"], pos["ledger"]):
        assert is_locked_by_open_session(obj) is False
    r = _patch(pos["client"], f"/api/treasury/pos-terminals/{pos['terminal'].pk}/", {"location": "Entrada"})
    assert r.status_code == 200, r.content


@pytest.mark.django_db
def test_open_session_locks_terminal_methods_accounts_and_ledger(pos):
    make_pos_session(pos["user"], terminal=pos["terminal"], treasury_account=pos["cash"])

    assert is_locked_by_open_session(pos["terminal"])
    assert is_locked_by_open_session(pos["method"])
    assert is_locked_by_open_session(pos["cash"])
    assert is_locked_by_open_session(pos["ledger"])
    # Lo que ninguna Caja POS con sesión abierta usa, sigue editable.
    assert not is_locked_by_open_session(pos["unrelated"])
    assert not is_locked_by_open_session(pos["elsewhere"])
    assert not is_locked_by_open_session(pos["other_ledger"])


@pytest.mark.django_db
def test_api_rejects_edit_and_archive_while_open_and_allows_after_close(pos):
    session = make_pos_session(pos["user"], terminal=pos["terminal"], treasury_account=pos["cash"])
    client = pos["client"]
    targets = [
        (f"/api/treasury/pos-terminals/{pos['terminal'].pk}/", {"location": "Otra"}),
        (f"/api/treasury/payment-methods/{pos['method'].pk}/", {"name": "Efectivo 2"}),
        (f"/api/treasury/accounts/{pos['cash'].pk}/", {"name": "Caja 2"}),
        (f"/api/accounting/accounts/{pos['ledger'].pk}/", {"name": "Caja chica 2"}),
        (f"/api/treasury/pos-terminals/{pos['terminal'].pk}/", {"is_active": False}),
    ]
    for url, payload in targets:
        r = _patch(client, url, payload)
        assert r.status_code >= 400, (url, r.status_code, r.content)
        assert "sesión abierta" in r.json()["error"]["message"], (url, r.content)

    ok = _patch(client, f"/api/treasury/payment-methods/{pos['unrelated'].pk}/", {"name": "Efectivo bodega 2"})
    assert ok.status_code == 200, ok.content

    session.status = POSSession.Status.CLOSED
    session.save()
    for url, payload in targets[:4]:
        r = _patch(client, url, payload)
        assert r.status_code == 200, (url, r.status_code, r.content)


@pytest.mark.django_db
def test_pos_settings_accounts_are_locked_only_while_a_session_is_open(pos):
    loss = pos["other_ledger"]
    settings = AccountingSettings.get_solo()
    settings.pos_cash_difference_loss_account = loss
    settings.save()

    assert not is_locked_by_open_session(loss)
    make_pos_session(pos["user"], terminal=pos["terminal"], treasury_account=pos["cash"])
    assert is_locked_by_open_session(loss)


@pytest.mark.django_db
def test_listing_flag_is_precomputed_without_extra_queries(pos, django_assert_num_queries):
    make_pos_session(pos["user"], terminal=pos["terminal"], treasury_account=pos["cash"])
    rows = list(annotate_pos_lock(PaymentMethod.objects.order_by("name")))
    assert {r.name: r._pos_session_locked for r in rows} == {"Efectivo": True, "Efectivo bodega": False}
    with django_assert_num_queries(0):
        assert [is_locked_by_open_session(r) for r in rows] == [True, False]
