"""
Tests para BillingService.cancel_invoice.
"""

from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError

from billing.models import Invoice
from billing.services import BillingService
from contacts.models import Contact

User = get_user_model()


@pytest.fixture
def env(db):
    user = User.objects.create_user(username="cancelinv", password="x")
    contact = Contact.objects.create(
        name="Cliente Test",
        tax_id="11111111-1",
    )
    return {"user": user, "contact": contact}


def _factura(env, **overrides):
    kwargs = dict(
        dte_type=Invoice.DTEType.FACTURA,
        contact=env["contact"],
        total=Decimal("50000"),
        total_net=Decimal("42017"),
        total_tax=Decimal("7983"),
    )
    kwargs.update(overrides)
    return Invoice.objects.create(**kwargs)


@pytest.mark.django_db
def test_cancel_draft_invoice(env):
    inv = _factura(env)
    assert inv.status == Invoice.Status.DRAFT

    result = BillingService.cancel_invoice(inv)

    assert result.status == Invoice.Status.CANCELLED
    result.refresh_from_db()
    assert result.status == Invoice.Status.CANCELLED


@pytest.mark.django_db
def test_cancel_cancelled_invoice_idempotente(env):
    inv = _factura(env, status=Invoice.Status.CANCELLED)

    result = BillingService.cancel_invoice(inv)

    assert result.status == Invoice.Status.CANCELLED
    assert result == inv


@pytest.mark.django_db
def test_cancel_posted_invoice_raises_error(env):
    inv = _factura(env, status=Invoice.Status.POSTED)

    with pytest.raises(ValidationError, match="Borrador"):
        BillingService.cancel_invoice(inv)
