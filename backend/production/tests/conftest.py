import pytest
from rest_framework.test import APIClient

from core.models import User


@pytest.fixture
def api_client(db):
    client = APIClient()
    user = User.objects.create_superuser("testuser", "test@test.com", "pass")
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def work_order_factory(db):
    def make(**kwargs):
        from production.models import WorkOrder

        defaults = {
            "description": "Test OT",
            "status": WorkOrder.Status.DRAFT,
            "current_stage": WorkOrder.Stage.MATERIAL_ASSIGNMENT,
        }
        defaults.update(kwargs)
        return WorkOrder.objects.create(**defaults)

    return make


@pytest.fixture
def warehouse_factory(db):
    def make(**kwargs):
        from inventory.models import Warehouse

        count = Warehouse.objects.count()
        defaults = {"name": f"Bodega Test {count}", "code": f"WH-{count:03d}"}
        defaults.update(kwargs)
        return Warehouse.objects.create(**defaults)

    return make


@pytest.fixture
def customer_factory(db):
    def make(**kwargs):
        from contacts.models import Contact

        count = Contact.objects.count()
        defaults = {"name": f"Cliente Test {count}", "tax_id": f"99{count:06d}-K"}
        defaults.update(kwargs)
        if "tax_id" not in defaults:
            defaults["tax_id"] = "12345678-9"
        return Contact.objects.create(**defaults)

    return make


@pytest.fixture
def sale_order_factory(db, customer_factory):
    def make(customer=None, **kwargs):
        from sales.models import SaleOrder

        defaults = {
            "status": SaleOrder.Status.CONFIRMED,
            "customer": customer or customer_factory(),
        }
        defaults.update(kwargs)
        return SaleOrder.objects.create(**defaults)

    return make


@pytest.fixture
def manufacturable_product(db):
    from inventory.models import Product, ProductCategory, UoM, UoMCategory

    uom_cat, _ = UoMCategory.objects.get_or_create(name="Unidades")
    uom, _ = UoM.objects.get_or_create(name="unidad", defaults={"ratio": 1, "category": uom_cat})
    prod_cat, _ = ProductCategory.objects.get_or_create(name="Test", defaults={"prefix": "TST"})
    return Product.objects.create(
        name="Tarjeta Conftest",
        internal_code="TARJ-CONF-001",
        product_type=Product.Type.MANUFACTURABLE,
        uom=uom,
        category=prod_cat,
    )


@pytest.fixture
def sale_line_factory(db, manufacturable_product, sale_order_factory):
    def make(order=None, **kwargs):
        from decimal import Decimal

        from inventory.models import UoM
        from sales.models import SaleLine

        uom = UoM.objects.get(name="unidad")
        order = order or sale_order_factory()
        return SaleLine.objects.create(
            order=order,
            product=manufacturable_product,
            quantity=Decimal("100"),
            unit_price=Decimal("1000"),
            uom=uom,
            **kwargs,
        )

    return make
