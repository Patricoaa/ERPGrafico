"""
P1-8: credit ledger (selectors.py get_credit_ledger), partners list payload,
partners summary y partner statement — prefetch + una consulta agrupada de
métricas de socio eliminan el N+1 (Θ(orders/partner) round-trips → O(1))
sin cambiar el contrato del payload.
"""

from datetime import date, timedelta
from decimal import Decimal

import pytest

from contacts.models import Contact
from contacts.partner_models import PartnerTransaction
from contacts.partner_service import PartnerService
from contacts.selectors import ContactSelector, ContactSelectorExt
from contacts.serializers import ContactSerializer
from sales.models import SaleOrder
from treasury.models import TreasuryMovement

TODAY = date.today()


class _LightContactSerializer(ContactSerializer):
    class Meta(ContactSerializer.Meta):
        fields = ["id", "name", "tax_id", "partner_since"]


@pytest.fixture
def credit_customer(db):
    customer = Contact.objects.create(name="Cliente Crédito", tax_id="33.333.333-3")
    order = SaleOrder.objects.create(
        customer=customer,
        date=TODAY - timedelta(days=5),
        total=Decimal("1000"),
        status=SaleOrder.Status.CONFIRMED,
    )
    TreasuryMovement.objects.create(
        movement_type=TreasuryMovement.Type.INBOUND,
        amount=Decimal("200"),
        sale_order=order,
        date=TODAY - timedelta(days=3),
    )
    return customer


@pytest.fixture
def partner_a(db):
    from django.contrib.auth import get_user_model

    get_user_model().objects.create_user(username="partneruser", password="x")

    partner = Contact.objects.create(
        name="Socio A", tax_id="44.444.444-4", is_partner=True, partner_equity_percentage=Decimal("25.00")
    )
    for tx_type, amount in [
        (PartnerTransaction.Type.EQUITY_SUBSCRIPTION, Decimal("100000")),
        (PartnerTransaction.Type.CAPITAL_CONTRIBUTION_CASH, Decimal("60000")),
        (PartnerTransaction.Type.REINVESTMENT, Decimal("20000")),
        (PartnerTransaction.Type.PROVISIONAL_WITHDRAWAL, Decimal("10000")),
        (PartnerTransaction.Type.RETAINED, Decimal("15000")),
    ]:
        PartnerTransaction.objects.create(
            partner=partner, transaction_type=tx_type, amount=amount, date=date(2026, 1, 15)
        )
    return partner


@pytest.fixture
def partner_b(db):
    partner = Contact.objects.create(name="Socio B", tax_id="55.555.555-5", is_partner=True)
    for tx_type, amount in [
        (PartnerTransaction.Type.EQUITY_SUBSCRIPTION, Decimal("50000")),
        (PartnerTransaction.Type.WITHDRAWAL, Decimal("30000")),
        (PartnerTransaction.Type.LOAN_TO_COMPANY, Decimal("10000")),
        (PartnerTransaction.Type.LOAN_FROM_COMPANY, Decimal("20000")),
        (PartnerTransaction.Type.DIVIDEND, Decimal("20000")),
        (PartnerTransaction.Type.DIVIDEND_PAYMENT, Decimal("5000")),
    ]:
        PartnerTransaction.objects.create(
            partner=partner, transaction_type=tx_type, amount=amount, date=date(2026, 2, 10)
        )
    return partner


@pytest.mark.django_db
def test_credit_ledger_balance_aging_and_bounded_queries(
    credit_customer, django_assert_max_num_queries
):
    with django_assert_max_num_queries(6):
        ledger = ContactSelector.get_credit_ledger(contact=credit_customer)

    assert len(ledger) == 1
    row = ledger[0]
    assert row["id"] == credit_customer.sale_orders.first().id
    assert row["number"] == credit_customer.sale_orders.first().number
    assert row["effective_total"] == "1000"
    assert row["paid_amount"] == "200.00"
    assert row["balance"] == "800.00"
    assert row["aging_bucket"] == "current"
    assert row["days_overdue"] == 0
    assert row["credit_assignment_origin"] is None
    assert row["credit_assignment_origin_display"] is None


