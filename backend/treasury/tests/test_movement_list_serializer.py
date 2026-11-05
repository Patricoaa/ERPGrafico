import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from contacts.models import Contact
from treasury.models import TreasuryAccount, TreasuryMovement


@pytest.fixture
def api_client(db):
    user = get_user_model().objects.create_superuser(
        username="treasury-list-user", password="password"
    )
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def movement_data(db):
    contact = Contact.objects.create(name="Proveedor Uno", tax_id="11111111-1")
    account = TreasuryAccount.objects.create(
        name="Caja Principal", currency="CLP", account_type="CASH"
    )
    return contact, account


@pytest.mark.django_db
def test_list_movements_exposes_counterparty_and_treasury_accounts(api_client, movement_data):
    """The movement card/table renders origin → destination; the list must carry both sides."""
    contact, account = movement_data

    outbound = TreasuryMovement.objects.create(
        movement_type="OUTBOUND",
        payment_method="TRANSFER",
        amount=1000,
        from_account=account,
        contact=contact,
    )
    inbound = TreasuryMovement.objects.create(
        movement_type="INBOUND",
        payment_method="TRANSFER",
        amount=2000,
        to_account=account,
        contact=contact,
    )

    response = api_client.get("/api/treasury/movements/")

    assert response.status_code == 200
    rows = {row["id"]: row for row in response.data["results"]}

    assert rows[outbound.id]["from_account"] == account.id
    assert rows[outbound.id]["from_account_name"] == "Caja Principal"
    assert rows[outbound.id]["to_account"] is None
    assert rows[outbound.id]["to_account_name"] is None
    assert rows[outbound.id]["partner_id"] == contact.id
    assert rows[outbound.id]["partner_name"] == "Proveedor Uno"

    assert rows[inbound.id]["to_account"] == account.id
    assert rows[inbound.id]["to_account_name"] == "Caja Principal"
    assert rows[inbound.id]["from_account_name"] is None
    assert rows[inbound.id]["partner_name"] == "Proveedor Uno"


@pytest.mark.django_db
def test_list_movements_without_contact_uses_particular(api_client, movement_data):
    _, account = movement_data

    movement = TreasuryMovement.objects.create(
        movement_type="OUTBOUND",
        payment_method="CASH",
        amount=500,
        from_account=account,
    )

    response = api_client.get("/api/treasury/movements/")
    row = next(r for r in response.data["results"] if r["id"] == movement.id)

    assert row["partner_name"] == "Particular"
    assert row["partner_id"] is None
