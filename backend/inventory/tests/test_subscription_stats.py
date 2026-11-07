"""GET /api/inventory/subscriptions/stats/ referenced names that were never imported."""

from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from contacts.models import Contact
from inventory.models import Product, ProductCategory, Subscription, UoM, UoMCategory

User = get_user_model()


@pytest.mark.django_db
def test_stats_summarize_subscriptions():
    client = APIClient()
    client.force_authenticate(user=User.objects.create_superuser(username="viewer", password="x"))
    uom = UoM.objects.create(name="unidad", ratio=Decimal("1"), category=UoMCategory.objects.create(name="Unidades"))
    product = Product.objects.create(
        name="Licencia",
        internal_code="SUB-1",
        product_type=Product.Type.SUBSCRIPTION,
        uom=uom,
        category=ProductCategory.objects.create(name="Software", prefix="SOF"),
    )
    Subscription.objects.create(
        product=product,
        supplier=Contact.objects.create(name="Proveedor", tax_id="11111111-1"),
        amount=Decimal("1000"),
        start_date=timezone.localdate(),
        next_payment_date=timezone.localdate(),
    )

    response = client.get("/api/inventory/subscriptions/stats/")

    assert response.status_code == 200
    assert response.data["active_subscriptions"] == 1
    assert response.data["total_monthly_cost"] == 1000.0
    assert response.data["upcoming_renewals_30_days"] == 1
