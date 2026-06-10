"""
Tests para PurchasingService.cancel_receipt.
"""
import pytest
from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model

from purchasing.models import PurchaseOrder, PurchaseReceipt
from purchasing.services import PurchasingService
from contacts.models import Contact
from inventory.models import Warehouse

User = get_user_model()


@pytest.fixture
def env(db):
    user = User.objects.create_user(username='cancelrec', password='x')
    supplier = Contact.objects.create(
        name='Proveedor Test', tax_id='33333333-3',
    )
    warehouse = Warehouse.objects.create(
        name='Bodega Principal', code='BOD-01',
    )
    po = PurchaseOrder.objects.create(
        number='TEST-PO-001',
        supplier=supplier,
        warehouse=warehouse,
        total=0, total_net=0, total_tax=0,
    )
    return {'user': user, 'supplier': supplier, 'warehouse': warehouse, 'po': po}


def _receipt(env, **overrides):
    kwargs = dict(
        purchase_order=env['po'],
        warehouse=env['warehouse'],
        receipt_date='2026-06-10',
        total=0, total_net=0, total_tax=0,
    )
    kwargs.update(overrides)
    return PurchaseReceipt.objects.create(**kwargs)


@pytest.mark.django_db
def test_cancel_draft_receipt(env):
    receipt = _receipt(env)
    assert receipt.status == PurchaseReceipt.Status.DRAFT

    result = PurchasingService.cancel_receipt(receipt)

    assert result.status == PurchaseReceipt.Status.CANCELLED
    result.refresh_from_db()
    assert result.status == PurchaseReceipt.Status.CANCELLED


@pytest.mark.django_db
def test_cancel_cancelled_receipt_idempotente(env):
    receipt = _receipt(env, status=PurchaseReceipt.Status.CANCELLED)

    result = PurchasingService.cancel_receipt(receipt)

    assert result.status == PurchaseReceipt.Status.CANCELLED
    assert result == receipt


@pytest.mark.django_db
def test_cancel_confirmed_receipt_raises_error(env):
    receipt = _receipt(env, status=PurchaseReceipt.Status.CONFIRMED)

    with pytest.raises(ValidationError, match='Borrador'):
        PurchasingService.cancel_receipt(receipt)
