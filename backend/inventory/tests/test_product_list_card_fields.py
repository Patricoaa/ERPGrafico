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

    from accounting.vat import gross_from_net
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
            # ADR-0151: el bruto manda; una escritura solo-neto se convierte a bruto.
            variant.sale_price_gross = gross_from_net(Decimal(price))
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
    for index in range(3):
        _surcharge_variant(catalog, f"Plantilla recargo {index}")

    with CaptureQueriesContext(connection) as grown:
        assert client.get(LIST_URL).status_code == 200

    assert len(grown) == len(baseline)


def _surcharge_variant(catalog, template_name):
    template = catalog["make"](template_name, has_variants=True, sale_price_gross=Decimal("1000"))
    return catalog["make"](
        f"{template_name} V", parent_template=template, sale_price_gross=Decimal("1000"),
        price_inheritance_mode="SURCHARGE", price_surcharge_gross=Decimal("500"),
    ), template


@pytest.mark.django_db
def test_variant_row_exposes_inheritance_and_resolved_price(catalog):
    variant, template = _surcharge_variant(catalog, "Plantilla recargo")

    response = catalog["client"].get(
        f"{LIST_URL}?parent_template={template.id}&show_technical_variants=true&is_active=true"
    )
    row = next(r for r in response.data["results"] if r["id"] == variant.id)

    assert row["price_inheritance_mode"] == "SURCHARGE"
    assert Decimal(str(row["price_surcharge_gross"])) == Decimal("500")
    assert "price_surcharge" in row
    # El precio cobrado (resuelto) es plantilla + recargo, no la copia guardada de la plantilla.
    assert row["effective_price"] == 1500.0
    assert row["effective_price_net"] == float(round(1500 / Decimal("1.19")))


def test_template_reports_variants_qty_available(catalog):
    """`variants_qty_available` suma la disponibilidad de las variantes y no crece con las filas."""
    from inventory.models import Product, Stock, Warehouse

    client = catalog["client"]
    template = catalog["make_template"]("Polera", ["1000", "1200"], [catalog["gramaje"]])
    catalog["make_template"]("Gorro", ["500"], [catalog["gramaje"]])

    rows = rows_by_name(client)
    assert rows["Polera"]["variants_qty_available"] == 0
    assert rows["Gorro"]["variants_qty_available"] == 0

    variant = Product.objects.get(name="Polera v0")
    warehouse = Warehouse.objects.create(name="Principal", code="PRI")
    Stock.objects.create(product=variant, warehouse=warehouse, quantity=Decimal("7"))

    rows = rows_by_name(client)
    assert rows["Polera"]["variants_qty_available"] == 7
    assert rows["Gorro"]["variants_qty_available"] == 0
    assert template.has_variants
