"""Proveedores de relaciones documentales de inventario (ADR-0080, contrato document-relations.md)."""

from core.documents.details import display, join, lines_count, quantity
from core.documents import (
    DocumentType,
    DocumentTypeRegistry,
    Link,
    related_or_none,
    relation_provider,
)

DocumentTypeRegistry.register(DocumentType(
    label="inventory.stockmove", canonical_url="/inventory/reports/movements?selected={id}", status_field=None,
    amount_field=None,
    detail=lambda m: join(getattr(m.product, "name", None), f"{quantity(m.quantity)} {getattr(m.uom, 'name', '')}".strip()),
))


@relation_provider("inventory.stockmove")
def stock_move_relations(move):
    for accessor, attr, role, semantic in (
        ("sale_delivery_line", "delivery", "delivery", "fulfillment"),
        ("purchase_receipt_line", "receipt", "receipt", "fulfillment"),
        ("sale_return_line", "return_doc", "return", "correction"),
        ("purchase_return_line", "return_doc", "return", "correction"),
        ("production_consumption", "work_order", "work_order", "fulfillment"),
    ):
        line = related_or_none(move, accessor)
        if line is not None:
            yield Link(semantic, "incoming", role, getattr(line, attr))
    detail = related_or_none(move, "inventory_document_detail")
    if detail is not None:
        yield Link("derivation", "incoming", "inventory_document", detail.document)
    if move.journal_entry_id:
        yield Link("posting", "outgoing", "journal_entry", move.journal_entry)


DocumentTypeRegistry.register(DocumentType(
    label="inventory.inventorydocument", amount_field=None,
    detail=lambda d: join(display(d, "document_type"), lines_count(d, "details")),
))


@relation_provider("inventory.inventorydocument")
def inventory_document_relations(doc):
    if doc.source_document_type and doc.source_document_id:
        yield Link("derivation", "incoming", "source_document", (doc.source_document_type, doc.source_document_id))
    for detail in doc.details.select_related("stock_move"):
        if detail.stock_move_id:
            yield Link("derivation", "outgoing", "stock_move", detail.stock_move, quantity=detail.quantity)


DocumentTypeRegistry.register(DocumentType(
    label="inventory.subscription", canonical_url="/inventory/products/subscriptions?selected={id}",
))
