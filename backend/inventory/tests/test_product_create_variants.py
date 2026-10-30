import json

import pytest
from django.http import QueryDict

from inventory.models import (
    Product,
    ProductAttribute,
    ProductAttributeValue,
    ProductCategory,
    UoM,
    UoMCategory,
)
from inventory.serializers import ProductWriteSerializer
from rest_framework.exceptions import ValidationError as APIValidationError


@pytest.fixture
def product_setup(db):
    uom_category = UoMCategory.objects.create(name="Unidades")
    uom = UoM.objects.create(name="Unidad", category=uom_category)
    category = ProductCategory.objects.create(name="Productos")
    attribute = ProductAttribute.objects.create(name="Color")
    red = ProductAttributeValue.objects.create(attribute=attribute, value="Rojo")
    blue = ProductAttributeValue.objects.create(attribute=attribute, value="Azul")
    other_attribute = ProductAttribute.objects.create(name="Talla")
    large = ProductAttributeValue.objects.create(attribute=other_attribute, value="Grande")
    return {
        "uom": uom,
        "category": category,
        "attribute": attribute,
        "red": red,
        "blue": blue,
        "large": large,
    }


def test_create_product_persists_variant_flags_and_generates_initial_variants(product_setup):
    setup = product_setup
    payload = QueryDict("", mutable=True)
    payload.update(
        {
            "name": "Camiseta",
            "category": str(setup["category"].pk),
            "product_type": Product.Type.STORABLE,
            "uom": str(setup["uom"].pk),
            "has_variants": "true",
            "has_bom": "true",
            "requires_advanced_manufacturing": "true",
            "variant_generation_selection": json.dumps(
                [
                    {
                        "attribute": setup["attribute"].pk,
                        "values": [setup["red"].pk, setup["blue"].pk],
                    }
                ]
            ),
        }
    )
    serializer = ProductWriteSerializer(
        data=payload
    )

    assert serializer.is_valid(), serializer.errors
    template = serializer.save()

    assert template.has_variants is True
    assert template.has_bom is True
    assert template.requires_advanced_manufacturing is True
    assert template.variants.count() == 2
    assert set(template.variants.values_list("attribute_values__id", flat=True)) == {
        setup["red"].pk,
        setup["blue"].pk,
    }


def test_invalid_initial_variant_selection_rolls_back_product_creation(product_setup):
    setup = product_setup
    serializer = ProductWriteSerializer(
        data={
            "name": "Producto inválido",
            "category": setup["category"].pk,
            "product_type": Product.Type.STORABLE,
            "uom": setup["uom"].pk,
            "has_variants": True,
            "variant_generation_selection": [
                {
                    "attribute": setup["attribute"].pk,
                    "values": [setup["large"].pk],
                }
            ],
        }
    )

    assert serializer.is_valid(), serializer.errors
    with pytest.raises(APIValidationError, match="no pertenecen"):
        serializer.save()

    assert not Product.objects.filter(name="Producto inválido").exists()
