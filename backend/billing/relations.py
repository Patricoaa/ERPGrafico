"""Proveedores de relaciones documentales de facturación (ADR-0080, contrato document-relations.md)."""

from core.documents import DocumentType, DocumentTypeRegistry, Link, relation_provider
from core.documents.types import RESOLVER_URL


def _invoice_url(invoice):
    # Factura de venta: `?selected` abre el Order Hub de la factura. Compra: resolvedor /d/.
    if invoice.is_sale_document():
        return f"/billing/sales?selected={invoice.pk}"
    return RESOLVER_URL.format(label="billing.invoice", id=invoice.pk)


DocumentTypeRegistry.register(DocumentType(label="billing.invoice", canonical_url=_invoice_url))

NOTE_ROLES = {"NOTA_CREDITO": "credit_note", "NOTA_DEBITO": "debit_note"}


@relation_provider("billing.invoice")
def invoice_relations(invoice):
    # D1: factura ↔ orden es N:M; hoy se deriva de las FK tipadas (Invoice.order), mañana de las líneas.
    if invoice.sale_order_id:
        yield Link("derivation", "incoming", "sale_order", invoice.sale_order)
    if invoice.purchase_order_id:
        yield Link("derivation", "incoming", "purchase_order", invoice.purchase_order)
    if invoice.corrected_invoice_id:
        yield Link("correction", "outgoing", "corrected_invoice", invoice.corrected_invoice)
    for note in invoice.adjustments.all():
        yield Link("correction", "incoming", NOTE_ROLES.get(note.dte_type, "note"), note)
    for payment in invoice.payments.all():
        yield Link("settlement", "incoming", "payment", payment, amount=payment.amount)
    for allocation in invoice.payment_allocations.select_related("treasury_movement"):
        yield Link("settlement", "incoming", "payment", allocation.treasury_movement, amount=allocation.amount)
    if invoice.journal_entry_id:
        yield Link("posting", "outgoing", "journal_entry", invoice.journal_entry)
