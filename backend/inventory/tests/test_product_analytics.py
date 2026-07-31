from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from inventory.models import Product, ProductCategory, Stock, Warehouse


@pytest.fixture
def product_analytics_setup(db):
    """Base categories/products/warehouses for product-analytics tests."""
    category_a = ProductCategory.objects.create(name="Categoría A")
    category_b = ProductCategory.objects.create(name="Categoría B")

    product_a = Product.objects.create(
        name="Producto A",
        category=category_a,
        product_type=Product.Type.STORABLE,
        cost_price=100,
        sale_price=8_000,
    )
    product_b = Product.objects.create(
        name="Producto B",
        category=category_a,
        product_type=Product.Type.STORABLE,
        cost_price=200,
        sale_price=30_000,
    )
    product_c = Product.objects.create(
        name="Producto C",
        category=category_b,
        product_type=Product.Type.SERVICE,
        cost_price=0,
        sale_price=150_000,
        track_inventory=False,
    )
    archived = Product.objects.create(
        name="Archivado",
        category=category_b,
        product_type=Product.Type.CONSUMABLE,
        cost_price=50,
        sale_price=2_000,
        is_active=False,
    )

    warehouse_main = Warehouse.objects.create(name="Bodega Principal", code="BP01")
    warehouse_secondary = Warehouse.objects.create(name="Bodega Secundaria", code="BS02")

    Stock.objects.create(product=product_a, warehouse=warehouse_main, quantity=Decimal("10"))
    Stock.objects.create(product=product_a, warehouse=warehouse_secondary, quantity=Decimal("5"))
    Stock.objects.create(product=product_b, warehouse=warehouse_main, quantity=Decimal("3"))
    # product_c (SERVICE) and archived have no stock rows.

    return {
        "category_a": category_a,
        "category_b": category_b,
        "product_a": product_a,
        "product_b": product_b,
        "product_c": product_c,
        "archived": archived,
        "warehouse_main": warehouse_main,
        "warehouse_secondary": warehouse_secondary,
    }


@pytest.fixture
def auth_client():
    from django.contrib.auth import get_user_model

    client = APIClient()
    User = get_user_model()
    user, _ = User.objects.get_or_create(
        username="product_analytics_admin",
        email="product_analytics_admin@test.com",
        defaults={"is_superuser": True},
    )
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
class TestCatalogDistributions:
    def test_type_distribution(self, product_analytics_setup):
        from inventory.product_analytics import ProductAnalyticsService

        dist = ProductAnalyticsService.get_catalog_type_distribution(is_active=None)
        by_id = {row["id"]: row for row in dist}

        assert by_id["STORABLE"]["value"] == 2
        assert by_id["SERVICE"]["value"] == 1
        assert by_id["CONSUMABLE"]["value"] == 1
        assert by_id["STORABLE"]["label"] == "Almacenable"

    def test_category_distribution(self, product_analytics_setup):
        from inventory.product_analytics import ProductAnalyticsService

        dist = ProductAnalyticsService.get_catalog_category_distribution(is_active=None)
        by_id = {row["id"]: row for row in dist}

        assert by_id["Categoría A"]["value"] == 2
        assert by_id["Categoría B"]["value"] == 2

    def test_price_range_distribution(self, product_analytics_setup):
        from inventory.product_analytics import ProductAnalyticsService

        dist = ProductAnalyticsService.get_price_range_distribution(is_active=None)
        by_id = {row["id"]: row for row in dist}

        assert by_id["0 – 10.000"]["value"] == 2  # A y Archivado
        assert by_id["10.000 – 50.000"]["value"] == 1
        assert by_id["100.000 – 500.000"]["value"] == 1
        assert sum(row["value"] for row in dist) == 4


