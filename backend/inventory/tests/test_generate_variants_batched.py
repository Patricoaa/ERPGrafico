"""ProductService.generate_variants: producto cartesiano acotado y lecturas en memoria."""

from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError
from django.db import connection
from django.test.utils import CaptureQueriesContext

from inventory.models import Product, ProductAttribute, ProductAttributeValue, ProductCategory, UoM, UoMCategory
from inventory.services import MAX_VARIANT_COMBINATIONS, ProductService


@pytest.fixture
def template_setup(db):
    uom = UoM.objects.create(name="Unidad", category=UoMCategory.objects.create(name="Unit"), uom_type="REFERENCE")
    category = ProductCategory.objects.create(name="Gen")
    template = Product.objects.create(
        name="Plantilla", category=category, uom=uom, sale_uom=uom, purchase_uom=uom,
        product_type="STORABLE", sale_price=Decimal("10"), has_variants=True,
    )
    color = ProductAttribute.objects.create(name="Color")
    size = ProductAttribute.objects.create(name="Talla")
    colors = [ProductAttributeValue.objects.create(attribute=color, value=f"C{i}") for i in range(3)]
    sizes = [ProductAttributeValue.objects.create(attribute=size, value=f"T{i}") for i in range(2)]
    return template, color, size, colors, sizes


def _selection(color, size, colors, sizes):
    return [
        {"attribute": color.pk, "values": [v.pk for v in colors]},
        {"attribute": size.pk, "values": [v.pk for v in sizes]},
    ]


@pytest.mark.django_db
def test_creates_full_cartesian_product(template_setup):
    template, color, size, colors, sizes = template_setup

    result = ProductService.generate_variants(template, _selection(color, size, colors, sizes))

    assert result == {"success": True, "created": 6, "skipped": 0}
    assert Product.objects.filter(parent_template=template).count() == 6


@pytest.mark.django_db
def test_existing_combinations_are_skipped(template_setup):
    template, color, size, colors, sizes = template_setup
    ProductService.generate_variants(template, _selection(color, size, colors, sizes))

    result = ProductService.generate_variants(template, _selection(color, size, colors, sizes))

    assert result["created"] == 0
    assert result["skipped"] == 6


@pytest.mark.django_db
def test_partial_match_with_fewer_attributes_is_not_a_duplicate(template_setup):
    template, color, size, colors, sizes = template_setup
    only_color = [{"attribute": color.pk, "values": [colors[0].pk]}]
    ProductService.generate_variants(template, only_color)

    result = ProductService.generate_variants(template, _selection(color, size, colors, sizes))

    # Variant "C0" alone must not block "C0 + T0" and "C0 + T1" (different attribute sets).
    assert result["skipped"] == 0
    assert result["created"] == 6


@pytest.mark.django_db
def test_rejects_selection_over_the_cap(template_setup):
    template, color, size, colors, sizes = template_setup
    big_values = [ProductAttributeValue.objects.create(attribute=ProductAttribute.objects.create(name=f"A{i}"), value="x") for i in range(10)]
    selection = [
        {"attribute": v.attribute_id, "values": [v.pk]} for v in big_values[:1]
    ]
    # Build a selection whose product exceeds the cap without creating that many rows.
    attrs = []
    for i in range(3):
        a = ProductAttribute.objects.create(name=f"Cap{i}")
        attrs.append({"attribute": a.pk, "values": [ProductAttributeValue.objects.create(attribute=a, value=f"v{j}").pk for j in range(10)]})
    assert 10 ** 3 > MAX_VARIANT_COMBINATIONS

    with pytest.raises(ValidationError):
        ProductService.generate_variants(template, attrs)
    assert Product.objects.filter(parent_template=template).count() == 0


@pytest.mark.django_db
def test_read_queries_do_not_grow_with_combinations(template_setup):
    """Corridas en las que todas las combinaciones ya existen: las queries no dependen de
    cuántas combinaciones se revisan (en master cada combinación agregaba queries)."""
    template, color, size, colors, sizes = template_setup
    small_selection = _selection(color, size, colors, sizes)  # 3 x 2 = 6 combinations
    ProductService.generate_variants(template, small_selection)
    with CaptureQueriesContext(connection) as small:
        ProductService.generate_variants(template, small_selection)

    # 10 x 2 = 20 combinations, all created up front (outside the measured block).
    more_colors = colors + [ProductAttributeValue.objects.create(attribute=color, value=f"C{i}") for i in range(3, 10)]
    big_selection = _selection(color, size, more_colors, sizes)
    ProductService.generate_variants(template, big_selection)
    assert Product.objects.filter(parent_template=template).count() == 20

    with CaptureQueriesContext(connection) as large:
        ProductService.generate_variants(template, big_selection)

    assert len(large.captured_queries) == len(small.captured_queries)
