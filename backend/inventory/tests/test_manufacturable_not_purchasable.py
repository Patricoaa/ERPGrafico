"""Un fabricable no se puede comprar: regla de Product.save y migración de datos."""
import importlib
from decimal import Decimal

import pytest
from django.apps import apps

from inventory.models import Product, ProductCategory, UoM, UoMCategory
from inventory.selectors import ProductSelector


@pytest.fixture
def base(db):
    uom = UoM.objects.create(name="Unidad", category=UoMCategory.objects.create(name="Unit"), uom_type="REFERENCE")
    return {"uom": uom, "category": ProductCategory.objects.create(name="Impresos")}


def _product(base, product_type: str, **kw) -> Product:
    defaults = dict(
        name=f"P {product_type}", category=base["category"], uom=base["uom"], sale_uom=base["uom"],
        purchase_uom=base["uom"], product_type=product_type, sale_price=Decimal("1000"), can_be_purchased=True,
    )
    return Product.objects.create(**{**defaults, **kw})


def test_new_manufacturable_is_not_purchasable(base):
    assert _product(base, "MANUFACTURABLE").can_be_purchased is False


def test_switching_to_manufacturable_clears_purchasable(base):
    product = _product(base, "STORABLE")
    assert product.can_be_purchased is True
    product.product_type = "MANUFACTURABLE"
    product.save()
    product.refresh_from_db()
    assert product.can_be_purchased is False


def test_storable_keeps_purchasable(base):
    assert _product(base, "STORABLE").can_be_purchased is True


def test_migration_clears_existing_manufacturables(base):
    manufacturable = _product(base, "MANUFACTURABLE")
    storable = _product(base, "STORABLE")
    Product.objects.filter(pk=manufacturable.pk).update(can_be_purchased=True)
    migration = importlib.import_module("inventory.migrations.0038_manufacturable_not_purchasable")
    migration.clear_purchasable_manufacturables(apps, None)
    manufacturable.refresh_from_db()
    storable.refresh_from_db()
    assert manufacturable.can_be_purchased is False
    assert storable.can_be_purchased is True


def test_capabilities_of_manufacturable_do_not_buy(base):
    assert ProductSelector.get_capabilities(_product(base, "MANUFACTURABLE"))["buys"] is False
