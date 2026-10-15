"""Proveedores de relaciones documentales de compras (ADR-0080, contrato document-relations.md)."""

from core.documents import DocumentType, DocumentTypeRegistry, Link, relation_provider

# OC: `?selected` abre su ficha documental (ADR-0083). Área "origin": encabeza el ciclo.
DocumentTypeRegistry.register(DocumentType(
    label="purchasing.purchaseorder", canonical_url="/purchasing/orders?selected={id}", domain="origin",
))
# Recepción: sin lista con `?selected` propio → resolvedor /d/ (valor por defecto).
DocumentTypeRegistry.register(DocumentType(label="purchasing.purchasereceipt"))

NOTE_ROLES = {"NOTA_CREDITO": "credit_note", "NOTA_DEBITO": "debit_note"}


@relation_provider("purchasing.purchaseorder")
def purchase_order_relations(order):
    for receipt in order.receipts.all():
        yield Link("fulfillment", "outgoing", "receipt", receipt)
    from billing.invoicing import InvoicingService

    for invoice in InvoicingService.invoices_of(order):
        if invoice.dte_type in NOTE_ROLES:
            yield Link("correction", "outgoing", NOTE_ROLES[invoice.dte_type], invoice)
        else:
            yield Link("derivation", "outgoing", "invoice", invoice)
    for purchase_return in order.returns.all():
        yield Link("correction", "outgoing", "return", purchase_return)
    if order.work_order_id:
        yield Link("reference", "incoming", "work_order", order.work_order, is_dependency=False)
    for payment in order.payments.all():
        yield Link("settlement", "incoming", "payment", payment, amount=payment.amount)
    for allocation in order.payment_allocations.select_related("treasury_movement"):
        yield Link("settlement", "incoming", "payment", allocation.treasury_movement, amount=allocation.amount)
    if order.journal_entry_id:
        yield Link("posting", "outgoing", "journal_entry", order.journal_entry)


@relation_provider("purchasing.purchasereceipt")
def purchase_receipt_relations(receipt):
    from inventory.models import InventoryDocument

    yield Link("fulfillment", "incoming", "purchase_order", receipt.purchase_order)
    if receipt.related_note_id:
        yield Link("reference", "incoming", NOTE_ROLES.get(receipt.related_note.dte_type, "note"),
                   receipt.related_note, is_dependency=False)
    for line in receipt.lines.select_related("stock_move"):
        if line.stock_move_id:
            yield Link("fulfillment", "outgoing", "stock_move", line.stock_move, quantity=line.quantity_received)
    for doc in InventoryDocument.objects.filter(source_document_type="purchasing.purchasereceipt", source_document_id=receipt.id):
        yield Link("derivation", "outgoing", "inventory_document", doc)
    if receipt.journal_entry_id:
        yield Link("posting", "outgoing", "journal_entry", receipt.journal_entry)


DocumentTypeRegistry.register(DocumentType(label="purchasing.purchasereturn"))


@relation_provider("purchasing.purchasereturn")
def purchase_return_relations(purchase_return):
    yield Link("correction", "incoming", "purchase_order", purchase_return.purchase_order)
    if purchase_return.credit_note_id:
        yield Link("reference", "incoming", "credit_note", purchase_return.credit_note, is_dependency=False)
    for line in purchase_return.lines.select_related("stock_move"):
        if line.stock_move_id:
            yield Link("fulfillment", "outgoing", "stock_move", line.stock_move, quantity=line.quantity)
    if purchase_return.journal_entry_id:
        yield Link("posting", "outgoing", "journal_entry", purchase_return.journal_entry)
