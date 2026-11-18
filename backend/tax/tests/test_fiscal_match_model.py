"""Modelo FiscalMatch: un grupo de cuadre por documento ERP."""

from datetime import date

import pytest
from django.db import IntegrityError, transaction

from accounting.models import RCVDocument, RCVImport
from tax.models import FiscalMatch, FiscalMatchRun
from tax.tests.fiscal_match_helpers import (
    local_dt,
    make_pos_document,
    make_terminal_env,
    make_terminal_sale,
)
from treasury.models import TreasuryMovement


@pytest.mark.django_db
def test_invoice_unique_per_group():
    env = make_terminal_env()
    invoice = make_pos_document(env, 1000, local_dt(2026, 5, 4))
    FiscalMatch.objects.create(direction=FiscalMatch.Direction.SALE, invoice=invoice)
    with pytest.raises(IntegrityError), transaction.atomic():
        FiscalMatch.objects.create(direction=FiscalMatch.Direction.SALE, invoice=invoice)


@pytest.mark.django_db
def test_groups_without_invoice_allowed_many():
    FiscalMatch.objects.create(direction=FiscalMatch.Direction.SALE)
    FiscalMatch.objects.create(direction=FiscalMatch.Direction.SALE)
    assert FiscalMatch.objects.count() == 2


@pytest.mark.django_db
def test_movement_unique_per_sale():
    env = make_terminal_env()
    make_pos_document(env, 1000, local_dt(2026, 5, 4))
    movement = TreasuryMovement.objects.get()
    make_terminal_sale(env, 1000, local_dt(2026, 5, 4), matched_movement=movement)
    with pytest.raises(IntegrityError, match="matched_movement"):
        with transaction.atomic():
            make_terminal_sale(env, 1000, local_dt(2026, 5, 4), matched_movement=movement)


@pytest.mark.django_db
def test_group_accepts_many_sales_and_rcv_documents():
    env = make_terminal_env()
    group = FiscalMatch.objects.create(direction=FiscalMatch.Direction.SALE)
    make_terminal_sale(env, 500, local_dt(2026, 5, 4), fiscal_match=group)
    make_terminal_sale(env, 700, local_dt(2026, 5, 4), fiscal_match=group)
    imp = RCVImport.objects.create(
        direction=RCVImport.Direction.SALES, year=2026, month=5, trigger=RCVImport.Trigger.MANUAL
    )
    for folio in (1, 2):
        RCVDocument.objects.create(
            direction=RCVImport.Direction.SALES, company_rut="76000000-0", period="202605",
            dte_type=39, folio=folio, issue_date=date(2026, 5, 4),
            first_import=imp, last_import=imp,
        )
    RCVDocument.objects.update(fiscal_match=group)
    assert group.terminal_sales.count() == 2
    assert group.rcv_documents.count() == 2


@pytest.mark.django_db
def test_run_latest_finished():
    from django.utils import timezone

    assert FiscalMatchRun.latest_finished() is None
    FiscalMatchRun.objects.create()  # sin terminar
    done = FiscalMatchRun.objects.create(finished_at=timezone.now())
    assert FiscalMatchRun.latest_finished() == done
