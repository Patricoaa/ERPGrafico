"""`?product_type__in=` used by multi-type product selectors (e.g. OT stock materials)."""
import pytest
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_product_type_in_keeps_only_the_listed_types():
    from django.contrib.auth import get_user_model

    from inventory.models import Product, ProductCategory, UoM, UoMCategory

    user = get_user_model().objects.create_superuser(username="typesuser", password="password")
    uom = UoM.objects.create(name="Unidad", category=UoMCategory.objects.create(name="Unit"), uom_type="REFERENCE")
    category = ProductCategory.objects.create(name="Varios")
    for name, product_type in [("Papel", "STORABLE"), ("Tarjeta", "MANUFACTURABLE"), ("Internet", "SUBSCRIPTION"), ("Flete", "SERVICE")]:
        Product.objects.create(
            name=name, category=category, uom=uom, sale_uom=uom, purchase_uom=uom, product_type=product_type,
        )
    client = APIClient()
    client.force_authenticate(user=user)

    response = client.get("/api/inventory/products/?product_type__in=STORABLE,MANUFACTURABLE")

    assert response.status_code == 200
    assert sorted(row["name"] for row in response.data["results"]) == ["Papel", "Tarjeta"]
