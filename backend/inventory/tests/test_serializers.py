from decimal import Decimal
from unittest.mock import patch

import pytest

from inventory.models import Product, ProductCategory, UoM, UoMCategory
from inventory.serializers import ProductListSerializer


@pytest.fixture
def accounting_settings(db):
    with patch("core.cache.invalidate_singleton"):
        from accounting.models import AccountingSettings

        return AccountingSettings.objects.create(
            asset_prefix="1",
            liability_prefix="2",
            equity_prefix="3",
            income_prefix="4",
            expense_prefix="5",
        )


@pytest.fixture
def accounts(accounting_settings):
    from accounting.models import Account, AccountType

    with patch("core.cache.cached_singleton", return_value=accounting_settings):
        asset = Account.objects.create(name="Activo", account_type=AccountType.ASSET)
        income = Account.objects.create(name="Ingreso", account_type=AccountType.INCOME)
        expense = Account.objects.create(name="Gasto", account_type=AccountType.EXPENSE)
    accounting_settings.storable_inventory_account = asset
    accounting_settings.manufacturable_inventory_account = asset
    accounting_settings.default_consumable_account = expense
    accounting_settings.default_revenue_account = income
    accounting_settings.default_expense_account = expense
    accounting_settings.default_service_revenue_account = income
    accounting_settings.default_service_expense_account = expense
    accounting_settings.default_subscription_revenue_account = income
    accounting_settings.default_subscription_expense_account = expense
    accounting_settings.merchandise_cogs_account = expense
    accounting_settings.manufactured_cogs_account = expense
    with patch("core.cache.invalidate_singleton"):
        accounting_settings.save()
    return {"asset": asset, "income": income, "expense": expense}


@pytest.fixture
def uom(db):
    return UoM.objects.create(
        name="unidad", ratio=1, category=UoMCategory.objects.create(name="Unidades")
    )


@pytest.fixture
def category(db, accounts):
    return ProductCategory.objects.create(
        name="Test",
        prefix="TST",
        asset_account=accounts["asset"],
        income_account=accounts["income"],
        expense_account=accounts["expense"],
    )


@pytest.fixture
def product_factory(db, uom, category):
    def make(product_type: str, **overrides):
        fields = {
            "name": f"Producto {product_type}",
            "internal_code": f"PROD-{product_type}",
            "product_type": product_type,
            "uom": uom,
            "category": category,
        }
        fields.update(overrides)
        return Product.objects.create(**fields)

    return make


class TestProductListSerializerManufacturingFields:
    """Regresión: el list usado por el POS debe exponer los flags de manufactura
    que isPOSProductDisabled necesita para clasificar ADVANCED / EXPRESS / SIMPLE."""

    def test_exposes_manufacturing_flags(self, product_factory, uom):
        product = product_factory(
            "MANUFACTURABLE",
            has_bom=True,
            requires_advanced_manufacturing=True,
            mfg_auto_finalize=False,
            mfg_enable_prepress=True,
            mfg_enable_press=True,
            mfg_enable_postpress=False,
            sale_price_gross=Decimal("11.90"),
        )

        data = ProductListSerializer(product).data

        assert data["has_bom"] is True
        assert data["requires_advanced_manufacturing"] is True
        assert data["mfg_auto_finalize"] is False
        assert data["mfg_enable_prepress"] is True
        assert data["mfg_enable_press"] is True
        assert data["mfg_enable_postpress"] is False

    def test_exposes_manufacturable_quantity_without_active_bom(self, product_factory):
        product = product_factory("MANUFACTURABLE", has_bom=False)

        data = ProductListSerializer(product).data

        assert "manufacturable_quantity" in data
        assert data["manufacturable_quantity"] is None

    def test_exposes_sale_price_gross_image_and_available_uoms(self, product_factory, uom):
        product = product_factory("STORABLE", sale_price_gross=Decimal("11.90"))
        product.refresh_from_db()

        data = ProductListSerializer(product).data

        assert data["sale_price_gross"] == str(product.sale_price_gross)
        assert "image" in data
        assert len(data["available_uoms"]) == 1
        assert data["available_uoms"][0]["id"] == uom.id
