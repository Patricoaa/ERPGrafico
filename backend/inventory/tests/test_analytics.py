from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from inventory.models import Location, Product, ProductCategory, StockMove, Warehouse


@pytest.fixture
def analytics_setup(db):
    """Base locations/products for stock-move analytics tests."""
    category_a = ProductCategory.objects.create(name="Categoría A")
    category_b = ProductCategory.objects.create(name="Categoría B")

    product_a = Product.objects.create(name="Producto A", category=category_a, cost_price=100)
    product_b = Product.objects.create(name="Producto B", category=category_b, cost_price=200)

    warehouse_main = Warehouse.objects.create(name="Bodega Principal", code="BP01")
    warehouse_secondary = Warehouse.objects.create(name="Bodega Secundaria", code="BS02")

    internal_main = Location.objects.get_or_create(
        location_type="INTERNAL", warehouse=warehouse_main, defaults={"name": "Interno Principal"}
    )[0]
    internal_secondary = Location.objects.get_or_create(
        location_type="INTERNAL", warehouse=warehouse_secondary, defaults={"name": "Interno Secundario"}
    )[0]
    vendor = Location.objects.get_or_create(location_type="VENDOR", defaults={"name": "Proveedor"})[0]
    customer = Location.objects.get_or_create(location_type="CUSTOMER", defaults={"name": "Cliente"})[0]
    loss = Location.objects.get_or_create(
        location_type="VIRTUAL", name="Ajuste por Merma/Pérdida", defaults={"location_type": "VIRTUAL"}
    )[0]
    gain = Location.objects.get_or_create(
        location_type="VIRTUAL", name="Ajuste por Sobrante/Ganancia", defaults={"location_type": "VIRTUAL"}
    )[0]
    other_virtual = Location.objects.get_or_create(
        location_type="VIRTUAL", name="Producción", defaults={"location_type": "VIRTUAL"}
    )[0]

    return {
        "category_a": category_a,
        "category_b": category_b,
        "product_a": product_a,
        "product_b": product_b,
        "warehouse_main": warehouse_main,
        "warehouse_secondary": warehouse_secondary,
        "internal_main": internal_main,
        "internal_secondary": internal_secondary,
        "vendor": vendor,
        "customer": customer,
        "loss": loss,
        "gain": gain,
        "other_virtual": other_virtual,
    }


def create_move(setup, product, source, destination, quantity, unit_cost, days_ago=0):
    return StockMove.objects.create(
        product=product,
        source_location=source,
        destination_location=destination,
        quantity=Decimal(str(quantity)),
        unit_cost=Decimal(str(unit_cost)),
        date=timezone.now().date() - timedelta(days=days_ago),
        description="Test move",
    )


@pytest.fixture
def auth_client():
    from django.contrib.auth import get_user_model

    client = APIClient()
    User = get_user_model()
    user, _ = User.objects.get_or_create(
        username="analytics_admin",
        email="analytics_admin@test.com",
        defaults={"is_superuser": True},
    )
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
class TestDirectionClassification:
    def test_direction_buckets(self, analytics_setup):
        s = analytics_setup
        create_move(s, s["product_a"], s["vendor"], s["internal_main"], 10, 100, days_ago=1)  # IN
        create_move(s, s["product_a"], s["internal_main"], s["customer"], 4, 100, days_ago=1)  # OUT
        create_move(s, s["product_a"], s["internal_main"], s["internal_secondary"], 3, 100, days_ago=1)  # TRANSFER
        create_move(s, s["product_a"], s["internal_main"], s["loss"], 2, 100, days_ago=1)  # ADJUSTMENT
        create_move(s, s["product_a"], s["gain"], s["internal_main"], 1, 100, days_ago=1)  # ADJUSTMENT
        create_move(s, s["product_a"], s["other_virtual"], s["internal_main"], 5, 100, days_ago=1)  # IN (producción)

        from inventory.analytics import StockMoveAnalyticsService

        dist = StockMoveAnalyticsService.get_direction_distribution()
        by_id = {row["id"]: row for row in dist}

        assert by_id["IN"]["quantity"] == "15"  # 10 vendor + 5 producción
        assert by_id["OUT"]["quantity"] == "4"
        assert by_id["TRANSFER"]["quantity"] == "3"
        assert by_id["ADJUSTMENT"]["quantity"] == "3"  # 2 merma + 1 sobrante
        assert by_id["IN"]["count"] == 2
        assert by_id["OTHER"]["quantity"] == "0"


@pytest.mark.django_db
class TestValueAggregation:
    def test_value_is_quantity_times_unit_cost(self, analytics_setup):
        s = analytics_setup
        create_move(s, s["product_a"], s["vendor"], s["internal_main"], 10, 100, days_ago=1)
        create_move(s, s["product_b"], s["internal_main"], s["customer"], 3, 250, days_ago=1)

        from inventory.analytics import StockMoveAnalyticsService

        consolidated = StockMoveAnalyticsService.get_consolidated()
        assert consolidated["summary"]["total_value"] == str(Decimal("1750"))  # 1000 + 750
        assert consolidated["summary"]["total_movements"] == 2

        by_id = {row["id"]: row for row in consolidated["direction_distribution"]}
        assert by_id["IN"]["amount"] == str(Decimal("1000"))
        assert by_id["OUT"]["amount"] == str(Decimal("750"))


