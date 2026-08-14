"""
P2.3: evaluate_credit_portfolio — prefetch sale_orders__payments/invoices
y bulk_update eliminan el N+1 (Θ(C+O) round-trips → O(1)) sin cambiar la
clasificación de riesgo ni el auto-block/unblock.
"""

from datetime import date, timedelta
from decimal import Decimal
from unittest import mock

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from accounting.models import AccountingSettings
from contacts.models import Contact, RiskLevel
from contacts.tasks import evaluate_credit_portfolio
from sales.models import SaleOrder
from treasury.models import TreasuryMovement

TODAY = date(2026, 8, 14)


@pytest.fixture
def credit_settings(db):
    return AccountingSettings.objects.create(credit_auto_block_days=60)


def _order(contact, days_ago, total, status=SaleOrder.Status.CONFIRMED):
    return SaleOrder.objects.create(
        customer=contact,
        date=TODAY - timedelta(days=days_ago),
        total=Decimal(total),
        status=status,
    )


def _payment(order, amount):
    return TreasuryMovement.objects.create(
        movement_type=TreasuryMovement.Type.INBOUND,
        amount=Decimal(amount),
        sale_order=order,
    )


def test_task_blocks_and_classifies_critical(credit_settings):
    risky = Contact.objects.create(name="Riesgoso", tax_id="1-1", credit_days=30)
    healthy = Contact.objects.create(name="Sano", tax_id="2-2", credit_days=30)
    _order(risky, 200, "1000")
    _order(healthy, 5, "500")

    result = evaluate_credit_portfolio()

    risky.refresh_from_db()
    healthy.refresh_from_db()
    assert result["evaluated"] == 2
    assert result["blocked"] == 1
    assert result["unblocked"] == 0
    assert risky.credit_risk_level == RiskLevel.CRITICAL
    assert risky.credit_auto_blocked is True
    assert healthy.credit_risk_level == RiskLevel.LOW
    assert healthy.credit_auto_blocked is False


def test_task_unblocks_and_lowers_risk(credit_settings):
    contact = Contact.objects.create(
        name="Rehabilitado",
        tax_id="3-3",
        credit_days=30,
        credit_risk_level=RiskLevel.CRITICAL,
        credit_auto_blocked=True,
    )
    order = _order(contact, 5, "1000")
    _payment(order, "1000")

    result = evaluate_credit_portfolio()

    contact.refresh_from_db()
    assert result["blocked"] == 0
    assert result["unblocked"] == 1
    assert contact.credit_risk_level == RiskLevel.LOW
    assert contact.credit_auto_blocked is False


def test_task_queries_do_not_scale_with_orders_and_payments(credit_settings):
    for i in range(2):
        contact = Contact.objects.create(name=f"Cliente {i}", tax_id=f"{i}-{i}", credit_days=30)
        for j in range(3):
            order = _order(contact, 5 + j, "500")
            _payment(order, "250")
            _payment(order, "250")

    with mock.patch("workflow.services.WorkflowService.send_notification"):
        with CaptureQueriesContext(connection) as ctx:
            evaluate_credit_portfolio()
        q1 = len(ctx)
        with CaptureQueriesContext(connection) as ctx:
            evaluate_credit_portfolio()
        q2 = len(ctx)

    assert q2 <= q1
    assert q2 <= 8
