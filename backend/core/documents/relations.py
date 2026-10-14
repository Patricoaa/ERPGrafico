"""
DocumentRelationService — resuelve las relaciones de un documento a partir de
proveedores por tipo (ADR-0080). Los proveedores viven en `<app>/relations.py`
(autodescubiertos en CoreConfig.ready) y solo leen FKs tipadas.
"""

from __future__ import annotations

from collections.abc import Callable, Iterable
from dataclasses import dataclass
from decimal import Decimal
from typing import Any, ClassVar

from django.db import models

from .refs import build_ref, get_document, missing_ref
from .types import DocumentTypeRegistry

SEMANTICS = ("derivation", "fulfillment", "settlement", "posting", "correction", "reference", "association")
DIRECTIONS = ("outgoing", "incoming")


@dataclass(frozen=True)
class Link:
    semantic: str
    direction: str
    role: str
    # Instancia del documento destino, o (label, id) cuando puede no existir (GFK/PGFK).
    target: models.Model | tuple[str, Any]
    amount: Decimal | None = None
    quantity: Decimal | None = None
    is_dependency: bool = True

    def __post_init__(self):
        if self.semantic not in SEMANTICS:
            raise ValueError(f"semantic inválido: {self.semantic}")
        if self.direction not in DIRECTIONS:
            raise ValueError(f"direction inválido: {self.direction}")


Provider = Callable[[models.Model], Iterable[Link]]


class DocumentRelationService:
    _providers: ClassVar[dict[str, list[Provider]]] = {}

    @classmethod
    def register(cls, label: str) -> Callable[[Provider], Provider]:
        def decorator(func: Provider) -> Provider:
            cls._providers.setdefault(label, []).append(func)
            return func

        return decorator

    @classmethod
    def has_provider(cls, label: str) -> bool:
        return label in cls._providers

    @classmethod
    def relations(cls, label: str, pk: Any, user, semantic: str | None = None, direction: str | None = None) -> dict | None:
        obj = get_document(label, pk)
        if obj is None:
            return None
        links: list[dict] = []
        unresolved: list[dict] = []
        seen: set[tuple] = set()
        for provider in cls._providers.get(label, []):
            for link in provider(obj):
                if (semantic and link.semantic != semantic) or (direction and link.direction != direction):
                    continue
                target_ref = cls._target_ref(link.target, user)
                key = (link.role, target_ref["label"], target_ref["id"])
                if key in seen:
                    continue
                seen.add(key)
                if not target_ref["exists"]:
                    unresolved.append({"label": target_ref["label"], "id": target_ref["id"], "role": link.role,
                                       "reason": "not_found"})
                    continue
                links.append({
                    "semantic": link.semantic,
                    "direction": link.direction,
                    "role": link.role,
                    "target": target_ref,
                    "amount": link.amount,
                    "quantity": link.quantity,
                    "is_dependency": link.is_dependency,
                })
        return {"document": build_ref(obj, user, label), "relations": links, "unresolved": unresolved}

    @staticmethod
    def _target_ref(target, user) -> dict:
        if isinstance(target, tuple):
            target_label, target_pk = target
            target_obj = get_document(target_label, target_pk)
            return build_ref(target_obj, user, target_label) if target_obj else missing_ref(target_label, target_pk)
        return build_ref(target, user, DocumentTypeRegistry.label_for(type(target)))


relation_provider = DocumentRelationService.register


def related_or_none(obj: models.Model, name: str) -> Any:
    """Acceso seguro a una relación inversa O2O (devuelve None si no existe)."""
    from django.core.exceptions import ObjectDoesNotExist

    try:
        return getattr(obj, name)
    except ObjectDoesNotExist:
        return None
