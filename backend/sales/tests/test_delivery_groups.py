"""`GET /api/sales/deliveries/groups/` (ADR-0158 §7): date groups select their day through the
existing range filters, and the list's default ordering orders the groups."""

from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from contacts.models import Contact
from inventory.models import Warehouse
from sales.models import SaleDelivery, SaleOrder

pytestmark = pytest.mark.ci_gate

User = get_user_model()
URL = "/api/sales/deliveries/"


@pytest.fixture
def client(db):
    api = APIClient()
    api.force_authenticate(user=User.objects.create_superuser(username="grouper", password="x"))
    return api


@pytest.fixture
def deliveries(db):
    warehouse = Warehouse.objects.create(name="Bodega", code="WH-G")
    beta = Contact.objects.create(name="Beta", tax_id="11111111-1")
    alfa = Contact.objects.create(name="Alfa", tax_id="22222222-2")
    made = []
    for customer, day, cost in [(beta, date(2026, 11, 2), "10"), (beta, date(2026, 11, 3), "20"), (alfa, date(2026, 11, 3), "5")]:
        order = SaleOrder.objects.create(customer=customer, status=SaleOrder.Status.CONFIRMED)
        delivery = SaleDelivery.objects.create(sale_order=order, warehouse=warehouse, delivery_date=day, status="CONFIRMED")
        SaleDelivery.objects.filter(pk=delivery.pk).update(total_cost=Decimal(cost))
        made.append(delivery)
    return {"beta": beta, "alfa": alfa, "rows": made}


def test_date_groups_follow_the_default_ordering_and_select_their_day(client, deliveries):
    groups = client.get(f"{URL}groups/?group_by=date").json()

    # Default list ordering is -delivery_date: newest day first.
    assert [(g["key"], g["count"], g["label"]) for g in groups] == [("2026-11-03", 2, None), ("2026-11-02", 1, None)]
    assert groups[0]["params"] == {"date_after": "2026-11-03", "date_before": "2026-11-03"}
    assert groups[0]["aggregates"]["cost"] == str(Decimal("25").quantize(Decimal(1).scaleb(-SaleDelivery._meta.get_field("total_cost").decimal_places)))

    listed = client.get(URL, groups[0]["params"]).json()
    assert listed["count"] == 2


def test_customer_groups_list_their_rows(client, deliveries):
    groups = client.get(f"{URL}groups/?group_by=customer").json()

    assert [(g["label"], g["count"]) for g in groups] == [("Alfa", 1), ("Beta", 2)]
    for group in groups:
        assert client.get(URL, group["params"]).json()["count"] == group["count"]


def test_status_groups_carry_the_choice_label(client, deliveries):
    groups = client.get(f"{URL}groups/?group_by=status").json()

    assert len(groups) == 1
    assert groups[0]["key"] == "CONFIRMED"
    assert groups[0]["label"] == str(dict(SaleDelivery._meta.get_field("status").flatchoices)["CONFIRMED"])
