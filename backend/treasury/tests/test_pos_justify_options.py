"""ADR-0128: el cajero lee los motivos y cuentas de justificación sin permisos de contabilidad
ni de tesorería; el endpoint no filtra datos contables y no crece en consultas por cuenta."""

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.management import call_command
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

URL = "/api/treasury/pos-sessions/justify_options/"


@pytest.fixture
def ventas_client(db):
    call_command("sync_permissions", verbosity=0)
    user = get_user_model().objects.create_user(username="ventas_justify", password="x")
    user.groups.add(Group.objects.get(name="Ventas"))
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _account(name, account_type, is_active=True):
    from treasury.models import Bank, TreasuryAccount

    extra = {}
    if account_type == TreasuryAccount.Type.CHECKING:
        extra = {"bank": Bank.objects.get_or_create(name="Banco Test", defaults={"code": "BT"})[0], "account_number": "123"}
    return TreasuryAccount.objects.create(name=name, account_type=account_type, is_active=is_active, **extra)


@pytest.mark.django_db
def test_ventas_reads_justify_options_without_open_session(ventas_client):
    res = ventas_client.get(URL)
    assert res.status_code == 200
    assert set(res.data["reasons"]) == {
        "COUNTING_ERROR", "SYSTEM_ERROR", "ROUNDING", "TIP", "OTHER_IN",
        "THEFT", "PARTNER_WITHDRAWAL", "CASHBACK", "OTHER_OUT",
        "UNEXPLAINED_GAIN", "UNEXPLAINED_LOSS",
    }
    assert isinstance(res.data["accounts"], list)


@pytest.mark.django_db
def test_ventas_still_cannot_read_accounting_settings(ventas_client):
    assert ventas_client.get("/api/accounting/settings/current/").status_code == 403


@pytest.mark.django_db
def test_accounts_are_active_cash_or_bank_only_with_minimal_fields(ventas_client):
    from treasury.models import TreasuryAccount

    cash = _account("Caja chica", TreasuryAccount.Type.CASH)
    bank = _account("Banco", TreasuryAccount.Type.CHECKING)
    _account("Caja archivada", TreasuryAccount.Type.CASH, is_active=False)
    _account("Puente", TreasuryAccount.Type.BRIDGE)

    rows = ventas_client.get(URL).data["accounts"]
    ids = {r["id"] for r in rows}
    assert {cash.id, bank.id} <= ids
    assert all(r["name"] not in ("Caja archivada", "Puente") for r in rows)
    assert all(set(r) == {"id", "name", "account_type", "current_balance"} for r in rows)


@pytest.mark.django_db
def test_reasons_follow_accounting_settings(ventas_client):
    from accounting.services import AccountingService

    settings = AccountingService.get_or_create_current_settings()
    settings.pos_theft_account = None
    settings.save()
    assert ventas_client.get(URL).data["reasons"]["THEFT"] is False


@pytest.mark.django_db
def test_query_count_does_not_grow_with_accounts(ventas_client):
    from treasury.models import TreasuryAccount

    _account("A", TreasuryAccount.Type.CASH)
    ventas_client.get(URL)  # calienta settings
    with CaptureQueriesContext(connection) as few:
        ventas_client.get(URL)
    for i in range(5):
        _account(f"Caja {i}", TreasuryAccount.Type.CASH)
    with CaptureQueriesContext(connection) as many:
        ventas_client.get(URL)
    assert len(many) == len(few)


@pytest.mark.django_db
def test_anonymous_cannot_read_justify_options():
    assert APIClient().get(URL).status_code in (401, 403)


@pytest.mark.django_db
def test_bank_balance_is_not_exposed(ventas_client):
    from treasury.models import TreasuryAccount

    bank = _account("Banco", TreasuryAccount.Type.CHECKING)
    row = next(r for r in ventas_client.get(URL).data["accounts"] if r["id"] == bank.id)
    assert row["current_balance"] is None
