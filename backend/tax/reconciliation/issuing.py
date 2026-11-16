"""Emisión automática de borradores 39/41/48 con el folio del proveedor (ADR-0140 D3).

El checkout deja las boletas y comprobantes sin folio en borrador. Cuando el
cuadre los enlaza con su venta TUU (y la venta con su boleta del RCV), el número
fiscal ya es conocido: folio RCV para 39/41, id TUU para 48. Cada emisión pasa
por ``BillingService.confirm_invoice`` en su propia transacción; un fallo se
registra y no detiene al resto.
"""

import calendar
import logging
from datetime import date

from django.db import transaction
from django.utils import timezone

from billing.models import Invoice
from billing.sale_documents import FOLIO_EXEMPT_DTE_TYPES
from billing.services import BillingService
from treasury.models import TerminalSale

logger = logging.getLogger(__name__)


def issue_fiscal_drafts(year: int, month: int) -> dict[str, int]:
    """Emite los borradores del mes ya enlazados a su venta TUU; devuelve emitidos y fallidos."""
    issued = failed = 0
    for sale in _linked_drafts(year, month):
        invoice = sale.matched_invoice
        fiscal = fiscal_number_and_date(invoice, sale)
        if fiscal is None:
            continue
        number, issue_date = fiscal
        try:
            with transaction.atomic():
                BillingService.confirm_invoice(invoice, number, date=issue_date)
        except Exception as exc:  # noqa: BLE001 — un documento no detiene la emisión del resto
            logger.warning("No se pudo emitir el documento %s: %s", invoice.pk, exc)
            failed += 1
        else:
            issued += 1
    return {"issued": issued, "failed": failed}


def fiscal_number_and_date(invoice: Invoice, sale: TerminalSale) -> tuple[str, date] | None:
    """Número y fecha fiscales del borrador según su propio tipo; ``None`` si aún no se conocen."""
    if invoice.dte_type == Invoice.DTEType.COMPROBANTE_PAGO:
        number = _tuu_number(sale)
        return (number, timezone.localdate(sale.transaction_at)) if number else None
    doc = sale.rcv_document
    if doc is None:
        return None
    return str(doc.folio), doc.issue_date


def _tuu_number(sale: TerminalSale) -> str:
    sale_id = (sale.sale_id or "").strip()
    if sale_id and sale_id.upper() != "N/A":
        return sale_id
    return (sale.sequence_number or "").strip()


def _linked_drafts(year: int, month: int) -> list[TerminalSale]:
    first = date(year, month, 1)
    last = date(year, month, calendar.monthrange(year, month)[1])
    return list(
        TerminalSale.objects.filter(
            matched_invoice__status=Invoice.Status.DRAFT,
            matched_invoice__number="",
            matched_invoice__dte_type__in=FOLIO_EXEMPT_DTE_TYPES,
            matched_invoice__purchase_order__isnull=True,
            matched_invoice__date__gte=first,
            matched_invoice__date__lte=last,
        )
        .select_related("matched_invoice__sale_order", "rcv_document")
        .order_by("matched_invoice__date", "matched_invoice_id")
    )
