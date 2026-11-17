"""Cuadre de boletas 39/41 del RCV contra ventas TUU (ADR-0139 D1-D2).

El RCV trae las boletas en detalle sin hora: se emparejan 1 a 1 con las ventas
TUU del mismo día local, monto y tipo, en orden (ventas por hora, boletas por
folio). La factura del ERP llega a la boleta a través del vínculo ya existente
de la venta TUU. Solo escribe en `RCVDocument` y `TerminalSale`; nunca toca la
factura (ADR-0091).
"""

import calendar
from collections import Counter
from datetime import date, datetime, timedelta

from django.db import transaction
from django.db.models import Q

from accounting.models import RCVDocument, RCVImport, RCVSettings
from billing.models import Invoice
from core.fiscal_match import MatchStatus
from tax.fiscal_match.boletas import _pair, months_in_range  # noqa: F401  (re-export)
from treasury.models import TerminalSale

from .rcv import BOLETA_SII_CODES
from .terminal import _local_midnight


@transaction.atomic
def reconcile_rcv_boletas(year: int, month: int) -> dict[str, int]:
    """Empareja las boletas RCV del mes con ventas TUU; devuelve conteos por estado."""
    start_date = RCVSettings.get_settings().fiscal_match_start_date
    first = date(year, month, 1)
    last = date(year, month, calendar.monthrange(year, month)[1])
    if start_date is None or last < start_date:
        return {}

    selection = RCVDocument.objects.filter(
        _stale_or_automatic(),
        direction=RCVImport.Direction.SALES,
        period=f"{year}{month:02d}",
        dte_type__in=BOLETA_SII_CODES,
    )
    docs = list(selection.order_by("folio", "id"))
    if not docs:
        return {}
    # Limpiar antes de leer: lo que quede enlazado pertenece a boletas fuera de
    # esta selección (manuales válidas u otro período) y no compite.
    selection.update(matched_invoice=None, match_status="", matched_manually=False)
    TerminalSale.objects.filter(rcv_document__in=[d.id for d in docs]).update(rcv_document=None)
    sales = _unlinked_sales(_local_midnight(first), _local_midnight(last + timedelta(days=1)))

    paired = _pair(docs, sales)
    _assign(docs, paired, _invoices_taken_elsewhere(sales))

    RCVDocument.objects.bulk_update(docs, ["matched_invoice", "match_status"], batch_size=500)
    TerminalSale.objects.bulk_update(paired.values(), ["rcv_document"], batch_size=500)
    return dict(Counter(d.match_status for d in docs))


def propagate_invoice(doc_id: int, invoice: Invoice | None) -> None:
    """Refleja en la boleta la factura (o su ausencia) del vínculo manual de su venta TUU."""
    invoice_id = invoice.pk if invoice else None
    if invoice_id and RCVDocument.objects.filter(matched_invoice_id=invoice_id).exclude(pk=doc_id).exists():
        invoice_id = None  # la factura ya está en otra fila RCV (única por factura)
    RCVDocument.objects.filter(pk=doc_id, matched_manually=False).update(
        matched_invoice_id=invoice_id, match_status=_paired_status(invoice_id)
    )


def _paired_status(invoice_id: int | None) -> str:
    """Boleta con venta TUU: cuadrada solo si la cadena llega al ERP (ADR-0140 D5)."""
    return MatchStatus.MATCHED if invoice_id else MatchStatus.PENDING_ERP


def _stale_or_automatic() -> Q:
    """Automáticas, o manuales cuya factura ya no existe o fue anulada."""
    return (
        Q(matched_manually=False)
        | Q(matched_invoice__isnull=True)
        | Q(matched_invoice__status=Invoice.Status.CANCELLED)
    )


def _unlinked_sales(lo: datetime, hi: datetime) -> list[TerminalSale]:
    return list(
        TerminalSale.objects.filter(
            status=TerminalSale.Status.COMPLETED,
            document_type__in=BOLETA_SII_CODES,
            transaction_at__gte=lo,
            transaction_at__lt=hi,
            rcv_document__isnull=True,
        ).order_by("transaction_at", "id")
    )


def _invoices_taken_elsewhere(sales: list[TerminalSale]) -> set[int]:
    """Facturas de estas ventas ya vinculadas a otra fila RCV (única por factura)."""
    ids = [s.matched_invoice_id for s in sales if s.matched_invoice_id]
    if not ids:
        return set()
    return set(
        RCVDocument.objects.filter(matched_invoice_id__in=ids).values_list("matched_invoice_id", flat=True)
    )


def _assign(docs: list[RCVDocument], paired: dict[int, TerminalSale], taken: set[int]) -> None:
    for doc in docs:
        doc.matched_invoice = None
        if doc.missing_since_import_id is not None:
            doc.match_status = MatchStatus.EXCLUDED
        elif doc.id in paired:
            invoice_id = paired[doc.id].matched_invoice_id
            doc.matched_invoice_id = invoice_id if invoice_id not in taken else None
            doc.match_status = _paired_status(doc.matched_invoice_id)
        else:
            doc.match_status = MatchStatus.ONLY_EXTERNAL
