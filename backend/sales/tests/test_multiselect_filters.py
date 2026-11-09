"""
Regression tests for issue #223: multi-select filters (CSV values) failing with
400 or returning 0 results when 2+ options are selected.

The frontend sends `status=DRAFT,CONFIRMED` (single param, comma-separated).
The backend must split the CSV and return rows matching any of the values.
"""
import pytest
from decimal import Decimal
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model

from contacts.models import Contact
from inventory.models import Product, ProductCategory, UoM, UoMCategory, Warehouse
from sales.models import SaleDelivery, SaleOrder, SaleLine, SaleReturn

User = get_user_model()

pytestmark = pytest.mark.django_db


@pytest.fixture
def superuser(db):
    return User.objects.create_superuser(username="admin_filter", password="x")


@pytest.fixture
def client_auth(superuser):
    c = APIClient()
    c.force_authenticate(superuser)
    return c


@pytest.fixture
def catalog(db):
    uom_cat = UoMCategory.objects.create(name="Unidades_ms")
    uom = UoM.objects.create(name="un_ms", ratio=Decimal("1"), category=uom_cat)
    cat = ProductCategory.objects.create(name="Cat_ms", prefix="MS")
    warehouse = Warehouse.objects.create(name="WH_ms", code="WH-MS")
    customer = Contact.objects.create(name="Cliente MS", tax_id="99887766-5")
    product = Product.objects.create(
        name="Prod MS", internal_code="PMS-01", product_type=Product.Type.STORABLE, uom=uom, category=cat
    )
    return {"uom": uom, "cat": cat, "warehouse": warehouse, "customer": customer, "product": product}


def _make_order(catalog, **kwargs) -> SaleOrder:
    order = SaleOrder.objects.create(
        customer=catalog["customer"],
        date="2024-01-01",
        **kwargs,
    )
    SaleLine.objects.create(
        order=order, product=catalog["product"], quantity=Decimal("1"), unit_price=Decimal("100"),
    )
    return order


# ---------------------------------------------------------------------------
# SaleDelivery multi-select status
# ---------------------------------------------------------------------------

class TestSaleDeliveryMultiStatus:
    @pytest.fixture
    def deliveries(self, catalog):
        order = _make_order(catalog)
        draft = SaleDelivery.objects.create(
            sale_order=order, warehouse=catalog["warehouse"],
            delivery_date="2024-01-02", status=SaleDelivery.Status.DRAFT,
        )
        confirmed = SaleDelivery.objects.create(
            sale_order=order, warehouse=catalog["warehouse"],
            delivery_date="2024-01-03", status=SaleDelivery.Status.CONFIRMED,
        )
        cancelled = SaleDelivery.objects.create(
            sale_order=order, warehouse=catalog["warehouse"],
            delivery_date="2024-01-04", status=SaleDelivery.Status.CANCELLED,
        )
        return {"draft": draft, "confirmed": confirmed, "cancelled": cancelled}

    def test_single_status_ok(self, client_auth, deliveries):
        r = client_auth.get("/api/sales/deliveries/", {"status": "DRAFT"})
        assert r.status_code == 200
        ids = {d["id"] for d in r.data["results"]}
        assert deliveries["draft"].id in ids
        assert deliveries["confirmed"].id not in ids

    def test_csv_two_values_returns_both(self, client_auth, deliveries):
        """Core regression: status=DRAFT,CONFIRMED must return both, not 400."""
        r = client_auth.get("/api/sales/deliveries/", {"status": "DRAFT,CONFIRMED"})
        assert r.status_code == 200, f"Expected 200 but got {r.status_code}: {r.data}"
        ids = {d["id"] for d in r.data["results"]}
        assert deliveries["draft"].id in ids
        assert deliveries["confirmed"].id in ids
        assert deliveries["cancelled"].id not in ids

    def test_csv_excludes_non_selected(self, client_auth, deliveries):
        r = client_auth.get("/api/sales/deliveries/", {"status": "CANCELLED"})
        assert r.status_code == 200
        ids = {d["id"] for d in r.data["results"]}
        assert deliveries["cancelled"].id in ids
        assert deliveries["draft"].id not in ids


# ---------------------------------------------------------------------------
# SaleReturn multi-select status
# ---------------------------------------------------------------------------

