"""Fecha del documento y de su asiento al crear y confirmar borradores (ADR-0140)."""

from datetime import date, datetime
from zoneinfo import ZoneInfo

import pytest
import time_machine

from accounting.models import JournalEntry
from billing.models import Invoice
from billing.services import BillingService
from billing.tests.conftest import _any_account_is_cash, env  # noqa: F401 (fixtures)
from billing.tests.test_pos_checkout_documents import _checkout, _order, pos  # noqa: F401
from tax.models import AccountingPeriod

SANTIAGO = ZoneInfo("America/Santiago")


@pytest.mark.django_db
@pytest.mark.parametrize("new_date", [date(2026, 11, 1), "2026-11-01"])
def test_confirm_across_month_boundary_moves_entry_date_and_period(env, pos, new_date):  # noqa: F811
    inv = _checkout(_order(env), pos, payment_method_id=pos["cash"].id)
    october = date(2026, 10, 31)
    Invoice.objects.filter(pk=inv.pk).update(date=october)
    oct_period, _ = AccountingPeriod.objects.get_or_create(year=2026, month=10)
    JournalEntry.objects.filter(pk=inv.journal_entry_id).update(date=october, accounting_period=oct_period)
    inv.refresh_from_db()

    BillingService.confirm_invoice(inv, "72762", date=new_date)

    inv.refresh_from_db()
    assert inv.date == date(2026, 11, 1)
    entry = JournalEntry.objects.get(pk=inv.journal_entry_id)
    assert entry.status == JournalEntry.State.POSTED
    assert entry.date == date(2026, 11, 1)
    assert (entry.accounting_period.year, entry.accounting_period.month) == (2026, 11)


@pytest.mark.django_db
def test_pos_sale_late_night_is_dated_local_today(env, pos):  # noqa: F811
    order = _order(env)
    # 23:30 en Santiago = 02:30 UTC del día siguiente.
    with time_machine.travel(datetime(2026, 11, 16, 23, 30, tzinfo=SANTIAGO), tick=False):
        inv = _checkout(order, pos, payment_method_id=pos["cash"].id)

    assert inv.date == date(2026, 11, 16)
    assert inv.journal_entry.date == date(2026, 11, 16)
