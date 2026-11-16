"""Reporte de cuadre fiscal del período y vínculo manual del RCV (ADR-0138)."""

import itertools
from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient

from accounting.models import RCVDocument, RCVImport, RCVImportSummary
from billing.models import Invoice
from contacts.models import Contact
from core.fiscal_match import MatchStatus
from core.tests.rbac_factories import make_user
from purchasing.models import PurchaseOrder
from tax.reconciliation.report import fiscal_reconciliation_report
from tax.tests.reconciliation_helpers import (
    local_dt,
    make_pos_document,
    make_terminal_env,
    make_terminal_sale,
    set_match_settings,
)
from treasury.models import TerminalSale

pytestmark = pytest.mark.django_db

BASE = "/api/tax/reconciliation"
P = RCVImport.Direction.PURCHASES
S = RCVImport.Direction.SALES
_seq = itertools.count(5000)


@pytest.fixture
def api():
    c = APIClient()
    c.force_authenticate(user=make_user("recon-rep", "tax.view_taxperiod", "tax.change_taxperiod"))
    return c


def _import(direction=S, status=RCVImport.Status.SUCCESS, finished_at=None, month=10):
    return RCVImport.objects.create(
        direction=direction, year=2026, month=month, trigger=RCVImport.Trigger.MANUAL,
        status=status, finished_at=finished_at or timezone.now(),
    )


def _rcv(imp, folio, total, *, direction=P, dte_type=33, rut="8973356-K", **kw):
    return RCVDocument.objects.create(
        direction=direction, company_rut="11111111-1", period="202610", dte_type=dte_type, folio=folio,
        counterparty_rut=rut, issue_date=date(2026, 10, 15), total_amount=Decimal(total),
        first_import=imp, last_import=imp, **kw,
    )


def _invoice(dte_type, total, *, number=None, day=12, rut="8.973.356-k", **kw):
    return Invoice.objects.create(
        dte_type=dte_type, status=kw.pop("status", Invoice.Status.POSTED),
        number=str(next(_seq)) if number is None else number,
        partner_tax_id_snapshot=rut, total=Decimal(total), date=date(2026, 10, day), **kw,
    )


def _purchase_order():
    supplier = Contact.objects.create(name=f"Proveedor {next(_seq)}", tax_id="8.973.356-k")
    return PurchaseOrder.objects.create(supplier=supplier, status="DRAFT")


def _row(report, code):
    return next(r for r in report["summaries"] if r["dte_type"] == code)


def test_report_three_column_summary():
    set_match_settings(date(2026, 10, 1))
    env = make_terminal_env()
    for amount, hh in ((1000, 10), (2000, 11)):
        make_pos_document(env, amount, local_dt(2026, 10, 5, hh), dte_type=Invoice.DTEType.BOLETA)
        make_terminal_sale(env, amount, local_dt(2026, 10, 5, hh), document_type=39)
    make_terminal_sale(env, 9999, local_dt(2026, 11, 1, 1), document_type=39)  # otro mes
    imp = _import()
    RCVImportSummary.objects.create(rcv_import=imp, dte_type=39, document_count=2, total_amount=Decimal(3000))

    report = fiscal_reconciliation_report(2026, 10)

    row = _row(report, 39)
    assert row["erp_count"] == 2 and Decimal(row["erp_total"]) == 3000
    assert row["tuu_count"] == 2 and Decimal(row["tuu_total"]) == 3000
    assert row["rcv_count"] == 2 and Decimal(row["rcv_total"]) == 3000
    assert Decimal(row["difference"]) == 0
    assert [r["dte_type"] for r in report["summaries"]] == [39, 41, 48]
    assert _row(report, 48)["erp_count"] == 0 and Decimal(_row(report, 48)["erp_total"]) == 0
    assert report["start_date"] == "2026-10-01"


def test_report_uses_latest_successful_sales_import():
    old = _import(finished_at=timezone.now() - timedelta(days=2))
    RCVImportSummary.objects.create(rcv_import=old, dte_type=39, document_count=1, total_amount=Decimal(10))
    new = _import()
    RCVImportSummary.objects.create(rcv_import=new, dte_type=39, document_count=3, total_amount=Decimal(30))
    failed = _import(status=RCVImport.Status.FAILED, finished_at=timezone.now() + timedelta(hours=1))
    RCVImportSummary.objects.create(rcv_import=failed, dte_type=39, document_count=9, total_amount=Decimal(90))

    row = _row(fiscal_reconciliation_report(2026, 10), 39)

    assert row["rcv_count"] == 3 and Decimal(row["rcv_total"]) == 30
    assert Decimal(row["difference"]) == -30


