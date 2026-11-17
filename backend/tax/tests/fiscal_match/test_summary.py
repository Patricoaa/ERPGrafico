"""Resumen mensual, pendientes de folio y conteo del F29 por grupo (spec §5.6)."""

import uuid
from datetime import date
from decimal import Decimal

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from billing.models import Invoice
from core.fiscal_match import FiscalMatchStatus, PartState
from core.tests.rbac_factories import make_user
from tax.fiscal_match.summary import fiscal_mismatch_counts, monthly_summary, pending_issue
from tax.models import FiscalMatch
from tax.tests.reconciliation_helpers import (
    local_dt,
    make_pos_document,
    make_terminal_env,
    make_terminal_sale,
)
from treasury.models import TerminalSale

pytestmark = pytest.mark.django_db

AT = local_dt(2026, 10, 7)


def _row(rows, code):
    return next(r for r in rows if r["dte_type"] == code)


def _group(invoice=None, **kw):
    return FiscalMatch.objects.create(direction="sale", invoice=invoice, **kw)


def test_48_expected_includes_card_payments_of_facturas():
    env = make_terminal_env()
    make_pos_document(env, 1000, AT)  # comprobante 48 del mes
    factura = Invoice.objects.create(
        dte_type=Invoice.DTEType.FACTURA, status=Invoice.Status.POSTED, number="9", total=Decimal("5000"),
        date=date(2026, 10, 8),
    )
    group = _group(factura)
    card = make_terminal_sale(env, 5000, AT, payment_type=TerminalSale.PaymentType.DEBIT, document_type=None)
    debit = make_terminal_sale(env, 700, AT, payment_type=TerminalSale.PaymentType.CASH, document_type=None)
    TerminalSale.objects.filter(pk__in=[card.pk, debit.pk]).update(fiscal_match=group)
    other = _group(Invoice.objects.create(
        dte_type=Invoice.DTEType.FACTURA, status=Invoice.Status.POSTED, number="10", total=Decimal("1"),
        date=date(2026, 9, 30),
    ))
    out_of_month = make_terminal_sale(env, 999, AT, payment_type=TerminalSale.PaymentType.CREDIT, document_type=None)
    TerminalSale.objects.filter(pk=out_of_month.pk).update(fiscal_match=other)

    row = _row(monthly_summary(2026, 10), 48)

    assert Decimal(row["erp_total"]) == 1000
    assert Decimal(row["expected_total"]) == 6000
    assert row["difference"] is None  # sin importación RCV
    assert Decimal(_row(monthly_summary(2026, 10), 39)["expected_total"]) == 0


def _factura(number, status=Invoice.Status.POSTED):
    return Invoice.objects.create(
        dte_type=Invoice.DTEType.FACTURA, status=status, number=number, total=Decimal("100"),
        date=date(2026, 10, 8),
    )


def test_card_sales_ignore_reversed_sales_and_cancelled_facturas():
    env = make_terminal_env()
    ok_group = _group(_factura("20"))
    cancelled_group = _group(_factura("21", Invoice.Status.CANCELLED))
    good = make_terminal_sale(env, 300, AT, payment_type=TerminalSale.PaymentType.DEBIT, document_type=None)
    reversed_sale = make_terminal_sale(
        env, 400, AT, payment_type=TerminalSale.PaymentType.DEBIT, document_type=None,
        status=TerminalSale.Status.REVERSED,
    )
    on_cancelled = make_terminal_sale(env, 500, AT, payment_type=TerminalSale.PaymentType.DEBIT, document_type=None)
    TerminalSale.objects.filter(pk__in=[good.pk, reversed_sale.pk]).update(fiscal_match=ok_group)
    TerminalSale.objects.filter(pk=on_cancelled.pk).update(fiscal_match=cancelled_group)

    assert Decimal(_row(monthly_summary(2026, 10), 48)["expected_total"]) == 300


def test_mismatch_counts_keys_and_period():
    for status, period in (
        (FiscalMatchStatus.DIFF, "202610"),
        (FiscalMatchStatus.AMBIGUOUS, "202610"),
        (FiscalMatchStatus.MISSING_ERP, "202610"),
        (FiscalMatchStatus.MISSING_EXTERNAL, "202610"),
        (FiscalMatchStatus.MISSING_EXTERNAL, "202610"),
        (FiscalMatchStatus.MATCHED, "202610"),
        (FiscalMatchStatus.PENDING, "202610"),
        (FiscalMatchStatus.DIFF, "202609"),
    ):
        _group(status=status, fiscal_period=period)

    result = fiscal_mismatch_counts(2026, 10)

    assert result == {
        "count": 5,
        "by_status": {"DIFF": 1, "AMBIGUOUS": 1, "MISSING_ERP": 1, "MISSING_EXTERNAL": 2},
    }


def _draft(env, total, dte_type, **group_kw):
    invoice = make_pos_document(env, total, AT, dte_type=dte_type, status=Invoice.Status.DRAFT)
    return _group(invoice, **group_kw)


