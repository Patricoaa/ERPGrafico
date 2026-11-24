"""ADR-0151: el bruto es la autoridad única del precio de venta; Product.save deriva el neto."""
from decimal import Decimal

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from accounting.vat import gross_from_net
from inventory.models import Product, ProductCategory, UoM, UoMCategory
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


def _make(base, **kw):
    return Product.objects.create(**base, **kw)


def test_create_with_gross_only_derives_net(base):
    p = _make(base, sale_price_gross=Decimal("1450"))
    assert (p.sale_price, p.sale_price_gross) == (Decimal("1218"), Decimal("1450"))


def test_create_with_net_only_derives_gross(base):
    p = _make(base, sale_price=Decimal("1218"))
    assert p.sale_price_gross == Decimal("1449")
    assert p.sale_price == Decimal("1218")


def test_create_with_both_zero_stays_zero(base):
    p = _make(base)
    assert (p.sale_price, p.sale_price_gross) == (0, 0)


@pytest.mark.parametrize("start", [(1000, 1190), (1218, 1450)])
def test_update_with_both_values_is_independent_of_previous(base, start):
    net0, gross0 = start
    p = _make(base, sale_price=Decimal(net0), sale_price_gross=Decimal(gross0))
    p.sale_price = Decimal("1000")
    p.sale_price_gross = Decimal("1450")
    p.save()
    p.refresh_from_db()
    assert (p.sale_price, p.sale_price_gross) == (Decimal("1218"), Decimal("1450"))


def test_legacy_zero_gross_with_net_counts_as_net_only(base):
    p = _make(base, sale_price=Decimal("1000"))
    Product.objects.filter(pk=p.pk).update(sale_price_gross=0)
    p.refresh_from_db()
    p.save()
    assert p.sale_price_gross == gross_from_net(Decimal("1000"))


def test_save_does_not_fetch_old_instance(base):
    p = _make(base, sale_price_gross=Decimal("1190"))
    p.sale_price_gross = Decimal("2380")
    with CaptureQueriesContext(connection) as ctx:
        p.save()
    by_pk = [
        q["sql"]
        for q in ctx.captured_queries
        if q["sql"].startswith("SELECT")
        and 'FROM "inventory_product"' in q["sql"]
        and 'WHERE "inventory_product"."id" =' in q["sql"]
        # The search-index post_save (Postgres only) re-reads the row to build its vector:
        # that is indexing, not save() fetching the old instance.
        and "computed_vector" not in q["sql"]
    ]
    # Solo la consulta del signal pre_save (margen); save() ya no hace la suya.
    assert len(by_pk) == 1, by_pk


def test_surcharge_gross_derives_net(base):
    p = _make(base, price_surcharge_gross=Decimal("119"))
    assert p.price_surcharge == Decimal("100")
    assert p.price_surcharge_gross == Decimal("119")


def test_surcharge_net_only_derives_gross(base):
    p = _make(base, price_surcharge=Decimal("100"))
    assert p.price_surcharge_gross == Decimal("119")


def test_surcharge_both_none_stays_none(base):
    p = _make(base)
    assert p.price_surcharge is None and p.price_surcharge_gross is None


def test_service_update_net_only_converts_to_gross(base):
    p = _make(base, sale_price_gross=Decimal("1450"))
    ProductService.update_product(p, {"sale_price": Decimal("2000")})
    p.refresh_from_db()
    assert p.sale_price_gross == Decimal("2380")
    assert p.sale_price == Decimal("2000")


def test_service_update_gross_wins_when_both(base):
    p = _make(base, sale_price_gross=Decimal("1450"))
    ProductService.update_product(
        p, {"sale_price": Decimal("1000"), "sale_price_gross": Decimal("2380")}
    )
    p.refresh_from_db()
    assert (p.sale_price, p.sale_price_gross) == (Decimal("2000"), Decimal("2380"))


def test_service_create_net_only(base):
    p = ProductService.create_product({**base, "sale_price": Decimal("2000")})
    assert p.sale_price_gross == Decimal("2380")


def test_service_update_variant_net_and_surcharge(base):
    tpl = _make(base, sale_price_gross=Decimal("1190"), has_variants=True)
    var = _make(
        base, parent_template=tpl, sale_price_gross=Decimal("1190"),
        price_inheritance_mode="SURCHARGE", price_surcharge_gross=Decimal("119"),
    )
    ProductService.update_product(
        tpl,
        {"variant_updates": [{"id": var.id, "sale_price": Decimal("2000"), "price_surcharge": Decimal("200")}]},
    )
    var.refresh_from_db()
    assert (var.sale_price, var.sale_price_gross) == (Decimal("2000"), Decimal("2380"))
    assert (var.price_surcharge, var.price_surcharge_gross) == (Decimal("200"), Decimal("238"))


def test_service_update_clears_surcharge(base):
    p = _make(base, price_surcharge_gross=Decimal("119"))
    ProductService.update_product(p, {"price_surcharge": None})
    p.refresh_from_db()
    assert p.price_surcharge is None and p.price_surcharge_gross is None


def test_service_variant_update_clears_surcharge(base):
    tpl = _make(base, sale_price_gross=Decimal("1190"), has_variants=True)
    var = _make(
        base, parent_template=tpl, sale_price_gross=Decimal("1190"),
        price_inheritance_mode="SURCHARGE", price_surcharge_gross=Decimal("119"),
    )
    ProductService.update_product(
        tpl, {"variant_updates": [{"id": var.id, "price_surcharge": None}]}
    )
    var.refresh_from_db()
    assert var.price_surcharge is None and var.price_surcharge_gross is None
