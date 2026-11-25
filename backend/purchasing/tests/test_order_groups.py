"""`GET /api/purchasing/orders/groups/` (ADR-0158 §7): date, status and receiving groups list
exactly their rows; dates follow the list's default order (newest first)."""

from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from contacts.models import Contact
from purchasing.models import PurchaseOrder

pytestmark = pytest.mark.ci_gate

User = get_user_model()
URL = "/api/purchasing/orders/"


@pytest.fixture
def client(db):
    api = APIClient()
    api.force_authenticate(user=User.objects.create_superuser(username="grouper", password="x"))
    return api


@pytest.fixture
def orders(db):
    supplier = Contact.objects.create(name="Proveedor", tax_id="22222222-2")
    for i, (day, status, total) in enumerate([(date(2026, 11, 2), "DRAFT", "10"), (date(2026, 11, 3), "CONFIRMED", "20"), (date(2026, 11, 3), "CONFIRMED", "5")]):
        order = PurchaseOrder.objects.create(number=f"PO-{i}", supplier=supplier, status=status, date=day, total=0, total_net=0, total_tax=0)
        PurchaseOrder.objects.filter(pk=order.pk).update(total=Decimal(total))


@pytest.mark.parametrize("group_by", ["date", "status", "receiving"])
def test_groups_list_exactly_their_rows(client, orders, group_by):
    groups = client.get(f"{URL}groups/", {"group_by": group_by}).json()

    assert sum(g["count"] for g in groups) == 3
    for group in groups:
        assert client.get(URL, group["params"]).json()["count"] == group["count"]


def test_date_groups_newest_first_with_totals(client, orders):
    groups = client.get(f"{URL}groups/", {"group_by": "date"}).json()

    assert [g["key"] for g in groups] == ["2026-11-03", "2026-11-02"]
    assert Decimal(groups[0]["aggregates"]["total"]) == Decimal("25")
