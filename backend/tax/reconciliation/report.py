"""Reporte de cuadre fiscal del período: ERP vs TUU vs SII (ADR-0138 D6).

Solo lectura. Todas las cifras salen de agregados en la base de datos, así el
número de consultas no crece con los documentos del período (ADR-0118).
"""

import calendar
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.db.models import Count, Exists, F, OuterRef, Q, QuerySet, Sum
from django.utils import timezone

from accounting.models import RCVDocument, RCVImport, RCVImportSummary, RCVSettings
from billing.fiscal_key import fiscal_direction_expression, sii_code_expression
from billing.models import Invoice
from billing.sale_documents import FOLIO_EXEMPT_DTE_TYPES
from core.fiscal_match import MatchStatus
from treasury.models import TerminalSale, TreasuryMovement

from .rcv import BOLETA_SII_CODES, DOCUMENT_SII_CODES, RCV_TO_FISCAL_DIRECTION
from .terminal import sale_document_status_q

SUMMARY_SII_CODES = (39, 41, 48)
ONLY_ERP_CAP = 50
# Mismo criterio que `billing.fiscal_key.parse_folio`: dígitos (con puntos/espacios) y > 0.
FOLIO_REGEX = r"^[0-9. ]*[1-9][0-9. ]*$"


def fiscal_reconciliation_report(year: int, month: int) -> dict:
    settings = RCVSettings.get_settings()
    start = settings.fiscal_match_start_date
    first = date(year, month, 1)
    last = date(year, month, calendar.monthrange(year, month)[1])
    lo, hi = _local_midnight(first), _local_midnight(last + timedelta(days=1))
    imported = _imported_directions(year, month)
    only_erp = _only_erp_documents(first, last, start, imported)
    return {
        "start_date": start.isoformat() if start else None,
        "documents": _documents(f"{year}{month:02d}", only_erp, imported),
        "only_erp": [_item(i) for i in only_erp.order_by("date", "id")[:ONLY_ERP_CAP]] if only_erp is not None else [],
        "summaries": _summaries(year, month, first, last, lo, hi, start),
        "terminal": _terminal(first, last, lo, hi, start, settings.terminal_match_window_minutes),
    }


MISMATCH_STATUSES = (
    MatchStatus.ONLY_EXTERNAL,
    MatchStatus.AMOUNT_DIFF,
    MatchStatus.TYPE_DIFF,
    MatchStatus.AMBIGUOUS,
    MatchStatus.PENDING_ERP,
)


def fiscal_mismatch_counts(year: int, month: int) -> dict:
    """Diferencias del cuadre (RCV + ventas TUU) del mes; 2 consultas agregadas fijas.

    ``ONLY_ERP`` no se cuenta: el RCV puede llegar tarde. Las boletas RCV 39/41 sin venta
    TUU ya entran como ``ONLY_EXTERNAL`` y las que tienen venta TUU sin documento ERP como
    ``PENDING_ERP`` (ADR-0140 D5); la venta TUU sin boleta no tiene estado propio y solo
    se informa en el reporte (ADR-0139 D2).
    """
    first = date(year, month, 1)
    lo = _local_midnight(first)
    hi = _local_midnight(date(year + (month == 12), month % 12 + 1, 1))
    by_status = {str(s): 0 for s in MISMATCH_STATUSES}
    rcv = RCVDocument.objects.filter(period=f"{year}{month:02d}", match_status__in=MISMATCH_STATUSES)
    sales = TerminalSale.objects.filter(transaction_at__gte=lo, transaction_at__lt=hi, match_status__in=MISMATCH_STATUSES)
    for qs in (rcv, sales):
        for row in qs.values("match_status").annotate(n=Count("id")).order_by():
            by_status[str(row["match_status"])] += row["n"]
    return {"count": sum(by_status.values()), "by_status": by_status}


def _local_midnight(day: date) -> datetime:
    return timezone.make_aware(datetime.combine(day, time.min))


def _period_start(first: date, last: date, start: date | None) -> date | None:
    """Primer día evaluable del mes, o ``None`` si el cuadre no aplica a este mes."""
    if start is None or last < start:
        return None
    return max(first, start)


def _annotated_invoices() -> QuerySet[Invoice]:
    return Invoice.objects.annotate(fiscal_direction=fiscal_direction_expression(), sii=sii_code_expression())


