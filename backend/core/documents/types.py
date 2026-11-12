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
# orden que el ciclo Origen → Facturación → Producción → Logística → Tesorería → Contabilidad → Capital.
DOCUMENT_DOMAINS = ("origin", "billing", "production", "logistics", "treasury", "accounting", "capital", "contacts", "other")
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
    "contacts": "contacts",
}

# Importe del documento: primer campo presente de esta lista (DocumentType.amount_field lo fija).
DEFAULT_AMOUNT_FIELDS = ("effective_total", "total", "amount")
AUTO = "auto"

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
    # Campo con el importe del documento; AUTO → DEFAULT_AMOUNT_FIELDS; None → sin importe.
    amount_field: str | None = AUTO
    # (obj) -> texto breve que identifica el documento en una lista de relacionados
    # ("Transferencia · ref. 123", "Factura electrónica"). ADR-0083.
    detail: Callable[[models.Model], str | None] | None = None
    # Etiqueta de vista sobre un modelo que ya tiene su propia etiqueta (p. ej. `contacts.partner`
    # sobre Contact, junto a `contacts.contact`): () -> QuerySet que resuelve la etiqueta y
    # restringe sus filas (un contacto no socio no existe como `contacts.partner`). ADR-0133.
    queryset: Callable[[], models.QuerySet] | None = None
    # Permiso de lectura de la etiqueta cuando no deriva de ella (no hay `contacts.view_partner`).
    permission: str | None = None


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
    def queryset_for(cls, label: str) -> models.QuerySet | None:
        declared = cls._types.get(label)
        if declared and declared.queryset:
            return declared.queryset()
        model = cls.model_for(label)
        return model.objects.all() if model else None

    @classmethod
    def model_for(cls, label: str) -> type[models.Model] | None:
        declared = cls._types.get(label)
        if declared and declared.queryset:
            return declared.queryset().model
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
        declared = cls._types.get(label)
        if declared and declared.permission:
            return declared.permission
        entity = UniversalRegistry.get(label)
        if entity and entity.permission:
            return entity.permission
        app_label, model_name = label.split(".", 1)
        return f"{app_label}.view_{model_name}"

    @classmethod
    def comment_view_permission(cls, label: str, obj: models.Model | None = None) -> str:
        """Permiso que gobierna los comentarios de `obj` (ADR-0111).

        Por defecto es el de visualización de la entidad. Un modelo que pertenece a otra
        entidad (p. ej. una tarea de aprobación de una OT) define `comment_permission_source()`
        y hereda el permiso de su padre.
        """
        source = getattr(obj, "comment_permission_source", None)
        parent = source() if callable(source) else None
        if parent is not None:
            return cls.view_permission(cls.label_for(parent.__class__))
        return cls.view_permission(label)
