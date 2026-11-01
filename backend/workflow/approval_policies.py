"""Canonical document labels and legacy aliases for approval policies."""

LEGACY_DOCUMENT_TYPE_ALIASES = {
    "sale_order": "sales.saleorder",
    "saleorder": "sales.saleorder",
    "ov": "sales.saleorder",
    "purchase_order": "purchasing.purchaseorder",
    "purchaseorder": "purchasing.purchaseorder",
    "oc": "purchasing.purchaseorder",
    "work_order": "production.workorder",
    "workorder": "production.workorder",
    "ot": "production.workorder",
    "factura": "billing.invoice",
    "invoice": "billing.invoice",
}

CANONICAL_DOCUMENT_TYPES = {
    "sales.saleorder": "Orden de venta",
    "purchasing.purchaseorder": "Orden de compra",
    "production.workorder": "Orden de trabajo",
    "billing.invoice": "Factura",
}

CANONICAL_MODEL_NAMES = {
    "sales.saleorder": "SaleOrder",
    "purchasing.purchaseorder": "PurchaseOrder",
    "production.workorder": "WorkOrder",
    "billing.invoice": "Invoice",
}


def canonicalize_document_type(value: str) -> str:
    normalized = value.strip().lower()
    return LEGACY_DOCUMENT_TYPE_ALIASES.get(normalized, normalized)


def document_type_candidates(document) -> list[str]:
    return document_type_label_candidates(document._meta.label_lower, type(document).__name__)


def document_type_label_candidates(label: str, model_name: str | None = None) -> list[str]:
    canonical = canonicalize_document_type(label)
    candidates = [
        canonical,
        model_name or CANONICAL_MODEL_NAMES.get(canonical, canonical.rsplit(".", 1)[-1].title()),
        canonical.upper(),
        canonical.replace(".", "_").upper(),
    ]
    candidates.extend(
        candidate
        for alias, target in LEGACY_DOCUMENT_TYPE_ALIASES.items()
        if target == canonical
        for candidate in (alias, alias.upper())
    )
    return list(dict.fromkeys(candidates))