"""Clave fiscal de un ``Invoice`` y dirección fiscal única (ADR-0138 D2).

Una sola regla para decidir si un documento es de compra o de venta, tanto en
Python como en el ORM, y una clave comparable contra el RCV del SII.
"""

from dataclasses import dataclass
from typing import Literal

from django.db.models import Case, CharField, F, IntegerField, Q, Value, When

from accounting.integrations.rcv_normalizer import normalize_rut
from billing.models import Invoice

Direction = Literal["purchase", "sale"]

# Relaciones que un llamador por lote pasa a select_related para evitar N+1.
FISCAL_KEY_RELATED = ("corrected_invoice", "contact")


def parse_folio(number: str | None) -> int | None:
    """Folio como entero positivo; quita espacios, puntos y ceros a la izquierda."""
    if not number:
        return None
    cleaned = str(number).replace(".", "").replace(" ", "").strip()
    if not cleaned.isascii() or not cleaned.isdigit():
        return None
    value = int(cleaned)
    return value if value > 0 else None


def _is_purchase_own(invoice: Invoice) -> bool:
    return bool(invoice.purchase_order_id) or invoice.dte_type == Invoice.DTEType.PURCHASE_INV


def invoice_direction(invoice: Invoice) -> Direction:
    """Compra si hay OC o es PURCHASE_INV; venta si hay OV; una nota hereda la del corregido."""
    if _is_purchase_own(invoice):
        return "purchase"
    if invoice.sale_order_id:
        return "sale"
    if invoice.corrected_invoice_id:
        corrected = invoice.corrected_invoice
        if _is_purchase_own(corrected):
            return "purchase"
        return "sale"
    return "sale"


def fiscal_direction_expression() -> Case:
    """Misma regla que ``invoice_direction`` como expresión ORM (anota "purchase"/"sale")."""
    own_purchase = Q(purchase_order__isnull=False) | Q(dte_type=Invoice.DTEType.PURCHASE_INV)
    corrected_purchase = Q(corrected_invoice__purchase_order__isnull=False) | Q(
        corrected_invoice__dte_type=Invoice.DTEType.PURCHASE_INV
    )
    return Case(
        When(own_purchase, then=Value("purchase")),
        When(sale_order__isnull=False, then=Value("sale")),
        When(Q(corrected_invoice__isnull=False) & corrected_purchase, then=Value("purchase")),
        default=Value("sale"),
        output_field=CharField(),
    )


def sii_code_expression() -> Case:
    """Misma regla que ``Invoice.sii_code`` como expresión ORM (código explícito o el de la estrategia)."""
    from billing.strategies.dte import DTE_STRATEGY_REGISTRY

    return Case(
        When(sii_document_code__gt=0, then=F("sii_document_code")),
        *(When(dte_type=t, then=Value(cls.sii_document_code)) for t, cls in DTE_STRATEGY_REGISTRY.items()),
        default=Value(0),
        output_field=IntegerField(),
    )


@dataclass(frozen=True)
class FiscalKey:
    direction: str
    sii_code: int
    folio: int | None
    counterparty_rut: str


def resolve_counterparty_rut(snapshot: str | None, contact_tax_id: str | None) -> str:
    """RUT normalizado de la contraparte: el de la emisión, o el del contacto si no hay."""
    return normalize_rut(snapshot or contact_tax_id or "")


def counterparty_rut(invoice: Invoice) -> str:
    return resolve_counterparty_rut(
        invoice.partner_tax_id_snapshot, invoice.contact.tax_id if invoice.contact_id else ""
    )


def fiscal_key(invoice: Invoice) -> FiscalKey:
    return FiscalKey(
        direction=invoice_direction(invoice),
        sii_code=invoice.sii_code,
        folio=parse_folio(invoice.number),
        counterparty_rut=counterparty_rut(invoice),
    )
