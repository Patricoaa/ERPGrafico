"""ADR-0151: un bruto None explícito (sin neto) limpia también el neto."""
from decimal import Decimal

from inventory.models import PricingRule, Product
from inventory.services import ProductService
from inventory.tests.test_sale_price_authority import _make, base  # noqa: F401
from inventory.tests.test_sale_price_authority_rules import api, product  # noqa: F401


def test_service_update_gross_none_clears_surcharge_both(base):  # noqa: F811
    tpl = _make(base, sale_price_gross=Decimal("1190"), has_variants=True)
    var = _make(
        base, parent_template=tpl, sale_price_gross=Decimal("1190"),
        price_inheritance_mode="SURCHARGE", price_surcharge_gross=Decimal("119"),
    )
    ProductService.update_product(
        var, {"price_inheritance_mode": "INHERIT", "price_surcharge_gross": None}
    )
    var = Product.objects.get(pk=var.pk)
    assert var.price_surcharge is None and var.price_surcharge_gross is None


def test_rule_endpoint_patch_gross_none_clears_both(product, api):  # noqa: F811
    r = PricingRule.objects.create(
        name="R", product=product, operator="GE", min_quantity=Decimal("10"), uom=product.uom,
        fixed_price=Decimal("1000"), fixed_price_gross=Decimal("1190"),
    )
    resp = api.patch(
        f"/api/inventory/pricing-rules/{r.id}/", {"fixed_price_gross": None}, format="json"
    )
    assert resp.status_code == 200, resp.content
    r.refresh_from_db()
    assert r.fixed_price is None and r.fixed_price_gross is None
