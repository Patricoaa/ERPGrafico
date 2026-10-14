"""
INT-16 (auditoría documental): el endpoint `register_transfer` llamaba a
`TreasuryService.register_internal_transfer`, eliminado en un refactor → 400 con
AttributeError en cada traspaso.
"""

import uuid
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from accounting.models import Account, AccountType
from treasury.models import TreasuryAccount, TreasuryMovement

User = get_user_model()


@pytest.fixture
def env(db):
    def cash(name, code):
        acc = Account.objects.create(name=name, code=code, account_type=AccountType.ASSET)
        return TreasuryAccount.objects.create(name=name, account=acc, account_type=TreasuryAccount.Type.CASH)

    client = APIClient()
    client.force_authenticate(User.objects.create_superuser(username="int16", password="x", email="i@x.cl"))
    return {"client": client, "caja": cash("Caja", "1.1.01.016"), "banco": cash("Banco", "1.1.02.016")}


@pytest.mark.django_db
def test_register_transfer_moves_money_between_accounts(env):
    caja, banco = env["caja"], env["banco"]
    caja0, banco0 = caja.account.balance, banco.account.balance

    res = env["client"].post(
        "/api/treasury/dashboard/register_transfer/",
        {"from_account_id": caja.id, "to_account_id": banco.id, "amount": 300,
         "notes": "depósito", "date": "2026-10-14T10:00:00"},
        format="json",
        HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()),
    )

    assert res.status_code == 200, res.data
    movement = TreasuryMovement.objects.get(pk=res.data["id"])
    assert movement.movement_type == TreasuryMovement.Type.TRANSFER
    assert str(movement.date) == "2026-10-14"
    assert movement.notes == "depósito"
    caja.account.refresh_from_db()
    banco.account.refresh_from_db()
    assert caja.account.balance == caja0 - Decimal("300")
    assert banco.account.balance == banco0 + Decimal("300")


@pytest.mark.django_db
def test_register_transfer_rejects_same_account(env):
    res = env["client"].post(
        "/api/treasury/dashboard/register_transfer/",
        {"from_account_id": env["caja"].id, "to_account_id": env["caja"].id, "amount": 10, "date": "2026-10-14"},
        format="json",
        HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()),
    )
    assert res.status_code == 400
    assert "misma" in res.data["error"]