@pytest.mark.django_db
class TestStockAggregation:
    def test_value_is_quantity_times_cost_price(self, product_analytics_setup):
        s = product_analytics_setup
        from inventory.product_analytics import ProductAnalyticsService

        summary = ProductAnalyticsService.get_stock_summary()
        # A: (10 + 5) × 100 = 1500 · B: 3 × 200 = 600
        assert summary["total_value"] == str(Decimal("2100"))
        assert summary["total_units"] == str(Decimal("18"))
        assert summary["with_stock"] == 2
        assert summary["out_of_stock"] == 0  # B tiene stock; C no trackea inventario
        assert summary["total_products"] == 3  # solo activos, sin variantes

    def test_services_excluded_from_stock_kpis(self, product_analytics_setup):
        s = product_analytics_setup
        from inventory.product_analytics import ProductAnalyticsService

        summary = ProductAnalyticsService.get_stock_summary()
        assert summary["total_units"] == str(Decimal("18"))  # C (SERVICE) no suma

    def test_stock_value_by_category(self, product_analytics_setup):
        from inventory.product_analytics import ProductAnalyticsService

        dist = ProductAnalyticsService.get_stock_value_by_category()
        by_id = {row["id"]: row for row in dist}

        assert by_id["Categoría A"]["value"] == str(Decimal("2100"))

    def test_top_products(self, product_analytics_setup):
        from inventory.product_analytics import ProductAnalyticsService

        by_value = ProductAnalyticsService.get_top_products_by_stock_value()
        assert by_value[0]["name"] == "Producto A"
        assert by_value[0]["value"] == str(Decimal("1500"))

        by_units = ProductAnalyticsService.get_top_products_by_units()
        assert by_units[0]["name"] == "Producto A"
        assert by_units[0]["value"] == str(Decimal("15"))


@pytest.mark.django_db
class TestFilters:
    def test_category_filter(self, product_analytics_setup):
        s = product_analytics_setup
        from inventory.product_analytics import ProductAnalyticsService

        dist = ProductAnalyticsService.get_catalog_type_distribution(
            category_id=s["category_b"].id
        )
        by_id = {row["id"]: row for row in dist}
        assert by_id["SERVICE"]["value"] == 1
        assert "STORABLE" not in by_id

    def test_is_active_filter(self, product_analytics_setup):
        from inventory.product_analytics import ProductAnalyticsService

        summary_all = ProductAnalyticsService.get_stock_summary(is_active=None)
        assert summary_all["total_products"] == 4  # incluye Archivado

        summary_active = ProductAnalyticsService.get_stock_summary(is_active=True)
        assert summary_active["total_products"] == 3

    def test_search_filter(self, product_analytics_setup):
        from inventory.product_analytics import ProductAnalyticsService

        dist = ProductAnalyticsService.get_catalog_type_distribution(search="Producto A")
        total = sum(row["value"] for row in dist)
        assert total == 1


@pytest.mark.django_db
class TestEndpoint:
    def test_analytics_endpoint_shape(self, auth_client, product_analytics_setup):
        response = auth_client.get("/api/inventory/products/analytics/")
        assert response.status_code == 200

        data = response.json()
        assert set(data.keys()) == {
            "catalog_type_distribution",
            "catalog_category_distribution",
            "price_range_distribution",
            "status_distribution",
            "stock_value_by_category",
            "stock_value_by_type",
            "top_products_by_stock_value",
            "top_products_by_units",
            "summary",
        }
        assert data["summary"]["total_products"] == 3
        assert data["summary"]["total_value"] == "2100"
        assert data["catalog_type_distribution"][0]["id"] == "STORABLE"
        assert data["catalog_category_distribution"][0]["id"] == "Categoría A"
        assert data["top_products_by_stock_value"][0]["name"] == "Producto A"

    def test_analytics_endpoint_respects_filters(self, auth_client, product_analytics_setup):
        s = product_analytics_setup
        response = auth_client.get(
            f"/api/inventory/products/analytics/?category={s['category_b'].id}"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["summary"]["total_products"] == 1  # solo Producto C (activo, cat B)

    def test_analytics_endpoint_requires_auth(self, product_analytics_setup):
        response = APIClient().get("/api/inventory/products/analytics/")
        assert response.status_code in (401, 403)
