"""Fixtures compartidos de billing/tests (movidos desde test_invoice_from_lines.py)."""

from decimal import Decimal

import pytest

from accounting.models import Account, AccountingSettings, AccountType
from contacts.models import Contact
from inventory.models import Location, Product, ProductCategory, UoM, UoMCategory, Warehouse
from treasury.models import TreasuryAccount


@pytest.fixture(autouse=True)
def _any_account_is_cash(monkeypatch):
    # Igual que core/treasury tests: evita exigir la jerarquía del plan de cuentas para la caja
    monkeypatch.setattr(Account, "get_cash_pool_accounts", classmethod(lambda cls: cls.objects.all()))


@pytest.fixture
def env(db):
    def acc(code, name, kind):
        return Account.objects.create(code=code, name=name, account_type=kind)

    settings = AccountingSettings.get_solo()
    settings.default_receivable_account = acc("1.1.03.082", "Clientes", AccountType.ASSET)
    settings.default_revenue_account = acc("4.1.01.082", "Ventas", AccountType.INCOME)
    settings.default_tax_payable_account = acc("2.1.05.082", "IVA Débito", AccountType.LIABILITY)
    settings.default_advance_payment_account = acc("2.1.07.082", "Anticipos de clientes", AccountType.LIABILITY)
    settings.save()

    uom_cat, _ = UoMCategory.objects.get_or_create(name="Unidades")
    uom, _ = UoM.objects.get_or_create(name="unidad", defaults={"ratio": 1, "category": uom_cat})
    cat, _ = ProductCategory.objects.get_or_create(name="Test", defaults={"prefix": "TST"})
    storable = Product.objects.create(name="Afiche", internal_code="AFI-82", product_type=Product.Type.STORABLE,
                                      uom=uom, category=cat, cost_price=Decimal("0"))
    service = Product.objects.create(name="Diseño", internal_code="DIS-82", product_type=Product.Type.SERVICE,
                                     uom=uom, category=cat, cost_price=Decimal("0"))
    warehouse = Warehouse.objects.create(name="Bodega", code="WH-82")
    Location.objects.get_or_create(location_type="INTERNAL", warehouse=warehouse, defaults={"name": "Interno"})
    Location.objects.get_or_create(location_type="CUSTOMER", defaults={"name": "Cliente"})
    cash_acc = acc("1.1.01.082", "Caja", AccountType.ASSET)
    cash = TreasuryAccount.objects.create(name="Caja", account=cash_acc, account_type=TreasuryAccount.Type.CASH)
    return {
        "uom": uom, "storable": storable, "service": service, "warehouse": warehouse, "cash": cash,
        "customer": Contact.objects.create(name="Imprenta Norte", tax_id="12345678-9"),
        "other": Contact.objects.create(name="Otra Imprenta", tax_id="98765432-1"),
    }
