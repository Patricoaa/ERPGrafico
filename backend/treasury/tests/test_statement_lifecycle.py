"""Ciclo de vida de la cartola bancaria: edición, borrado, descarga e historial.

Reglas (docs/20-contracts/state-map.md, deletion-policy.md):
- Sin edición: la cartola no se modifica después del import.
- Borrado solo en DRAFT sin líneas conciliadas ni excluidas.
"""

from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from rest_framework.test import APIClient

from accounting.models import Account
from treasury.models import BankStatement, BankStatementLine, TreasuryAccount


@pytest.fixture
def user(db):
    return get_user_model().objects.create_superuser(username="statement-lifecycle", password="password")


@pytest.fixture
def api(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def account(db):
    ledger = Account.objects.create(name="Banco Lifecycle", code="1.1.01.777", account_type="ASSET")
    return TreasuryAccount.objects.create(
        name="Cuenta Lifecycle", account_type="BANK", currency="CLP", account=ledger
    )


def _statement(user, account, status="DRAFT", file_name=None):
    stmt = BankStatement.objects.create(
        treasury_account=account,
        statement_date=date(2026, 3, 31),
        opening_balance=Decimal("1000.00"),
        closing_balance=Decimal("1500.00"),
        imported_by=user,
        status=status,
    )
    if file_name:
        stmt.file.save(file_name, ContentFile(b"fecha;glosa;monto\n"), save=True)
    return stmt


def _line(stmt, status):
    return BankStatementLine.objects.create(
        statement=stmt,
        line_number=1,
        transaction_date=date(2026, 3, 2),
        description="Transferencia",
        debit=Decimal("0.00"),
        credit=Decimal("500.00"),
        balance=Decimal("1500.00"),
        reconciliation_status=status,
    )


# ── Sin edición ──────────────────────────────────────────────────────────────

@pytest.mark.django_db
@pytest.mark.parametrize("method", ["patch", "put"])
def test_statement_cannot_be_edited_through_api(api, user, account, method):
    """La edición de cartolas se eliminó: PUT/PATCH no existen en el endpoint."""
    stmt = _statement(user, account)
    res = getattr(api, method)(f"/api/treasury/statements/{stmt.id}/", {"notes": "x"}, format="json")
    assert res.status_code == 405
    stmt.refresh_from_db()
    assert stmt.notes == ""


# ── Borrado ──────────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_untouched_draft_can_be_deleted(api, user, account):
    stmt = _statement(user, account)
    _line(stmt, "UNRECONCILED")
    res = api.delete(f"/api/treasury/statements/{stmt.id}/")
    assert res.status_code == 204
    assert not BankStatement.objects.filter(id=stmt.id).exists()
    assert not BankStatementLine.objects.filter(statement_id=stmt.id).exists()


@pytest.mark.django_db
@pytest.mark.parametrize("line_status", ["EXCLUDED", "MATCHED", "RECONCILED"])
def test_draft_with_worked_lines_cannot_be_deleted(api, user, account, line_status):
    stmt = _statement(user, account)
    _line(stmt, line_status)
    res = api.delete(f"/api/treasury/statements/{stmt.id}/")
    assert res.status_code == 400
    assert BankStatement.objects.filter(id=stmt.id).exists()


@pytest.mark.django_db
@pytest.mark.parametrize("status", ["CONFIRMED", "CANCELLED"])
def test_confirmed_or_cancelled_statement_cannot_be_deleted(api, user, account, status):
    stmt = _statement(user, account, status=status)
    res = api.delete(f"/api/treasury/statements/{stmt.id}/")
    assert res.status_code == 400
    assert BankStatement.objects.filter(id=stmt.id).exists()


# ── Descarga y historial ─────────────────────────────────────────────────────

@pytest.mark.django_db
def test_download_returns_original_attachment(api, user, account):
    stmt = _statement(user, account, file_name="cartola-marzo.csv")
    res = api.get(f"/api/treasury/statements/{stmt.id}/download/")
    assert res.status_code == 200
    assert "attachment" in res["Content-Disposition"]
    assert "cartola-marzo.csv" in res["Content-Disposition"]
    assert b"".join(res.streaming_content).startswith(b"fecha;glosa")


@pytest.mark.django_db
def test_download_without_file_is_404(api, user, account):
    stmt = _statement(user, account)
    res = api.get(f"/api/treasury/statements/{stmt.id}/download/")
    assert res.status_code == 404


@pytest.mark.django_db
def test_history_endpoint_is_exposed(api, user, account):
    stmt = _statement(user, account)
    res = api.get(f"/api/treasury/statements/{stmt.id}/history/")
    assert res.status_code == 200


@pytest.mark.django_db
def test_list_exposes_state_and_touched_lines(api, user, account):
    untouched = _statement(user, account)
    _line(untouched, "UNRECONCILED")
    worked = _statement(user, account)
    _line(worked, "EXCLUDED")
    res = api.get("/api/treasury/statements/")
    assert res.status_code == 200
    rows = {row["id"]: row for row in res.json()["results"]}
    assert rows[untouched.id]["state"] == "DRAFT"
    assert rows[untouched.id]["touched_lines"] == 0
    assert rows[worked.id]["touched_lines"] == 1
    assert rows[worked.id]["state_display"]
