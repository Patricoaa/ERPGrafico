"""
Tests para SalesService.cancel_sale_order.
"""

from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model

from contacts.models import Contact
from sales.models import SaleOrder
from sales.services import SalesService

User = get_user_model()


@pytest.fixture
def env(db):
    user = User.objects.create_user(username="cancelsale", password="x")
    customer = Contact.objects.create(
        name="Cliente Venta",
        tax_id="22222222-2",
    )
    return {"user": user, "customer": customer}


def _orden(env, **overrides):
    kwargs = dict(
        customer=env["customer"],
        number="TEST-SO-001",
        total=Decimal("100000"),
        total_net=Decimal("84034"),
        total_tax=Decimal("15966"),
    )
    kwargs.update(overrides)
    return SaleOrder.objects.create(**kwargs)


@pytest.mark.django_db
def test_cancel_draft_sale_order(env):
    order = _orden(env)
    assert order.status == SaleOrder.Status.DRAFT

    result = SalesService.cancel_sale_order(order)

    assert result.status == SaleOrder.Status.CANCELLED
    result.refresh_from_db()
    assert result.status == SaleOrder.Status.CANCELLED


@pytest.mark.django_db
def test_cancel_cancelled_sale_order_idempotente(env):
    order = _orden(env, status=SaleOrder.Status.CANCELLED)

    result = SalesService.cancel_sale_order(order)

    assert result.status == SaleOrder.Status.CANCELLED
    assert result == order