def test_report_rcv_null_when_no_import():
    _import(direction=P)  # compras no cuenta
    _import(month=9)  # otro período

    row = _row(fiscal_reconciliation_report(2026, 10), 39)

    assert row["rcv_count"] is None and row["rcv_total"] is None and row["difference"] is None


def test_only_erp_excludes_purchase_boletas():
    set_match_settings(date(2026, 10, 5))
    imp = _import(direction=P)
    _invoice(Invoice.DTEType.BOLETA, 500, purchase_order=_purchase_order())  # boleta de compra
    _invoice(Invoice.DTEType.PURCHASE_INV, 700, sii_document_code=39)  # boleta de compra con código
    missing = _invoice(Invoice.DTEType.PURCHASE_INV, 1000)
    linked = _invoice(Invoice.DTEType.PURCHASE_INV, 2000)
    _rcv(imp, int(linked.number), 2000, matched_invoice=linked, match_status=MatchStatus.MATCHED)
    _rcv(imp, 999, 50, match_status=MatchStatus.ONLY_EXTERNAL)
    _invoice(Invoice.DTEType.PURCHASE_INV, 3000, day=1)  # antes del inicio
    _invoice(Invoice.DTEType.PURCHASE_INV, 3000, number="")  # sin folio
    _invoice(Invoice.DTEType.PURCHASE_INV, 3000, status=Invoice.Status.DRAFT)
    _invoice(Invoice.DTEType.FACTURA, 4000, day=20)  # venta sin RCV de ventas importado
    _invoice(Invoice.DTEType.BOLETA, 4000)  # boleta de venta: va por resumen

    report = fiscal_reconciliation_report(2026, 10)

    assert report["documents"]["purchase"] == {
        MatchStatus.MATCHED: 1, MatchStatus.ONLY_EXTERNAL: 1, MatchStatus.ONLY_ERP: 1,
    }
    # Sin importación RCV de ventas no se sabe qué falta en el SII: null, y sin listar.
    assert report["documents"]["sale"] == {MatchStatus.ONLY_ERP: None}
    assert [i["id"] for i in report["only_erp"]] == [missing.id]
    assert report["only_erp"][0] == {
        "id": missing.id, "label": f"Factura de Compra {missing.number}",
        "amount": str(missing.total), "date": "2026-10-12",
    }


def test_only_erp_counts_sales_once_imported():
    set_match_settings(date(2026, 10, 5))
    _import(direction=P, status=RCVImport.Status.FAILED)
    _import(direction=S)
    _invoice(Invoice.DTEType.PURCHASE_INV, 1000)
    sale_missing = _invoice(Invoice.DTEType.FACTURA, 4000, day=20)

    report = fiscal_reconciliation_report(2026, 10)

    assert report["documents"]["purchase"] == {MatchStatus.ONLY_ERP: None}
    assert report["documents"]["sale"] == {MatchStatus.ONLY_ERP: 1}
    assert [i["id"] for i in report["only_erp"]] == [sale_missing.id]


def test_only_erp_zero_without_start_date():
    set_match_settings(None)
    _invoice(Invoice.DTEType.PURCHASE_INV, 1000)
    imp = _import(direction=P)
    _rcv(imp, 1, 50, match_status=MatchStatus.ONLY_EXTERNAL)

    report = fiscal_reconciliation_report(2026, 10)

    assert report["start_date"] is None
    assert report["documents"]["purchase"] == {MatchStatus.ONLY_EXTERNAL: 1, MatchStatus.ONLY_ERP: 0}
    assert report["only_erp"] == []
    assert report["terminal"] == {MatchStatus.ONLY_ERP: 0}


def test_terminal_counts_and_only_erp():
    set_match_settings(date(2026, 10, 1))
    env = make_terminal_env()
    at = local_dt(2026, 10, 7, 12)
    make_terminal_sale(env, 100, at, match_status=MatchStatus.ONLY_EXTERNAL)
    make_terminal_sale(env, 200, at, match_status=MatchStatus.AMBIGUOUS)
    make_terminal_sale(env, 300, local_dt(2026, 9, 30, 12), match_status=MatchStatus.AMBIGUOUS)
    missing = make_pos_document(env, 5000, at, dte_type=Invoice.DTEType.BOLETA)
    recent = make_pos_document(env, 6000, at)  # creado dentro de la ventana
    linked = make_pos_document(env, 7000, at)
    make_terminal_sale(env, 7000, at, matched_invoice=linked, match_status=MatchStatus.MATCHED)
    factura = make_pos_document(env, 8000, at, dte_type=Invoice.DTEType.FACTURA)
    old = timezone.now() - timedelta(hours=1)
    Invoice.objects.filter(pk__in=[missing.pk, linked.pk, factura.pk]).update(created_at=old)
    assert recent.pk

    report = fiscal_reconciliation_report(2026, 10)

    assert report["terminal"] == {
        MatchStatus.ONLY_EXTERNAL: 1, MatchStatus.AMBIGUOUS: 1, MatchStatus.MATCHED: 1, MatchStatus.ONLY_ERP: 1,
    }