@pytest.mark.django_db
def test_credit_ledger_write_off_only_with_include_all(db):
    customer = Contact.objects.create(name="Castigo", tax_id="66.666.666-6")
    order = SaleOrder.objects.create(
        customer=customer,
        date=date(2026, 6, 1),
        total=Decimal("500"),
        status=SaleOrder.Status.CONFIRMED,
    )
    TreasuryMovement.objects.create(
        movement_type=TreasuryMovement.Type.INBOUND,
        payment_method=TreasuryMovement.Method.WRITE_OFF,
        amount=Decimal("500"),
        sale_order=order,
        date=date(2026, 6, 5),
    )

    default = ContactSelector.get_credit_ledger(contact=customer)
    assert default == []

    all_rows = ContactSelector.get_credit_ledger(contact=customer, include_all=True)
    assert len(all_rows) == 1
    assert all_rows[0]["balance"] == "0.00"
    assert all_rows[0]["aging_bucket"] == "written_off"
    assert all_rows[0]["days_overdue"] == max(
        0, (TODAY - (date(2026, 6, 1) + timedelta(days=30))).days
    )


@pytest.mark.django_db
def test_partners_payload_metrics_and_bounded_queries(
    partner_a, partner_b, django_assert_max_num_queries
):
    with django_assert_max_num_queries(3):
        payload = ContactSelector.list_partner_payloads()

    by_name = {p["name"]: p for p in payload}
    a = by_name["Socio A"]
    assert a["partner_equity_percentage"] == "25.00"
    assert a["partner_total_contributions"] == "120000"
    assert a["partner_total_paid_in"] == "80000"
    assert a["partner_pending_capital"] == "40000"
    assert a["partner_excess_capital"] == "0"
    assert a["partner_provisional_withdrawals_balance"] == "10000"
    assert a["partner_earnings_balance"] == "15000"
    assert a["partner_net_equity"] == "85000"
    assert a["partner_dividends_payable_balance"] == "0"

    b = by_name["Socio B"]
    assert b["partner_total_contributions"] == "50000"
    assert b["partner_total_paid_in"] == "0"
    assert b["partner_pending_capital"] == "50000"
    assert b["partner_provisional_withdrawals_balance"] == "0"
    assert b["partner_total_withdrawals"] == "35000"
    assert b["partner_dividends_payable_balance"] == "15000"
    assert b["partner_net_equity"] == "0"


@pytest.mark.django_db
def test_partners_summary_global_metrics(partner_a, partner_b, django_assert_max_num_queries):
    with django_assert_max_num_queries(3):
        summary = PartnerService.get_global_summary()

    assert summary["partner_count"] == 2
    assert summary["total_capital"] == Decimal("170000")
    assert summary["total_paid_in"] == Decimal("80000")
    assert summary["total_pending"] == Decimal("90000")
    assert summary["total_provisional_withdrawals"] == Decimal("10000")
    assert summary["total_earnings"] == Decimal("15000")
    assert summary["total_net_equity"] == Decimal("85000")


@pytest.mark.django_db
def test_partner_statement_summary_and_bounded_queries(
    partner_a, django_assert_max_num_queries
):
    with django_assert_max_num_queries(8):
        statement = ContactSelectorExt.get_partner_statement(partner_a, _LightContactSerializer)

    assert statement["summary"]["equity_percentage"] == "25.00"
    assert statement["summary"]["balance"] == "50000"
    assert statement["summary"]["total_contributions"] == "120000"
    assert statement["summary"]["total_paid_in"] == "80000"
    assert statement["summary"]["pending_capital"] == "40000"
    assert statement["summary"]["provisional_withdrawals"] == "10000"
    assert statement["summary"]["total_formal_withdrawals"] == "0"
    assert statement["summary"]["earnings_balance"] == "15000"
    assert len(statement["transactions"]) == 5


@pytest.mark.django_db
def test_credit_history_bounded_queries(db, django_assert_max_num_queries):
    customer = Contact.objects.create(name="Historial", tax_id="77.777.777-7")
    SaleOrder.objects.create(
        customer=customer,
        date=date(2026, 5, 1),
        total=Decimal("300"),
        status=SaleOrder.Status.CONFIRMED,
        credit_assignment_origin=SaleOrder.CreditOrigin.MANUAL,
    )
    with django_assert_max_num_queries(10):
        history = ContactSelector.get_credit_history(customer)

    assert len(history) == 1
    assert history[0]["credit_assignment_origin"] == "MANUAL"
