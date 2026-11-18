"""Migración 0010: vínculos por pares -> grupos FiscalMatch."""

import importlib
from datetime import date
from decimal import Decimal

import pytest
from django.apps import apps
from django.utils import timezone

from accounting.models import RCVDocument, RCVImport
from billing.models import Invoice
from tax.models import FiscalMatch
from tax.tests.fiscal_match_helpers import (
    local_dt,
    make_pos_document,
    make_terminal_env,
    make_terminal_sale,
)
from treasury.models import TerminalSale

backfill = importlib.import_module("tax.migrations.0010_fiscalmatch_backfill").backfill


def _rcv(folio: int, issue: date, direction=RCVImport.Direction.SALES, dte_type=39, total=1000, **extra) -> RCVDocument:
    imp = RCVImport.objects.create(
        direction=direction, year=issue.year, month=issue.month, trigger=RCVImport.Trigger.MANUAL
    )
    return RCVDocument.objects.create(
        first_import=imp, last_import=imp, direction=direction, company_rut="76.000.000-0",
        period=f"{issue:%Y%m}", dte_type=dte_type, folio=folio, counterparty_rut="11.111.111-1",
        issue_date=issue, total_amount=Decimal(total), **extra,
    )


def _run():
    backfill(apps, None)


@pytest.mark.django_db
def test_backfill_preserves_manual_flags():
    env = make_terminal_env()
    invoice = make_pos_document(env, 1000, local_dt(2026, 5, 4), dte_type=Invoice.DTEType.BOLETA)
    sale = make_terminal_sale(env, 1000, local_dt(2026, 5, 4), matched_invoice=invoice, matched_manually=True)
    doc = _rcv(1, date(2026, 5, 4), matched_invoice=invoice, matched_manually=True)
    attempted = timezone.now()
    TerminalSale.objects.filter(pk=sale.pk).update(issue_attempted_at=attempted, issue_error="boom")

    _run()

    group = FiscalMatch.objects.get(invoice=invoice)
    sale.refresh_from_db()
    doc.refresh_from_db()
    assert group.direction == "sale"
    assert group.rcv_linked_manually is True
    assert group.status == "PENDING"
    assert group.issue_error == "boom"
    assert group.issue_attempted_at == attempted
    assert sale.fiscal_match_id == group.id and sale.linked_manually is True
    assert doc.fiscal_match_id == group.id


@pytest.mark.django_db
def test_backfill_pending_erp_becomes_orphan_group_with_both():
    env = make_terminal_env()
    doc = _rcv(2, date(2026, 5, 4), total=1500)
    sale = make_terminal_sale(env, 1500, local_dt(2026, 5, 4), rcv_document=doc)

    _run()

    sale.refresh_from_db()
    doc.refresh_from_db()
    group = FiscalMatch.objects.get(pk=sale.fiscal_match_id)
    assert doc.fiscal_match_id == group.id
    assert group.invoice_id is None and group.direction == "sale"
    assert group.rcv_amount == 1500 and group.tuu_amount == 1500


@pytest.mark.django_db
def test_backfill_sets_movement_when_unique():
    env = make_terminal_env()
    invoice = make_pos_document(env, 1000, local_dt(2026, 5, 4), dte_type=Invoice.DTEType.BOLETA)
    movement = invoice.payments.get()
    sale = make_terminal_sale(env, 1000, local_dt(2026, 5, 4), matched_invoice=invoice)
    ambiguous = make_pos_document(env, 500, local_dt(2026, 5, 4), dte_type=Invoice.DTEType.BOLETA)
    twin = ambiguous.payments.get()
    twin.pk = None
    twin.save()
    ambiguous_sale = make_terminal_sale(env, 500, local_dt(2026, 5, 4), matched_invoice=ambiguous)

    _run()

    sale.refresh_from_db()
    ambiguous_sale.refresh_from_db()
    assert sale.matched_movement_id == movement.id
    assert ambiguous_sale.matched_movement_id is None


@pytest.mark.django_db
def test_backfill_reuses_existing_group_for_invoice():
    env = make_terminal_env()
    invoice = make_pos_document(env, 1000, local_dt(2026, 5, 4), dte_type=Invoice.DTEType.BOLETA)
    existing = FiscalMatch.objects.create(direction="sale", invoice=invoice)
    sale = make_terminal_sale(env, 1000, local_dt(2026, 5, 4), matched_invoice=invoice)

    _run()

    sale.refresh_from_db()
    assert FiscalMatch.objects.filter(invoice=invoice).count() == 1
    assert sale.fiscal_match_id == existing.id


@pytest.mark.django_db
def test_backfill_is_idempotent():
    env = make_terminal_env()
    invoice = make_pos_document(env, 1000, local_dt(2026, 5, 4), dte_type=Invoice.DTEType.BOLETA)
    make_terminal_sale(env, 1000, local_dt(2026, 5, 4), matched_invoice=invoice)
    doc = _rcv(3, date(2026, 5, 5))
    make_terminal_sale(env, 900, local_dt(2026, 5, 5), rcv_document=doc)

    _run()
    first = FiscalMatch.objects.count()
    _run()

    assert first == 2 and FiscalMatch.objects.count() == 2
