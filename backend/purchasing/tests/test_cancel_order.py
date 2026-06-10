"""
Tests para PurchasingService.cancel_purchase_order.
"""
import pytest
from decimal import Decimal
from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model

from purchasing.models import PurchaseOrder
from purchasing.services import PurchasingService
from contacts.models import Contact

User = get_user_model()


@pytest.fixture
def env(db):
    user = User.objects.create_user(username='cancelpo', password='x')
    supplier = Contact.objects.create(
        name='Proveedor OC', tax_id='44444444-4',
    )
    return {'user': user, 'supplier': supplier}


def _orden(env, **overrides):
    kwargs = dict(
        number='TEST-PO-002',
        supplier=env['supplier'],
        total=Decimal('200000'),
        total_net=Decimal('168067'),
        total_tax=Decimal('31933'),
    )
    kwargs.update(overrides)
    return PurchaseOrder.objects.create(**kwargs)


@pytest.mark.django_db
def test_cancel_draft_purchase_order(env):
    order = _orden(env)
    assert order.status == PurchaseOrder.Status.DRAFT

    result = PurchasingService.cancel_purchase_order(order)

    assert result.status == PurchaseOrder.Status.CANCELLED
    result.refresh_from_db()
    assert result.status == PurchaseOrder.Status.CANCELLED


@pytest.mark.django_db
def test_cancel_cancelled_purchase_order_idempotente(env):
    order = _orden(env, status=PurchaseOrder.Status.CANCELLED)

    result = PurchasingService.cancel_purchase_order(order)

    assert result.status == PurchaseOrder.Status.CANCELLED
    assert result == order
