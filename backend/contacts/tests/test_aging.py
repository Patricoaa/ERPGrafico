"""
P1-5: aging reports (117/208) + credit portfolio (318) — prefetch/annotations
eliminan el N+1 (Θ(C+O) round-trips → O(1) queries) sin cambiar la semántica
de los buckets ni del payload.
"""

from datetime import date, datetime
from decimal import Decimal
from unittest import mock

import pytest

from contacts.models import Contact
from contacts.selectors import (
    _credit_balance_used_from_orders,
    ContactSelector,
    customer_aging_report,
    supplier_aging_report,
)
from purchasing.models import PurchaseOrder
from sales.models import SaleOrder
from treasury.models import TreasuryMovement

CUTOFF = date(2026, 8, 14)


@pytest.fixture
def aging_data(db):
    from django.contrib.auth import get_user_model

    get_user_model().objects.create_user(username="aginguser", password="x")

    customer = Contact.objects.create(name="Cliente A", tax_id="11.111.111-1")
    supplier = Contact.objects.create(name="Proveedor A", tax_id="22.222.222-2")

    SaleOrder.objects.create(
        customer=customer,
        date=date(2026, 7, 1),
        total=Decimal("1000"),
        status=SaleOrder.Status.CONFIRMED,
    )
    order_b = SaleOrder.objects.create(
        customer=customer,
        date=date(2026, 8, 10),
        total=Decimal("500"),
        status=SaleOrder.Status.CONFIRMED,
    )
    TreasuryMovement.objects.create(
        movement_type=TreasuryMovement.Type.INBOUND,
        amount=Decimal("200"),
        sale_order=order_b,
    )

    po_a = PurchaseOrder.objects.create(
        supplier=supplier,
        date=date(2026, 7, 1),
        total=Decimal("2000"),
        status=PurchaseOrder.Status.CONFIRMED,
    )
    TreasuryMovement.objects.create(
        movement_type=TreasuryMovement.Type.OUTBOUND,
        amount=Decimal("500"),
        purchase_order=po_a,
    )
    PurchaseOrder.objects.create(
        supplier=supplier,
        date=date(2026, 8, 10),
        total=Decimal("1000"),
        status=PurchaseOrder.Status.CONFIRMED,
    )

    return {"customer": customer, "supplier": supplier}


@pytest.mark.django_db
def test_customer_aging_buckets_and_bounded_queries(aging_data, django_assert_max_num_queries):
    with django_assert_max_num_queries(5):
        report = customer_aging_report(cutoff_date=CUTOFF, limit=20)

    assert len(report) == 1
    row = report[0]
    assert row["contact_id"] == aging_data["customer"].id
    assert row["current"] == Decimal("300")
    assert row["overdue_30"] == Decimal("1000")
    assert row["overdue_60"] == Decimal("0")
    assert row["overdue_90"] == Decimal("0")
    assert row["overdue_90plus"] == Decimal("0")
    assert row["total"] == Decimal("1300")


@pytest.mark.django_db
def test_supplier_aging_buckets_and_bounded_queries(aging_data, django_assert_max_num_queries):
    with django_assert_max_num_queries(4):
        report = supplier_aging_report(cutoff_date=CUTOFF, limit=20)

    assert len(report) == 1
    row = report[0]
    assert row["contact_id"] == aging_data["supplier"].id
    assert row["current"] == Decimal("1000")
    assert row["overdue_30"] == Decimal("1500")
    assert row["total"] == Decimal("2500")


@pytest.mark.django_db
def test_customer_with_draft_order_excluded(aging_data):
    """
    Guard de regresión del comportamiento pre-existente: el `.exclude()` sobre
    una relación multivaluada se traduce a NOT EXISTS, por lo que un contacto
    con CUALQUIER orden DRAFT/CANCELLED desaparece del reporte completo.
    P1-5 preserva esta semántica (el quirk queda documentado para un fix futuro).
    """
    draft_customer = Contact.objects.create(name="Cliente DRAFT", tax_id="33.333.333-3")
    SaleOrder.objects.create(
        customer=draft_customer,
        date=date(2026, 7, 5),
        total=Decimal("999"),
        status=SaleOrder.Status.DRAFT,
    )

    report = customer_aging_report(cutoff_date=CUTOFF, limit=20)
    assert all(r["contact_id"] != draft_customer.id for r in report)


@pytest.mark.django_db
def test_portfolio_bounded_queries_and_values(aging_data, django_assert_max_num_queries):
    customer = aging_data["customer"]
    customer.credit_enabled = True
    customer.credit_limit = Decimal("10000")
    customer.save()

    with mock.patch("django.utils.timezone.now", return_value=datetime(2026, 8, 14, 12, 0, 0)):
        with django_assert_max_num_queries(6):
            data = ContactSelector.get_credit_portfolio_data(is_blacklist=False)

    assert len(data["contacts"]) == 1
    contact = data["contacts"][0]
    assert contact["id"] == customer.id
    assert contact["credit_balance_used"] == "1300"
    assert contact["credit_available"] == "8700"
    assert contact["credit_limit"] == "10000"
    assert contact["credit_aging"]["current"] == Decimal("300")
    assert contact["credit_aging"]["overdue_30"] == Decimal("1000")

    summary = data["summary"]
    assert summary["total_debt"] == "1300.00"
    assert summary["count_with_credit"] == 1
    assert summary["count_debtors"] == 1
    assert summary["count_overdue"] == 1


@pytest.mark.django_db
def test_credit_balance_used_from_orders(aging_data):
    customer = aging_data["customer"]
    used = _credit_balance_used_from_orders(customer.sale_orders.all())
    assert used == Decimal("1300")
