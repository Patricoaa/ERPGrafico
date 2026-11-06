"""Regression for the N+1 seen in Sentry trace c681c24a… on GET /api/sales/orders/ (697 spans)."""

from decimal import Decimal
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from contacts.models import Contact
from inventory.models import Product, ProductCategory, Stock, UoM, UoMCategory, Warehouse
from production.models import BillOfMaterials, BillOfMaterialsLine, WorkOrder
from production.serializers import WorkOrderListSerializer
from sales.models import SaleLine, SaleOrder
from sales.selectors import SaleOrderSelector
from sales.serializers import SaleLineSerializer

User = get_user_model()


@pytest.fixture
def catalog(db):
    uom_category = UoMCategory.objects.create(name="Peso")
    kilo = UoM.objects.create(name="kg", ratio=Decimal("1"), category=uom_category)
    gram = UoM.objects.create(name="g", ratio=Decimal("0.001"), category=uom_category)
    return {
        "kilo": kilo,
        "gram": gram,
        "category": ProductCategory.objects.create(name="Papel", prefix="PAP"),
        "warehouse": Warehouse.objects.create(name="Central", code="WH-Q"),
        "customer": Contact.objects.create(name="Cliente", tax_id="12345678-9"),
    }


def _make_order(index: int, catalog: dict) -> SaleOrder:
    """One order with a storable line and a manufacturable line (active BOM + work order)."""
    kilo, gram, category = catalog["kilo"], catalog["gram"], catalog["category"]
    component = Product.objects.create(
        name=f"Componente {index}", internal_code=f"C-{index}", product_type=Product.Type.STORABLE,
        uom=kilo, category=category,
    )
    Stock.objects.create(product=component, warehouse=catalog["warehouse"], quantity=Decimal("10"))
    storable = Product.objects.create(
        name=f"Almacenable {index}", internal_code=f"S-{index}", product_type=Product.Type.STORABLE,
        uom=kilo, category=category,
    )
    Stock.objects.create(product=storable, warehouse=catalog["warehouse"], quantity=Decimal("7"))
    manufactured = Product.objects.create(
        name=f"Fabricado {index}", internal_code=f"F-{index}", product_type=Product.Type.MANUFACTURABLE,
        uom=kilo, category=category,
    )
    bom = BillOfMaterials.objects.create(
        product=manufactured, name=f"BOM {index}", active=True, yield_quantity=Decimal("1"), yield_uom=kilo
    )
    BillOfMaterialsLine.objects.create(bom=bom, component=component, quantity=Decimal("2000"), uom=gram)

    order = SaleOrder.objects.create(customer=catalog["customer"], status=SaleOrder.Status.CONFIRMED)
    SaleLine.objects.create(order=order, product=storable, uom=kilo, quantity=Decimal("3"), unit_price=Decimal("100"))
    manufactured_line = SaleLine.objects.create(
        order=order, product=manufactured, uom=kilo, quantity=Decimal("1"), unit_price=Decimal("100")
    )
    WorkOrder.objects.create(
        description=f"OT {index}", sale_order=order, sale_line=manufactured_line, warehouse=catalog["warehouse"]
    )
    return order


def _authenticated_client() -> APIClient:
    client = APIClient()
    client.force_authenticate(user=User.objects.create_superuser(username="viewer", password="x"))
    return client


def _count(client: APIClient, url: str) -> tuple[int, dict]:
    with CaptureQueriesContext(connection) as ctx:
        response = client.get(url)
    assert response.status_code == 200
    return len(ctx), response.data


def test_order_list_query_count_does_not_grow_with_rows(catalog):
    client = _authenticated_client()

    _make_order(0, catalog)
    one_order_queries, _ = _count(client, "/api/sales/orders/")

    for index in range(1, 6):
        _make_order(index, catalog)
    many_orders_queries, data = _count(client, "/api/sales/orders/")

    assert len(data["results"]) == 6
    assert many_orders_queries == one_order_queries


def test_order_detail_query_count_does_not_grow_with_lines(catalog):
    client = _authenticated_client()
    order = _make_order(0, catalog)
    few_lines_queries, _ = _count(client, f"/api/sales/orders/{order.pk}/")

    for index in range(1, 6):
        extra = _make_order(index, catalog)
        extra.lines.update(order=order)
    many_lines_queries, data = _count(client, f"/api/sales/orders/{order.pk}/")

    assert len(data["lines"]) == 12
    assert many_lines_queries == few_lines_queries


def test_order_list_figures_match_the_product_model(catalog):
    """Preloading must not change the numbers: they must equal what Product computes on its own."""
    client = _authenticated_client()
    order = _make_order(0, catalog)

    rows = client.get("/api/sales/orders/").data["results"][0]["lines"]
    by_type = {row["product_type"]: row for row in rows}

    storable = order.lines.get(product__product_type=Product.Type.STORABLE).product
    manufactured = order.lines.get(product__product_type=Product.Type.MANUFACTURABLE).product
    assert by_type["STORABLE"]["available_stock"] == float(storable.qty_available)
    # 7 on hand, 3 reserved by this confirmed order
    assert by_type["STORABLE"]["available_stock"] == 4.0
    assert by_type["MANUFACTURABLE"]["manufacturable_quantity"] == float(manufactured.get_manufacturable_quantity())
    # 10 kg on hand / 2000 g per unit
    assert by_type["MANUFACTURABLE"]["manufacturable_quantity"] == 5.0
    assert by_type["MANUFACTURABLE"]["uom_name"] == "kg"
    assert by_type["MANUFACTURABLE"]["work_order_summary"]["number"]


def test_list_shows_the_active_bom_even_with_an_older_inactive_one(catalog):
    client = _authenticated_client()
    order = _make_order(0, catalog)
    manufactured = order.lines.get(product__product_type=Product.Type.MANUFACTURABLE).product
    BillOfMaterials.objects.create(
        product=manufactured, name="Inactiva", active=False, yield_quantity=Decimal("1"), yield_uom=catalog["kilo"]
    )

    rows = client.get("/api/sales/orders/").data["results"][0]["lines"]
    row = next(r for r in rows if r["product_type"] == "MANUFACTURABLE")

    assert row["manufacturable_quantity"] == 5.0


def test_write_flows_do_not_receive_the_stock_snapshot(catalog):
    """Dispatch and confirm validate `qty_available`: a preloaded snapshot would make them read stale stock."""
    order = _make_order(0, catalog)

    fetched = SaleOrderSelector.get_base_queryset().get(pk=order.pk)

    for line in fetched.lines.all():
        assert not hasattr(line.product, "annotated_current_stock")
        assert not hasattr(line.product, "annotated_qty_reserved")


def test_list_builds_each_nested_serializer_only_once(catalog):
    """DRF rebuilds a ModelSerializer's fields per instance: doing it per order dominated the list's CPU time."""
    client = _authenticated_client()
    for index in range(3):
        _make_order(index, catalog)

    with (
        patch.object(SaleLineSerializer, "get_fields", autospec=True, side_effect=SaleLineSerializer.get_fields) as lines,
        patch.object(
            WorkOrderListSerializer, "get_fields", autospec=True, side_effect=WorkOrderListSerializer.get_fields
        ) as work_orders,
    ):
        response = client.get("/api/sales/orders/")

    assert len(response.data["results"]) == 3
    assert lines.call_count == 1
    assert work_orders.call_count == 1
