"""Proveedores de relaciones documentales de ventas (ADR-0080, contrato document-relations.md)."""

from core.documents import DocumentType, DocumentTypeRegistry, Link, relation_provider
from core.documents.details import display, join, lines_count

# OV: `?selected` abre su ficha documental (ADR-0083). Área "origin": encabeza el ciclo.
DocumentTypeRegistry.register(DocumentType(
    label="sales.saleorder", canonical_url="/sales/dtes/orders?selected={id}", domain="origin",
    detail=lambda o: join(display(o, "channel"), lines_count(o)),
))
# Despacho: su lista usa `?selected` con id de OV → resolvedor /d/ (valor por defecto).
DocumentTypeRegistry.register(DocumentType(
    label="sales.saledelivery", amount_field=None,
    detail=lambda d: join(lines_count(d), getattr(d.warehouse, "name", None)),
))

NOTE_ROLES = {"NOTA_CREDITO": "credit_note", "NOTA_DEBITO": "debit_note"}


@relation_provider("sales.saleorder")
def sale_order_relations(order):
    for delivery in order.deliveries.all():
        yield Link("fulfillment", "outgoing", "delivery", delivery)
    from inventory.models import InventoryDocument
    for inv_doc in InventoryDocument.objects.filter(
        source_document_type="sales.saleorder",
        source_document_id=order.id,
    ):
        yield Link("fulfillment", "outgoing", "inventory_document", inv_doc)
    from billing.invoicing import InvoicingService

    for invoice in InvoicingService.invoices_of(order):
        if invoice.dte_type in NOTE_ROLES:
            yield Link("correction", "outgoing", NOTE_ROLES[invoice.dte_type], invoice)
        else:
            yield Link("derivation", "outgoing", "invoice", invoice)
    for work_order in order.work_orders.all():
        yield Link("derivation", "outgoing", "work_order", work_order)
    for sale_return in order.returns.all():
        yield Link("correction", "outgoing", "return", sale_return)
    for payment in order.payments.all():
        yield Link("settlement", "incoming", "payment", payment, amount=payment.amount)
    for allocation in order.payment_allocations.select_related("treasury_movement"):
        yield Link("settlement", "incoming", "payment", allocation.treasury_movement, amount=allocation.amount)
    if order.journal_entry_id:
        yield Link("posting", "outgoing", "journal_entry", order.journal_entry)


@relation_provider("sales.saledelivery")
def sale_delivery_relations(delivery):
    from inventory.models import InventoryDocument, StockMove

    yield Link("fulfillment", "incoming", "sale_order", delivery.sale_order)
    if delivery.related_note_id:
        yield Link("reference", "incoming", NOTE_ROLES.get(delivery.related_note.dte_type, "note"),
                   delivery.related_note, is_dependency=False)
    for line in delivery.lines.select_related("work_order"):
        if line.work_order_id:
            yield Link("derivation", "outgoing", "work_order", line.work_order)
    # ADR-0085: el despacho es dueño de sus movimientos (incluye la explosión BOM).
    for move in StockMove.for_document(delivery):
        yield Link("fulfillment", "outgoing", "stock_move", move, quantity=move.quantity)
    for doc in InventoryDocument.objects.filter(source_document_type="sales.saledelivery", source_document_id=delivery.id):
        yield Link("derivation", "outgoing", "inventory_document", doc)
    if delivery.journal_entry_id:
        yield Link("posting", "outgoing", "journal_entry", delivery.journal_entry)


# Devolución: su lista (`/sales/dtes/returns`) abre el drawer con id propio → resolvedor /d/ (valor por defecto).
DocumentTypeRegistry.register(DocumentType(label="sales.salereturn"))


@relation_provider("sales.salereturn")
def sale_return_relations(sale_return):
    from inventory.models import InventoryDocument

    yield Link("correction", "incoming", "sale_order", sale_return.sale_order)
    if sale_return.credit_note_id:
        yield Link("reference", "incoming", "credit_note", sale_return.credit_note, is_dependency=False)
    for line in sale_return.lines.select_related("stock_move"):
        if line.stock_move_id:
            yield Link("fulfillment", "outgoing", "stock_move", line.stock_move, quantity=line.quantity)
    for doc in InventoryDocument.objects.filter(source_document_type="sales.salereturn", source_document_id=sale_return.id):
        yield Link("derivation", "outgoing", "inventory_document", doc)
    if sale_return.journal_entry_id:
        yield Link("posting", "outgoing", "journal_entry", sale_return.journal_entry)