def _imported_directions(year: int, month: int) -> set[str]:
    """Direcciones fiscales con alguna importación RCV exitosa del período."""
    rows = RCVImport.objects.filter(year=year, month=month, status=RCVImport.Status.SUCCESS).values_list(
        "direction", flat=True
    ).distinct()
    return {RCV_TO_FISCAL_DIRECTION[d] for d in rows}


def _only_erp_documents(
    first: date, last: date, start: date | None, imported: set[str]
) -> QuerySet[Invoice] | None:
    """Facturas sin documento RCV; solo en direcciones ya importadas (si no, no se sabe qué falta)."""
    since = _period_start(first, last, start)
    if since is None or not imported:
        return None
    linked = RCVDocument.objects.filter(matched_invoice=OuterRef("pk"))
    return (
        _annotated_invoices()
        .filter(
            status=Invoice.Status.POSTED,
            date__gte=since,
            date__lte=last,
            sii__in=DOCUMENT_SII_CODES,
            number__regex=FOLIO_REGEX,
            fiscal_direction__in=imported,
        )
        .filter(~Exists(linked))
    )


def _documents(
    period: str, only_erp: QuerySet[Invoice] | None, imported: set[str]
) -> dict[str, dict[str, int | None]]:
    """Conteos por estado; ``ONLY_ERP`` es ``None`` en una dirección sin importación RCV exitosa."""
    out: dict[str, dict[str, int | None]] = {"purchase": {}, "sale": {}}
    rows = (
        RCVDocument.objects.filter(period=period)
        .values("direction", "match_status")
        .annotate(n=Count("id"))
        .order_by()
    )
    for row in rows:
        out[RCV_TO_FISCAL_DIRECTION[row["direction"]]][row["match_status"]] = row["n"]
    for direction, counts in out.items():
        counts[MatchStatus.ONLY_ERP] = 0 if direction in imported else None
    if only_erp is not None:
        for row in only_erp.values("fiscal_direction").annotate(n=Count("id")).order_by():
            out[row["fiscal_direction"]][MatchStatus.ONLY_ERP] = row["n"]
    return out


def _item(invoice: Invoice) -> dict:
    """Mismo formato que `_item` de `TaxPeriodService` (checklist de cierre)."""
    return {
        "id": invoice.pk,
        "label": f"{invoice.get_dte_type_display()} {invoice.number}".strip(),
        "amount": str(invoice.total) if invoice.total is not None else None,
        "date": invoice.date.isoformat() if invoice.date else None,
    }


def _totals(rows, key: str) -> dict[int, tuple[int, Decimal]]:
    return {row[key]: (row["n"] or 0, row["t"] or Decimal("0")) for row in rows}


def _summary_status_q() -> Q:
    """Como ``sale_document_status_q`` pero los borradores deben venir de una orden de venta."""
    return Q(status=Invoice.Status.POSTED) | (
        sale_document_status_q() & Q(sale_order__isnull=False)
    )


def _summaries(
    year: int, month: int, first: date, last: date, lo: datetime, hi: datetime, start: date | None
) -> list[dict]:
    # El código sale de `sii_code_expression`, así un `sii_document_code` explícito también cuenta.
    # Los borradores 39/41/48 sin folio son ventas reales a la espera de su número (ADR-0140 D2).
    erp = _totals(
        _annotated_invoices()
        .filter(
            _summary_status_q(), fiscal_direction="sale",
            date__gte=first, date__lte=last, sii__in=SUMMARY_SII_CODES,
        )
        .values("sii").annotate(n=Count("id"), t=Sum("total")).order_by(),
        "sii",
    )
    tuu = _totals(
        TerminalSale.objects.filter(
            status=TerminalSale.Status.COMPLETED, transaction_at__gte=lo, transaction_at__lt=hi,
            document_type__in=SUMMARY_SII_CODES,
        )
        .values("document_type").annotate(n=Count("id"), t=Sum("sale_amount")).order_by(),
        "document_type",
    )
    rcv = _rcv_totals(year, month)
    since = _period_start(first, last, start) if rcv is not None else None
    unpaired = _unpaired_boletas(year, month, since, hi)
    return [_summary_row(code, erp, tuu, rcv) | unpaired.get(code, _NO_PAIRING) for code in SUMMARY_SII_CODES]