def _populate(n):
    env = make_terminal_env()
    imp = _import(direction=P)
    for _ in range(n):
        at = local_dt(2026, 10, 8, 12)
        make_pos_document(env, 1000, at, dte_type=Invoice.DTEType.BOLETA)
        make_pos_document(env, 1000, at, dte_type=Invoice.DTEType.COMPROBANTE_PAGO)
        make_terminal_sale(env, 1000, at, document_type=48, match_status=MatchStatus.ONLY_EXTERNAL)
        make_terminal_sale(env, 1000, at, document_type=39)
        inv = _invoice(Invoice.DTEType.PURCHASE_INV, 1000)
        _rcv(imp, int(inv.number), 1000, matched_invoice=inv, match_status=MatchStatus.MATCHED)
        _invoice(Invoice.DTEType.PURCHASE_INV, 1000)
        _invoice(Invoice.DTEType.FACTURA, 1000)
    sales = _import()
    for _ in range(n):
        _rcv(sales, next(_seq), 1000, direction=S, dte_type=39, match_status=MatchStatus.ONLY_EXTERNAL)
    for code in (39, 41, 48):
        RCVImportSummary.objects.create(rcv_import=sales, dte_type=code, document_count=n, total_amount=n * 1000)


def _count_queries():
    with CaptureQueriesContext(connection) as ctx:
        fiscal_reconciliation_report(2026, 10)
    return len(ctx.captured_queries)


def test_report_query_count_constant():
    set_match_settings(date(2026, 10, 1))
    _populate(5)
    _count_queries()  # calienta el caché de RCVSettings
    small = _count_queries()
    _populate(25)
    assert _count_queries() == small


def test_report_endpoint(api):
    r = api.get(f"{BASE}/", {"year": 2026, "month": 10})
    assert r.status_code == 200
    assert set(r.json()) == {"start_date", "documents", "only_erp", "summaries", "terminal"}
    assert {"tuu_without_rcv", "rcv_without_tuu"} <= set(r.json()["summaries"][0])
    assert api.get(f"{BASE}/", {"year": 2026, "month": 13}).status_code == 400
    assert api.get(f"{BASE}/").status_code == 400


def test_report_endpoint_permissions():
    viewer = APIClient()
    viewer.force_authenticate(user=make_user("recon-view", "tax.view_taxperiod"))
    assert viewer.get(f"{BASE}/", {"year": 2026, "month": 10}).status_code == 200
    assert viewer.post(f"{BASE}/rcv/run/", {"year": 2026, "month": 10}, format="json").status_code == 403
    doc = _rcv(_import(direction=P), 1, 10)
    assert viewer.get(f"{BASE}/rcv-documents/{doc.pk}/candidates/").status_code == 403
    assert viewer.post(f"{BASE}/rcv-documents/{doc.pk}/match/", {"invoice_id": 1}, format="json").status_code == 403
    assert viewer.post(f"{BASE}/rcv-documents/{doc.pk}/unmatch/").status_code == 403
    nobody = APIClient()
    nobody.force_authenticate(user=make_user("recon-none"))
    assert nobody.get(f"{BASE}/", {"year": 2026, "month": 10}).status_code == 403


def test_rcv_run_endpoint(api):
    set_match_settings(date(2026, 10, 1))
    imp = _import(direction=P)
    _rcv(imp, 77, 100)
    r = api.post(f"{BASE}/rcv/run/", {"year": 2026, "month": 10}, format="json")
    assert r.status_code == 200
    assert r.json() == {"purchase": {MatchStatus.ONLY_EXTERNAL: 1}, "sale": {}, "boletas": {}}
    assert api.post(f"{BASE}/rcv/run/", {"year": 2026, "month": 0}, format="json").status_code == 400


