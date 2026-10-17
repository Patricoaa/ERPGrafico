"""Proveedores de relaciones documentales de contabilidad (ADR-0080, contrato document-relations.md)."""

from core.documents import DocumentType, DocumentTypeRegistry, Link, relation_provider

DocumentTypeRegistry.register(DocumentType(
    label="accounting.journalentry", canonical_url="/accounting/entries?selected={id}",
    amount_field=None, detail=lambda je: je.description or None,
))


@relation_provider("accounting.journalentry")
def journal_entry_relations(entry):
    if entry.source_content_type_id and entry.source_object_id:
        model = entry.source_content_type.model_class()
        label = DocumentTypeRegistry.label_for(model) if model else entry.source_content_type.model
        # (label, id): si el origen ya no existe se reporta en `unresolved`.
        yield Link("posting", "incoming", "source_document", (label, entry.source_object_id))
    if entry.reversal_of_id:
        yield Link("correction", "outgoing", "reverses", entry.reversal_of)
    for reversal in entry.reversals.all():
        yield Link("correction", "incoming", "reversal", reversal)
    for move in entry.stock_moves.all():
        yield Link("posting", "incoming", "stock_move", move)


# Tipos sin ficha (drawer): ruta propia verificada por core/tests/test_document_routes_sync.py
DocumentTypeRegistry.register(DocumentType(label="accounting.budget", canonical_url="/finances/budgets/{id}"))
DocumentTypeRegistry.register(DocumentType(label="accounting.fiscalyear", canonical_url="/accounting/closures/{id}"))
