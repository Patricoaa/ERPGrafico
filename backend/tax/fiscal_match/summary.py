"""Resumen mensual, pendientes de folio y conteo del F29 sobre los grupos de cuadre (spec §5.6).

Solo lectura. Todo sale de agregados en la base: el número de consultas no crece
con los documentos (ADR-0118).
"""

import calendar
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.db.models import Count, F, Q, QuerySet, Sum
from django.utils import timezone

from accounting.models import RCVImport, RCVImportSummary
from billing.fiscal_key import fiscal_direction_expression, sii_code_expression
from billing.models import Invoice
from billing.sale_documents import FOLIO_EXEMPT_DTE_TYPES
from core.fiscal_match import FiscalMatchStatus, PartState
from tax.fiscal_match.boletas import BOLETA_SII_CODES
from tax.fiscal_match.candidates import sale_document_status_q
from tax.models import FiscalMatch
from treasury.models import TerminalSale

SUMMARY_SII_CODES = (39, 41, 48)
PENDING_ISSUE_CAP = 50
MISMATCH_STATUSES = (
    FiscalMatchStatus.DIFF,
    FiscalMatchStatus.AMBIGUOUS,
    FiscalMatchStatus.MISSING_ERP,
    FiscalMatchStatus.MISSING_EXTERNAL,
)
_FACTURA_TYPES = (Invoice.DTEType.FACTURA, Invoice.DTEType.FACTURA_EXENTA)
# El terminal no tiene un tipo «tarjeta»: son los que no son efectivo ni desconocidos.
_CARD_PAYMENT_TYPES = (
    TerminalSale.PaymentType.DEBIT,
    TerminalSale.PaymentType.CREDIT,
    TerminalSale.PaymentType.PREPAID,
)
_ZERO = Decimal("0")


def local_midnight(day: date) -> datetime:
    return timezone.make_aware(datetime.combine(day, time.min))


def annotated_invoices() -> QuerySet[Invoice]:
    return Invoice.objects.annotate(fiscal_direction=fiscal_direction_expression(), sii=sii_code_expression())


def totals(rows, key: str) -> dict[int, tuple[int, Decimal]]:
    return {row[key]: (row["n"] or 0, row["t"] or _ZERO) for row in rows}


def summary_status_q() -> Q:
    """Como ``sale_document_status_q`` pero los borradores deben venir de una orden de venta."""
    return Q(status=Invoice.Status.POSTED) | (sale_document_status_q() & Q(sale_order__isnull=False))


def rcv_totals(year: int, month: int) -> dict[int, tuple[int, Decimal]] | None:
    """Resúmenes de la última importación exitosa de ventas del período; ``None`` si no hay."""
    latest = (
        RCVImport.objects.filter(
            direction=RCVImport.Direction.SALES, year=year, month=month, status=RCVImport.Status.SUCCESS
        )
        .order_by(F("finished_at").desc(nulls_last=True), "-id")
        .values_list("id", flat=True)
        .first()
    )
    if latest is None:
        return None
    return totals(
        RCVImportSummary.objects.filter(rcv_import_id=latest, dte_type__in=SUMMARY_SII_CODES)
        .values("dte_type").annotate(n=Sum("document_count"), t=Sum("total_amount")).order_by(),
        "dte_type",
    )


def _card_sales_of_facturas(first: date, last: date) -> Decimal:
    """Ventas TUU con tarjeta de grupos con factura 33/34 del mes: el SII las resume en el 48."""
    total = TerminalSale.objects.filter(
        status=TerminalSale.Status.COMPLETED,
        fiscal_match__invoice__status=Invoice.Status.POSTED,
        payment_type__in=_CARD_PAYMENT_TYPES,
        fiscal_match__invoice__dte_type__in=_FACTURA_TYPES,
        fiscal_match__invoice__date__gte=first,
        fiscal_match__invoice__date__lte=last,
    ).aggregate(t=Sum("sale_amount"))["t"]
    return total or _ZERO


def summary_row(code: int, erp: dict, tuu: dict, rcv: dict | None, extra_expected: Decimal = _ZERO) -> dict:
    erp_count, erp_total = erp.get(code, (0, _ZERO))
    tuu_count, tuu_total = tuu.get(code, (0, _ZERO))
    expected = erp_total + extra_expected
    row = {
        "dte_type": code,
        "erp_count": erp_count, "erp_total": str(erp_total),
        "tuu_count": tuu_count, "tuu_total": str(tuu_total),
        "expected_total": str(expected),
        "rcv_count": None, "rcv_total": None, "difference": None,
    }
    if rcv is not None:
        rcv_count, rcv_total = rcv.get(code, (0, _ZERO))
        row.update(rcv_count=rcv_count, rcv_total=str(rcv_total), difference=str(expected - rcv_total))
    return row


