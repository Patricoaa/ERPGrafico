"""Qué documentos entran al cuadre y utilidades de rango compartidas (ADR-0138)."""

from datetime import date, datetime, time

from django.db.models import Q
from django.utils import timezone

from billing.models import Invoice
from billing.sale_documents import FOLIO_EXEMPT_DTE_TYPES

SALE_DTE_TYPES = (
    Invoice.DTEType.BOLETA,
    Invoice.DTEType.BOLETA_EXENTA,
    Invoice.DTEType.COMPROBANTE_PAGO,
    Invoice.DTEType.FACTURA,
    Invoice.DTEType.FACTURA_EXENTA,
)


def sale_document_status_q(prefix: str = "") -> Q:
    """Estado de un documento de venta que el cuadre considera (ADR-0140 D2).

    Los emitidos, y los borradores 39/41/48 sin número: el proveedor del terminal
    emite su folio y el ERP lo recibe después. ``prefix`` es la ruta hasta la
    factura (p. ej. ``"invoice__"``).
    """
    return Q(**{f"{prefix}status": Invoice.Status.POSTED}) | Q(
        **{
            f"{prefix}status": Invoice.Status.DRAFT,
            f"{prefix}dte_type__in": FOLIO_EXEMPT_DTE_TYPES,
            f"{prefix}number": "",
        }
    )


def local_midnight(day: date) -> datetime:
    return timezone.make_aware(datetime.combine(day, time.min))
