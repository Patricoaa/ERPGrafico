from unittest.mock import patch

import pytest
from django.core.exceptions import ValidationError

from inventory.models import Product, ProductCategory, UoM, UoMCategory
from inventory.strategies.product_type import (
    PRODUCT_TYPE_STRATEGIES,
    ConsumableStrategy,
    ManufacturableStrategy,
    ServiceStrategy,
    StorableStrategy,
    SubscriptionStrategy,
    get_product_type_strategy,
)


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
    return UoM.objects.create(name="unidad", ratio=1, category=UoMCategory.objects.create(name="Unidades"))


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


# ─── Class-level bool properties ───────────────────────────────────────


class TestStrategyProperties:
    @pytest.mark.parametrize(
        "strategy_cls,expected",
        [
            (ConsumableStrategy, {"tracks_inventory": False, "can_have_bom": False, "requires_manufacturing_profile": False, "allows_stock_moves": False, "costing_method": "none", "supports_returns": True}),
            (StorableStrategy, {"tracks_inventory": True, "can_have_bom": False, "requires_manufacturing_profile": False, "allows_stock_moves": True, "costing_method": "average", "supports_returns": True}),
            (ManufacturableStrategy, {"tracks_inventory": True, "can_have_bom": True, "requires_manufacturing_profile": True, "allows_stock_moves": True, "costing_method": "average", "supports_returns": True}),
            (ServiceStrategy, {"tracks_inventory": False, "can_have_bom": False, "requires_manufacturing_profile": False, "allows_stock_moves": False, "costing_method": "none", "supports_returns": False}),
            (SubscriptionStrategy, {"tracks_inventory": False, "can_have_bom": False, "requires_manufacturing_profile": False, "allows_stock_moves": False, "costing_method": "none", "supports_returns": False}),
        ],
    )
    def test_bool_properties(self, strategy_cls, expected):
        instance = strategy_cls()
        for prop, value in expected.items():
            assert getattr(instance, prop) == value, f"{strategy_cls.__name__}.{prop} should be {value}"


# ─── Factory ───────────────────────────────────────────────────────────


class TestGetProductTypeStrategy:
    def test_returns_correct_strategy(self):
        assert isinstance(get_product_type_strategy("CONSUMABLE"), ConsumableStrategy)
        assert isinstance(get_product_type_strategy("STORABLE"), StorableStrategy)
        assert isinstance(get_product_type_strategy("MANUFACTURABLE"), ManufacturableStrategy)
        assert isinstance(get_product_type_strategy("SERVICE"), ServiceStrategy)
        assert isinstance(get_product_type_strategy("SUBSCRIPTION"), SubscriptionStrategy)

    def test_unknown_type_raises(self):
        with pytest.raises(NotImplementedError, match="No ProductTypeStrategy registered"):
            get_product_type_strategy("INVENTADO")

    def test_all_registered_types_have_correct_class(self):
        assert isinstance(PRODUCT_TYPE_STRATEGIES["CONSUMABLE"], ConsumableStrategy)
        assert isinstance(PRODUCT_TYPE_STRATEGIES["STORABLE"], StorableStrategy)
        assert isinstance(PRODUCT_TYPE_STRATEGIES["MANUFACTURABLE"], ManufacturableStrategy)
        assert isinstance(PRODUCT_TYPE_STRATEGIES["SERVICE"], ServiceStrategy)
        assert isinstance(PRODUCT_TYPE_STRATEGIES["SUBSCRIPTION"], SubscriptionStrategy)


# ─── validate() ────────────────────────────────────────────────────────


