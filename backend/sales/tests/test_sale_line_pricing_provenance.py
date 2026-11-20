"""Procedencia del precio en SaleLine: regla aplicada, precio de lista y origen."""
from decimal import Decimal

import pytest

from contacts.models import Contact
from sales.models import SaleLine, SaleOrder


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
