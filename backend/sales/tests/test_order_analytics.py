"""Sale order analytics endpoint + server ordering (ADR-0087 lote 2b)."""
from datetime import date
from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from contacts.models import Contact
from sales.models import SaleOrder

TODAY = date.today()
THIS_MONTH = date(TODAY.year, TODAY.month, 1)
LAST_MONTH = date(TODAY.year - 1, 12, 1) if TODAY.month == 1 else date(TODAY.year, TODAY.month - 1, 1)


@pytest.fixture
def client_and_orders(db):
    from django.contrib.auth import get_user_model

    user = get_user_model().objects.create_superuser(username="analyticsuser", password="password")
    acme = Contact.objects.create(name="Acme", tax_id="11111111-1")
    beta = Contact.objects.create(name="Beta", tax_id="22222222-2")
    # 25 orders: more than one page (20), so page-based figures would differ.
    for i in range(25):
        SaleOrder.objects.create(
            customer=acme if i % 5 else beta,
            status="CONFIRMED",
            channel="POS" if i % 2 else "SYSTEM",
            date=THIS_MONTH if i < 15 else LAST_MONTH,
            total=Decimal(100_000 if i < 20 else 300_000),
            total_net=Decimal(84_034),
        )
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
def test_analytics_covers_the_whole_filtered_list(client_and_orders):
    data = client_and_orders.get("/api/sales/orders/analytics/").data
    totals = data["totals"]
    assert totals["order_count"] == 25
    assert totals["total_volume"] == 20 * 100_000 + 5 * 300_000
    assert totals["customer_count"] == 2
    assert totals["pos_order_count"] == 12 and totals["system_order_count"] == 13
    assert {r["id"]: r["value"] for r in data["price_ranges"]} == {"$50k - $200k": 20, "$200k - $500k": 5}
    assert data["trend"]["current"]["count"] == 15 and data["trend"]["previous"]["count"] == 10
    assert [p["bucket"] for p in data["periods"]] == [LAST_MONTH.isoformat(), THIS_MONTH.isoformat()]


@pytest.mark.django_db
def test_analytics_applies_the_list_filters(client_and_orders):
    data = client_and_orders.get("/api/sales/orders/analytics/?search=Beta").data
    assert data["totals"]["order_count"] == 5
    assert data["customers"] == [{"customer": "Beta", "total": 4 * 100_000 + 300_000.0, "order_count": 5}]


@pytest.mark.django_db
def test_analytics_granularity_buckets(client_and_orders):
    data = client_and_orders.get("/api/sales/orders/analytics/?granularity=year").data
    assert data["granularity"] == "year"
    assert len(data["periods"]) == (1 if THIS_MONTH.year == LAST_MONTH.year else 2)


@pytest.mark.django_db
def test_list_server_ordering(client_and_orders):
    results = client_and_orders.get("/api/sales/orders/?ordering=-total,-id&page_size=10").data["results"]
    assert [Decimal(str(r["total"])) for r in results[:5]] == [Decimal(300_000)] * 5
    names = [r["customer_name"] for r in client_and_orders.get("/api/sales/orders/?ordering=customer__name,id").data["results"]]
    assert names == sorted(names)


@pytest.mark.django_db(transaction=True)
def test_analytics_queries_do_not_scale_with_orders(client_and_orders, django_assert_max_num_queries):
    with django_assert_max_num_queries(20):
        assert client_and_orders.get("/api/sales/orders/analytics/").status_code == 200


@pytest.mark.django_db
def test_customers_are_grouped_by_id_and_capped(client_and_orders):
    for i in range(12):
        twin = Contact.objects.create(name="Acme", tax_id=f"9{i:07d}-K")  # same name, different contact
        SaleOrder.objects.create(customer=twin, status="CONFIRMED", date=THIS_MONTH, total=Decimal(1_000), total_net=Decimal(840))
    data = client_and_orders.get("/api/sales/orders/analytics/").data
    assert data["totals"]["customer_count"] == 14
    assert len(data["customers"]) == 11 and data["customers"][-1]["customer"] == "Otros"
    assert sum(c["order_count"] for c in data["customers"]) == data["totals"]["order_count"]
