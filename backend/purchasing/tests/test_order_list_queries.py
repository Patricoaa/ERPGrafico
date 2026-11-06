"""Regression for GET /api/purchasing/orders/: 211 queries for 50 orders, mostly per payment and per product."""

from decimal import Decimal
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient

from accounting.models import Account, AccountType, JournalEntry
from contacts.models import Contact
from inventory.models import Product, ProductCategory, UoM, UoMCategory
from purchasing.models import PurchaseLine, PurchaseOrder
from purchasing.serializers import PurchaseLineSerializer
from treasury.models import TreasuryAccount, TreasuryMovement
from treasury.serializers import TreasuryMovementSerializer

User = get_user_model()


def _make_order(index: int, uom: UoM) -> PurchaseOrder:
    """One order whose line and payment each point to their own related rows."""
    supplier = Contact.objects.create(name=f"Proveedor {index}", tax_id=f"2000000{index}-9")
    product = Product.objects.create(
        name=f"Insumo {index}",
        internal_code=f"I-{index}",
        product_type=Product.Type.STORABLE,
        uom=uom,
        category=ProductCategory.objects.create(name=f"Categoria {index}", prefix=f"I{index}"),
    )
    order = PurchaseOrder.objects.create(supplier=supplier, status="CONFIRMED")
    PurchaseLine.objects.create(order=order, product=product, uom=uom, quantity=Decimal("2"), unit_cost=Decimal("10"))
    ledger = Account.objects.create(code=f"1.1.01.90{index}", name=f"Caja {index}", account_type=AccountType.ASSET)
    bank_account = TreasuryAccount.objects.create(
        name=f"Cuenta {index}", account=ledger, account_type=TreasuryAccount.Type.CASH
    )
    TreasuryMovement.objects.create(
        movement_type=TreasuryMovement.Type.OUTBOUND,
        from_account=bank_account,
        account=ledger,
        amount=Decimal("20"),
        contact=supplier,
        purchase_order=order,
        journal_entry=JournalEntry.objects.create(date=timezone.localdate(), description=f"Pago {index}"),
        created_by=User.objects.create_user(username=f"tesorero{index}", password="x"),
    )
    return order


@pytest.fixture
def uom(db):
    # Treasury accounts must hang from the cash group, which `_make_order` needs to exist.
    Account.objects.get_or_create(
        code=Account.CASH_GROUP_CODE, defaults={"name": "Efectivo y Equivalentes", "account_type": AccountType.ASSET}
    )
    return UoM.objects.create(name="unidad", ratio=Decimal("1"), category=UoMCategory.objects.create(name="Unidades"))


@pytest.fixture
def client(db):
    api_client = APIClient()
    api_client.force_authenticate(user=User.objects.create_superuser(username="viewer", password="x"))
    return api_client


def _list(client: APIClient):
    with CaptureQueriesContext(connection) as ctx:
        response = client.get("/api/purchasing/orders/")
    assert response.status_code == 200
    return len(ctx), response.data["results"]


def test_list_query_count_does_not_grow_with_rows(client, uom):
    _make_order(0, uom)
    one_order_queries, _ = _list(client)

    for index in range(1, 6):
        _make_order(index, uom)
    many_orders_queries, rows = _list(client)

    assert len(rows) == 6
    assert many_orders_queries == one_order_queries


def test_list_builds_each_nested_serializer_only_once(client, uom):
    for index in range(3):
        _make_order(index, uom)

    with (
        patch.object(
            PurchaseLineSerializer, "get_fields", autospec=True, side_effect=PurchaseLineSerializer.get_fields
        ) as lines,
        patch.object(
            TreasuryMovementSerializer, "get_fields", autospec=True, side_effect=TreasuryMovementSerializer.get_fields
        ) as payments,
    ):
        response = client.get("/api/purchasing/orders/")

    assert len(response.data["results"]) == 3
    assert lines.call_count == 1
    assert payments.call_count == 1


def test_list_rows_keep_their_related_names(client, uom):
    order = _make_order(0, uom)

    _, rows = _list(client)
    row = rows[0]
    payment = row["serialized_payments"][0]
    movement = order.payments.get()

    assert row["lines"][0]["category_name"] == order.lines.get().product.category.name
    assert payment["from_account_name"] == movement.from_account.name
    assert payment["account_name"] == movement.account.name
    assert payment["partner_name"] == order.supplier.name
    assert payment["created_by_name"] == movement.created_by.username
    assert payment["journal_entry_display_id"] == movement.journal_entry.display_id
    assert payment["purchase_order_display_id"] == order.display_id
