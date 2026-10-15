"""DocumentRef — referencia común a un documento (ADR-0080, contrato document-relations.md)."""

from __future__ import annotations

from typing import Any

from django.db import models

from core.registry import UniversalRegistry

from .types import DEFAULT_DATE_FIELDS, DEFAULT_PARTNER_PATHS, DocumentTypeRegistry


def _resolve_path(obj: Any, path: str) -> Any:
    for part in path.split("."):
        obj = getattr(obj, part, None)
        if obj is None:
            return None
    return obj


def _display_id(label: str, obj: models.Model) -> str:
    value = getattr(obj, "display_id", None)
    if value:
        return str(value)
    entity = UniversalRegistry.get(label)
    if entity:
        return UniversalRegistry._render(entity.short_display_template, obj)
    return f"{obj._meta.verbose_name} #{obj.pk}"


def _date(doc_type, obj) -> str | None:
    fields = (doc_type.date_field,) if doc_type.date_field else DEFAULT_DATE_FIELDS
    for name in fields:
        value = getattr(obj, name, None)
        if value:
            return value.isoformat()
    return None


def _partner_name(doc_type, obj) -> str | None:
    paths = (doc_type.partner_path,) if doc_type.partner_path else DEFAULT_PARTNER_PATHS
    for path in paths:
        partner = _resolve_path(obj, path)
        if partner is not None:
            return getattr(partner, "name", None) or str(partner)
    return None


def build_ref(obj: models.Model, user, label: str | None = None) -> dict:
    label = label or DocumentTypeRegistry.label_for(type(obj))
    doc_type = DocumentTypeRegistry.get(label)
    entity = UniversalRegistry.get(label)
    accessible = bool(user and user.has_perm(DocumentTypeRegistry.view_permission(label)))
    status = getattr(obj, doc_type.status_field, None) if doc_type.status_field else None
    status_display = None
    if status is not None and hasattr(obj, f"get_{doc_type.status_field}_display"):
        status_display = getattr(obj, f"get_{doc_type.status_field}_display")()
    return {
        "label": label,
        "id": obj.pk,
        "display_id": _display_id(label, obj),
        "title": entity.title_singular if entity else str(obj._meta.verbose_name),
        "icon": entity.icon if entity else None,
        "domain": DocumentTypeRegistry.domain(label),
        # Sin permiso: se muestra que existe la relación, no su contenido.
        "status": status if accessible else None,
        "status_display": status_display if accessible else None,
        "date": _date(doc_type, obj) if accessible else None,
        "partner_name": _partner_name(doc_type, obj) if accessible else None,
        "url": DocumentTypeRegistry.canonical_url(label, obj),
        "accessible": accessible,
        "exists": True,
    }


def missing_ref(label: str, pk: Any) -> dict:
    entity = UniversalRegistry.get(label)
    return {
        "label": label, "id": pk, "display_id": f"#{pk}",
        "title": entity.title_singular if entity else label,
        "icon": entity.icon if entity else None,
        "domain": DocumentTypeRegistry.domain(label),
        "status": None, "status_display": None, "date": None, "partner_name": None,
        "url": None, "accessible": False, "exists": False,
    }


def get_document(label: str, pk: Any) -> models.Model | None:
    model = DocumentTypeRegistry.model_for(label)
    if model is None:
        return None
    return model.objects.filter(pk=pk).first()


def ref_for(label: str, pk: Any, user) -> dict:
    obj = get_document(label, pk)
    return build_ref(obj, user, label) if obj is not None else missing_ref(label, pk)
