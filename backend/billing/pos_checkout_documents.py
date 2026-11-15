"""Documentos de venta del checkout POS (ADR-0138 D3).

El checkout recibe la *clase* de documento (``BOLETA``, ``FACTURA``…) y la
resuelve con los medios de pago: la parte cobrada con terminal integrado de una
boleta es un 48 y el resto un 39. Con más de un documento, totales y líneas se
reparten en proporción al monto de cada uno.
"""

from decimal import Decimal

from .line_split import LineAmount, LineShare, split_lines, split_proportional
from .models import Invoice
from .sale_documents import DocumentPlan, PaymentPortion

_ZERO = Decimal(0)


def payment_method_key(value) -> int | None:
    try:
        return int(value) if value not in (None, "") else None
    except (TypeError, ValueError):
        return None


def load_payment_methods(payments, payment_method_id) -> dict:
    """``PaymentMethod`` por id, en una sola consulta para todas las asignaciones."""
    from treasury.models import PaymentMethod

    keys = {payment_method_key(p.get("payment_method_id")) for p in payments or []}
    keys.add(payment_method_key(payment_method_id))
    keys.discard(None)
    return PaymentMethod.objects.in_bulk(keys) if keys else {}


def _integrated(methods: dict, payment_method_id) -> bool:
    method = methods.get(payment_method_key(payment_method_id))
    return bool(method and method.is_integrated)


def checkout_portions(payments, methods: dict, *, order_total: Decimal,
                      single_amount: Decimal, single_method_id) -> list[PaymentPortion]:
    """Una porción por asignación cobrada (sin ``CREDIT``); en pago único, una con ``index=None``."""
    if payments:
        return [
            PaymentPortion(
                min(Decimal(str(alloc.get("amount", 0))), order_total),
                _integrated(methods, alloc.get("payment_method_id")),
                i,
            )
            for i, alloc in enumerate(payments)
            if alloc.get("method") != "CREDIT"
        ]
    return [PaymentPortion(min(single_amount, order_total), _integrated(methods, single_method_id), None)]


def portion_totals(order, amounts: list[Decimal]) -> list[tuple[list[LineShare], tuple[Decimal, Decimal, Decimal]]]:
    """``(line_shares, (neto, IVA, descuento))`` por documento; el IVA es el complemento del neto."""
    sale_lines = list(order.lines.filter(related_note__isnull=True).order_by("id"))
    lines = [LineAmount(key=sl.pk, quantity=sl.quantity, subtotal=sl.subtotal) for sl in sale_lines]
    # Los descuentos de la OV hacen que Σ subtotales de línea ≠ total: las líneas se
    # reparten sobre su propio total, en la misma proporción que los documentos.
    line_amounts = split_proportional(sum((sl.subtotal for sl in sale_lines), _ZERO), amounts)
    shares = split_lines(lines, line_amounts)
    nets = split_proportional(order.total_net, amounts)
    discounts = split_proportional(order.total_discount_amount, amounts)
    return [
        (shares[i], (nets[i], amounts[i] - nets[i], discounts[i]))
        for i in range(len(amounts))
    ]


def create_checkout_documents(order, plans: list[DocumentPlan], *, payment_method, status,
                              number, date, attachment, folio_exempt) -> list[Invoice]:
    """Un documento por plan, en orden de plan. El folio y adjunto del usuario nunca van al 48."""
    from .services import BillingService

    comprobante = Invoice.DTEType.COMPROBANTE_PAGO
    totals = portion_totals(order, [p.amount for p in plans]) if len(plans) > 1 else None
    advances_at = next((i for i, p in enumerate(plans) if p.dte_type != comprobante), 0)

    documents = []
    for i, plan in enumerate(plans):
        own_folio = plan.dte_type != comprobante
        portion = {} if totals is None else {
            "amount": plan.amount, "line_shares": totals[i][0], "net_tax_discount": totals[i][1],
        }
        invoice = BillingService.create_sale_invoice(
            order, plan.dte_type, payment_method, status=status,
            number=number if own_folio else None, date=date,
            folio_exempt=folio_exempt, link_advances=i == advances_at, **portion,
        )
        if attachment and own_folio:
            invoice.document_attachment = attachment
            invoice.save()
        documents.append(invoice)
    return documents


def invoice_by_payment(plans: list[DocumentPlan], documents: list[Invoice]) -> dict:
    """``index de asignación → documento`` según el ``payment_indexes`` de cada plan."""
    return {i: doc for plan, doc in zip(plans, documents, strict=True) for i in plan.payment_indexes}
