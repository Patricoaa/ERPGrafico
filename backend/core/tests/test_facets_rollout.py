"""`facets/` on the logistics lists and purchase orders (ADR-0158 §8): status counts without their
own filter, view totals with the view's filters only, constant query count."""

from datetime import date

import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from contacts.models import Contact
from inventory.models import Warehouse
from purchasing.models import PurchaseOrder
from sales.models import SaleDelivery, SaleOrder

pytestmark = pytest.mark.ci_gate

User = get_user_model()


@pytest.fixture
def client(db):
    api = APIClient()
    api.force_authenticate(user=User.objects.create_superuser(username="facets", password="x"))
    return api


def _deliveries(customer, warehouse, statuses):
    for status in statuses:
        order = SaleOrder.objects.create(customer=customer, status=SaleOrder.Status.CONFIRMED)
        SaleDelivery.objects.create(sale_order=order, warehouse=warehouse, delivery_date=date(2026, 11, 3), status=status)


@pytest.fixture
def deliveries(db):
    customer = Contact.objects.create(name="Cliente", tax_id="11111111-1")
    warehouse = Warehouse.objects.create(name="Bodega", code="WH-F")
    _deliveries(customer, warehouse, ["DRAFT", "DRAFT", "CONFIRMED"])
    return customer, warehouse


@pytest.fixture
def orders(db):
    supplier = Contact.objects.create(name="Proveedor", tax_id="22222222-2")
    for i, status in enumerate(["DRAFT", "CONFIRMED", "CONFIRMED"]):
        PurchaseOrder.objects.create(number=f"PO-{i}", supplier=supplier, status=status, date=date(2026, 11, 3), total=0, total_net=0, total_tax=0)


def test_delivery_status_counts_leave_their_own_filter_out(client, deliveries):
    response = client.get("/api/sales/deliveries/facets/", {"fields": "status", "status": "DRAFT"})

    assert response.status_code == 200, response.content
    assert {i["value"]: i["count"] for i in response.json()["fields"]["status"]} == {"DRAFT": 2, "CONFIRMED": 1}


def test_delivery_view_totals_ignore_the_user_filters(client, deliveries):
    views = '{"all": {}, "drafts": {"status": "DRAFT"}}'
    response = client.get("/api/sales/deliveries/facets/", {"views": views, "status": "CONFIRMED"})

    assert response.json()["views"] == {"all": 3, "drafts": 2}


def test_delivery_facets_query_count_does_not_grow(client, deliveries):
    params = {"fields": "status", "views": '{"all": {}, "drafts": {"status": "DRAFT"}}'}
    with CaptureQueriesContext(connection) as small:
        client.get("/api/sales/deliveries/facets/", params)
    _deliveries(*deliveries, ["CONFIRMED"] * 10)
    with CaptureQueriesContext(connection) as large:
        client.get("/api/sales/deliveries/facets/", params)

    assert len(large.captured_queries) == len(small.captured_queries)


def test_purchase_order_view_totals(client, orders):
    views = '{"all": {}, "drafts": {"origin_status": "DRAFT"}, "to-receive": {"origin_status": "ACTIVE", "receiving_status": "PENDING"}}'
    response = client.get("/api/purchasing/orders/facets/", {"views": views})

    assert response.status_code == 200, response.content
    assert response.json()["views"] == {"all": 3, "drafts": 1, "to-receive": 2}


@pytest.mark.parametrize("url", ["/api/sales/returns/", "/api/purchasing/receipts/", "/api/purchasing/returns/"])
def test_other_logistics_lists_serve_status_facets(client, db, url):
    response = client.get(f"{url}facets/", {"fields": "status", "views": '{"all": {}}'})

    assert response.status_code == 200, response.content
    assert response.json() == {"fields": {"status": []}, "views": {"all": 0}}
