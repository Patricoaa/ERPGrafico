from decimal import Decimal

import pytest
from django.core.management import call_command

from accounting.vat import net_from_gross
from inventory.models import PricingRule, Product, ProductCategory, ProductUoMPrice, UoM, UoMCategory
from inventory.price_rederivation import rederive_sale_prices

M = Decimal("1.19")


def _run(apply):
    return rederive_sale_prices(
        product=Product, pricing_rule=PricingRule, uom_price=ProductUoMPrice, multiplier=M, apply=apply
    )


@pytest.fixture
def product(db):
    uom = UoM.objects.create(name="Unidad", category=UoMCategory.objects.create(name="Unit"), uom_type="REFERENCE")
    cat = ProductCategory.objects.create(name="Gen")
    p = Product.objects.create(
        name="P", category=cat, uom=uom, sale_uom=uom, purchase_uom=uom, product_type="STORABLE",
        sale_price=Decimal("100"),
    )
    return p, uom


def _raw(p, **kw):
    Product.objects.filter(pk=p.pk).update(**kw)


@pytest.mark.django_db
def test_consistent_row_unchanged(product):
    p, _ = product
    _raw(p, sale_price=Decimal("1218"), sale_price_gross=Decimal("1449"))
    assert _run(True)["Product"].changed == 0
    p.refresh_from_db()
    assert (p.sale_price, p.sale_price_gross) == (1218, 1449)


@pytest.mark.django_db
def test_drifted_net_rederived_from_gross_and_idempotent(product):
    p, _ = product
    _raw(p, sale_price=Decimal("1000"), sale_price_gross=Decimal("1450"))
    first = _run(True)["Product"]
    assert first.changed == 1 and first.samples[0][0] == p.pk
    p.refresh_from_db()
    assert (p.sale_price, p.sale_price_gross) == (1218, 1450)
    assert _run(True)["Product"].changed == 0


@pytest.mark.django_db
def test_net_only_row_gets_gross(product):
    p, _ = product
    _raw(p, sale_price=Decimal("1000"), sale_price_gross=Decimal("0"))
    _run(True)
    p.refresh_from_db()
    assert p.sale_price_gross == 1190


@pytest.mark.django_db
def test_surcharge_net_504_becomes_gross_600(product):
    p, _ = product
    _raw(p, price_surcharge=Decimal("504"), price_surcharge_gross=None)
    _run(True)
    p.refresh_from_db()
    assert p.price_surcharge_gross == 600
    assert p.price_surcharge == net_from_gross(600, M) == 504
    assert _run(True)["Product"].changed == 0


@pytest.mark.django_db
def test_rule_and_uom_price_rederived(product):
    p, uom = product
    rule = PricingRule.objects.create(product=p, fixed_price=Decimal("100"))
    up = ProductUoMPrice.objects.create(product=p, uom=uom, price_net=Decimal("100"), price_gross=Decimal("119"))
    PricingRule.objects.filter(pk=rule.pk).update(fixed_price=Decimal("1000"), fixed_price_gross=Decimal("1450"))
    ProductUoMPrice.objects.filter(pk=up.pk).update(price_net=Decimal("1000"), price_gross=Decimal("1450"))
    s = _run(True)
    assert s["PricingRule"].changed == 1 and s["ProductUoMPrice"].changed == 1
    rule.refresh_from_db()
    up.refresh_from_db()
    assert (rule.fixed_price, rule.fixed_price_gross) == (1218, 1450)
    assert (up.price_net, up.price_gross) == (1218, 1450)


@pytest.mark.django_db
def test_dry_run_changes_nothing(product, capsys):
    p, _ = product
    _raw(p, sale_price=Decimal("1000"), sale_price_gross=Decimal("1450"))
    assert _run(False)["Product"].changed == 1
    call_command("audit_sale_prices")
    p.refresh_from_db()
    assert p.sale_price == 1000
    assert "DRY-RUN" in capsys.readouterr().out
    call_command("audit_sale_prices", "--apply")
    p.refresh_from_db()
    assert p.sale_price == 1218


@pytest.mark.django_db
def test_migration_frozen_logic_matches_service(product):
    """La copia congelada de la migración 0039 debe dar lo mismo que el módulo de servicio."""
    import importlib

    frozen = importlib.import_module("inventory.migrations.0039_rederive_sale_prices")
    p, uom = product
    rule = PricingRule.objects.create(product=p, fixed_price=Decimal("100"))
    up = ProductUoMPrice.objects.create(product=p, uom=uom, price_net=Decimal("100"), price_gross=Decimal("119"))
    extra = [
        Product.objects.create(
            name=f"E{i}", category=p.category, uom=uom, sale_uom=uom, purchase_uom=uom,
            product_type="STORABLE", sale_price=Decimal("100"),
        )
        for i in range(4)
    ]
    # Casos: neto desviado, solo neto, recargo solo neto, recargo con bruto, ceros y empate .5.
    _raw(p, sale_price=Decimal("1000"), sale_price_gross=Decimal("1450"),
         price_surcharge=Decimal("504"), price_surcharge_gross=None)
    _raw(extra[0], sale_price=Decimal("1000"), sale_price_gross=Decimal("0"))
    _raw(extra[1], sale_price=Decimal("1"), sale_price_gross=Decimal("1"),
         price_surcharge=Decimal("1"), price_surcharge_gross=Decimal("3"))
    _raw(extra[2], sale_price=Decimal("0"), sale_price_gross=Decimal("0"))
    _raw(extra[3], sale_price=Decimal("5"), sale_price_gross=Decimal("6"))
    PricingRule.objects.filter(pk=rule.pk).update(fixed_price=Decimal("1000"), fixed_price_gross=Decimal("1450"))
    ProductUoMPrice.objects.filter(pk=up.pk).update(price_net=Decimal("1000"), price_gross=Decimal("1450"))

    models = (("Product", Product), ("PricingRule", PricingRule), ("ProductUoMPrice", ProductUoMPrice))

    def snapshot():
        return [list(m.objects.order_by("pk").values()) for _, m in models]

    seed = snapshot()
    service_changed = {k: v.changed for k, v in _run(True).items()}
    service_result = snapshot()

    for (_, model), rows in zip(models, seed):
        for row in rows:
            model.objects.filter(pk=row["id"]).update(**row)
    frozen_changed = {name: frozen.rederive_model(model, M) for name, model in models}

    assert snapshot() == service_result
    assert frozen_changed == service_changed
    assert sum(service_changed.values()) >= 5
