import sys
import pytest
from datetime import date
from decimal import Decimal
from rest_framework.test import APIClient

from core.models import User

# ---------------------------------------------------------------------------
#  Patch get_cash_pool_accounts to avoid prefix-check during tests
# ---------------------------------------------------------------------------
if "pytest" in sys.modules:
    from accounting.models import Account

    @classmethod
    def _mock_get_cash_pool_accounts(cls):
        return cls.objects.all()

    Account.get_cash_pool_accounts = _mock_get_cash_pool_accounts


@pytest.fixture(autouse=True)
def clear_singleton_cache():
    from django.core.cache import cache
    cache.clear()
    yield
    cache.clear()


@pytest.fixture(autouse=True)
def setup_cash_group_account(db):
    from accounting.models import Account, AccountType
    if not Account.objects.filter(code=Account.CASH_GROUP_CODE).exists():
        Account.objects.create(
            code=Account.CASH_GROUP_CODE,
            name="Efectivo y Equivalentes",
            account_type=AccountType.ASSET,
        )


@pytest.fixture
def api_client(db):
    client = APIClient()
    user = User.objects.create_superuser("n1test", "n1test@test.com", "pass")
    client.force_authenticate(user=user)
    return client


# ---------------------------------------------------------------------------
#  UoM / Category primitives
# ---------------------------------------------------------------------------

@pytest.fixture
def uom_category(db):
    from inventory.models import UoMCategory
    return UoMCategory.objects.create(name="Unidades")


@pytest.fixture
def uom(db, uom_category):
    from inventory.models import UoM
    return UoM.objects.create(
        name="Unidad", category=uom_category, ratio=Decimal("1.00000"),
    )


@pytest.fixture
def product_category(db):
    from inventory.models import ProductCategory
    return ProductCategory.objects.create(name="Cat Test", prefix="CAT")


# ---------------------------------------------------------------------------
#  Contact
# ---------------------------------------------------------------------------

@pytest.fixture
def contact(db):
    from contacts.models import Contact
    return Contact.objects.create(name="Cliente Test", tax_id="76.123.456-7")


@pytest.fixture
def supplier_contact(db):
    from contacts.models import Contact
    return Contact.objects.create(name="Proveedor Test", tax_id="76.987.654-3")


# ---------------------------------------------------------------------------
#  Accounting
# ---------------------------------------------------------------------------

@pytest.fixture
def account_asset(db):
    from accounting.models import Account, AccountType
    return Account.objects.create(
        code="1.1.01.001", name="Caja", account_type=AccountType.ASSET,
    )


@pytest.fixture
def account_income(db):
    from accounting.models import Account, AccountType
    return Account.objects.create(
        code="4.1.01.001", name="Ventas", account_type=AccountType.INCOME,
    )


# ---------------------------------------------------------------------------
#  Warehouse / Locations
# ---------------------------------------------------------------------------

@pytest.fixture
def warehouse(db):
    from inventory.models import Warehouse
    return Warehouse.objects.create(name="Bodega Central", code="WH-001")


@pytest.fixture
def internal_location(db, warehouse):
    from inventory.models import Location
    return Location.objects.create(
        name="Ubicación Principal", location_type="INTERNAL", warehouse=warehouse,
    )


# ---------------------------------------------------------------------------
#  Product
# ---------------------------------------------------------------------------

@pytest.fixture
def product(db, product_category, uom):
    from inventory.models import Product
    return Product.objects.create(
        name="Producto Test", code="PRD-001",
        category=product_category, product_type="STORABLE", uom=uom,
        sale_uom=uom, purchase_uom=uom,
    )


# ---------------------------------------------------------------------------
#  Bank / TreasuryAccount
# ---------------------------------------------------------------------------

@pytest.fixture
def bank(db):
    from treasury.models import Bank
    return Bank.objects.create(name="Banco Test", code="BT")


@pytest.fixture
def treasury_account(db, bank, account_asset):
    from treasury.models import TreasuryAccount
    return TreasuryAccount.objects.create(
        name="Cta Corriente", account_type="CHECKING",
        bank=bank, account_number="12345678", account=account_asset,
    )


@pytest.fixture
def cash_account(db):
    from treasury.models import TreasuryAccount
    from accounting.models import Account, AccountType
    cash_acc = Account.objects.create(
        code="1.1.01.100", name="Caja Chica", account_type=AccountType.ASSET,
    )
    return TreasuryAccount.objects.create(
        name="Caja Física", account_type="CASH", account=cash_acc,
    )


# ---------------------------------------------------------------------------
#  Sale Order
# ---------------------------------------------------------------------------

@pytest.fixture
def sale_order(db, contact):
    from sales.models import SaleOrder
    return SaleOrder.objects.create(
        status="CONFIRMED", customer=contact,
    )


@pytest.fixture
def sale_order_with_lines(db, sale_order, product, uom):
    from sales.models import SaleLine
    SaleLine.objects.create(
        order=sale_order, product=product, description="Línea 1",
        quantity=Decimal("10"), unit_price=Decimal("1000"), uom=uom,
    )
    SaleLine.objects.create(
        order=sale_order, product=product, description="Línea 2",
        quantity=Decimal("5"), unit_price=Decimal("2000"), uom=uom,
    )
    return sale_order


# ---------------------------------------------------------------------------
#  Invoice
# ---------------------------------------------------------------------------

@pytest.fixture
def invoice(db, contact, sale_order):
    from billing.models import Invoice
    return Invoice.objects.create(
        dte_type="FACTURA", status="POSTED", contact=contact,
        sale_order=sale_order,
    )


# ---------------------------------------------------------------------------
#  Purchase Order
# ---------------------------------------------------------------------------

@pytest.fixture
def purchase_order(db, supplier_contact):
    from purchasing.models import PurchaseOrder
    return PurchaseOrder.objects.create(
        status="CONFIRMED", supplier=supplier_contact,
    )


# ---------------------------------------------------------------------------
#  Work Order
# ---------------------------------------------------------------------------

@pytest.fixture
def work_order(db, sale_order, product, warehouse):
    from production.models import WorkOrder
    return WorkOrder.objects.create(
        description="OT Test", status="DRAFT",
        sale_order=sale_order, product=product, warehouse=warehouse,
    )


# ---------------------------------------------------------------------------
#  Payroll (HR)
# ---------------------------------------------------------------------------

@pytest.fixture
def afp(db):
    from hr.models import AFP
    return AFP.objects.create(name="AFP Modelo", percentage=Decimal("11.27"))


@pytest.fixture
def employee(db, contact, afp):
    from hr.models import Employee
    return Employee.objects.create(
        contact=contact, afp=afp, status="ACTIVE",
        contract_type="INDEFINIDO",
    )


@pytest.fixture
def payroll_concept(db, account_income):
    from hr.models import PayrollConcept
    return PayrollConcept.objects.create(
        name="Sueldo Base", category="HABER_IMPONIBLE", account=account_income,
    )
