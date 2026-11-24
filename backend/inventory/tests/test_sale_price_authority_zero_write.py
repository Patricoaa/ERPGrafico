"""ADR-0151: un bruto 0 explícito (sin neto) es autoritativo: deja 0/0, no re-deriva el neto viejo."""
from decimal import Decimal

import pytest

from inventory.models import PricingRule, ProductUoMPrice
from inventory.services import ProductService, net_write_to_gross
from inventory.tests.test_sale_price_authority import _make, base  # noqa: F401
from inventory.tests.test_sale_price_authority_rules import api, product  # noqa: F401

pytestmark = pytest.mark.django_db
ZERO = Decimal("0")


def test_helper_zero_gross_sets_net_zero():
    assert net_write_to_gross({"g": ZERO}, "n", "g", clear_on_none=False) == {"g": ZERO, "n": ZERO}


def test_helper_nonzero_gross_and_net_only_unchanged():
    assert net_write_to_gross({"g": Decimal("1190")}, "n", "g", clear_on_none=False) == {"g": Decimal("1190")}
    assert net_write_to_gross({"n": Decimal("1000")}, "n", "g", clear_on_none=False)["g"] == Decimal("1190")


def test_helper_zero_gross_with_explicit_net_keeps_net():
    d = net_write_to_gross({"g": ZERO, "n": Decimal("1000")}, "n", "g", clear_on_none=False)
    assert d["n"] == Decimal("1000")


def test_product_update_gross_zero(base):  # noqa: F811
    p = _make(base, sale_price_gross=Decimal("1450"))
    assert p.sale_price == Decimal("1218")
    ProductService.update_product(p, {"sale_price_gross": ZERO})
    p.refresh_from_db()
    assert (p.sale_price, p.sale_price_gross) == (ZERO, ZERO)


def test_product_update_nonzero_gross_still_works(base):  # noqa: F811
    p = _make(base, sale_price_gross=Decimal("1450"))
    ProductService.update_product(p, {"sale_price_gross": Decimal("1190")})
    p.refresh_from_db()
    assert (p.sale_price, p.sale_price_gross) == (Decimal("1000"), Decimal("1190"))


def test_product_update_net_only_still_works(base):  # noqa: F811
    p = _make(base, sale_price_gross=Decimal("1450"))
    ProductService.update_product(p, {"sale_price": Decimal("1000")})
    p.refresh_from_db()
    assert (p.sale_price, p.sale_price_gross) == (Decimal("1000"), Decimal("1190"))


def test_variant_direct_update_gross_zero(base):  # noqa: F811
    tpl = _make(base, sale_price_gross=Decimal("1190"), has_variants=True)
    var = _make(
        base, parent_template=tpl, sale_price_gross=Decimal("1450"),
        price_inheritance_mode="OVERRIDE",
    )
    ProductService.update_product(var, {"sale_price_gross": ZERO})
    var.refresh_from_db()
    assert (var.sale_price, var.sale_price_gross) == (ZERO, ZERO)


def test_variant_updates_gross_zero(base):  # noqa: F811
    tpl = _make(base, sale_price_gross=Decimal("1190"), has_variants=True)
    var = _make(
        base, parent_template=tpl, sale_price_gross=Decimal("1450"),
        price_inheritance_mode="OVERRIDE",
    )
    ProductService.update_product(tpl, {"variant_updates": [{"id": var.id, "sale_price_gross": ZERO}]})
    var.refresh_from_db()
    assert (var.sale_price, var.sale_price_gross) == (ZERO, ZERO)


def test_surcharge_gross_zero(base):  # noqa: F811
    tpl = _make(base, sale_price_gross=Decimal("1190"), has_variants=True)
    var = _make(
        base, parent_template=tpl, sale_price_gross=Decimal("1190"),
        price_inheritance_mode="SURCHARGE", price_surcharge_gross=Decimal("119"),
    )
    ProductService.update_product(var, {"price_surcharge_gross": ZERO})
    var.refresh_from_db()
    assert (var.price_surcharge, var.price_surcharge_gross) == (ZERO, ZERO)


def test_rule_endpoint_patch_gross_zero(product, api):  # noqa: F811
    r = PricingRule.objects.create(
        name="R", product=product, operator="GE", min_quantity=Decimal("10"), uom=product.uom,
        fixed_price_gross=Decimal("1450"),
    )
    resp = api.patch(f"/api/inventory/pricing-rules/{r.id}/", {"fixed_price_gross": "0"}, format="json")
    assert resp.status_code == 200, resp.content
    r.refresh_from_db()
    assert (r.fixed_price, r.fixed_price_gross) == (ZERO, ZERO)


def test_uom_price_endpoint_patch_gross_zero(product, api):  # noqa: F811
    u = ProductUoMPrice.objects.create(product=product, uom=product.uom, price_gross=Decimal("1450"), price_net=Decimal("1218"))
    resp = api.patch(f"/api/inventory/uom-prices/{u.id}/", {"price_gross": "0"}, format="json")
    assert resp.status_code == 200, resp.content
    u.refresh_from_db()
    assert (u.price_net, u.price_gross) == (ZERO, ZERO)


def test_service_uom_prices_gross_zero(product):  # noqa: F811
    ProductService.update_product(
        product, {"uom_prices": [{"uom": product.uom, "price_gross": ZERO}]}
    )
    u = product.uom_prices.get()
    assert (u.price_net, u.price_gross) == (ZERO, ZERO)
