import pytest

from inventory.filters import ProductFilter
from inventory.models import Product, ProductCategory, UoM, UoMCategory


@pytest.fixture
def product_type_catalog(db):
    uom_cat = UoMCategory.objects.create(name="Unidades")
    uom = UoM.objects.create(name="unidad", ratio=1, category=uom_cat)
    category = ProductCategory.objects.create(name="Cat", prefix="CAT")
    products = {}
    for ptype in (Product.Type.STORABLE, Product.Type.SERVICE, Product.Type.MANUFACTURABLE):
        products[ptype] = Product.objects.create(
            name=f"Producto {ptype}",
            internal_code=f"PROD-{ptype}",
            product_type=ptype,
            uom=uom,
            category=category,
        )
    return products


@pytest.mark.django_db
def test_product_type_exact_still_works(product_type_catalog):
    f = ProductFilter({"product_type": "STORABLE"}, queryset=Product.objects.all())
    assert list(f.qs) == [product_type_catalog[Product.Type.STORABLE]]


@pytest.mark.django_db
def test_product_type_in_returns_matching_types(product_type_catalog):
    f = ProductFilter(
        {"product_type__in": "STORABLE,SERVICE"}, queryset=Product.objects.all()
    )
    assert set(f.qs) == {
        product_type_catalog[Product.Type.STORABLE],
        product_type_catalog[Product.Type.SERVICE],
    }


@pytest.mark.django_db
def test_product_type_in_single_value(product_type_catalog):
    f = ProductFilter({"product_type__in": "MANUFACTURABLE"}, queryset=Product.objects.all())
    assert list(f.qs) == [product_type_catalog[Product.Type.MANUFACTURABLE]]
