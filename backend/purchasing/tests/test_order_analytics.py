"""Purchase order analytics endpoint + server ordering + distinct search (ADR-0087 lote 2c)."""
from datetime import date, timedelta
from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from contacts.models import Contact
from inventory.models import Product, ProductCategory, UoM, UoMCategory
from purchasing.models import PurchaseLine, PurchaseOrder

TODAY = date.today()
THIS_MONTH = date(TODAY.year, TODAY.month, 1)


@pytest.fixture
def client_and_orders(db):
    from django.contrib.auth import get_user_model

    user = get_user_model().objects.create_superuser(username="poanalytics", password="password")
    acme = Contact.objects.create(name="Papelera", tax_id="11111111-1")
    beta = Contact.objects.create(name="Tintas", tax_id="22222222-2")
    uom_cat, _ = UoMCategory.objects.get_or_create(name="Unidades")
    uom, _ = UoM.objects.get_or_create(name="unidad", defaults={"ratio": 1, "category": uom_cat})
    category, _ = ProductCategory.objects.get_or_create(name="Papeles", defaults={"prefix": "PAP"})
    # Same name, different products: the analytics must not merge them.
    papers = [
        Product.objects.create(name="Papel Bond", internal_code=f"PB-{n}", product_type=Product.Type.STORABLE,
                               uom=uom, category=category, cost_price=Decimal("0"))
        for n in (1, 2)
    ]
    # 25 orders: more than one page (20), each with one line (exercises the line prefetches).
    for i in range(25):
        order = PurchaseOrder.objects.create(
            supplier=acme if i % 5 else beta,
            number=f"OC-{i:03d}",
            status="CONFIRMED",
            date=THIS_MONTH,
            receipt_date=TODAY - timedelta(days=3) if i < 4 else None,
            receiving_status="PENDING",
            total=Decimal(200_000 if i < 20 else 2_000_000),
        )
        PurchaseLine.objects.create(order=order, product=papers[i % 2], quantity=Decimal("1"), unit_cost=Decimal("1000"), uom=uom)
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
def test_analytics_covers_the_whole_filtered_list(client_and_orders):
    data = client_and_orders.get("/api/purchasing/orders/analytics/").data
    totals = data["totals"]
    assert totals["order_count"] == 25
    assert totals["total_volume"] == 20 * 200_000 + 5 * 2_000_000
    assert len(data["top_suppliers"]) == 2
    assert totals["pending_receipt_count"] == 25 and totals["overdue_count"] == 4
    assert data["periods"] == [{"bucket": THIS_MONTH.isoformat(), "total": totals["total_volume"], "count": 25}]
    assert data["payment_method"] == [{"id": "Crédito", "value": 25}]
    assert data["invoiced"]["pending_volume"] == totals["total_volume"]
    assert set(data["by_type"]) == {"storable", "service", "subscription"}
    assert {s["id"]: s["value"] for s in data["funnel"]}["CONFIRMED"] == 25
    storable = data["by_type"]["storable"]
    assert storable["order_count"] == 25 and storable["categories"] == [{"id": "Papeles", "value": storable["total_volume"]}]
    assert [p["product"] for p in data["top_products"]] == ["Papel Bond", "Papel Bond"]


@pytest.mark.django_db
def test_analytics_applies_the_list_filters(client_and_orders):
    data = client_and_orders.get("/api/purchasing/orders/analytics/?search=Tintas").data
    assert data["totals"]["order_count"] == 5
    assert data["top_suppliers"][0]["supplier"] == "Tintas"


@pytest.mark.django_db
def test_list_server_ordering(client_and_orders):
    results = client_and_orders.get("/api/purchasing/orders/?ordering=-total,-id&page_size=10").data["results"]
    assert [Decimal(str(r["total"])) for r in results[:5]] == [Decimal(2_000_000)] * 5


@pytest.mark.django_db(transaction=True)
def test_analytics_queries_do_not_scale_with_orders(client_and_orders, django_assert_max_num_queries):
    with django_assert_max_num_queries(20):
        assert client_and_orders.get("/api/purchasing/orders/analytics/").status_code == 200
