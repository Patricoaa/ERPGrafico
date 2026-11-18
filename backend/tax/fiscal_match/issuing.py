"""Emisión automática de borradores 39/41/48 desde el grupo de cuadre (ADR-0140 D3).

Toma los grupos cuya factura es un borrador sin número y cuya parte TUU está
``MATCHED`` (en 39/41 también la RCV): el número fiscal ya es conocido (id TUU
para 48, folio RCV para 39/41). Cada emisión pasa por ``BillingService.confirm_invoice`` en su propia
transacción; un fallo se registra en el grupo y no detiene al resto.
"""

import logging
from datetime import date, timedelta

from celery.exceptions import SoftTimeLimitExceeded
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Prefetch, Q
from django.utils import timezone

from accounting.models import RCVDocument
from billing.models import Invoice
from billing.sale_documents import FOLIO_EXEMPT_DTE_TYPES
from billing.services import BillingService
from core.fiscal_match import PartState
from core.services.document import lock_document
from tax.models import FiscalMatch
from treasury.models import TerminalSale

logger = logging.getLogger(__name__)

ISSUE_RETRY_MINUTES = 60


def issue_fiscal_drafts(
    *, group_ids: list[int] | None = None, retry_failed: bool = False
) -> dict[str, int]:
    """Emite los borradores de los grupos con TUU conciliada; devuelve emitidos y fallidos.

    ``retry_failed`` reintenta también los fallos recientes que la corrida periódica espera
    ``ISSUE_RETRY_MINUTES`` antes de reintentar.
    """
    issued = failed = 0
    for group in _candidates(group_ids, retry_failed=retry_failed):
        fiscal = fiscal_number_and_date(group)
        if fiscal is None:
            continue
        invoice = group.invoice
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
            FiscalMatch.objects.filter(pk=group.pk).update(
                issue_attempted_at=timezone.now(), issue_error=error
            )
        elif group.issue_error or group.issue_attempted_at:
            FiscalMatch.objects.filter(pk=group.pk).update(issue_attempted_at=None, issue_error="")
    return {"issued": issued, "failed": failed}


def fiscal_number_and_date(group: FiscalMatch) -> tuple[str, date] | None:
    """Número y fecha fiscales según el tipo del borrador; ``None`` si aún no se conocen."""
    sales = list(group.terminal_sales.all())
    if group.invoice.dte_type == Invoice.DTEType.COMPROBANTE_PAGO:
        if len(sales) != 1:
            return None
        number = tuu_number(sales[0])
        return (number, timezone.localdate(sales[0].transaction_at)) if number else None
    docs = list(group.rcv_documents.all())
    if len(docs) != 1:
        return None
    return str(docs[0].folio), docs[0].issue_date


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


def tuu_number(sale: TerminalSale) -> str:
    """Número fiscal de un 48: el id de venta TUU, o su número de secuencia si no hay id."""
    sale_id = (sale.sale_id or "").strip()
    if sale_id and sale_id.upper() != "N/A":
        return sale_id
    return (sale.sequence_number or "").strip()


def issuable_q() -> Q:
    """Grupos cuyo borrador sin número puede emitirse: TUU cuadrada y, en 39/41, el RCV también.

    Una boleta se emite con el folio de su registro RCV: si ese registro no cuadra (otro
    monto, ambiguo o aún pendiente) el folio sería equivocado y la emisión es irreversible.
    """
    return Q(
        tuu_state=PartState.MATCHED,
        invoice__status=Invoice.Status.DRAFT,
        invoice__number="",
        invoice__dte_type__in=FOLIO_EXEMPT_DTE_TYPES,
    ) & (Q(invoice__dte_type=Invoice.DTEType.COMPROBANTE_PAGO) | Q(rcv_state=PartState.MATCHED))


def _candidates(group_ids: list[int] | None, *, retry_failed: bool) -> list[FiscalMatch]:
    groups = FiscalMatch.objects.filter(issuable_q(), invoice__purchase_order__isnull=True)
    if group_ids is not None:
        groups = groups.filter(pk__in=group_ids)
    if not retry_failed:
        since = timezone.now() - timedelta(minutes=ISSUE_RETRY_MINUTES)
        groups = groups.exclude(Q(issue_attempted_at__gt=since) & ~Q(issue_error=""))
    return list(
        groups.select_related("invoice__sale_order")
        .prefetch_related(
            Prefetch("terminal_sales", queryset=TerminalSale.objects.order_by("id")),
            Prefetch("rcv_documents", queryset=RCVDocument.objects.order_by("id")),
        )
        .order_by("invoice__date", "invoice_id")
    )
