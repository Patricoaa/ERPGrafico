"""`GET /api/production/orders/groups/` (ADR-0158 §7): status and stage groups list their rows."""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from production.models import WorkOrder

pytestmark = pytest.mark.ci_gate

User = get_user_model()
URL = "/api/production/orders/"


@pytest.fixture
def client(db):
    api = APIClient()
    api.force_authenticate(user=User.objects.create_superuser(username="grouper", password="x"))
    return api


@pytest.mark.parametrize("group_by", ["status", "current_stage"])
def test_groups_list_exactly_their_rows(client, group_by):
    for status in ["DRAFT", "DRAFT", "IN_PROGRESS"]:
        WorkOrder.objects.create(description="OT", status=status)

    groups = client.get(f"{URL}groups/", {"group_by": group_by}).json()

    assert sum(g["count"] for g in groups) == 3
    assert all(g["label"] for g in groups)
    for group in groups:
        assert client.get(URL, group["params"]).json()["count"] == group["count"]


def test_customer_groups_follow_the_shown_customer(client):
    """The customer is derived (stage data override > sale order > contact > internal), yet groups and
    their params match the list."""
    from contacts.models import Contact

    acme = Contact.objects.create(name="Acme", tax_id="11111111-1")
    WorkOrder.objects.create(description="OT", related_contact=acme)
    WorkOrder.objects.create(description="OT", related_contact=acme, stage_data={"contact_name": "Beta"})
    WorkOrder.objects.create(description="OT")

    groups = {g["key"]: g for g in client.get(f"{URL}groups/", {"group_by": "customer"}).json()}

    assert {k: g["count"] for k, g in groups.items()} == {"Acme": 1, "Beta": 1, "Manual / Interno": 1}
    for group in groups.values():
        assert client.get(URL, group["params"]).json()["count"] == group["count"]