def test_pending_issue_reasons():
    from accounting.models import RCVDocument, RCVImport

    env = make_terminal_env()
    matched = {"tuu_state": PartState.MATCHED}
    failed = _draft(env, 1, Invoice.DTEType.COMPROBANTE_PAGO, issue_error="boom", **matched)
    no_tuu = _draft(env, 2, Invoice.DTEType.COMPROBANTE_PAGO)
    waiting = _draft(env, 3, Invoice.DTEType.BOLETA, **matched)
    many = _draft(env, 4, Invoice.DTEType.BOLETA, **matched)
    ready39 = _draft(env, 5, Invoice.DTEType.BOLETA, **matched)
    ready48 = _draft(env, 6, Invoice.DTEType.COMPROBANTE_PAGO, **matched)
    imp = RCVImport.objects.create(
        direction=RCVImport.Direction.SALES, year=2026, month=10, status=RCVImport.Status.SUCCESS
    )
    for group, folios in ((many, (1, 2)), (ready39, (3,))):
        for folio in folios:
            RCVDocument.objects.create(
                direction=RCVImport.Direction.SALES, company_rut="11111111-1", period="202610", dte_type=39,
                folio=folio, issue_date=date(2026, 10, 7), total_amount=Decimal("5"),
                first_import=imp, last_import=imp, fiscal_match=group,
            )
    numbered = _draft(env, 7, Invoice.DTEType.BOLETA, **matched)
    Invoice.objects.filter(pk=numbered.invoice_id).update(number="55")
    _draft(env, 8, Invoice.DTEType.COMPROBANTE_PAGO, **matched)
    FiscalMatch.objects.filter(invoice__total=8).delete()  # sin grupo no aparece

    out = pending_issue(2026, 10)

    reasons = {i["id"]: i["reason"] for i in out["items"]}
    assert out["count"] == 6
    assert reasons == {
        failed.invoice_id: "ERROR", no_tuu.invoice_id: "NO_TUU", waiting.invoice_id: "WAITING_RCV",
        many.invoice_id: "MANY_FOLIOS", ready39.invoice_id: "READY", ready48.invoice_id: "READY",
    }
    assert next(i for i in out["items"] if i["id"] == failed.invoice_id)["error"] == "boom"
    assert pending_issue(2026, 9) == {"count": 0, "items": []}
    assert pending_issue()["count"] == 6


def test_summary_query_count_constant():
    from accounting.models import RCVDocument, RCVImport

    env = make_terminal_env()
    imp = RCVImport.objects.create(
        direction=RCVImport.Direction.SALES, year=2026, month=10, status=RCVImport.Status.SUCCESS
    )

    def queries():
        with CaptureQueriesContext(connection) as ctx:
            monthly_summary(2026, 10)
            pending_issue(2026, 10)
            fiscal_mismatch_counts(2026, 10)
        return len(ctx)

    base = queries()
    for n in range(4):
        group = _draft(env, 10 + n, Invoice.DTEType.BOLETA, tuu_state=PartState.MATCHED,
                       status=FiscalMatchStatus.DIFF, fiscal_period="202610")
        sale = make_terminal_sale(env, 50, AT, payment_type=TerminalSale.PaymentType.DEBIT, document_type=39)
        TerminalSale.objects.filter(pk=sale.pk).update(fiscal_match=_group(_factura(f"3{n}")))
        RCVDocument.objects.create(
            direction=RCVImport.Direction.SALES, company_rut="11111111-1", period="202610", dte_type=39,
            folio=100 + n, issue_date=date(2026, 10, 7), total_amount=Decimal("5"),
            first_import=imp, last_import=imp, fiscal_match=group,
        )
    assert queries() == base


def _client(*perms):
    c = APIClient()
    c.force_authenticate(user=make_user(f"s-{uuid.uuid4().hex[:8]}", *perms))
    return c


def test_summary_and_pending_issue_endpoints():
    api = _client("tax.view_taxperiod")
    ok = api.get("/api/tax/fiscal-matches/summary/?year=2026&month=10")
    assert ok.status_code == 200 and [r["dte_type"] for r in ok.json()] == [39, 41, 48]
    assert api.get("/api/tax/fiscal-matches/summary/").status_code == 400
    assert api.get("/api/tax/fiscal-matches/summary/?year=2026&month=13").status_code == 400
    pend = api.get("/api/tax/fiscal-matches/pending-issue/")
    assert pend.status_code == 200 and pend.json() == {"count": 0, "items": []}
    assert api.get("/api/tax/fiscal-matches/pending-issue/?year=2026").status_code == 400
    assert _client().get("/api/tax/fiscal-matches/summary/?year=2026&month=10").status_code == 403


def test_pending_issue_includes_41_excludes_manual_drafts_and_caps():
    env = make_terminal_env()
    boleta41 = _draft(env, 1, Invoice.DTEType.BOLETA_EXENTA, tuu_state=PartState.MATCHED)
    manual = Invoice.objects.create(
        dte_type=Invoice.DTEType.BOLETA, status=Invoice.Status.DRAFT, number="", total=Decimal("9"),
        date=date(2026, 10, 7),
    )
    _group(manual, tuu_state=PartState.MATCHED)

    out = pending_issue(2026, 10)
    assert [i["id"] for i in out["items"]] == [boleta41.invoice_id]
    assert out["items"][0]["reason"] == "WAITING_RCV"

    for n in range(55):
        _draft(env, 100 + n, Invoice.DTEType.COMPROBANTE_PAGO, tuu_state=PartState.MATCHED)
    capped = pending_issue(2026, 10)
    assert capped["count"] == 56 and len(capped["items"]) == 50
