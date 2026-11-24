"""Procedencia del precio en SaleLine: regla aplicada, precio de lista y origen."""
import uuid
from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from contacts.models import Contact
from inventory.models import (
    PricingRule,
    Product,
    ProductCategory,
    ProductUoMPrice,
    UoM,
    UoMCategory,
)
from sales.models import SaleLine, SaleOrder
from sales.services import SalesService


@pytest.fixture
def customer(db):
    return Contact.objects.create(name="Cliente Precio", tax_id="44444444-4")


def test_new_fields_default_to_null(customer):
    order = SaleOrder.objects.create(
        customer=customer, number="T-PROV-1", total=Decimal("0"), total_net=Decimal("0"), total_tax=Decimal("0")
    )
    line = SaleLine.objects.create(order=order, description="Libre", quantity=1, unit_price=Decimal("100"))
    line.refresh_from_db()
    assert line.pricing_rule is None
    assert line.list_unit_price_gross is None
    assert line.price_source is None


# ── Sellado al crear la orden (Task 3) ────────────────────────────────────────




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
    defaults = dict(
        name="Regla", product=product, operator="GE", min_quantity=Decimal("10"), uom=product.uom,
        rule_type="FIXED", fixed_price_gross=Decimal("1000"),
    )
    defaults.update(kwargs)
    return PricingRule.objects.create(**defaults)


def _create_line(customer, product, qty="10", **line):
    data = {
        "customer": customer,
        "number": f"T-{uuid.uuid4().hex[:8]}",
        "lines": [{"product": product, "quantity": Decimal(qty), "uom": product.uom, **line}],
    }
    return SalesService.create_sale_order(data).lines.get()


def test_rule_price_is_stamped_as_rule(customer, product):
    rule = _rule(product)
    line = _create_line(customer, product, unit_price=Decimal("840"), unit_price_gross=Decimal("1000"))
    assert line.price_source == "RULE"
    assert line.pricing_rule == rule
    assert line.list_unit_price_gross == product.sale_price_gross


def test_list_price_is_stamped_as_list(customer, product):
    line = _create_line(
        customer, product, unit_price=product.sale_price, unit_price_gross=product.sale_price_gross
    )
    assert line.price_source == "LIST"
    assert line.pricing_rule is None
    assert line.list_unit_price_gross == product.sale_price_gross


def test_uom_price_is_stamped_as_uom_price(customer, product):
    ProductUoMPrice.objects.create(product=product, uom=product.uom, price_net=Decimal("800"), price_gross=Decimal("952"))
    line = _create_line(customer, product, unit_price=Decimal("800"), unit_price_gross=Decimal("952"))
    assert line.price_source == "UOM_PRICE"
    assert line.list_unit_price_gross == Decimal("952")


def test_different_price_is_manual_without_rule(customer, product):
    _rule(product)
    line = _create_line(customer, product, unit_price=Decimal("500"), unit_price_gross=Decimal("595"))
    assert line.price_source == "MANUAL"
    assert line.pricing_rule is None
    assert line.list_unit_price_gross == product.sale_price_gross


def test_discount_does_not_make_line_manual(customer, product):
    rule = _rule(product)
    line = _create_line(
        customer, product, unit_price=Decimal("840"), unit_price_gross=Decimal("1000"),
        discount_percentage=Decimal("5"),
    )
    assert line.price_source == "RULE"
    assert line.pricing_rule == rule


def test_net_only_line_tolerates_one_peso_rounding(customer, product):
    rule = _rule(product)
    line = _create_line(customer, product, unit_price=Decimal("841"))  # neto resuelto: 840
    assert line.price_source == "RULE"
    assert line.pricing_rule == rule


def test_expired_rule_not_recorded(customer, product):
    _rule(product, end_date=timezone.localdate() - timedelta(days=1))
    line = _create_line(customer, product, unit_price=Decimal("840"), unit_price_gross=Decimal("1000"))
    assert line.pricing_rule is None
    assert line.price_source == "MANUAL"


def test_line_without_product_has_null_provenance(customer):
    data = {
        "customer": customer,
        "number": f"T-{uuid.uuid4().hex[:8]}",
        "lines": [{"description": "Libre", "quantity": Decimal("1"), "unit_price": Decimal("100")}],
    }
    line = SalesService.create_sale_order(data).lines.get()
    assert line.price_source is None
    assert line.list_unit_price_gross is None
    assert line.pricing_rule is None


def test_line_with_null_uom_does_not_fail(customer, product):
    line = _create_line(
        customer, product, uom=None, qty="1",
        unit_price=product.sale_price, unit_price_gross=product.sale_price_gross,
    )
    assert line.price_source == "LIST"


def test_serializer_path_stamps_provenance(customer, product):
    from sales.serializers import CreateSaleOrderSerializer

    rule = _rule(product)
    serializer = CreateSaleOrderSerializer(
        data={
            "customer": customer.id,
            "number": f"T-{uuid.uuid4().hex[:8]}",
            "lines": [
                {
                    "product": product.id, "quantity": "10", "uom": product.uom_id,
                    "unit_price": "840", "unit_price_gross": "1000", "description": "Tarjeta",
                }
            ],
        }
    )
    assert serializer.is_valid(), serializer.errors
    line = serializer.save().lines.get()
    assert line.price_source == "RULE"
    assert line.pricing_rule == rule


def test_surcharge_variant_with_parent_rule_creates_sale(customer, product):
    """Regresión: la resolución de una variante SURCHARGE con regla del padre no debe romper la venta."""
    variant = Product.objects.create(
        name="Tarjeta Roja", category=product.category, uom=product.uom, sale_uom=product.uom,
        purchase_uom=product.uom, product_type="STORABLE", sale_price=Decimal("1000"),
        parent_template=product, price_inheritance_mode="SURCHARGE", price_surcharge=Decimal("100"),
    )
    variant.refresh_from_db()
    rule = _rule(product)
    line = _create_line(customer, variant, unit_price=Decimal("1000"), unit_price_gross=Decimal("1119"))
    assert line.pricing_rule == rule
    assert line.price_source == "RULE"


def test_provenance_failure_does_not_block_the_sale(customer, product, monkeypatch):
    from inventory.services import PricingService

    def boom(*args, **kwargs):
        raise RuntimeError("pricing exploded")

    monkeypatch.setattr(PricingService, "resolve_product_price", boom)
    line = _create_line(customer, product, unit_price=product.sale_price, unit_price_gross=product.sale_price_gross)
    assert line.price_source is None
    assert line.pricing_rule is None
    assert line.list_unit_price_gross is None


def test_return_without_origin_line_uses_integer_sale_price_gross(db, customer, product):
    from inventory.models import Warehouse
    from sales.return_services import ReturnService

    product.sale_price_gross = Decimal("1725")
    product.save()
    product.refresh_from_db()
    order = SaleOrder.objects.create(
        customer=customer, number="T-RET-1", total=Decimal("0"), total_net=Decimal("0"), total_tax=Decimal("0")
    )
    wh = Warehouse.objects.create(name="Bodega Ret", code="BR")
    ret = ReturnService.create_return_from_note_request(order, [{"product_id": product.id, "quantity": 1}], wh.id)
    line = ret.lines.get()
    assert line.unit_price_gross == Decimal("1725")
    assert line.unit_price == product.sale_price