def test_rcv_manual_match(api):
    imp = _import(direction=P)
    doc = _rcv(imp, 123, 1000)
    by_folio = _invoice(Invoice.DTEType.PURCHASE_INV, 900, number="000123")
    by_total = _invoice(Invoice.DTEType.PURCHASE_INV, 1000)
    _invoice(Invoice.DTEType.PURCHASE_INV, 555)  # ni folio ni total
    _invoice(Invoice.DTEType.PURCHASE_INV, 1000, rut="7.777.777-7")  # otro RUT
    _invoice(Invoice.DTEType.FACTURA, 1000, number="123")  # venta
    _invoice(Invoice.DTEType.NOTA_CREDITO, 1000, purchase_order=_purchase_order())  # otro código
    _invoice(Invoice.DTEType.PURCHASE_INV, 1000, status=Invoice.Status.DRAFT)
    taken = _invoice(Invoice.DTEType.PURCHASE_INV, 1000)
    _rcv(imp, 456, 1000, matched_invoice=taken, match_status=MatchStatus.MATCHED)

    r = api.get(f"{BASE}/rcv-documents/{doc.pk}/candidates/")
    assert r.status_code == 200
    assert [i["id"] for i in r.json()] == [by_folio.id, by_total.id]

    r = api.post(f"{BASE}/rcv-documents/{doc.pk}/match/", {"invoice_id": by_folio.pk}, format="json")
    assert r.status_code == 200
    assert r.json() == {"id": doc.pk, "match_status": MatchStatus.AMOUNT_DIFF, "matched_invoice": by_folio.pk}
    doc.refresh_from_db()
    assert doc.matched_manually and doc.matched_invoice_id == by_folio.pk

    r = api.post(f"{BASE}/rcv-documents/{doc.pk}/match/", {"invoice_id": by_total.pk}, format="json")
    doc.refresh_from_db()
    assert doc.match_status == MatchStatus.MATCHED

    r = api.post(f"{BASE}/rcv-documents/{doc.pk}/unmatch/")
    assert r.status_code == 200
    doc.refresh_from_db()
    assert doc.matched_invoice is None and not doc.matched_manually and doc.match_status == ""


def test_rcv_manual_match_rejections(api):
    imp = _import(direction=P)
    doc = _rcv(imp, 123, 1000)
    sale = _invoice(Invoice.DTEType.FACTURA, 1000)
    draft = _invoice(Invoice.DTEType.PURCHASE_INV, 1000, status=Invoice.Status.DRAFT)
    taken = _invoice(Invoice.DTEType.PURCHASE_INV, 1000)
    _rcv(imp, 456, 1000, matched_invoice=taken, match_status=MatchStatus.MATCHED)
    for invoice in (sale, draft, taken):
        r = api.post(f"{BASE}/rcv-documents/{doc.pk}/match/", {"invoice_id": invoice.pk}, format="json")
        assert r.status_code == 400
    doc.refresh_from_db()
    assert doc.matched_invoice is None and not doc.matched_manually


# ── Boletas 39/41: cruce RCV ↔ venta TUU (ADR-0139) ─────────────────────────


def test_summaries_boletas_without_pair():
    set_match_settings(date(2026, 10, 1))
    env = make_terminal_env()
    at = local_dt(2026, 10, 5, 12)
    imp = _import()
    paired = _rcv(imp, 1, 1000, direction=S, dte_type=39, match_status=MatchStatus.MATCHED)
    make_terminal_sale(env, 1000, at, document_type=39, rcv_document=paired)
    make_terminal_sale(env, 2000, at, document_type=39)  # sin boleta
    make_terminal_sale(env, 2500, at, document_type=41)  # sin boleta
    make_terminal_sale(env, 3000, at, document_type=39, status=TerminalSale.Status.REVERSED)  # anulada: no cuenta
    make_terminal_sale(env, 4000, local_dt(2026, 11, 1, 12), document_type=39)  # otro mes
    make_terminal_sale(env, 5000, at, document_type=48)  # comprobante: no aplica
    _rcv(imp, 2, 700, direction=S, dte_type=39, match_status=MatchStatus.ONLY_EXTERNAL)
    _rcv(imp, 3, 800, direction=S, dte_type=39, match_status=MatchStatus.ONLY_EXTERNAL)
    _rcv(imp, 4, 900, direction=S, dte_type=41, match_status=MatchStatus.ONLY_EXTERNAL)
    _rcv(imp, 5, 900, direction=S, dte_type=39, match_status=MatchStatus.EXCLUDED)

    report = fiscal_reconciliation_report(2026, 10)

    assert _row(report, 39)["tuu_without_rcv"] == 1 and _row(report, 39)["rcv_without_tuu"] == 2
    assert _row(report, 41)["tuu_without_rcv"] == 1 and _row(report, 41)["rcv_without_tuu"] == 1
    assert _row(report, 48)["tuu_without_rcv"] is None and _row(report, 48)["rcv_without_tuu"] is None


