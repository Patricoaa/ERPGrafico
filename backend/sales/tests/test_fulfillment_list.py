"""`/api/sales/fulfillment/` and `/api/purchasing/fulfillment/` (ADR-0090, ADR-0158 §7): one list over
deliveries + returns (receipts + returns), paginated, ordered and grouped on the server."""

from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from contacts.models import Contact
from inventory.models import Warehouse
from purchasing.models import PurchaseOrder, PurchaseReceipt, PurchaseReturn
from sales.models import SaleDelivery, SaleOrder, SaleReturn

pytestmark = pytest.mark.ci_gate

User = get_user_model()
URL = "/api/sales/fulfillment/"


@pytest.fixture
def client(db):
    api = APIClient()
    api.force_authenticate(user=User.objects.create_superuser(username="fulfil", password="x"))
    return api


def _delivery(customer, warehouse, day, cost, status="CONFIRMED"):
    order = SaleOrder.objects.create(customer=customer, status=SaleOrder.Status.CONFIRMED)
    delivery = SaleDelivery.objects.create(sale_order=order, warehouse=warehouse, delivery_date=day, status=status)
    SaleDelivery.objects.filter(pk=delivery.pk).update(total_cost=Decimal(cost))
    return delivery


def _return(customer, warehouse, day, cost, status="CONFIRMED"):
    order = SaleOrder.objects.create(customer=customer, status=SaleOrder.Status.CONFIRMED)
    ret = SaleReturn.objects.create(sale_order=order, warehouse=warehouse, date=day, status=status)
    SaleReturn.objects.filter(pk=ret.pk).update(total_cost=Decimal(cost))
    return ret


@pytest.fixture
def docs(db):
    warehouse = Warehouse.objects.create(name="Bodega", code="WH-U")
    alfa = Contact.objects.create(name="Alfa", tax_id="11111111-1")
    beta = Contact.objects.create(name="Beta", tax_id="22222222-2")
    _delivery(beta, warehouse, date(2026, 11, 1), "10")
    _delivery(alfa, warehouse, date(2026, 11, 3), "30", status="DRAFT")
    _return(beta, warehouse, date(2026, 11, 2), "5")
    _return(alfa, warehouse, date(2026, 11, 3), "7")
    return {"warehouse": warehouse, "alfa": alfa, "beta": beta}


def _rows(response):
    assert response.status_code == 200, response.content
    return [(r["fulfillment_type"], r.get("delivery_date") or r.get("date")) for r in response.json()["results"]]


def test_one_paginated_list_over_both_newest_first(client, docs):
    first = client.get(URL, {"page_size": 3}).json()
    second = client.get(URL, {"page_size": 3, "page": 2}).json()

    assert first["count"] == 4
    assert [r["fulfillment_type"] for r in first["results"]] + [r["fulfillment_type"] for r in second["results"]] == [
        "DELIVERY" if "delivery_date" in r else "RETURN" for r in first["results"] + second["results"]
    ]
    dates = [r.get("delivery_date") or r.get("date") for r in first["results"] + second["results"]]
    assert dates == sorted(dates, reverse=True)
    assert len(second["results"]) == 1


def test_orders_by_cost_and_customer_across_both(client, docs):
    by_cost = client.get(URL, {"ordering": "total_cost"}).json()["results"]
    assert [Decimal(r["total_cost"]) for r in by_cost] == [Decimal("5"), Decimal("7"), Decimal("10"), Decimal("30")]

    by_customer = client.get(URL, {"ordering": "-sale_order__customer__name"}).json()["results"]
    assert {r["sale_order"] for r in by_customer[:2]} == {d.sale_order_id for d in [*SaleDelivery.objects.filter(sale_order__customer=docs["beta"]), *SaleReturn.objects.filter(sale_order__customer=docs["beta"])]}


def test_type_and_status_filters_apply_to_both(client, docs):
    assert _rows(client.get(URL, {"fulfillment_type": "RETURN"})) == [("RETURN", "2026-11-03"), ("RETURN", "2026-11-02")]
    assert client.get(URL, {"status": "DRAFT"}).json()["count"] == 1
    assert client.get(URL, {"date_after": "2026-11-03"}).json()["count"] == 2


