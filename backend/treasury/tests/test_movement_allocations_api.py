"""The allocations actions referenced a serializer that was never imported: they answered 500."""

from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from accounting.models import Account, AccountType
from treasury.models import TreasuryAccount, TreasuryMovement

User = get_user_model()


@pytest.mark.django_db
def test_allocations_endpoint_answers():
    Account.objects.get_or_create(
        code=Account.CASH_GROUP_CODE, defaults={"name": "Efectivo y Equivalentes", "account_type": AccountType.ASSET}
    )
    ledger = Account.objects.create(name="Caja", code="1.1.01.960", account_type=AccountType.ASSET)
    cash = TreasuryAccount.objects.create(name="Caja", account=ledger, account_type=TreasuryAccount.Type.CASH)
    movement = TreasuryMovement.objects.create(
        movement_type=TreasuryMovement.Type.INBOUND, to_account=cash, amount=Decimal("100")
    )
    client = APIClient()
    client.force_authenticate(user=User.objects.create_superuser(username="viewer", password="x"))

    response = client.get(f"/api/treasury/movements/{movement.pk}/allocations/")

    assert response.status_code == 200
    assert response.json() == []
