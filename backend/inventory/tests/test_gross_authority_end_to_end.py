"""ADR-0151: recorrido del bug del producto 11 (bruto 1450 se degradaba a 1449) por la API real."""
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from inventory.models import Product, ProductCategory, UoM, UoMCategory
from inventory.services import PricingService

User = get_user_model()


@pytest.fixture
def client(db):
    c = APIClient()
    c.force_authenticate(user=User.objects.create_superuser(username="e2e", password="x"))
    return c


@pytest.fixture
def product(db):
    uom = UoM.objects.create(name="Unidad", category=UoMCategory.objects.create(name="Unit"), uom_type="REFERENCE")
    return Product.objects.create(
        name="Tarjeta", category=ProductCategory.objects.create(name="Impresos"),
        uom=uom, sale_uom=uom, purchase_uom=uom, product_type="STORABLE",
        sale_price_gross=Decimal("1000"),
    )


def _patch(client, product, body):
    r = client.patch(f"/api/inventory/products/{product.id}/", body, format="json")
    assert r.status_code == 200, r.data
    product.refresh_from_db()
    return (product.sale_price_gross, product.sale_price)


def test_gross_write_is_idempotent_and_net_write_is_documented(client, product):
    assert _patch(client, product, {"sale_price_gross": 1450}) == (Decimal("1450"), Decimal("1218"))
    assert _patch(client, product, {"sale_price_gross": 1450}) == (Decimal("1450"), Decimal("1218"))
    # Escribir solo el neto 1218 da 1449 (1450 no tiene neto entero): comportamiento documentado.
    assert _patch(client, product, {"sale_price": 1218}) == (Decimal("1449"), Decimal("1218"))


def test_list_payload_and_pricing_service_expose_gross(client, product):
    _patch(client, product, {"sale_price_gross": 1450})
    r = client.get("/api/inventory/products/")
    assert r.status_code == 200
    rows = r.data["results"] if isinstance(r.data, dict) and "results" in r.data else r.data
    row = next(x for x in rows if x["id"] == product.id)
    assert Decimal(str(row["sale_price_gross"])) == Decimal("1450")
    price = PricingService.get_effective_sale_price(product.id, 1)
    assert price["price_gross"] == 1450
