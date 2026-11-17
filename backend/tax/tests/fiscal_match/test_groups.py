"""ensure_groups: un grupo por documento ERP y por registro externo huérfano."""

from datetime import date
from decimal import Decimal

import pytest

from accounting.models import RCVDocument, RCVImport
from billing.models import Invoice
from tax.fiscal_match.groups import ensure_groups
from tax.models import FiscalMatch
from tax.tests.reconciliation_helpers import (
    local_dt,
    make_pos_document,
    make_terminal_env,
    make_terminal_sale,
)
from treasury.models import TerminalSale

SINCE = date(2026, 5, 1)


def _rcv(folio: int, issue: date, direction=RCVImport.Direction.PURCHASES, total=-1190) -> RCVDocument:
    imp = RCVImport.objects.create(
        direction=direction, year=issue.year, month=issue.month, trigger=RCVImport.Trigger.MANUAL
    )
    return RCVDocument.objects.create(
        first_import=imp, last_import=imp, direction=direction, company_rut="76.000.000-0", period=f"{issue:%Y%m}", dte_type=33,
        folio=folio, counterparty_rut="11.111.111-1", issue_date=issue, total_amount=Decimal(total),
    )


@pytest.mark.django_db
def test_creates_group_per_posted_invoice_once():
    env = make_terminal_env()
    invoice = make_pos_document(env, 1000, local_dt(2026, 5, 4), dte_type=Invoice.DTEType.BOLETA)
    assert ensure_groups(SINCE) == 1
    assert ensure_groups(SINCE) == 0
    group = FiscalMatch.objects.get(invoice=invoice)
    assert group.direction == "sale"
    assert group.dte_type == 39
    assert group.issue_date == date(2026, 5, 4)
    assert group.fiscal_period == "202605"
    assert group.erp_amount == Decimal("1000")
    assert group.counterparty_rut  # normalizado, no vacío


@pytest.mark.django_db
def test_orphan_groups_for_unlinked_rcv_and_terminal_sales():
    env = make_terminal_env()
    rcv = _rcv(10, date(2026, 5, 6))
    sale = make_terminal_sale(env, 500, local_dt(2026, 5, 7), document_type=39)
    assert ensure_groups(SINCE) == 2
    rcv.refresh_from_db()
    sale.refresh_from_db()
    assert rcv.fiscal_match.rcv_amount == Decimal("1190")
    assert rcv.fiscal_match.direction == "purchase"
    assert rcv.fiscal_match.fiscal_period == "202605"
    assert sale.fiscal_match.tuu_amount == Decimal("500")
    assert sale.fiscal_match.direction == "sale"
    assert sale.fiscal_match.dte_type == 39
    assert sale.fiscal_match.issue_date == date(2026, 5, 7)
    assert ensure_groups(SINCE) == 0


@pytest.mark.django_db
def test_ignores_before_start_date():
    env = make_terminal_env()
    make_pos_document(env, 1000, local_dt(2026, 4, 30))
    _rcv(11, date(2026, 4, 30))
    make_terminal_sale(env, 500, local_dt(2026, 4, 30, 23, 59))
    assert ensure_groups(SINCE) == 0
    assert FiscalMatch.objects.count() == 0


@pytest.mark.django_db
def test_skips_cancelled_and_non_completed():
    env = make_terminal_env()
    make_pos_document(env, 1000, local_dt(2026, 5, 4), status=Invoice.Status.CANCELLED)
    make_terminal_sale(env, 500, local_dt(2026, 5, 4), status=TerminalSale.Status.REVERSED)
    assert ensure_groups(SINCE) == 0


def _populate(n: int, env, offset: int = 0) -> None:
    for i in range(offset, offset + n):
        make_pos_document(env, 1000 + i, local_dt(2026, 5, 4), dte_type=Invoice.DTEType.BOLETA)
        _rcv(1000 + i, date(2026, 5, 5))
        make_terminal_sale(env, 300 + i, local_dt(2026, 5, 6))


@pytest.mark.django_db
def test_query_count_constant(django_assert_max_num_queries):
    env = make_terminal_env()
    _populate(1, env)
    with django_assert_max_num_queries(8):
        assert ensure_groups(SINCE) == 3
    _populate(10, env, offset=1)
    with django_assert_max_num_queries(8):
        assert ensure_groups(SINCE) == 30
