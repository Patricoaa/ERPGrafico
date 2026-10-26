"""Read-only counters that feed the inventory catalog cards."""
from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from inventory.models import Product, ProductCategory, Stock, Warehouse


@pytest.fixture
def api_client(db):
    from django.contrib.auth import get_user_model

    user = get_user_model().objects.create_superuser(username="masterdata", password="password")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
def test_category_product_count_counts_active_direct_products(api_client):
    parent = ProductCategory.objects.create(name="Papeles")
    child = ProductCategory.objects.create(name="Couché", parent=parent)
    Product.objects.create(name="Papel activo", category=parent)
    Product.objects.create(name="Papel archivado", category=parent, is_active=False)
    Product.objects.create(name="Papel hijo", category=child)

    response = api_client.get("/api/inventory/categories/?is_active=all")

    assert response.status_code == 200
    rows = {row["name"]: row for row in response.data}
    assert rows["Papeles"]["product_count"] == 1
    assert rows["Couché"]["product_count"] == 1


@pytest.mark.django_db
def test_warehouse_counts_distinct_positive_products_and_units(api_client):
    category = ProductCategory.objects.create(name="Insumos")
    first = Product.objects.create(name="Tinta", category=category)
    second = Product.objects.create(name="Papel", category=category)
    empty_product = Product.objects.create(name="Sin stock", category=category)

    main = Warehouse.objects.create(name="Principal", code="WH-01")
    secondary = Warehouse.objects.create(name="Secundaria", code="WH-02")
    empty = Warehouse.objects.create(name="Vacía", code="WH-03")

    Stock.objects.create(product=first, warehouse=main, quantity=Decimal("5"))
    Stock.objects.create(product=second, warehouse=main, quantity=Decimal("0"))
    Stock.objects.create(product=empty_product, warehouse=main, quantity=Decimal("0"))
    Stock.objects.create(product=first, warehouse=secondary, quantity=Decimal("2.5"))

    response = api_client.get("/api/inventory/warehouses/?is_active=all")

    assert response.status_code == 200
    rows = {row["name"]: row for row in response.data}
    assert rows["Principal"]["stocked_product_count"] == 1
    assert Decimal(rows["Principal"]["stock_units"]) == Decimal("5")
    assert rows["Secundaria"]["stocked_product_count"] == 1
    assert Decimal(rows["Secundaria"]["stock_units"]) == Decimal("2.5")
    assert rows["Vacía"]["stocked_product_count"] == 0
    assert Decimal(rows["Vacía"]["stock_units"]) == Decimal("0")
