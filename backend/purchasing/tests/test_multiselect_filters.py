"""
Regression tests for issue #223: multi-select filters (CSV values) failing with
400 or returning 0 results when 2+ options are selected in purchasing views.
"""
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from contacts.models import Contact
from inventory.models import Product, ProductCategory, UoM, UoMCategory, Warehouse
from purchasing.models import PurchaseLine, PurchaseOrder, PurchaseReceipt, PurchaseReturn

User = get_user_model()

pytestmark = pytest.mark.django_db


@pytest.fixture
def superuser(db):
    return User.objects.create_superuser(username="admin_purch_filter", password="x")


@pytest.fixture
def client_auth(superuser):
    c = APIClient()
    c.force_authenticate(superuser)
    return c


@pytest.fixture
def catalog(db):
    uom_cat = UoMCategory.objects.create(name="Unidades_pms")
    uom = UoM.objects.create(name="un_pms", ratio=Decimal("1"), category=uom_cat)
    cat = ProductCategory.objects.create(name="Cat_pms", prefix="PMS")
    warehouse = Warehouse.objects.create(name="WH_pms", code="WH-PM")
    supplier = Contact.objects.create(name="Proveedor MS", tax_id="11223344-5")
    product = Product.objects.create(
        name="Prod PMS", internal_code="PPMS-01", product_type=Product.Type.STORABLE, uom=uom, category=cat
    )
    return {"uom": uom, "cat": cat, "warehouse": warehouse, "supplier": supplier, "product": product}


def _make_purchase_order(catalog) -> PurchaseOrder:
    order = PurchaseOrder.objects.create(
        supplier=catalog["supplier"],
        date="2024-01-01",
    )
    PurchaseLine.objects.create(
        order=order, product=catalog["product"], quantity=Decimal("1"), unit_cost=Decimal("50"),
    )
    return order


# ---------------------------------------------------------------------------
# PurchaseReceipt multi-select status
# ---------------------------------------------------------------------------

class TestPurchaseReceiptMultiStatus:
    @pytest.fixture
    def receipts(self, catalog):
        order = _make_purchase_order(catalog)
        draft = PurchaseReceipt.objects.create(
            purchase_order=order, warehouse=catalog["warehouse"],
            receipt_date="2024-01-02", status=PurchaseReceipt.Status.DRAFT,
        )
        confirmed = PurchaseReceipt.objects.create(
            purchase_order=order, warehouse=catalog["warehouse"],
            receipt_date="2024-01-03", status=PurchaseReceipt.Status.CONFIRMED,
        )
        cancelled = PurchaseReceipt.objects.create(
            purchase_order=order, warehouse=catalog["warehouse"],
            receipt_date="2024-01-04", status=PurchaseReceipt.Status.CANCELLED,
        )
        return {"draft": draft, "confirmed": confirmed, "cancelled": cancelled}

    def test_single_status_ok(self, client_auth, receipts):
        r = client_auth.get("/api/purchasing/receipts/", {"status": "DRAFT"})
        assert r.status_code == 200
        ids = {d["id"] for d in r.data["results"]}
        assert receipts["draft"].id in ids
        assert receipts["confirmed"].id not in ids

    def test_csv_two_values_returns_both(self, client_auth, receipts):
        r = client_auth.get("/api/purchasing/receipts/", {"status": "DRAFT,CONFIRMED"})
        assert r.status_code == 200, f"Expected 200 but got {r.status_code}: {r.data}"
        ids = {d["id"] for d in r.data["results"]}
        assert receipts["draft"].id in ids
        assert receipts["confirmed"].id in ids
        assert receipts["cancelled"].id not in ids


# ---------------------------------------------------------------------------
# PurchaseReturn multi-select status
# ---------------------------------------------------------------------------

class TestPurchaseReturnMultiStatus:
    @pytest.fixture
    def returns(self, catalog):
        order = _make_purchase_order(catalog)
        draft = PurchaseReturn.objects.create(
            purchase_order=order, warehouse=catalog["warehouse"],
            date="2024-01-02", status=PurchaseReturn.Status.DRAFT,
        )
        confirmed = PurchaseReturn.objects.create(
            purchase_order=order, warehouse=catalog["warehouse"],
            date="2024-01-03", status=PurchaseReturn.Status.CONFIRMED,
        )
        return {"draft": draft, "confirmed": confirmed}

    def test_csv_two_values_returns_both(self, client_auth, returns):
        r = client_auth.get("/api/purchasing/returns/", {"status": "DRAFT,CONFIRMED"})
        assert r.status_code == 200, f"Expected 200 but got {r.status_code}: {r.data}"
        ids = {d["id"] for d in r.data["results"]}
        assert returns["draft"].id in ids
        assert returns["confirmed"].id in ids
