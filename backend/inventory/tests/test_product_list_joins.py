"""The product list must keep its query small: joining every FK cost ~300 ms of Postgres planning."""

from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from contacts.models import Contact
from inventory.models import Product, ProductCategory, UoM, UoMCategory, Warehouse

pytestmark = pytest.mark.ci_gate

User = get_user_model()


@pytest.fixture
def client(db):
    api_client = APIClient()
    api_client.force_authenticate(user=User.objects.create_superuser(username="viewer", password="x"))
    return api_client


def _make_product(index: int) -> Product:
    """A product with every optional FK set, so a missing `select_related` would surface as a query."""
    uom = UoM.objects.create(
        name=f"uom-{index}", ratio=Decimal("1"), category=UoMCategory.objects.create(name=f"cat-{index}")
    )
    supplier = Contact.objects.create(name=f"Proveedor {index}", tax_id=f"1000000{index}-9")
    return Product.objects.create(
        name=f"Producto {index}",
        internal_code=f"P-{index}",
        product_type=Product.Type.STORABLE,
        category=ProductCategory.objects.create(name=f"Categoria {index}", prefix=f"C{index}"),
        uom=uom,
        sale_uom=uom,
        purchase_uom=uom,
        receiving_warehouse=Warehouse.objects.create(name=f"Bodega {index}", code=f"WH-{index}"),
        preferred_supplier=supplier,
        subscription_supplier=supplier,
    )


def _list(client: APIClient):
    with CaptureQueriesContext(connection) as ctx:
        response = client.get("/api/inventory/products/")
    assert response.status_code == 200
    return ctx, response.data["results"]


def test_list_query_count_does_not_grow_without_the_extra_joins(client):
    _make_product(0)
    one_product_queries, _ = _list(client)

    for index in range(1, 6):
        _make_product(index)
    many_products_queries, rows = _list(client)

    assert len(rows) == 6
    assert len(many_products_queries) <= len(one_product_queries)


def test_main_list_query_only_joins_what_the_serializer_reads(client):
    _make_product(0)

    queries, _ = _list(client)

    main_query = max((q["sql"] for q in queries), key=len)
    assert main_query.count(" JOIN ") <= 5
    for table in ("contacts_contact", "inventory_warehouse"):
        assert f'JOIN "{table}"' not in main_query


def test_list_still_returns_the_names_of_its_relations(client):
    product = _make_product(0)

    _, rows = _list(client)
    row = rows[0]

    assert row["category_name"] == product.category.name
    assert row["uom_name"] == product.uom.name
    assert row["sale_uom_name"] == product.sale_uom.name
