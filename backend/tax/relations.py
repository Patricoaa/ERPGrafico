"""Tipos documentales de impuestos (ADR-0080, M5)."""

from core.documents import DocumentType, DocumentTypeRegistry

DocumentTypeRegistry.register(DocumentType(label="tax.taxperiod", canonical_url="/accounting/closures/{id}"))  # ADR-0090