_NO_PAIRING = {"tuu_without_rcv": None, "rcv_without_tuu": None}


def _unpaired_boletas(year: int, month: int, since: date | None, hi: datetime) -> dict[int, dict[str, int | None]]:
    """Boletas 39/41 sin par (ADR-0139): venta TUU sin boleta RCV y boleta RCV sin venta TUU.

    ``since`` es el primer día que se cuadra; ``None`` (sin importación RCV de ventas
    o sin fecha de inicio que cubra el mes) deja ``tuu_without_rcv`` en null: no se
    sabe qué falta en el SII.
    """
    out: dict[int, dict[str, int | None]] = {
        code: {"tuu_without_rcv": None if since is None else 0, "rcv_without_tuu": 0} for code in BOLETA_SII_CODES
    }
    if since is not None:
        sales = (
            TerminalSale.objects.filter(
                status=TerminalSale.Status.COMPLETED, transaction_at__gte=_local_midnight(since),
                transaction_at__lt=hi, document_type__in=BOLETA_SII_CODES, rcv_document__isnull=True,
            )
            .values("document_type").annotate(n=Count("id")).order_by()
        )
        for row in sales:
            out[row["document_type"]]["tuu_without_rcv"] = row["n"]
    docs = (
        RCVDocument.objects.filter(
            direction=RCVImport.Direction.SALES, period=f"{year}{month:02d}",
            dte_type__in=BOLETA_SII_CODES, match_status=MatchStatus.ONLY_EXTERNAL,
        )
        .values("dte_type").annotate(n=Count("id")).order_by()
    )
    for row in docs:
        out[row["dte_type"]]["rcv_without_tuu"] = row["n"]
    return out


def _rcv_totals(year: int, month: int) -> dict[int, tuple[int, Decimal]] | None:
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
    return _totals(
        RCVImportSummary.objects.filter(rcv_import_id=latest, dte_type__in=SUMMARY_SII_CODES)
        .values("dte_type").annotate(n=Sum("document_count"), t=Sum("total_amount")).order_by(),
        "dte_type",
    )


def _summary_row(code: int, erp: dict, tuu: dict, rcv: dict | None) -> dict:
    erp_count, erp_total = erp.get(code, (0, Decimal("0")))
    tuu_count, tuu_total = tuu.get(code, (0, Decimal("0")))
    row = {
        "dte_type": code,
        "erp_count": erp_count, "erp_total": str(erp_total),
        "tuu_count": tuu_count, "tuu_total": str(tuu_total),
        "rcv_count": None, "rcv_total": None, "difference": None,
    }
    if rcv is not None:
        rcv_count, rcv_total = rcv.get(code, (0, Decimal("0")))
        row.update(rcv_count=rcv_count, rcv_total=str(rcv_total), difference=str(erp_total - rcv_total))
    return row


def _terminal(
    first: date, last: date, lo: datetime, hi: datetime, start: date | None, window_minutes: int
) -> dict[str, int]:
    rows = (
        TerminalSale.objects.filter(transaction_at__gte=lo, transaction_at__lt=hi)
        .values("match_status").annotate(n=Count("id")).order_by()
    )
    out = {row["match_status"]: row["n"] for row in rows}
    out[MatchStatus.ONLY_ERP] = _terminal_only_erp(first, last, start, window_minutes)
    return out


def _terminal_only_erp(first: date, last: date, start: date | None, window_minutes: int) -> int:
    """Documentos POS cobrados en caja sin venta TUU, ya fuera de la ventana de espera."""
    since = _period_start(first, last, start)
    if since is None:
        return 0
    pos_payment = TreasuryMovement.objects.filter(invoice=OuterRef("pk"), pos_session__isnull=False)
    linked = TerminalSale.objects.filter(matched_invoice=OuterRef("pk"))
    return (
        Invoice.objects.annotate(fiscal_direction=fiscal_direction_expression())
        .filter(
            _summary_status_q(), fiscal_direction="sale", dte_type__in=FOLIO_EXEMPT_DTE_TYPES,
            date__gte=since, date__lte=last,
            created_at__lt=timezone.now() - timedelta(minutes=window_minutes),
        )
        .filter(Exists(pos_payment), ~Exists(linked))
        .count()
    )
