"""`GET /api/sales/orders/groups/` (ADR-0158 §7): grouping over the filtered list in one query."""

from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from contacts.models import Contact
from inventory.models import Product, ProductCategory, UoM, UoMCategory
from sales.models import SaleLine, SaleOrder

pytestmark = pytest.mark.ci_gate

User = get_user_model()
URL = "/api/sales/orders/groups/"


@pytest.fixture
def client(db):
    api = APIClient()
    api.force_authenticate(user=User.objects.create_superuser(username="grouper", password="x"))
    return api


@pytest.fixture
def customers(db):
    return Contact.objects.create(name="Beta", tax_id="11111111-1"), Contact.objects.create(name="Alfa", tax_id="22222222-2")


def _order(customer: Contact, total: str, status: str = SaleOrder.Status.CONFIRMED, day: date = date(2026, 11, 2)) -> SaleOrder:
    order = SaleOrder.objects.create(customer=customer, status=status, date=day)
    # Totals are recalculated from lines on save: set the figure directly for the sums.
    SaleOrder.objects.filter(pk=order.pk).update(total=Decimal(total))
    return order


def _queries(client: APIClient, url: str) -> tuple[int, list]:
    with CaptureQueriesContext(connection) as ctx:
        response = client.get(url)
    assert response.status_code == 200, response.content
    return len(ctx.captured_queries), response.json()


def test_groups_by_customer_with_count_sum_label_and_params(client, customers):
    beta, alfa = customers
    _order(beta, "100")
    _order(beta, "50")
    _order(alfa, "30")

    _, groups = _queries(client, f"{URL}?group_by=customer")

    # Ordered by label when the list ordering does not name the grouped field.
    assert groups == [
        {"key": str(alfa.pk), "label": "Alfa", "count": 1, "aggregates": {"total": "30"}, "params": {"customer": str(alfa.pk)}},
        {"key": str(beta.pk), "label": "Beta", "count": 2, "aggregates": {"total": "150"}, "params": {"customer": str(beta.pk)}},
    ]


def test_group_params_list_exactly_the_group_rows(client, customers):
    beta, alfa = customers
    _order(beta, "100")
    _order(beta, "50")
    _order(alfa, "30")

    _, groups = _queries(client, f"{URL}?group_by=customer")
    for group in groups:
        (param, value), = group["params"].items()
        rows = client.get(f"/api/sales/orders/?{param}={value}").json()
        assert rows["count"] == group["count"]


def test_choices_label_and_list_filters_apply(client, customers):
    beta, _ = customers
    _order(beta, "100", status=SaleOrder.Status.DRAFT)
    _order(beta, "50")
    _order(beta, "999", day=date(2025, 1, 1))

    _, groups = _queries(client, f"{URL}?group_by=status&date_after=2026-01-01")

    assert {(g["key"], g["label"], g["count"]) for g in groups} == {
        (SaleOrder.Status.DRAFT, str(SaleOrder.Status.DRAFT.label), 1),
        (SaleOrder.Status.CONFIRMED, str(SaleOrder.Status.CONFIRMED.label), 1),
    }


def test_date_groups_follow_the_list_ordering(client, customers):
    beta, _ = customers
    for day in (date(2026, 11, 1), date(2026, 11, 3), date(2026, 11, 2)):
        _order(beta, "10", day=day)

    _, desc = _queries(client, f"{URL}?group_by=date&ordering=-date,-id")
    _, asc = _queries(client, f"{URL}?group_by=date&ordering=date,id")

    assert [g["key"] for g in desc] == ["2026-11-03", "2026-11-02", "2026-11-01"]
    assert [g["key"] for g in asc] == ["2026-11-01", "2026-11-02", "2026-11-03"]
    assert desc[0]["params"] == {"date": "2026-11-03"}


def test_search_across_lines_does_not_inflate_the_sums(client, customers):
    beta, _ = customers
    category = UoMCategory.objects.create(name="Unidad")
    unit = UoM.objects.create(name="u", ratio=Decimal("1"), category=category)
    product = Product.objects.create(
        name="Papel bond", internal_code="P-1", product_type=Product.Type.CONSUMABLE, uom=unit,
        category=ProductCategory.objects.create(name="Papel", prefix="PAP"),
    )
    order = _order(beta, "100")
    for _ in range(3):
        SaleLine.objects.create(order=order, product=product, uom=unit, quantity=Decimal("1"), unit_price=Decimal("1"))
    SaleOrder.objects.filter(pk=order.pk).update(total=Decimal("100"))

    _, groups = _queries(client, f"{URL}?group_by=customer&search=bond")

    assert groups[0]["count"] == 1
    assert groups[0]["aggregates"] == {"total": "100"}


def test_unknown_group_is_rejected(client):
    response = client.get(f"{URL}?group_by=nope")
    assert response.status_code == 400
    assert "group_by" in response.json() or "group_by" in str(response.json())


def test_query_count_does_not_grow_with_rows(client, customers):
    beta, alfa = customers
    _order(beta, "1")
    _order(alfa, "1")
    few, _ = _queries(client, f"{URL}?group_by=customer")

    for i in range(12):
        _order(beta if i % 2 else alfa, "1")
    many, groups = _queries(client, f"{URL}?group_by=customer")

    assert sum(g["count"] for g in groups) == 14
    assert many == few
