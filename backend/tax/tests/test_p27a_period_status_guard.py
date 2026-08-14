"""
P2.7a: los signals post_save de TaxPeriod/AccountingPeriod solo ejecutan el
bulk update de cierre/apertura cuando el status cambió realmente (guard de
transición vía pre_save), no en cada save.
"""

from datetime import date
from decimal import Decimal

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from accounting.models import JournalEntry
from billing.models import Invoice
from tax.models import AccountingPeriod, TaxPeriod


def _close_tax_period(period, invoice):
    period.status = TaxPeriod.Status.CLOSED
    period.save()
    invoice.refresh_from_db()
    return invoice


@pytest.mark.django_db
def test_tax_period_close_marks_invoices_and_guard_skips_noop_saves():
    period = TaxPeriod.objects.create(year=2026, month=8, status=TaxPeriod.Status.OPEN)
    invoice = Invoice.objects.create(
        dte_type=Invoice.DTEType.FACTURA,
        status=Invoice.Status.POSTED,
        date=date(2026, 8, 15),
        total=Decimal("1000"),
        total_net=Decimal("1000"),
        total_tax=0,
    )

    _close_tax_period(period, invoice)
    assert invoice.tax_period_closed is True

    with CaptureQueriesContext(connection) as ctx:
        period.status = TaxPeriod.Status.CLOSED
        period.save()
    assert not any("billing_invoice" in q["sql"] for q in ctx)

    invoice.refresh_from_db()
    assert invoice.tax_period_closed is True

    period.status = TaxPeriod.Status.OPEN
    period.save()
    invoice.refresh_from_db()
    assert invoice.tax_period_closed is False


@pytest.mark.django_db
def test_accounting_period_close_reopens_journal_entries():
    period = AccountingPeriod.objects.create(
        year=2026, month=8, status=AccountingPeriod.Status.OPEN
    )
    entry = JournalEntry.objects.create(
        date=date(2026, 8, 15),
        description="Entrada test",
        status=JournalEntry.Status.POSTED,
    )

    period.status = AccountingPeriod.Status.CLOSED
    period.save()
    entry.refresh_from_db()
    assert entry.period_closed is True
    assert entry.status == JournalEntry.Status.CLOSED

    period.status = AccountingPeriod.Status.OPEN
    period.save()
    entry.refresh_from_db()
    assert entry.period_closed is False
    assert entry.status == JournalEntry.Status.POSTED