class TestSaleReturnMultiStatus:
    @pytest.fixture
    def returns(self, catalog):
        order = _make_order(catalog)
        draft = SaleReturn.objects.create(
            sale_order=order, warehouse=catalog["warehouse"],
            date="2024-01-02", status=SaleReturn.Status.DRAFT,
        )
        confirmed = SaleReturn.objects.create(
            sale_order=order, warehouse=catalog["warehouse"],
            date="2024-01-03", status=SaleReturn.Status.CONFIRMED,
        )
        return {"draft": draft, "confirmed": confirmed}

    def test_csv_two_values_returns_both(self, client_auth, returns):
        r = client_auth.get("/api/sales/returns/", {"status": "DRAFT,CONFIRMED"})
        assert r.status_code == 200, f"Expected 200 but got {r.status_code}: {r.data}"
        ids = {d["id"] for d in r.data["results"]}
        assert returns["draft"].id in ids
        assert returns["confirmed"].id in ids


# ---------------------------------------------------------------------------
# SaleOrder delivery_status multi-select
# ---------------------------------------------------------------------------

class TestSaleOrderDeliveryStatusMulti:
    @pytest.fixture
    def orders(self, catalog):
        pending = _make_order(catalog, delivery_status="PENDING")
        partial = _make_order(catalog, delivery_status="PARTIAL")
        delivered = _make_order(catalog, delivery_status="DELIVERED")
        return {"pending": pending, "partial": partial, "delivered": delivered}

    def test_single_delivery_status_ok(self, client_auth, orders):
        r = client_auth.get("/api/sales/orders/", {"delivery_status": "PENDING"})
        assert r.status_code == 200
        ids = {d["id"] for d in r.data["results"]}
        assert orders["pending"].id in ids
        assert orders["partial"].id not in ids

    def test_csv_delivery_status_returns_both(self, client_auth, orders):
        r = client_auth.get("/api/sales/orders/", {"delivery_status": "PENDING,PARTIAL"})
        assert r.status_code == 200, f"Expected 200: {r.data}"
        ids = {d["id"] for d in r.data["results"]}
        assert orders["pending"].id in ids
        assert orders["partial"].id in ids
        assert orders["delivered"].id not in ids


# ---------------------------------------------------------------------------
# SaleOrder origin_status multi-select
# ---------------------------------------------------------------------------

class TestSaleOrderOriginStatusMulti:
    @pytest.fixture
    def orders(self, catalog):
        draft = _make_order(catalog, status=SaleOrder.Status.DRAFT)
        cancelled = _make_order(catalog, status=SaleOrder.Status.CANCELLED)
        confirmed = _make_order(catalog, status=SaleOrder.Status.CONFIRMED)
        return {"draft": draft, "cancelled": cancelled, "confirmed": confirmed}

    def test_single_origin_status_neutral(self, client_auth, orders):
        r = client_auth.get("/api/sales/orders/", {"origin_status": "neutral"})
        assert r.status_code == 200
        ids = {d["id"] for d in r.data["results"]}
        assert orders["draft"].id in ids
        assert orders["confirmed"].id not in ids

    def test_csv_origin_status_neutral_destructive(self, client_auth, orders):
        r = client_auth.get("/api/sales/orders/", {"origin_status": "neutral,destructive"})
        assert r.status_code == 200, f"Expected 200: {r.data}"
        ids = {d["id"] for d in r.data["results"]}
        assert orders["draft"].id in ids
        assert orders["cancelled"].id in ids
        assert orders["confirmed"].id not in ids


# ---------------------------------------------------------------------------
# SaleOrder production_status multi-select
# ---------------------------------------------------------------------------

class TestSaleOrderProductionStatusMulti:
    @pytest.fixture
    def orders(self, catalog):
        no_wt = _make_order(catalog)   # no work orders
        return {"no_wt": no_wt}

    def test_csv_production_status_no_error(self, client_auth, orders):
        """Multi-value production_status must not return 400 or silently ignore."""
        r = client_auth.get("/api/sales/orders/", {"production_status": "none,in_progress"})
        assert r.status_code == 200, f"Expected 200: {r.data}"
        ids = {d["id"] for d in r.data["results"]}
        assert orders["no_wt"].id in ids