def monthly_summary(year: int, month: int) -> list[dict]:
    """Filas 39, 41 y 48 (ERP, TUU, RCV); en el 48 se esperan además las tarjetas de facturas."""
    first = date(year, month, 1)
    last = date(year, month, calendar.monthrange(year, month)[1])
    lo, hi = local_midnight(first), local_midnight(last + timedelta(days=1))
    erp = totals(
        annotated_invoices()
        .filter(
            summary_status_q(), fiscal_direction="sale",
            date__gte=first, date__lte=last, sii__in=SUMMARY_SII_CODES,
        )
        .values("sii").annotate(n=Count("id"), t=Sum("total")).order_by(),
        "sii",
    )
    tuu = totals(
        TerminalSale.objects.filter(
            status=TerminalSale.Status.COMPLETED, transaction_at__gte=lo, transaction_at__lt=hi,
            document_type__in=SUMMARY_SII_CODES,
        )
        .values("document_type").annotate(n=Count("id"), t=Sum("sale_amount")).order_by(),
        "document_type",
    )
    rcv = rcv_totals(year, month)
    cards = _card_sales_of_facturas(first, last)
    return [summary_row(code, erp, tuu, rcv, cards if code == 48 else _ZERO) for code in SUMMARY_SII_CODES]


def fiscal_mismatch_counts(year: int, month: int) -> dict:
    """Grupos con diferencia del ``fiscal_period``; una consulta agregada. Solo informa (no bloquea)."""
    by_status = {str(s): 0 for s in MISMATCH_STATUSES}
    rows = (
        FiscalMatch.objects.filter(fiscal_period=f"{year}{month:02d}", status__in=MISMATCH_STATUSES)
        .values("status").annotate(n=Count("id")).order_by()
    )
    for row in rows:
        by_status[str(row["status"])] = row["n"]
    return {"count": sum(by_status.values()), "by_status": by_status}


def _reason(group: FiscalMatch) -> str:
    if group.issue_error:
        return "ERROR"
    if group.tuu_state != PartState.MATCHED:
        return "NO_TUU"
    if group.invoice.sii_code in BOLETA_SII_CODES:
        if group.rcv_count > 1:
            return "MANY_FOLIOS"
        if group.rcv_count == 0:
            return "WAITING_RCV"
    return "READY"


def pending_issue(year: int | None = None, month: int | None = None) -> dict:
    """Borradores 39/41/48 sin folio y por qué aún no se emiten (ADR-0140 D3), leídos de los grupos.

    ``ERROR``: el último intento falló; ``NO_TUU``: la parte TUU no cuadra; ``MANY_FOLIOS`` y
    ``WAITING_RCV``: boleta cuyo RCV trae varios folios o ninguno; ``READY``: la próxima
    emisión automática la toma. Dos consultas fijas.
    """
    groups = FiscalMatch.objects.filter(
        invoice__status=Invoice.Status.DRAFT, invoice__number="",
        invoice__dte_type__in=FOLIO_EXEMPT_DTE_TYPES, invoice__sale_order__isnull=False,
    )
    if year is not None and month is not None:
        first = date(year, month, 1)
        groups = groups.filter(
            invoice__date__gte=first, invoice__date__lte=date(year, month, calendar.monthrange(year, month)[1])
        )
    count = groups.count()
    rows = (
        groups.select_related("invoice").annotate(rcv_count=Count("rcv_documents"))
        .order_by("invoice__date", "invoice_id")[:PENDING_ISSUE_CAP]
    )
    items = []
    for group in rows:
        invoice = group.invoice
        reason = _reason(group)
        items.append({
            "id": invoice.pk,
            "group": group.pk,
            "label": f"{invoice.get_dte_type_display()} sin folio (#{invoice.pk})",
            "amount": str(invoice.total) if invoice.total is not None else None,
            "date": invoice.date.isoformat() if invoice.date else None,
            "reason": reason,
            "error": group.issue_error if reason == "ERROR" else None,
        })
    return {"count": count, "items": items}