class TestValidate:
    def test_manufacturable_without_bom_express(self, product_factory):
        strategy = ManufacturableStrategy()
        product = product_factory("MANUFACTURABLE", mfg_auto_finalize=True, has_bom=False)
        with pytest.raises(ValidationError, match="Lista de Materiales activa"):
            strategy.validate(product)

    def test_manufacturable_with_bom_express(self, product_factory):
        strategy = ManufacturableStrategy()
        product = product_factory("MANUFACTURABLE", mfg_auto_finalize=True, has_bom=False)
        with patch.object(Product, "has_active_bom", return_value=True):
            strategy.validate(product)

    def test_manufacturable_not_express(self, product_factory):
        strategy = ManufacturableStrategy()
        product = product_factory("MANUFACTURABLE", mfg_auto_finalize=False, has_bom=False)
        strategy.validate(product)

    def test_subscription_without_recurrence(self, product_factory):
        strategy = SubscriptionStrategy()
        product = product_factory("SUBSCRIPTION", recurrence_period=None)
        with pytest.raises(ValidationError, match="Período de Recurrencia"):
            strategy.validate(product)

    def test_subscription_with_recurrence(self, product_factory):
        strategy = SubscriptionStrategy()
        product = product_factory("SUBSCRIPTION", recurrence_period=30)
        strategy.validate(product)

    def test_other_types_have_no_validation(self, product_factory):
        for product_type in ("CONSUMABLE", "STORABLE", "SERVICE"):
            strategy = get_product_type_strategy(product_type)
            product = product_factory(product_type)
            strategy.validate(product)


# ─── Account resolution ────────────────────────────────────────────────


class TestAccountResolution:
    def test_consumable_accounts(self, product_factory, accounts, category):
        product = product_factory("CONSUMABLE")
        strat = ConsumableStrategy()
        assert strat.get_asset_account(product) == accounts["asset"]
        assert strat.get_income_account(product) == accounts["income"]
        assert strat.get_expense_account(product) == accounts["expense"]

    def test_storable_accounts(self, product_factory, accounts):
        product = product_factory("STORABLE")
        strat = StorableStrategy()
        assert strat.get_asset_account(product) == accounts["asset"]
        assert strat.get_income_account(product) == accounts["income"]
        assert strat.get_expense_account(product) == accounts["expense"]

    def test_manufacturable_accounts(self, product_factory, accounts):
        product = product_factory("MANUFACTURABLE")
        strat = ManufacturableStrategy()
        assert strat.get_asset_account(product) == accounts["asset"]
        assert strat.get_income_account(product) == accounts["income"]
        assert strat.get_expense_account(product) == accounts["expense"]

    def test_service_accounts(self, product_factory, accounts):
        product = product_factory("SERVICE")
        strat = ServiceStrategy()
        assert strat.get_asset_account(product) is None
        assert strat.get_income_account(product) == accounts["income"]
        assert strat.get_expense_account(product) == accounts["expense"]

    def test_subscription_accounts(self, product_factory, accounts):
        product = product_factory("SUBSCRIPTION")
        strat = SubscriptionStrategy()
        assert strat.get_asset_account(product) is None
        assert strat.get_income_account(product) == accounts["income"]
        assert strat.get_expense_account(product) == accounts["expense"]

    def test_no_settings_returns_none(self, db, uom, accounting_settings):
        bare_category = ProductCategory.objects.create(name="Bare", prefix="BAR")
        product = Product.objects.create(
            name="No settings",
            internal_code="NO-SET",
            product_type="CONSUMABLE",
            uom=uom,
            category=bare_category,
        )
        strat = ConsumableStrategy()
        with patch("inventory.strategies.product_type.ProductTypeStrategy._get_settings", return_value=None):
            assert strat.get_asset_account(product) is None
            assert strat.get_income_account(product) is None
            assert strat.get_expense_account(product) is None


# ─── Product.strategy delegation ──────────────────────────────────────


class TestProductStrategyDelegation:
    def test_strategy_property(self, product_factory):
        product = product_factory("STORABLE")
        strat = product.strategy
        assert isinstance(strat, StorableStrategy)
        assert strat.tracks_inventory is True
        assert strat.can_have_bom is False

    def test_strategy_via_service_product(self, product_factory):
        product = product_factory("SERVICE")
        strat = product.strategy
        assert isinstance(strat, ServiceStrategy)
        assert strat.supports_returns is False
