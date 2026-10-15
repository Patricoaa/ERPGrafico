"""Tipos documentales de contactos (ADR-0080, M5)."""

from core.documents import DocumentType, DocumentTypeRegistry
from core.documents.details import join

DocumentTypeRegistry.register(DocumentType(label="contacts.partnertransaction", canonical_url="/contacts", status_field=None))
# Contraparte de los documentos (área "contacts" de la ficha documental, ADR-0083).
DocumentTypeRegistry.register(DocumentType(
    label="contacts.contact", status_field=None, amount_field=None, date_field="created_at",
    detail=lambda c: join(c.name, c.tax_id, c.email or c.phone),
))
