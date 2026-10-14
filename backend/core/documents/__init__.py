"""Modelo documental común (ADR-0080): tipos, DocumentRef y relaciones."""

from .refs import build_ref, missing_ref, ref_for
from .relations import DocumentRelationService, Link, related_or_none, relation_provider
from .types import DocumentType, DocumentTypeRegistry

__all__ = [
    "DocumentRelationService",
    "DocumentType",
    "DocumentTypeRegistry",
    "Link",
    "build_ref",
    "missing_ref",
    "ref_for",
    "related_or_none",
    "relation_provider",
]
