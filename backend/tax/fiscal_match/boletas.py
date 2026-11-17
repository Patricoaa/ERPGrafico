"""TUU ↔ RCV por boleta: la boleta RCV entra al grupo de su venta o de su boleta emitida (ADR-0139 D1).

El RCV trae las boletas en detalle sin hora: se emparejan 1 a 1 con las ventas TUU
del mismo día local, monto y tipo, en orden (ventas por hora, boletas por folio).
Antes, una boleta cuyo folio ya es el número de una boleta emitida en el ERP se une
directo a ella. Solo mueve ``RCVDocument`` entre grupos; nunca toca la factura.
"""

from collections import defaultdict
from datetime import date, datetime, timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Exists, OuterRef
from django.utils import timezone

from accounting.models import RCVDocument, RCVImport, RCVSettings
from billing.fiscal_key import parse_folio
from billing.models import Invoice
from tax.fiscal_match.candidates import LinkResult, local_midnight
from tax.models import FiscalMatch
from treasury.models import TerminalSale

BOLETA_SII_CODES = frozenset({39, 41})

PairKey = tuple[date, Decimal, int]


def months_in_range(start: date, end: date) -> list[tuple[int, int]]:
    """(año, mes) de cada mes que toca el rango [start, end], ambos inclusive."""
    months: list[tuple[int, int]] = []
    year, month = start.year, start.month
    while (year, month) <= (end.year, end.month):
        months.append((year, month))
        year, month = (year + 1, 1) if month == 12 else (year, month + 1)
    return months


def _pair(docs: list[RCVDocument], sales: list[TerminalSale]) -> dict[int, TerminalSale]:
    """doc_id → venta TUU, emparejadas en orden dentro de cada (día local, monto, tipo)."""
    by_key: dict[PairKey, list[TerminalSale]] = defaultdict(list)
    for s in sales:
        by_key[(timezone.localdate(s.transaction_at), s.sale_amount, s.document_type)].append(s)
    docs_by_key: dict[PairKey, list[RCVDocument]] = defaultdict(list)
    for d in docs:
        if d.missing_since_import_id is None:
            docs_by_key[(d.issue_date, abs(d.total_amount), d.dte_type)].append(d)
    paired: dict[int, TerminalSale] = {}
    for key, group in docs_by_key.items():
        for doc, sale in zip(group, by_key.get(key, ())):
            sale.rcv_document_id = doc.id
            paired[doc.id] = sale
    return paired


@transaction.atomic
def pair_rcv_boletas(lo: datetime, hi: datetime) -> LinkResult:
    """Mueve las boletas RCV huérfanas de [lo, hi) al grupo de su boleta emitida o de su venta TUU."""
    start = RCVSettings.get_settings().fiscal_match_start_date
    if start is None:
        return LinkResult(0)
    lo = max(lo, local_midnight(start))
    if lo >= hi:
        return LinkResult(0)
    first_day, last_day = timezone.localdate(lo), timezone.localdate(hi - timedelta(microseconds=1))

    docs = list(
        RCVDocument.objects.filter(
            direction=RCVImport.Direction.SALES,
            dte_type__in=BOLETA_SII_CODES,
            missing_since_import__isnull=True,
            issue_date__gte=first_day,
            issue_date__lte=last_day,
            fiscal_match__invoice__isnull=True,
            fiscal_match__rcv_linked_manually=False,
        )
        .exclude(Exists(TerminalSale.objects.filter(fiscal_match_id=OuterRef("fiscal_match_id"))))
        .order_by("folio", "id")
    )
    if not docs:
        return LinkResult(0)
    source_ids = {d.fiscal_match_id for d in docs}
    new_group: dict[int, int] = {}

    # Paso 1: folio directo contra boletas emitidas sin RCV.
    folio_groups = {
        (g.dte_type, parse_folio(g.invoice.number)): g.id
        for g in FiscalMatch.objects.filter(
            direction=FiscalMatch.Direction.SALE,
            invoice__status=Invoice.Status.POSTED,
            dte_type__in=BOLETA_SII_CODES,
            # Acota las filas leídas (no las consultas): una boleta se emite cerca de su fecha RCV.
            issue_date__gte=first_day - timedelta(days=31),
            issue_date__lte=last_day + timedelta(days=31),
            rcv_documents__isnull=True,
        ).select_related("invoice")
    }
    for d in docs:
        target = folio_groups.pop((d.dte_type, parse_folio(str(d.folio))), None)
        if target is not None:
            new_group[d.id] = target

    # Paso 2: emparejamiento ordenado con ventas TUU cuyo grupo aún no tiene RCV.
    rest = [d for d in docs if d.id not in new_group]
    if rest:
        sales = list(
            TerminalSale.objects.filter(
                status=TerminalSale.Status.COMPLETED,
                document_type__in=BOLETA_SII_CODES,
                transaction_at__gte=local_midnight(first_day),
                transaction_at__lt=local_midnight(last_day + timedelta(days=1)),
                fiscal_match__isnull=False,
                fiscal_match__rcv_documents__isnull=True,
            )
            .exclude(fiscal_match_id__in=set(new_group.values()))
            .order_by("transaction_at", "id")
        )
        for doc_id, sale in _pair(rest, sales).items():
            new_group[doc_id] = sale.fiscal_match_id

    moved = [d for d in docs if new_group.get(d.id) not in (None, d.fiscal_match_id)]
    touched: set[int] = set()
    for d in moved:
        touched |= {d.fiscal_match_id, new_group[d.id]}
        d.fiscal_match_id = new_group[d.id]
    RCVDocument.objects.bulk_update(moved, ["fiscal_match"], batch_size=500)
    FiscalMatch.objects.filter(
        id__in=source_ids, invoice__isnull=True, terminal_sales__isnull=True, rcv_documents__isnull=True
    ).delete()
    return LinkResult(len(moved), touched_group_ids=touched)
