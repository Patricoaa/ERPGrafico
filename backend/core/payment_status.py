"""
Estado de pago derivado (ADR-0084): eje separado del estado del documento.

El estado de un documento (factura, OV, OC) describe su ciclo: borrador, emitido/confirmado,
anulado. Si está pagado se deriva del saldo; tesorería nunca escribe el estado del documento.
"""

from decimal import Decimal

from django.db import models
from django.utils.translation import gettext_lazy as _


class PaymentStatus(models.TextChoices):
    UNPAID = "UNPAID", _("Pendiente de pago")
    PARTIAL = "PARTIAL", _("Pago parcial")
    PAID = "PAID", _("Pagado")


def payment_status_for(total, paid) -> str:
    """PAID si no queda saldo; PARTIAL si hay pagos; UNPAID si no hay ninguno."""
    total = Decimal(str(total or 0))
    paid = Decimal(str(paid or 0))
    if total - paid <= 0:
        return PaymentStatus.PAID
    if paid > 0:
        return PaymentStatus.PARTIAL
    return PaymentStatus.UNPAID


# Valores del filtro de etapa "Tesorería" de las listas (success/active/neutral).
STAGE_TO_PAYMENT_STATUS = {
    "success": PaymentStatus.PAID,
    "active": PaymentStatus.PARTIAL,
    "neutral": PaymentStatus.UNPAID,
}


def filter_by_payment_status(queryset, stage_value: str, prefetch=("payments", "payment_allocations__treasury_movement", "invoices")):
    """
    Filtra OV/OC/facturas por el eje de pago derivado (ADR-0084). Acepta el valor de etapa de
    las listas (success/active/neutral) o el de PaymentStatus (PAID/PARTIAL/UNPAID). El pagado
    considera signo e imputaciones (PaymentSelector), así que se evalúa en Python sobre un
    queryset con prefetch; devuelve un queryset filtrado por id. Valor desconocido → sin filtrar.
    """
    wanted = STAGE_TO_PAYMENT_STATUS.get(stage_value) or (
        stage_value if stage_value in PaymentStatus.values else None
    )
    if wanted is None:
        return queryset
    rows = queryset.prefetch_related(*prefetch)
    ids = [obj.pk for obj in rows if obj.payment_status == wanted]
    return queryset.filter(pk__in=ids)
