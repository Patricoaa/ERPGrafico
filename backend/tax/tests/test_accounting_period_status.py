"""Estado del período contable: pendientes listados y tax_period_id."""

from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from django.test.utils import CaptureQueriesContext

from accounting.models import JournalEntry
from billing.models import Invoice
from contacts.models import Contact
from hr.models import Employee, Payroll
from treasury.models import BankStatement, TreasuryAccount
from tax.models import AccountingPeriod, TaxPeriod

URL = "/api/tax/accounting-periods/{}/status_check/"


def _entry(day=10, n=0):
    return JournalEntry.objects.create(
        date=date(2026, 8, day),
        description=f"Asiento {n}",
        status=JournalEntry.State.DRAFT,
    )


def _invoice(day=10):
    return Invoice.objects.create(
        dte_type=Invoice.DTEType.FACTURA,
        number="123",
        status=Invoice.Status.DRAFT,
        date=date(2026, 8, day),
        total=Decimal("1190"),
        total_net=Decimal("1000"),
        total_tax=Decimal("190"),
    )


_seq = {"n": 0}


def _payroll():
    _seq["n"] += 1
    employee = Employee.objects.create(
        contact=Contact.objects.create(name=f"Empleado {_seq['n']}", tax_id=f"1{_seq['n']:07d}-0"),
        base_salary=500000,
        dias_pactados=30,
    )
    return Payroll.objects.create(
        employee=employee,
        period_year=2026,
        period_month=8,
        status=Payroll.Status.DRAFT,
        net_salary=Decimal("400000"),
    )


def _statement(day=10):
    _seq["n"] += 1
    account = TreasuryAccount.objects.create(name=f"Banco {_seq['n']}", code=f"1.1.7{_seq['n']}")
    user, _ = get_user_model().objects.get_or_create(username="importer")
    return BankStatement.objects.create(
        treasury_account=account,
        imported_by=user,
        statement_date=date(2026, 8, day),
        opening_balance=Decimal("0"),
        closing_balance=Decimal("987654"),
        status=BankStatement.Status.DRAFT,
    )


@pytest.fixture
def period(db):
    tax_period = TaxPeriod.objects.create(year=2026, month=8)
    acc, _ = AccountingPeriod.objects.update_or_create(
        year=2026, month=8, defaults={"tax_period": tax_period}
    )
    return acc, tax_period


def test_status_lists_pending_documents(api_client, period):
    acc, tax_period = period
    e1 = _entry(20, 1)
    e2 = _entry(5, 2)
    inv = _invoice()

    data = api_client.get(URL.format(acc.pk)).json()

    assert data["tax_period_id"] == tax_period.id
    assert [e["id"] for e in data["draft_entries"]] == [e2.id, e1.id]
    assert "Asiento 2" in data["draft_entries"][0]["label"]
    assert data["draft_entries"][0]["date"] == "2026-08-05"
    assert [i["id"] for i in data["draft_invoices"]] == [inv.id]
    assert "123" in data["draft_invoices"][0]["label"]
    assert data["draft_invoices"][0]["amount"] == "1190"
    assert data["unposted_payrolls"] == []
    assert data["unconfirmed_statements"] == []
    assert data["draft_entries_count"] == 2


def test_status_tax_period_id_null_without_tax_period(api_client, db):
    acc = AccountingPeriod.objects.create(year=2026, month=8)
    data = api_client.get(URL.format(acc.pk)).json()
    assert data["tax_period_id"] is None


def test_status_caps_pending_at_50(api_client, period):
    acc, _ = period
    for n in range(55):
        _entry(10, n)
    data = api_client.get(URL.format(acc.pk)).json()
    assert len(data["draft_entries"]) == 50
    assert data["draft_entries_count"] == 55


def _count_queries(api_client, acc):
    with CaptureQueriesContext(connection) as ctx:
        assert api_client.get(URL.format(acc.pk)).status_code == 200
    return len(ctx.captured_queries)


def test_status_query_count_constant(api_client, period):
    acc, _ = period
    _entry(1, 0)
    _invoice()
    _payroll()
    _statement()
    api_client.get(URL.format(acc.pk))  # warm-up
    few = _count_queries(api_client, acc)
    for n in range(9):
        _entry(2, n)
        _invoice()
        _payroll()
        _statement(3)
    many = _count_queries(api_client, acc)
    assert few == many


def test_status_hides_payroll_and_statement_amounts(api_client, period):
    """Sin permiso de nómina/banco el endpoint no filtra sueldos ni saldos."""
    acc, _ = period
    _payroll()
    _statement()
    data = api_client.get(URL.format(acc.pk)).json()
    assert len(data["unposted_payrolls"]) == 1
    assert len(data["unconfirmed_statements"]) == 1
    assert data["unposted_payrolls"][0]["amount"] is None
    assert data["unconfirmed_statements"][0]["amount"] is None
    assert "400000" not in str(data) and "987654" not in str(data)


def test_status_caps_invoices_at_50(api_client, period):
    acc, _ = period
    for _n in range(52):
        _invoice()
    data = api_client.get(URL.format(acc.pk)).json()
    assert len(data["draft_invoices"]) == 50
    assert data["draft_invoices_count"] == 52
