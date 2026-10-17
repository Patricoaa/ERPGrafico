"""Server ordering of the product list (ADR-0087 lote 2, `?ordering=`)."""
from decimal import Decimal

import pytest
from rest_framework.test import APIClient


@pytest.fixture
def products(db):
    from django.contrib.auth import get_user_model

    from inventory.models import Product, ProductCategory, UoM, UoMCategory

    user = get_user_model().objects.create_superuser(username="orderinguser", password="password")
    uom = UoM.objects.create(name="Unidad", category=UoMCategory.objects.create(name="Unit"), uom_type="REFERENCE")
    papers = ProductCategory.objects.create(name="Papeles")
    inks = ProductCategory.objects.create(name="Tintas")
    rows = [("Bond", papers, "300"), ("Couché", papers, "100"), ("Cyan", inks, "200")]
    for name, category, price in rows:
        Product.objects.create(
            name=name, category=category, uom=uom, sale_uom=uom, purchase_uom=uom,
            product_type="STORABLE", sale_price=Decimal(price),
        )
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def names(response):
    assert response.status_code == 200
    return [row["name"] for row in response.data["results"]]


@pytest.mark.django_db
def test_orders_by_whitelisted_field_with_id_tiebreak(products):
    assert names(products.get("/api/inventory/products/?ordering=-sale_price,-id")) == ["Bond", "Cyan", "Couché"]
    assert names(products.get("/api/inventory/products/?ordering=name,id")) == ["Bond", "Couché", "Cyan"]


@pytest.mark.django_db
def test_orders_by_related_and_annotated_fields(products):
    assert names(products.get("/api/inventory/products/?ordering=-category__name,name,id"))[0] == "Cyan"
    assert products.get("/api/inventory/products/?ordering=annotated_current_stock,id").status_code == 200


@pytest.mark.django_db
def test_ignores_fields_outside_the_whitelist(products):
    # DRF drops unknown ordering terms instead of failing: no ordering by arbitrary columns.
    response = products.get("/api/inventory/products/?ordering=password")
    assert response.status_code == 200
    assert len(response.data["results"]) == 3


@pytest.mark.django_db
def test_stock_and_variant_count_are_not_multiplied_by_the_joins(products):
    """Sum(stocks) and Count(variants) in one annotate fan out: stock × variants, variants × stock rows."""
    from inventory.models import Product, Stock, Warehouse

    template = Product.objects.get(name="Bond")
    for i in range(2):
        Product.objects.create(
            name=f"Bond variante {i}", category=template.category, uom=template.uom, sale_uom=template.uom,
            purchase_uom=template.uom, product_type="STORABLE", parent_template=template,
        )
    for code, qty in (("WA", "10"), ("WB", "5")):
        Stock.objects.create(product=template, warehouse=Warehouse.objects.create(name=code, code=code), quantity=Decimal(qty))

    from inventory.selectors import list_products

    rows = {row["name"]: row for row in products.get("/api/inventory/products/?ordering=-annotated_current_stock,-id").data["results"]}
    assert rows["Bond"]["current_stock"] == 15.0
    assert next(iter(rows)) == "Bond"
    annotated = list_products(user=None, params={}).get(pk=template.pk)
    assert annotated.variants_count == 2
