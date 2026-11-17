"""Emisión automática de borradores 39/41/48 con el folio del proveedor (ADR-0140 D3).

El checkout deja las boletas y comprobantes sin folio en borrador. Cuando el
cuadre los enlaza con su venta TUU con estado ``MATCHED`` (y la venta con su boleta del RCV), el número
fiscal ya es conocido: folio RCV para 39/41, id TUU para 48. Cada emisión pasa
por ``BillingService.confirm_invoice`` en su propia transacción; un fallo se
registra en la venta TUU (``issue_error``) y no detiene al resto. La venta con un
fallo reciente no se reintenta hasta pasados ``ISSUE_RETRY_MINUTES``.
"""

import calendar
import logging
from datetime import date, timedelta

from celery.exceptions import SoftTimeLimitExceeded
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from billing.models import Invoice
from billing.sale_documents import FOLIO_EXEMPT_DTE_TYPES
from billing.services import BillingService
from core.fiscal_match import MatchStatus
from core.services.document import lock_document
from treasury.models import TerminalSale

logger = logging.getLogger(__name__)

ISSUE_RETRY_MINUTES = 60


def issue_fiscal_drafts(year: int, month: int, *, retry_failed: bool = False) -> dict[str, int]:
    """Emite los borradores del mes ya enlazados a su venta TUU; devuelve emitidos y fallidos.

    ``retry_failed`` (corrida manual) reintenta también los fallos recientes que la tarea
    periódica espera ``ISSUE_RETRY_MINUTES`` antes de reintentar.
    """
    issued = failed = 0
    for sale in _linked_drafts(year, month, retry_failed=retry_failed):
        invoice = sale.matched_invoice
        fiscal = fiscal_number_and_date(invoice, sale)
        if fiscal is None:
            continue
        number, issue_date = fiscal
        try:
            done = _issue(invoice, number, issue_date)
        except SoftTimeLimitExceeded:
            raise  # el límite de la tarea periódica corta la emisión completa
        except Exception as exc:  # noqa: BLE001 — un documento no detiene la emisión del resto
            logger.warning("No se pudo emitir el documento %s: %s", invoice.pk, exc, exc_info=True)
            failed += 1
            error = _error_text(exc)
        else:
            issued += done
            error = None
        # Fuera del atomic de `_issue`: el registro del fallo sobrevive a su rollback.
        if error is not None:
            TerminalSale.objects.filter(pk=sale.pk).update(issue_attempted_at=timezone.now(), issue_error=error)
        elif sale.issue_error or sale.issue_attempted_at:
            TerminalSale.objects.filter(pk=sale.pk).update(issue_attempted_at=None, issue_error="")
    return {"issued": issued, "failed": failed}


def _error_text(exc: Exception) -> str:
    text = "; ".join(exc.messages) if isinstance(exc, ValidationError) else str(exc)
    return (text.strip() or type(exc).__name__)[:255]


@transaction.atomic
def _issue(invoice: Invoice, number: str, issue_date: date) -> bool:
    """Emite bajo el row-lock; ``False`` si otro proceso ya lo emitió tras la selección."""
    lock_document(invoice)
    if invoice.status != Invoice.Status.DRAFT or invoice.number:
        return False
    BillingService.confirm_invoice(invoice, number, date=issue_date)
    return True


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


def _linked_drafts(year: int, month: int, *, retry_failed: bool = False) -> list[TerminalSale]:
    first = date(year, month, 1)
    last = date(year, month, calendar.monthrange(year, month)[1])
    sales = TerminalSale.objects.filter(
            match_status=MatchStatus.MATCHED,
            matched_invoice__status=Invoice.Status.DRAFT,
            matched_invoice__number="",
            matched_invoice__dte_type__in=FOLIO_EXEMPT_DTE_TYPES,
            matched_invoice__purchase_order__isnull=True,
            matched_invoice__date__gte=first,
            matched_invoice__date__lte=last,
        )
    if not retry_failed:
        sales = sales.exclude(_recent_failure_q())
    return list(
        sales.select_related("matched_invoice__sale_order", "rcv_document")
        .order_by("matched_invoice__date", "matched_invoice_id")
    )


def _recent_failure_q() -> Q:
    """Venta cuyo último intento falló hace menos de ``ISSUE_RETRY_MINUTES``."""
    since = timezone.now() - timedelta(minutes=ISSUE_RETRY_MINUTES)
    return Q(issue_attempted_at__gt=since) & ~Q(issue_error="")
