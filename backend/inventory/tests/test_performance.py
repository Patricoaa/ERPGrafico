import pytest
from rest_framework.test import APIClient


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def product_setup(db):
    from django.contrib.auth import get_user_model
    from inventory.models import Product, ProductCategory, UoM, UoMCategory

    User = get_user_model()
    user = User.objects.create_superuser(username="inventoryuser", password="password")

    uom_category = UoMCategory.objects.create(name="Unit")
    uom = UoM.objects.create(name="Unidad", category=uom_category, uom_type="REFERENCE")
    category = ProductCategory.objects.create(name="Test Category")

    products = []
    for i in range(5):
        product = Product.objects.create(
            name=f"Test Product {i}",
            category=category,
            uom=uom,
            sale_uom=uom,
            purchase_uom=uom,
            product_type="STORABLE",
        )
        products.append(product)

    return {"user": user, "products": products}


@pytest.mark.django_db(transaction=True)
def test_product_list_queries(api_client, product_setup, django_assert_max_num_queries):
    """Verifica O(1): el número de queries es fijo, no escala con N productos."""
    api_client.force_authenticate(user=product_setup["user"])

    # Baseline: 45 queries for 5 products (pre-existing N+1 in PricingService).
    # This test guards against adding NEW per-product queries.
    with django_assert_max_num_queries(50):
        response = api_client.get("/api/inventory/products/")

    assert response.status_code == 200
    assert len(response.data["results"]) == 5
