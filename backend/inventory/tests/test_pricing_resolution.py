"""PricingService.resolve_product_price: precio + precio de lista + regla aplicada."""
from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from inventory.models import (
    PricingRule,
    Product,
    ProductCategory,
    ProductUoMPrice,
    UoM,
    UoMCategory,
)
from inventory.services import PricingService, ProductService


@pytest.fixture
def product(db):
    uom = UoM.objects.create(name="Unidad", category=UoMCategory.objects.create(name="Unit"), uom_type="REFERENCE")
    category = ProductCategory.objects.create(name="Impresos")
    product = Product.objects.create(
        name="Tarjeta", category=category, uom=uom, sale_uom=uom, purchase_uom=uom,
        product_type="STORABLE", sale_price=Decimal("1000"),
    )
    product.refresh_from_db()
    return product


def _rule(product, **kwargs):
    defaults = dict(name="Regla", product=product, operator="GE", min_quantity=Decimal("10"), uom=product.uom)
    defaults.update(kwargs)
    return PricingRule.objects.create(**defaults)


def _resolve(product, qty="10"):
    return PricingService.resolve_product_price(product, Decimal(qty), uom=product.uom)


def test_no_rule_returns_list_price_and_source_list(product):
    res = _resolve(product)
    assert res.rule is None
    assert res.source == "LIST"
    assert res.price_gross == product.sale_price_gross
    assert res.list_price_gross == product.sale_price_gross


def test_uom_price_returns_source_uom_price(product):
    ProductUoMPrice.objects.create(product=product, uom=product.uom, price_net=Decimal("800"), price_gross=Decimal("952"))
    res = _resolve(product)
    assert res.source == "UOM_PRICE"
    assert res.price_gross == Decimal("952")
    assert res.list_price_gross == Decimal("952")
    assert res.rule is None


def test_fixed_rule_returns_rule_and_list_price(product):
    rule = _rule(product, rule_type="FIXED", fixed_price_gross=Decimal("1000"))
    res = _resolve(product)
    assert res.rule == rule
    assert res.source == "RULE"
    assert res.price_gross == Decimal("1000")
    assert res.list_price_gross == product.sale_price_gross


def test_package_fixed_rule_returns_unit_price(product):
    rule = _rule(product, rule_type="PACKAGE_FIXED", fixed_price_gross=Decimal("5000"))
    res = _resolve(product, "10")
    assert res.rule == rule
    assert res.price_gross == Decimal("500")


def test_discount_percentage_rule(product):
    rule = _rule(product, rule_type="DISCOUNT_PERCENTAGE", discount_percentage=Decimal("10"))
    res = _resolve(product)
    assert res.rule == rule
    assert res.price_gross == (product.sale_price_gross * Decimal("0.9")).quantize(Decimal("1"))


def test_quantity_below_threshold_ignores_rule(product):
    _rule(product, rule_type="FIXED", fixed_price_gross=Decimal("1000"))
    res = _resolve(product, "5")
    assert res.rule is None
    assert res.source == "LIST"


def test_expired_rule_is_ignored(product):
    _rule(product, rule_type="FIXED", fixed_price_gross=Decimal("1000"), end_date=timezone.localdate() - timedelta(days=1))
    assert _resolve(product).rule is None


def test_inactive_rule_is_ignored(product):
    _rule(product, rule_type="FIXED", fixed_price_gross=Decimal("1000"), active=False)
    assert _resolve(product).rule is None


@pytest.mark.parametrize("kind", ["none", "fixed", "discount"])
def test_get_product_price_matches_resolution(product, kind):
    if kind == "fixed":
        _rule(product, rule_type="FIXED", fixed_price_gross=Decimal("1000"))
    elif kind == "discount":
        _rule(product, rule_type="DISCOUNT_PERCENTAGE", discount_percentage=Decimal("10"))
    qty = Decimal("10")
    assert PricingService.get_product_price(product, qty, uom=product.uom) == PricingService.resolve_product_price(
        product, qty, uom=product.uom
    ).price_gross


def test_surcharge_variant_with_parent_fixed_rule(product):
    """Regresión: variante SURCHARGE + regla FIXED del template padre no debe lanzar UnboundLocalError."""
    variant = Product.objects.create(
        name="Tarjeta Roja", category=product.category, uom=product.uom, sale_uom=product.uom,
        purchase_uom=product.uom, product_type="STORABLE", sale_price=Decimal("1000"),
        parent_template=product, price_inheritance_mode="SURCHARGE", price_surcharge=Decimal("100"),
    )
    variant.refresh_from_db()
    rule = _rule(product, rule_type="FIXED", fixed_price_gross=Decimal("1000"))
    res = PricingService.resolve_product_price(variant, Decimal("10"), uom=variant.uom)
    assert res.rule == rule
    assert res.source == "RULE"
    assert res.price_gross == Decimal("1000") + (Decimal("100") * Decimal("1.19")).quantize(Decimal("1"))


