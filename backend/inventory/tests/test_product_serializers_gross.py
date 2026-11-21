"""ADR-0151: los serializers de producto exponen el bruto como autoridad."""
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from inventory.models import Product, ProductCategory, UoM, UoMCategory

User = get_user_model()


@pytest.fixture
def client(db):
    c = APIClient()
    c.force_authenticate(user=User.objects.create_superuser(username="viewer", password="x"))
    return c


@pytest.fixture
def base(db):
    uom = UoM.objects.create(name="Unidad", category=UoMCategory.objects.create(name="Unit"), uom_type="REFERENCE")
    category = ProductCategory.objects.create(name="Impresos")
    return dict(
        name="Tarjeta", category=category, uom=uom, sale_uom=uom, purchase_uom=uom,
        product_type="STORABLE",
    )


def test_patch_with_inconsistent_net_and_gross_gross_wins(client, base):
    p = Product.objects.create(**base, sale_price_gross=Decimal("1000"))
    r = client.patch(
        f"/api/inventory/products/{p.id}/",
        {"sale_price": "5000", "sale_price_gross": "1450"}, format="json",
    )
    assert r.status_code == 200, r.data
    p.refresh_from_db()
    assert p.sale_price_gross == Decimal("1450")
    assert p.sale_price == Decimal("1218")


def test_patch_with_net_only_derives_gross(client, base):
    p = Product.objects.create(**base, sale_price_gross=Decimal("1000"))
    r = client.patch(f"/api/inventory/products/{p.id}/", {"sale_price": "1000"}, format="json")
    assert r.status_code == 200, r.data
    p.refresh_from_db()
    assert p.sale_price == Decimal("1000")
    assert p.sale_price_gross == Decimal("1190")


def test_price_surcharge_gross_writable_and_exposed(client, base):
    tpl = Product.objects.create(**base, has_variants=True, sale_price_gross=Decimal("1190"))
    variant = Product.objects.create(
        **{**base, "name": "Var"}, parent_template=tpl, price_inheritance_mode="SURCHARGE",
    )
    r = client.patch(
        f"/api/inventory/products/{variant.id}/",
        {"price_surcharge_gross": "119", "price_inheritance_mode": "SURCHARGE"}, format="json",
    )
    assert r.status_code == 200, r.data
    variant.refresh_from_db()
    assert variant.price_surcharge_gross == Decimal("119")
    assert variant.price_surcharge == Decimal("100")
    detail = client.get(f"/api/inventory/products/{variant.id}/")
    assert Decimal(str(detail.data["price_surcharge_gross"])) == Decimal("119")


def test_list_min_variant_price_gross(client, base):
    tpl = Product.objects.create(**base, has_variants=True, sale_price_gross=Decimal("1190"))
    Product.objects.create(**{**base, "name": "A"}, parent_template=tpl, price_inheritance_mode="INHERIT")
    Product.objects.create(
        **{**base, "name": "B"}, parent_template=tpl, price_inheritance_mode="SURCHARGE",
        price_surcharge_gross=Decimal("-190"),
    )
    Product.objects.create(
        **{**base, "name": "C"}, parent_template=tpl, price_inheritance_mode="OVERRIDE",
        sale_price_gross=Decimal("2000"),
    )
    r = client.get("/api/inventory/products/")
    row = next(x for x in r.data["results"] if x["id"] == tpl.id)
    assert Decimal(str(row["min_variant_price_gross"])) == Decimal("1000")
    assert "min_variant_price" in row


def test_min_variant_price_gross_none_without_variants(client, base):
    p = Product.objects.create(**base, sale_price_gross=Decimal("1190"))
    r = client.get("/api/inventory/products/")
    row = next(x for x in r.data["results"] if x["id"] == p.id)
    assert row["min_variant_price_gross"] is None


def test_min_variant_price_gross_adds_no_queries(client, base):
    def count():
        with CaptureQueriesContext(connection) as ctx:
            assert client.get("/api/inventory/products/").status_code == 200
        return len(ctx)

    tpl = Product.objects.create(**base, has_variants=True, sale_price_gross=Decimal("1190"))
    Product.objects.create(**{**base, "name": "A"}, parent_template=tpl)
    first = count()
    for i in range(4):
        Product.objects.create(**{**base, "name": f"V{i}"}, parent_template=tpl)
    assert count() == first