def test_summaries_boletas_zero_when_all_paired():
    set_match_settings(date(2026, 10, 1))
    _import()
    report = fiscal_reconciliation_report(2026, 10)
    assert _row(report, 39)["tuu_without_rcv"] == 0 and _row(report, 39)["rcv_without_tuu"] == 0


def test_tuu_without_rcv_null_without_rcv_import():
    """Sin importación RCV de ventas no se sabe qué falta en el SII: null, como las columnas SII."""
    set_match_settings(date(2026, 10, 1))
    env = make_terminal_env()
    make_terminal_sale(env, 2000, local_dt(2026, 10, 5, 12), document_type=39)
    _import(direction=P)  # compras no cuenta
    _import(status=RCVImport.Status.FAILED)

    report = fiscal_reconciliation_report(2026, 10)

    assert _row(report, 39)["tuu_without_rcv"] is None and _row(report, 41)["tuu_without_rcv"] is None


def test_tuu_without_rcv_respects_start_date():
    set_match_settings(date(2026, 10, 10))
    env = make_terminal_env()
    make_terminal_sale(env, 2000, local_dt(2026, 10, 9, 23, 59), document_type=39)  # antes del inicio
    make_terminal_sale(env, 2000, local_dt(2026, 10, 10, 0, 1), document_type=39)
    _import()

    assert _row(fiscal_reconciliation_report(2026, 10), 39)["tuu_without_rcv"] == 1
    set_match_settings(date(2026, 11, 1))  # el cuadre aún no aplica a este mes
    assert _row(fiscal_reconciliation_report(2026, 10), 39)["tuu_without_rcv"] is None
    set_match_settings(None)
    assert _row(fiscal_reconciliation_report(2026, 10), 39)["tuu_without_rcv"] is None


def test_mismatch_counts_boletas_counted_once():
    """Una boleta RCV sin venta TUU suma 1 (por su estado); la venta TUU sin boleta no suma."""
    from tax.reconciliation.report import fiscal_mismatch_counts

    env = make_terminal_env()
    imp = _import()
    _rcv(imp, 1, 700, direction=S, dte_type=39, match_status=MatchStatus.ONLY_EXTERNAL)
    _rcv(imp, 2, 700, direction=S, dte_type=41, match_status=MatchStatus.ONLY_EXTERNAL)
    make_terminal_sale(env, 2000, local_dt(2026, 10, 5, 12), document_type=39, match_status=MatchStatus.MATCHED)

    result = fiscal_mismatch_counts(2026, 10)

    assert result["count"] == 2
    assert result["by_status"][MatchStatus.ONLY_EXTERNAL] == 2


def test_summaries_and_only_erp_count_pos_drafts():
    """ADR-0140 D2: el 39/48 en borrador sin folio es una venta real a la espera de su número."""
    set_match_settings(date(2026, 10, 1))
    env = make_terminal_env()
    at = local_dt(2026, 10, 7, 12)
    draft = make_pos_document(env, 1500, at, dte_type=Invoice.DTEType.BOLETA, status=Invoice.Status.DRAFT)
    numbered = make_pos_document(env, 900, at, dte_type=Invoice.DTEType.BOLETA, status=Invoice.Status.DRAFT)
    draft48 = make_pos_document(env, 2500, at, status=Invoice.Status.DRAFT)
    Invoice.objects.filter(pk=numbered.pk).update(number="55")
    old = timezone.now() - timedelta(hours=1)
    Invoice.objects.filter(pk__in=[draft.pk, numbered.pk, draft48.pk]).update(created_at=old)

    report = fiscal_reconciliation_report(2026, 10)

    assert _row(report, 39)["erp_count"] == 1 and Decimal(_row(report, 39)["erp_total"]) == 1500
    assert _row(report, 48)["erp_count"] == 1 and Decimal(_row(report, 48)["erp_total"]) == 2500
    assert report["terminal"][MatchStatus.ONLY_ERP] == 2


def test_mismatch_counts_include_pending_erp():
    """ADR-0140 D5: la boleta con venta TUU pero sin documento ERP es una diferencia."""
    from tax.reconciliation.report import fiscal_mismatch_counts

    imp = _import()
    _rcv(imp, 1, 700, direction=S, dte_type=39, match_status=MatchStatus.PENDING_ERP)
    _rcv(imp, 2, 800, direction=S, dte_type=39, match_status=MatchStatus.MATCHED)

    result = fiscal_mismatch_counts(2026, 10)

    assert result["count"] == 1
    assert result["by_status"][MatchStatus.PENDING_ERP] == 1
