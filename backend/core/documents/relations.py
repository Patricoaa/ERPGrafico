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

from .refs import build_ref, get_document, missing_ref, partner_of
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
        # (label, obj) de los destinos existentes: base de contrapartes y asientos indirectos.
        targets: list[tuple[str, models.Model]] = []

        def add(link: Link) -> None:
            if (semantic and link.semantic != semantic) or (direction and link.direction != direction):
                return
            target_label, target_obj, target_ref = cls._resolve(link.target, user)
            key = (link.role, target_ref["label"], target_ref["id"])
            if key in seen:
                return
            seen.add(key)
            if not target_ref["exists"]:
                unresolved.append({"label": target_ref["label"], "id": target_ref["id"], "role": link.role,
                                   "reason": "not_found"})
                return
            targets.append((target_label, target_obj))
            links.append({
                "semantic": link.semantic,
                "direction": link.direction,
                "role": link.role,
                "target": target_ref,
                "amount": link.amount,
                "quantity": link.quantity,
                "is_dependency": link.is_dependency,
            })

        for provider in cls._providers.get(label, []):
            for link in provider(obj):
                add(link)
        for link in cls._indirect_links(label, obj, list(targets)):
            add(link)
        return {"document": build_ref(obj, user, label), "relations": links, "unresolved": unresolved}

    @staticmethod
    def _indirect_links(label: str, obj: models.Model, targets: list[tuple[str, models.Model]]) -> Iterable[Link]:
        """
        Relaciones derivadas para la ficha documental (ADR-0083):
        - asientos de los documentos relacionados (el documento no los referencia directamente);
        - contrapartes (cliente, proveedor, contacto) del documento y de sus relacionados.
        Se leen FKs tipadas (`journal_entry`, ruta de contraparte del registro); nada heurístico.
        """
        own_entries = {t.pk for t_label, t in targets if t_label == "accounting.journalentry"}
        for target_label, target in targets:
            if target_label == "accounting.journalentry":
                continue
            entry_id = getattr(target, "journal_entry_id", None)
            if entry_id and entry_id not in own_entries:
                own_entries.add(entry_id)
                yield Link("posting", "outgoing", "journal_entry", target.journal_entry, is_dependency=False)

        partners: dict[int, str] = {}
        for doc_label, doc in [(label, obj), *targets]:
            if doc_label.startswith("contacts."):
                continue
            found = partner_of(DocumentTypeRegistry.get(doc_label), doc)
            if found is None:
                continue
            path, partner = found
            role = PARTNER_ROLES.get(path.rsplit(".", 1)[-1], "contact")
            if partner.pk not in partners:
                partners[partner.pk] = role
                yield Link("association", "outgoing", role, partner, is_dependency=False)

    @staticmethod
    def _resolve(target, user) -> tuple[str, models.Model | None, dict]:
        if isinstance(target, tuple):
            target_label, target_pk = target
            target_obj = get_document(target_label, target_pk)
            ref = build_ref(target_obj, user, target_label) if target_obj else missing_ref(target_label, target_pk)
            return target_label, target_obj, ref
        target_label = DocumentTypeRegistry.label_for(type(target))
        return target_label, target, build_ref(target, user, target_label)


PARTNER_ROLES = {"customer": "customer", "supplier": "supplier"}


relation_provider = DocumentRelationService.register


def related_or_none(obj: models.Model, name: str) -> Any:
    """Acceso seguro a una relación inversa O2O (devuelve None si no existe)."""
    from django.core.exceptions import ObjectDoesNotExist

    try:
        return getattr(obj, name)
    except ObjectDoesNotExist:
        return None
