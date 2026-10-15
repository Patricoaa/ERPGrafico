"""Tipos documentales de contactos (ADR-0080, M5)."""

from core.documents import DocumentType, DocumentTypeRegistry

DocumentTypeRegistry.register(DocumentType(label="contacts.partnertransaction", canonical_url="/contacts", status_field=None))