def test_surcharge_variant_three_paths_agree_with_template_rule(db):
    """ADR-0151: plantilla bruto 1450 + recargo bruto 600 -> 2050 (neto 1723) en las tres rutas."""
    uom = UoM.objects.create(name="U4", category=UoMCategory.objects.create(name="Unit4"), uom_type="REFERENCE")
    cat = ProductCategory.objects.create(name="Cat4")
    common = dict(category=cat, uom=uom, sale_uom=uom, purchase_uom=uom, product_type="STORABLE")
    template = Product.objects.create(name="Plantilla", sale_price_gross=Decimal("1450"), **common)
    variant = Product.objects.create(
        name="Variante", parent_template=template, price_inheritance_mode="SURCHARGE",
        price_surcharge_gross=Decimal("600"), sale_price_gross=Decimal("1"), **common,
    )
    variant.refresh_from_db()

    # Sin regla: resolve_variant_price y resolve_product_price
    net, gross = PricingService.resolve_variant_price(variant)
    assert (net, gross) == (Decimal("1723"), Decimal("2050"))
    assert PricingService.resolve_product_price(variant, Decimal("1"), uom=uom).price_gross == Decimal("2050")

    # Con regla FIXED de la plantilla (1450): 1450 + 600
    PricingRule.objects.create(
        name="R", product=template, operator="GE", min_quantity=Decimal("1"), uom=uom,
        rule_type="FIXED", fixed_price_gross=Decimal("1450"),
    )
    assert PricingService.resolve_product_price(variant, Decimal("1"), uom=uom).price_gross == Decimal("2050")
    v2 = Product.objects.get(pk=variant.pk)
    ProductService.bulk_annotate_pricing([v2])
    assert v2.annotated_effective_price == Decimal("2050")
    assert v2.annotated_effective_price_net == Decimal("1723")


def test_surcharge_variant_annotation_without_rule_matches(db):
    uom = UoM.objects.create(name="U6", category=UoMCategory.objects.create(name="Unit6"), uom_type="REFERENCE")
    cat = ProductCategory.objects.create(name="Cat6")
    common = dict(category=cat, uom=uom, sale_uom=uom, purchase_uom=uom, product_type="STORABLE")
    template = Product.objects.create(name="Plantilla6", sale_price_gross=Decimal("1450"), **common)
    variant = Product.objects.create(
        name="Variante6", parent_template=template, price_inheritance_mode="SURCHARGE",
        price_surcharge_gross=Decimal("600"), **common,
    )
    variant = Product.objects.get(pk=variant.pk)
    ProductService.bulk_annotate_pricing([variant])
    assert variant.annotated_effective_price == Decimal("2050")
    assert variant.annotated_effective_price_net == Decimal("1723")


def test_variant_sale_price_is_pure_and_handles_modes(db):
    from accounting.vat import SalePrice
    from inventory.services import variant_sale_price

    uom = UoM.objects.create(name="U5", category=UoMCategory.objects.create(name="Unit5"), uom_type="REFERENCE")
    cat = ProductCategory.objects.create(name="Cat5")
    common = dict(category=cat, uom=uom, sale_uom=uom, purchase_uom=uom, product_type="STORABLE")
    t = Product.objects.create(name="T5", sale_price_gross=Decimal("1450"), **common)
    inh = Product.objects.create(name="I", parent_template=t, price_inheritance_mode="INHERIT", **common)
    sur = Product.objects.create(
        name="S", parent_template=t, price_inheritance_mode="SURCHARGE", price_surcharge_gross=Decimal("600"), **common
    )
    ovr = Product.objects.create(
        name="O", parent_template=t, price_inheritance_mode="OVERRIDE", sale_price_gross=Decimal("999"), **common
    )
    assert variant_sale_price(inh, t) == SalePrice(net=t.sale_price, gross=Decimal("1450"))
    assert variant_sale_price(sur, t) == SalePrice(net=Decimal("1723"), gross=Decimal("2050"))
    assert variant_sale_price(ovr, t).gross == Decimal("999")
