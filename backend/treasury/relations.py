"""Proveedores de relaciones documentales de tesorería (ADR-0080, contrato document-relations.md)."""

from core.documents import DocumentType, DocumentTypeRegistry, Link, relation_provider

DocumentTypeRegistry.register(DocumentType(
    label="treasury.treasurymovement", canonical_url="/treasury/operaciones/movements?selected={id}",
))


@relation_provider("treasury.treasurymovement")
def treasury_movement_relations(movement):
    for field, role in (("invoice", "invoice"), ("sale_order", "sale_order"), ("purchase_order", "purchase_order")):
        if getattr(movement, f"{field}_id"):
            yield Link("settlement", "outgoing", role, getattr(movement, field), amount=movement.amount)
    for allocation in movement.allocations.select_related("invoice", "sale_order", "purchase_order"):
        for field in ("invoice", "sale_order", "purchase_order"):
            target = getattr(allocation, field)
            if target is not None:
                yield Link("settlement", "outgoing", field, target, amount=allocation.amount)
    if movement.journal_entry_id:
        yield Link("posting", "outgoing", "journal_entry", movement.journal_entry)