@pytest.mark.django_db
class TestGranularity:
    def test_granularity_bucketing(self, analytics_setup):
        s = analytics_setup
        create_move(s, s["product_a"], s["vendor"], s["internal_main"], 10, 100, days_ago=45)  # ~2 months ago
        create_move(s, s["product_a"], s["vendor"], s["internal_main"], 20, 100, days_ago=1)  # current month

        from inventory.analytics import StockMoveAnalyticsService

        month_trend = StockMoveAnalyticsService.get_flow_trend(granularity="month")
        year_trend = StockMoveAnalyticsService.get_flow_trend(granularity="year")

        assert len(month_trend) == 2
        total_qty_month = sum(
            Decimal(row["entradas"]) for row in month_trend
        )
        assert total_qty_month == Decimal("30")

        assert len(year_trend) >= 1
        total_qty_year = sum(Decimal(row["entradas"]) for row in year_trend)
        assert total_qty_year == Decimal("30")


@pytest.mark.django_db
class TestFilters:
    def test_product_filter(self, analytics_setup):
        s = analytics_setup
        create_move(s, s["product_a"], s["vendor"], s["internal_main"], 10, 100, days_ago=1)
        create_move(s, s["product_b"], s["vendor"], s["internal_main"], 20, 100, days_ago=1)

        from inventory.analytics import StockMoveAnalyticsService

        consolidated = StockMoveAnalyticsService.get_consolidated(product_id=s["product_a"].id)
        assert consolidated["summary"]["total_movements"] == 1
        assert consolidated["top_products"][0]["product_id"] == s["product_a"].id

    def test_location_filter(self, analytics_setup):
        s = analytics_setup
        create_move(s, s["product_a"], s["vendor"], s["internal_main"], 10, 100, days_ago=1)
        create_move(s, s["product_a"], s["other_virtual"], s["internal_secondary"], 20, 100, days_ago=1)

        from inventory.analytics import StockMoveAnalyticsService

        consolidated = StockMoveAnalyticsService.get_consolidated(
            destination_location_id=s["internal_main"].id
        )
        assert consolidated["summary"]["total_movements"] == 1

    def test_date_range_filter(self, analytics_setup):
        s = analytics_setup
        create_move(s, s["product_a"], s["vendor"], s["internal_main"], 10, 100, days_ago=60)
        create_move(s, s["product_a"], s["vendor"], s["internal_main"], 20, 100, days_ago=1)

        from inventory.analytics import StockMoveAnalyticsService

        today = timezone.now().date()
        consolidated = StockMoveAnalyticsService.get_consolidated(
            date_from=str(today - timedelta(days=7)),
            date_to=str(today),
        )
        assert consolidated["summary"]["total_movements"] == 1
        assert consolidated["summary"]["total_in_qty"] == "20"


@pytest.mark.django_db
class TestEndpoint:
    def test_analytics_endpoint_shape(self, auth_client, analytics_setup):
        s = analytics_setup
        create_move(s, s["product_a"], s["vendor"], s["internal_main"], 10, 100, days_ago=1)

        response = auth_client.get("/api/inventory/moves/analytics/")
        assert response.status_code == 200

        data = response.json()
        assert set(data.keys()) == {
            "flow_trend",
            "value_trend",
            "direction_distribution",
            "top_products",
            "category_distribution",
            "location_distribution",
            "summary",
        }
        assert data["summary"]["total_movements"] == 1
        assert data["summary"]["total_in_qty"] == "10"
        assert data["flow_trend"]
        assert data["flow_trend"][0]["entradas"] == "10"
        assert data["value_trend"][0]["entrada"] == "1000"
        assert data["top_products"][0]["product_name"] == "Producto A"
        assert data["category_distribution"][0]["id"] == "Categoría A"
        assert data["location_distribution"][0]["id"] == "Interno Principal"

    def test_analytics_endpoint_respects_granularity(self, auth_client, analytics_setup):
        s = analytics_setup
        create_move(s, s["product_a"], s["vendor"], s["internal_main"], 10, 100, days_ago=1)
        create_move(s, s["product_a"], s["vendor"], s["internal_main"], 20, 100, days_ago=45)

        response = auth_client.get("/api/inventory/moves/analytics/?granularity=year")
        assert response.status_code == 200
        data = response.json()
        assert len(data["flow_trend"]) >= 1
        total = sum(Decimal(row["entradas"]) for row in data["flow_trend"])
        assert total == Decimal("30")

    def test_analytics_endpoint_requires_auth(self, analytics_setup):
        response = APIClient().get("/api/inventory/moves/analytics/")
        assert response.status_code in (401, 403)
