from decimal import Decimal

import pytest
from rest_framework.exceptions import ValidationError

from production.validators import ProductionValidator


@pytest.fixture
def bom_line_ctx(db):
    from inventory.models import Product, ProductCategory, UoM, UoMCategory

    uom_cat = UoMCategory.objects.create(name="Unidades")
    uom = UoM.objects.create(name="unidad", ratio=1, category=uom_cat)
    category = ProductCategory.objects.create(name="Cat", prefix="CAT")

    def make_product(product_type, **overrides):
        fields = {
            "name": f"Producto {product_type}",
            "internal_code": f"PROD-{len(Product.objects.all())}",
            "product_type": product_type,
            "uom": uom,
            "category": category,
        }
        fields.update(overrides)
        return Product.objects.create(**fields)

    storable = make_product(Product.Type.STORABLE)
    manufacturable = make_product(Product.Type.MANUFACTURABLE)
    service = make_product(Product.Type.SERVICE, can_be_purchased=True)
    service_not_purchasable = make_product(Product.Type.SERVICE, can_be_purchased=False)
    return {"uom": uom, "storable": storable, "manufacturable": manufacturable,
            "service": service, "service_not_purchasable": service_not_purchasable}


def _line(ctx, component, **overrides):
    data = {"component": component, "uom": ctx["uom"], "is_outsourced": False}
    data.update(overrides)
    return data


@pytest.mark.django_db
def test_new_material_must_be_storable(bom_line_ctx):
    ctx = bom_line_ctx
    with pytest.raises(ValidationError):
        ProductionValidator.validate_bom_line(_line(ctx, ctx["manufacturable"]), is_new=True)


@pytest.mark.django_db
def test_new_material_storable_accepted(bom_line_ctx):
    ctx = bom_line_ctx
    result = ProductionValidator.validate_bom_line(_line(ctx, ctx["storable"]), is_new=True)
    assert result["component"] == ctx["storable"]


@pytest.mark.django_db
def test_existing_material_manufacturable_allowed_for_legacy(bom_line_ctx):
    ctx = bom_line_ctx
    result = ProductionValidator.validate_bom_line(_line(ctx, ctx["manufacturable"]), is_new=False)
    assert result["component"] == ctx["manufacturable"]


@pytest.mark.django_db
def test_new_outsourced_material_must_be_service(bom_line_ctx):
    ctx = bom_line_ctx
    with pytest.raises(ValidationError):
        ProductionValidator.validate_bom_line(
            _line(ctx, ctx["storable"], is_outsourced=True, supplier=object(), unit_price=Decimal("100")),
            is_new=True,
        )


@pytest.mark.django_db
def test_new_outsourced_service_must_be_purchasable(bom_line_ctx):
    ctx = bom_line_ctx
    with pytest.raises(ValidationError) as exc:
        ProductionValidator.validate_bom_line(
            _line(ctx, ctx["service_not_purchasable"], is_outsourced=True, unit_price=Decimal("100")),
            is_new=True,
        )
    assert "can_be_purchased" in str(exc.value)


@pytest.mark.django_db
def test_new_outsourced_service_purchasable_accepted(bom_line_ctx):
    from contacts.models import Contact

    ctx = bom_line_ctx
    supplier = Contact.objects.create(name="Proveedor", tax_id="12345678-9")
    result = ProductionValidator.validate_bom_line(
        _line(ctx, ctx["service"], is_outsourced=True, supplier=supplier, unit_price=Decimal("100")),
        is_new=True,
    )
    assert result["component"] == ctx["service"]
