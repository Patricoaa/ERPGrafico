"""`GET /api/sales/orders/facets/` (ADR-0158 §8): counts per option with the other filters applied,
the filter's own value left out, and a query count that does not grow with the rows."""

import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from contacts.models import Contact
from sales.models import SaleOrder

pytestmark = pytest.mark.ci_gate

User = get_user_model()
URL = "/api/sales/orders/facets/"


@pytest.fixture
def client(db):
    api = APIClient()
    api.force_authenticate(user=User.objects.create_superuser(username="facets", password="x"))
    return api


def _orders(customer, spec):
    for status, delivery in spec:
        order = SaleOrder.objects.create(customer=customer, status=status)
        SaleOrder.objects.filter(pk=order.pk).update(delivery_status=delivery)


@pytest.fixture
def orders(db):
    customer = Contact.objects.create(name="Cliente", tax_id="11111111-1")
    _orders(customer, [("DRAFT", "PENDING"), ("CONFIRMED", "PENDING"), ("CONFIRMED", "DELIVERED"), ("CANCELLED", "PENDING")])
    return customer


def _counts(response, name):
    assert response.status_code == 200, response.content
    return {item["value"]: item["count"] for item in response.json()["fields"][name]}


def test_column_facet_counts_with_the_other_filters(client, orders):
    response = client.get(URL, {"fields": "delivery_status", "origin_status": "ACTIVE"})

    assert _counts(response, "delivery_status") == {"PENDING": 1, "DELIVERED": 1}


def test_own_filter_is_left_out(client, orders):
    """Choosing PENDING must not zero DELIVERED in the delivery facet."""
    response = client.get(URL, {"fields": "delivery_status", "delivery_status": "PENDING"})

    assert _counts(response, "delivery_status") == {"PENDING": 3, "DELIVERED": 1}


def test_method_filter_counts_one_per_option(client, orders):
    response = client.get(URL, {"fields": "origin_status", "delivery_status": "PENDING"})

    assert _counts(response, "origin_status") == {"DRAFT": 1, "ACTIVE": 1, "CANCELLED": 1}


def test_unknown_field_is_a_400(client, orders):
    assert client.get(URL, {"fields": "payment_status"}).status_code == 400


def test_query_count_does_not_grow_with_rows(client, orders):
    fields = "delivery_status,origin_status,production_status,billing_status"
    with CaptureQueriesContext(connection) as small:
        client.get(URL, {"fields": fields})
    _orders(orders, [("CONFIRMED", "PENDING")] * 15)
    with CaptureQueriesContext(connection) as large:
        client.get(URL, {"fields": fields})

    assert len(large.captured_queries) == len(small.captured_queries)


def test_view_counts_ignore_the_user_filters(client, orders):
    views = '{"to-deliver": {"origin_status": "ACTIVE", "delivery_status": "PENDING,PARTIAL"}, "drafts": {"origin_status": "DRAFT"}}'
    response = client.get(URL, {"views": views, "origin_status": "CANCELLED"})

    assert response.status_code == 200, response.content
    assert response.json()["views"] == {"to-deliver": 1, "drafts": 1}


@pytest.mark.parametrize("views", ["no-json", '["x"]', '{"a": {"p": 1}}'])
def test_malformed_views_are_a_400(client, orders, views):
    assert client.get(URL, {"views": views}).status_code == 400


def test_view_query_count_does_not_grow_with_rows(client, orders):
    views = '{"to-deliver": {"origin_status": "ACTIVE", "delivery_status": "PENDING"}, "drafts": {"origin_status": "DRAFT"}}'
    with CaptureQueriesContext(connection) as small:
        client.get(URL, {"views": views})
    _orders(orders, [("CONFIRMED", "PENDING")] * 15)
    with CaptureQueriesContext(connection) as large:
        client.get(URL, {"views": views})

    assert len(large.captured_queries) == len(small.captured_queries)
