"""Resolución del documento de venta según clase y medio de pago (ADR-0138 D3).

El ERP solo registra los DTE de boleta: las boletas (39) y los comprobantes de
pago (48) los emite el proveedor del terminal. Una venta de clase boleta cobrada
con terminal integrado es un 48; el resto (efectivo, transferencia, saldo
impago o a crédito) es un 39.
"""

from dataclasses import dataclass
from decimal import Decimal

from django.core.exceptions import ValidationError

FOLIO_EXEMPT_DTE_TYPES = ("BOLETA", "BOLETA_EXENTA", "COMPROBANTE_PAGO")

_SINGLE_DOCUMENT_CLASSES = ("FACTURA", "FACTURA_EXENTA", "BOLETA_EXENTA")
_BOLETA = "BOLETA"
_COMPROBANTE = "COMPROBANTE_PAGO"


@dataclass(frozen=True)
class PaymentPortion:
    """Porción de pago; ``index`` es su posición en ``payments`` (``None`` en pago único)."""

    amount: Decimal
    integrated: bool
    index: int | None


@dataclass(frozen=True)
class DocumentPlan:
    dte_type: str
    amount: Decimal
    payment_indexes: tuple[int | None, ...]


def plan_sale_documents(
    document_class: str, portions: list[PaymentPortion], order_total: Decimal
) -> list[DocumentPlan]:
    """Documentos a registrar; el primero es el documento principal de la venta."""
    if document_class in _SINGLE_DOCUMENT_CLASSES:
        return [DocumentPlan(document_class, order_total, tuple(p.index for p in portions))]
    if document_class != _BOLETA:
        raise ValidationError(f"Clase de documento no reconocida: {document_class}")

    integrated_portions = [p for p in portions if p.integrated]
    other_portions = [p for p in portions if not p.integrated]
    integrated = min(sum((p.amount for p in integrated_portions), Decimal("0")), order_total)
    rest = order_total - integrated

    plans: list[DocumentPlan] = []
    if integrated > 0:
        plans.append(DocumentPlan(_COMPROBANTE, integrated, tuple(p.index for p in integrated_portions)))
    if rest > 0 or not portions:
        plans.append(DocumentPlan(_BOLETA, rest, tuple(p.index for p in other_portions)))
    if not plans:
        # Total cero con porciones: siempre queda un documento principal.
        plans.append(DocumentPlan(_BOLETA, order_total, tuple(p.index for p in portions)))
    # Mayor monto primero; en empate, la boleta (sort estable sobre la clave).
    plans.sort(key=lambda d: (-d.amount, d.dte_type != _BOLETA))
    return plans


def folio_exempt_for_session(pos_session_id: int | None) -> bool:
    """True si el terminal de la sesión admite algún método integrado con un terminal físico."""
    if pos_session_id is None:
        return False
    from treasury.models import PaymentMethod, POSSession

    return POSSession.objects.filter(
        pk=pos_session_id,
        terminal__allowed_payment_methods__method_type=PaymentMethod.Type.CARD_TERMINAL,
        terminal__allowed_payment_methods__linked_terminal_device__isnull=False,
    ).exists()
