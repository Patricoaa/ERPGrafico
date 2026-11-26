"""`groups/` (ADR-0158 §7) on the inventory, treasury and accounting lists: every group counts
exactly the rows its params select in the list, and dates come newest first."""

from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from accounting.models import Account, AccountType, JournalEntry
from inventory.models import InventoryDocument, Location, Product, ProductCategory, StockMove, UoM, UoMCategory, Warehouse
from treasury.models import TreasuryAccount, TreasuryMovement

pytestmark = pytest.mark.ci_gate

User = get_user_model()
DAYS = [date(2026, 11, 2), date(2026, 11, 3), date(2026, 11, 3)]


@pytest.fixture
def client(db):
    api = APIClient()
    api.force_authenticate(user=User.objects.create_superuser(username="grouper", password="x"))
    return api


@pytest.fixture
def inventory(db):
    uom = UoM.objects.create(name="Unidad", category=UoMCategory.objects.create(name="Unit"), uom_type="REFERENCE")
    papers = ProductCategory.objects.create(name="Papeles")
    inks = ProductCategory.objects.create(name="Tintas")
    warehouse = Warehouse.objects.create(name="Bodega", code="B1")
    internal = Location.objects.create(name="Interno", location_type="INTERNAL", warehouse=warehouse)
    vendor = Location.objects.create(name="Proveedor", location_type="VENDOR")
    products = [
        Product.objects.create(name=name, category=cat, uom=uom, sale_uom=uom, purchase_uom=uom, product_type=kind, sale_price=Decimal("1"))
        for name, cat, kind in [("Resma", papers, "STORABLE"), ("Bond", papers, "STORABLE"), ("Tinta", inks, "CONSUMABLE")]
    ]
    for product, day in zip(products, DAYS):
        StockMove.objects.create(product=product, source_location=vendor, destination_location=internal, quantity=Decimal("1"), unit_cost=Decimal("1"), date=day, description="t")
    for day, kind in zip(DAYS, [InventoryDocument.Type.RECEIPT, InventoryDocument.Type.RECEIPT, InventoryDocument.Type.ADJUSTMENT]):
        InventoryDocument.objects.create(document_type=kind, status=InventoryDocument.Status.DRAFT, date=day, reference="R")
    for day, status in zip(DAYS, ["DRAFT", "POSTED", "POSTED"]):
        JournalEntry.objects.create(description="t", date=day, status=status)
    account = Account.objects.create(name="Caja", code="1.1.01.001", account_type=AccountType.ASSET)
    cash = TreasuryAccount.objects.create(name="Caja", account=account, account_type=TreasuryAccount.Type.CASH)
    for day, kind in zip(DAYS, ["INBOUND", "INBOUND", "OUTBOUND"]):
        TreasuryMovement.objects.create(movement_type=kind, to_account=cash if kind == "INBOUND" else None, from_account=cash if kind == "OUTBOUND" else None, amount=Decimal("10"), date=day)


CASES = [
    ("/api/inventory/products/", "product_type"),
    ("/api/inventory/products/", "category"),
    ("/api/inventory/moves/", "date"),
    ("/api/inventory/moves/", "product"),
    ("/api/inventory/documents/", "date"),
    ("/api/inventory/documents/", "document_type"),
    ("/api/inventory/documents/", "status"),
    ("/api/accounting/entries/", "status"),
    ("/api/accounting/entries/", "date"),
    ("/api/treasury/movements/", "date"),
    ("/api/treasury/movements/", "movement_type"),
]


@pytest.mark.parametrize("url,group_by", CASES)
def test_groups_count_exactly_their_rows(client, inventory, url, group_by):
    groups = client.get(f"{url}groups/", {"group_by": group_by}).json()

    assert sum(g["count"] for g in groups) == 3
    for group in groups:
        assert client.get(url, group["params"]).json()["count"] == group["count"], group


@pytest.mark.parametrize("url", ["/api/inventory/moves/", "/api/inventory/documents/", "/api/accounting/entries/", "/api/treasury/movements/"])
def test_date_groups_newest_first(client, inventory, url):
    groups = client.get(f"{url}groups/", {"group_by": "date"}).json()

    assert [g["key"] for g in groups] == ["2026-11-03", "2026-11-02"]


def test_inventory_documents_filter_by_date(client, inventory):
    """The list's date filter (date_from / date_to) used to be ignored by the endpoint."""
    assert client.get("/api/inventory/documents/", {"date_from": "2026-11-03"}).json()["count"] == 2