def test_type_groups_are_the_sources(client, docs):
    groups = client.get(f"{URL}groups/", {"group_by": "type"}).json()

    assert [(g["key"], g["count"]) for g in groups] == [("DELIVERY", 2), ("RETURN", 2)]
    assert Decimal(groups[0]["aggregates"]["cost"]) == Decimal("40")
    for group in groups:
        assert client.get(URL, group["params"]).json()["count"] == group["count"]


@pytest.mark.parametrize("group_by", ["date", "customer", "status"])
def test_merged_groups_list_exactly_their_rows(client, docs, group_by):
    groups = client.get(f"{URL}groups/", {"group_by": group_by}).json()

    assert sum(g["count"] for g in groups) == 4
    assert len({g["key"] for g in groups}) == len(groups)
    for group in groups:
        assert client.get(URL, group["params"]).json()["count"] == group["count"]


def test_date_groups_newest_first_with_summed_cost(client, docs):
    groups = client.get(f"{URL}groups/", {"group_by": "date"}).json()

    assert [g["key"] for g in groups] == ["2026-11-03", "2026-11-02", "2026-11-01"]
    assert groups[0]["count"] == 2
    assert Decimal(groups[0]["aggregates"]["cost"]) == Decimal("37")


def test_unknown_group_is_a_400(client, docs):
    assert client.get(f"{URL}groups/", {"group_by": "warehouse"}).status_code == 400


def test_query_count_does_not_grow_with_rows(client, docs):
    with CaptureQueriesContext(connection) as small:
        client.get(URL, {"page_size": 50})
    for i in range(6):
        _delivery(docs["alfa"], docs["warehouse"], date(2026, 10, i + 1), "1")
        _return(docs["beta"], docs["warehouse"], date(2026, 10, i + 1), "1")
    with CaptureQueriesContext(connection) as large:
        client.get(URL, {"page_size": 50})

    assert len(large.captured_queries) == len(small.captured_queries)


def test_purchase_fulfillment_orders_receipts_and_returns_together(client, db):
    warehouse = Warehouse.objects.create(name="Bodega", code="WH-P")
    supplier = Contact.objects.create(name="Proveedor", tax_id="33333333-3")
    order = PurchaseOrder.objects.create(number="PO-U", supplier=supplier, status="CONFIRMED", date=date(2026, 11, 1), total=0, total_net=0, total_tax=0)
    PurchaseReceipt.objects.create(purchase_order=order, warehouse=warehouse, receipt_date=date(2026, 11, 2))
    PurchaseReturn.objects.create(purchase_order=order, warehouse=warehouse, date=date(2026, 11, 3), number="DV-U")

    response = client.get("/api/purchasing/fulfillment/", {"ordering": "-total_cost"})
    assert response.status_code == 200, response.content
    assert response.json()["count"] == 2
    assert [r["fulfillment_type"] for r in client.get("/api/purchasing/fulfillment/").json()["results"]] == ["RETURN", "RECEIPT"]
    groups = client.get("/api/purchasing/fulfillment/groups/", {"group_by": "supplier"}).json()
    assert [(g["label"], g["count"]) for g in groups] == [("Proveedor", 2)]


def test_needs_the_view_permission_of_each_source(db, docs):
    from django.contrib.auth.models import Permission

    user = User.objects.create_user(username="limited", password="x")
    api = APIClient()
    api.force_authenticate(user=user)
    assert api.get(URL).status_code == 403

    user.user_permissions.add(Permission.objects.get(codename="view_saledelivery"))
    user = User.objects.get(pk=user.pk)
    api.force_authenticate(user=user)
    assert api.get(URL).status_code == 403

    user.user_permissions.add(Permission.objects.get(codename="view_salereturn"))
    api.force_authenticate(user=User.objects.get(pk=user.pk))
    assert api.get(URL).status_code == 200
