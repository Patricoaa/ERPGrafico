"""Resolución del documento de venta según clase y medio de pago (ADR-0138 D3).

El ERP solo registra los DTE de boleta: las boletas (39) y los comprobantes de
pago (48) los emite el proveedor del terminal. Una venta de clase boleta cobrada
con terminal integrado es un 48 por cada porción integrada; el resto (efectivo, transferencia, saldo
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

    other_portions = [p for p in portions if not p.integrated]

    # Un 48 por porción integrada (cada pasada del terminal es una venta TUU), en
    # orden de entrada y recortada a lo que queda del total. Una porción que
    # recibe 0 no genera documento: su asignación va al documento principal.
    plans: list[DocumentPlan] = []
    rest = order_total
    for portion in (p for p in portions if p.integrated):
        amount = min(portion.amount, rest)
        if amount > 0:
            plans.append(DocumentPlan(_COMPROBANTE, amount, (portion.index,)))
            rest -= amount
    if rest > 0 or not portions:
        plans.append(DocumentPlan(_BOLETA, rest, tuple(p.index for p in other_portions)))
    if not plans:
        # Total cero con porciones: siempre queda un documento principal.
        plans.append(DocumentPlan(_BOLETA, order_total, tuple(p.index for p in portions)))
    # Mayor monto primero; en empate, la boleta; entre 48 iguales, orden de entrada (sort estable).
    plans.sort(key=lambda d: (-d.amount, d.dte_type != _BOLETA))
    return plans
