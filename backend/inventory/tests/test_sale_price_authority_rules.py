"""ADR-0151 (Task 3): PricingRule y ProductUoMPrice derivan el neto solo del bruto."""
from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from inventory.models import (
    PricingRule,
    Product,
    ProductCategory,
    ProductUoMPrice,
    UoM,
    UoMCategory,
)
from inventory.services import ProductService


@pytest.fixture
def base(db):
    uom = UoM.objects.create(
        name="Unidad", category=UoMCategory.objects.create(name="Unit"), uom_type="REFERENCE"
    )
    category = ProductCategory.objects.create(name="Impresos")
    return dict(
        name="Tarjeta", category=category, uom=uom, sale_uom=uom, purchase_uom=uom,
        product_type="STORABLE",
    )


@pytest.fixture
def product(base):
    return Product.objects.create(**base, sale_price_gross=Decimal("1190"))


@pytest.fixture
def api(db):
    from django.contrib.auth import get_user_model

    client = APIClient()
    client.force_authenticate(
        user=get_user_model().objects.create_superuser(username="adr0151", password="x")
    )
    return client


def _rule(product, **kw):
    defaults = dict(
        name="R", product=product, operator="GE", min_quantity=Decimal("10"), uom=product.uom
    )
    defaults.update(kw)
    return PricingRule.objects.create(**defaults)


def test_rule_gross_only_derives_net(product):
    r = _rule(product, fixed_price_gross=Decimal("1450"))
    assert (r.fixed_price, r.fixed_price_gross) == (Decimal("1218"), Decimal("1450"))


def test_rule_net_only_derives_gross(product):
    assert _rule(product, fixed_price=Decimal("1000")).fixed_price_gross == Decimal("1190")


def test_rule_gross_wins_when_inconsistent(product):
    r = _rule(product, fixed_price=Decimal("1000"), fixed_price_gross=Decimal("2380"))
    assert (r.fixed_price, r.fixed_price_gross) == (Decimal("2000"), Decimal("2380"))


def test_rule_without_prices_stays_none(product):
    r = _rule(product, rule_type="DISCOUNT_PERCENTAGE", discount_percentage=Decimal("10"))
    r.save()
    r.refresh_from_db()
    assert r.fixed_price is None and r.fixed_price_gross is None


def test_rule_save_ignores_previous_instance(product):
    r = _rule(product, fixed_price=Decimal("1000"))
    r.fixed_price = Decimal("2000")  # neto cambiado con bruto viejo: el bruto manda
    r.save()
    r.refresh_from_db()
    assert (r.fixed_price, r.fixed_price_gross) == (Decimal("1000"), Decimal("1190"))


def test_rule_endpoint_patch_net_only(product, api):
    r = _rule(product, fixed_price=Decimal("1000"), fixed_price_gross=Decimal("1190"))
    resp = api.patch(f"/api/inventory/pricing-rules/{r.id}/", {"fixed_price": "2000"}, format="json")
    assert resp.status_code == 200, resp.content
    r.refresh_from_db()
    assert (r.fixed_price, r.fixed_price_gross) == (Decimal("2000"), Decimal("2380"))


def test_rule_endpoint_patch_inconsistent_gross_wins(product, api):
    r = _rule(product, fixed_price=Decimal("1000"), fixed_price_gross=Decimal("1190"))
    resp = api.patch(
        f"/api/inventory/pricing-rules/{r.id}/",
        {"fixed_price": "5000", "fixed_price_gross": "2380"},
        format="json",
    )
    assert resp.status_code == 200, resp.content
    r.refresh_from_db()
    assert (r.fixed_price, r.fixed_price_gross) == (Decimal("2000"), Decimal("2380"))


def test_rule_endpoint_patch_clears_price(product, api):
    r = _rule(product, fixed_price=Decimal("1000"), fixed_price_gross=Decimal("1190"))
    resp = api.patch(f"/api/inventory/pricing-rules/{r.id}/", {"fixed_price": None}, format="json")
    assert resp.status_code == 200, resp.content
    r.refresh_from_db()
    assert r.fixed_price is None and r.fixed_price_gross is None


def test_rule_endpoint_patch_other_field_keeps_prices(product, api):
    r = _rule(product, fixed_price=Decimal("1000"), fixed_price_gross=Decimal("1190"))
    resp = api.patch(f"/api/inventory/pricing-rules/{r.id}/", {"name": "Otra"}, format="json")
    assert resp.status_code == 200, resp.content
    r.refresh_from_db()
    assert (r.fixed_price, r.fixed_price_gross) == (Decimal("1000"), Decimal("1190"))


def test_uom_price_save_rules(product):
    uom = product.uom
    a = ProductUoMPrice.objects.create(
        product=product, uom=uom, price_gross=Decimal("1450"), price_net=Decimal("0")
    )
    assert (a.price_net, a.price_gross) == (Decimal("1218"), Decimal("1450"))
    a.price_net = Decimal("9999")  # neto cambiado con bruto viejo: el bruto manda
    a.save()
    a.refresh_from_db()
    assert (a.price_net, a.price_gross) == (Decimal("1218"), Decimal("1450"))
    a.delete()
    b = ProductUoMPrice.objects.create(
        product=product, uom=uom, price_net=Decimal("1000"), price_gross=Decimal("0")
    )
    assert b.price_gross == Decimal("1190")


def test_uom_price_endpoint_patch_net_only(product, api):
    u = ProductUoMPrice.objects.create(
        product=product, uom=product.uom, price_gross=Decimal("1190"), price_net=Decimal("1000")
    )
    resp = api.patch(f"/api/inventory/uom-prices/{u.id}/", {"price_net": "2000"}, format="json")
    assert resp.status_code == 200, resp.content
    u.refresh_from_db()
    assert (u.price_net, u.price_gross) == (Decimal("2000"), Decimal("2380"))


def test_service_update_replaces_uom_prices(product):
    uom = product.uom
    ProductService.update_product(
        product, {"uom_prices": [{"uom": uom, "price_net": Decimal("1000"), "price_gross": Decimal("0")}]}
    )
    ProductService.update_product(
        product, {"uom_prices": [{"uom": uom, "price_gross": Decimal("2380"), "price_net": Decimal("1")}]}
    )
    u = product.uom_prices.get()
    assert (u.price_net, u.price_gross) == (Decimal("2000"), Decimal("2380"))
