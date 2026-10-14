"""Tipos documentales de compras (ADR-0080). Los proveedores de relaciones llegan en M5."""

from core.documents import DocumentType, DocumentTypeRegistry

# OC: `?selected` abre el Order Hub, que es su ficha (decisión D4).
DocumentTypeRegistry.register(DocumentType(
    label="purchasing.purchaseorder", canonical_url="/purchasing/orders?selected={id}",
))
