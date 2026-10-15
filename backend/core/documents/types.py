"""
DocumentTypeRegistry — extensión de UniversalRegistry para el modelo documental (ADR-0080).

UniversalRegistry ya aporta título, icono, permiso y plantillas de cada label. Aquí se
declara lo que necesita la navegación documental: URL canónica y campos de estado,
fecha y contraparte. Un label registrado en UniversalRegistry sin declaración propia
usa los valores por defecto (introspección + resolvedor `/d/{label}/{id}`).
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import ClassVar

from django.apps import apps
from django.db import models

from core.registry import SearchableEntity, UniversalRegistry

RESOLVER_URL = "/d/{label}/{id}"

DEFAULT_DATE_FIELDS = ("date", "delivery_date", "receipt_date", "return_date", "created_at")
# Área operativa (ADR-0083): agrupa los relacionados en la ficha documental en el mismo
# orden que el ciclo Origen → Facturación → Producción → Logística → Tesorería → Contabilidad.
DOCUMENT_DOMAINS = ("origin", "billing", "production", "logistics", "treasury", "accounting", "other")
DEFAULT_DOMAIN_BY_APP = {
    "billing": "billing",
    "production": "production",
    "sales": "logistics",
    "purchasing": "logistics",
    "inventory": "logistics",
    "treasury": "treasury",
    "finance": "treasury",
    "accounting": "accounting",
    "tax": "accounting",
}

DEFAULT_PARTNER_PATHS = (
    "customer", "supplier", "contact", "partner",
    "sale_order.customer", "purchase_order.supplier",
)


@dataclass(frozen=True)
class DocumentType:
    label: str
    # Patrón con {id} o función (obj) -> url. None → resolvedor /d/{label}/{id}.
    canonical_url: str | Callable[[models.Model], str] | None = None
    status_field: str | None = "status"
    date_field: str | None = None
    partner_path: str | None = None
    # None → por app (DEFAULT_DOMAIN_BY_APP) o "other".
    domain: str | None = None


class DocumentTypeRegistry:
    _types: ClassVar[dict[str, DocumentType]] = {}

    @classmethod
    def register(cls, doc_type: DocumentType) -> None:
        if doc_type.domain and doc_type.domain not in DOCUMENT_DOMAINS:
            raise ValueError(f"Unknown document domain '{doc_type.domain}' for '{doc_type.label}'.")
        if doc_type.label in cls._types:
            raise ValueError(f"Document type '{doc_type.label}' already registered.")
        cls._types[doc_type.label] = doc_type

    @classmethod
    def domain(cls, label: str) -> str:
        declared = cls.get(label).domain
        if declared:
            return declared
        return DEFAULT_DOMAIN_BY_APP.get(label.split(".", 1)[0], "other")

    @classmethod
    def get(cls, label: str) -> DocumentType:
        return cls._types.get(label) or DocumentType(label=label)

    @classmethod
    def entity(cls, label: str) -> SearchableEntity | None:
        return UniversalRegistry.get(label)

    @classmethod
    def model_for(cls, label: str) -> type[models.Model] | None:
        entity = UniversalRegistry.get(label)
        if entity:
            return entity.model
        try:
            return apps.get_model(label)
        except (LookupError, ValueError):
            return None

    @classmethod
    def label_for(cls, model: type[models.Model]) -> str:
        entity = UniversalRegistry.get_for_model(model)
        return entity.label if entity else model._meta.label_lower

    @classmethod
    def canonical_url(cls, label: str, obj: models.Model) -> str:
        url = cls.get(label).canonical_url
        if callable(url):
            return url(obj)
        return (url or RESOLVER_URL).format(label=label, id=obj.pk)

    @classmethod
    def url_for(cls, label: str, pk) -> str:
        """URL canónica sin cargar el objeto: patrón declarado o resolvedor (que redirige)."""
        url = cls.get(label).canonical_url
        if isinstance(url, str):
            return url.format(label=label, id=pk)
        return RESOLVER_URL.format(label=label, id=pk)

    @classmethod
    def view_permission(cls, label: str) -> str:
        entity = UniversalRegistry.get(label)
        if entity and entity.permission:
            return entity.permission
        app_label, model_name = label.split(".", 1)
        return f"{app_label}.view_{model_name}"
