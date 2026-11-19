"""The purchase wizard reads its defaults (cost, UoM, warehouse, supplier) from the product *list* payload."""

from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from contacts.models import Contact
from inventory.models import Product, ProductCategory, UoM, UoMCategory, Warehouse
from purchasing.models import PurchaseLine, PurchaseOrder

pytestmark = pytest.mark.ci_gate

User = get_user_model()


@pytest.fixture
def client(db):
    api_client = APIClient()
    api_client.force_authenticate(user=User.objects.create_superuser(username="buyer", password="x"))
    return api_client


def _make_product(index: int, *, purchased_at: Decimal | None) -> Product:
    uom = UoM.objects.create(
        name=f"uom-{index}", ratio=Decimal("1"), category=UoMCategory.objects.create(name=f"cat-{index}")
    )
    supplier = Contact.objects.create(name=f"Proveedor {index}", tax_id=f"3000000{index}-9")
    product = Product.objects.create(
        name=f"Insumo {index}",
        internal_code=f"IN-{index}",
        product_type=Product.Type.STORABLE,
        category=ProductCategory.objects.create(name=f"Categoria {index}", prefix=f"K{index}"),
        uom=uom,
        sale_uom=uom,
        purchase_uom=uom,
        can_be_purchased=True,
        receiving_warehouse=Warehouse.objects.create(name=f"Bodega {index}", code=f"WP-{index}"),
        preferred_supplier=supplier,
    )
    if purchased_at is not None:
        order = PurchaseOrder.objects.create(supplier=supplier, status="CONFIRMED")
        PurchaseLine.objects.create(order=order, product=product, uom=uom, quantity=Decimal("1"), unit_cost=purchased_at)
    return product


def _list(client: APIClient):
    with CaptureQueriesContext(connection) as ctx:
        response = client.get("/api/inventory/products/?can_be_purchased=true")
    assert response.status_code == 200
    return ctx, response.data["results"]


def test_list_exposes_the_purchase_defaults(client):
    product = _make_product(0, purchased_at=Decimal("1234.50"))

    _, rows = _list(client)
    row = rows[0]

    assert row["last_purchase_price"] == pytest.approx(1234.5)
    assert row["purchase_uom"] == product.purchase_uom_id
    assert row["receiving_warehouse"] == product.receiving_warehouse_id
    assert row["preferred_supplier"] == product.preferred_supplier_id
    assert row["preferred_supplier_name"] == product.preferred_supplier.name


def test_last_purchase_price_is_zero_without_purchase_history(client):
    _make_product(0, purchased_at=None)

    _, rows = _list(client)

    assert rows[0]["last_purchase_price"] == 0


def test_purchase_fields_do_not_add_queries_per_row(client):
    _make_product(0, purchased_at=Decimal("10"))
    one, _ = _list(client)

    for index in range(1, 6):
        _make_product(index, purchased_at=Decimal("10"))
    many, rows = _list(client)

    assert len(rows) == 6
    assert len(many) <= len(one)
