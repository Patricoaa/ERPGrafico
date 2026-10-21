"""Product list fields feeding the POS / calculator ProductGrid card (variant hints, no N+1)."""
from decimal import Decimal

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

LIST_URL = "/api/inventory/products/"


@pytest.fixture
def catalog(db):
    from django.contrib.auth import get_user_model

    from inventory.models import Product, ProductAttribute, ProductAttributeValue, ProductCategory, UoM, UoMCategory

    user = get_user_model().objects.create_superuser(username="carduser", password="password")
    uom = UoM.objects.create(name="Pliego", category=UoMCategory.objects.create(name="Unit"), uom_type="REFERENCE")
    category = ProductCategory.objects.create(name="Papeles")
    gramaje = ProductAttribute.objects.create(name="Gramaje")
    color = ProductAttribute.objects.create(name="Color")

    def make(name, **extra):
        return Product.objects.create(
            name=name, category=category, uom=uom, sale_uom=uom, purchase_uom=uom,
            product_type="STORABLE", sale_price=Decimal("1000"), **extra,
        )

    def make_template(name, prices, attributes):
        template = make(name, has_variants=True)
        for index, price in enumerate(prices):
            variant = make(f"{name} v{index}", parent_template=template)
            variant.sale_price = Decimal(price)
            variant.save()
            for attribute in attributes:
                value, _ = ProductAttributeValue.objects.get_or_create(attribute=attribute, value=f"{attribute.name}-{index}")
                variant.attribute_values.add(value)
        return template

    client = APIClient()
    client.force_authenticate(user=user)
    return {"client": client, "make": make, "make_template": make_template, "gramaje": gramaje, "color": color}


def rows_by_name(client):
    response = client.get(LIST_URL)
    assert response.status_code == 200
    return {row["name"]: row for row in response.data["results"]}


@pytest.mark.django_db
def test_template_exposes_count_axis_label_and_minimum_price(catalog):
    catalog["make_template"]("Papel couché", ["480", "650", "900"], [catalog["gramaje"]])

    row = rows_by_name(catalog["client"])["Papel couché"]

    assert row["variants_count"] == 3
    assert row["variant_axis_label"] == "Gramaje"
    assert Decimal(str(row["min_variant_price"])) == Decimal("480")


@pytest.mark.django_db
def test_axis_label_is_none_when_variants_mix_attributes(catalog):
    catalog["make_template"]("Papel mixto", ["480", "650"], [catalog["gramaje"], catalog["color"]])

    row = rows_by_name(catalog["client"])["Papel mixto"]

    assert row["variants_count"] == 2
    assert row["variant_axis_label"] is None


@pytest.mark.django_db
def test_plain_product_has_no_variant_hints(catalog):
    catalog["make"]("Tinta cian")

    row = rows_by_name(catalog["client"])["Tinta cian"]

    assert row["variants_count"] == 0
    assert row["variant_axis_label"] is None
    assert row["min_variant_price"] is None
    assert row["manufacturable_quantity"] is None


@pytest.mark.django_db
def test_list_query_count_does_not_grow_with_templates(catalog):
    client = catalog["client"]
    catalog["make_template"]("Plantilla 0", ["480", "650"], [catalog["gramaje"]])

    with CaptureQueriesContext(connection) as baseline:
        assert client.get(LIST_URL).status_code == 200

    for index in range(1, 6):
        catalog["make_template"](f"Plantilla {index}", ["480", "650", "900"], [catalog["gramaje"]])
    catalog["make"]("Tinta magenta")

    with CaptureQueriesContext(connection) as grown:
        assert client.get(LIST_URL).status_code == 200

    assert len(grown) == len(baseline)
