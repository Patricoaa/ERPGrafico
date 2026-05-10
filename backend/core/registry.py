"""
UniversalRegistry — central catalog of searchable ERP entities.

Each app registers its entities in AppConfig.ready().
The search view calls UniversalRegistry.search() with the authenticated user
so permission filtering happens server-side.
"""

from __future__ import annotations

import operator
import re
from dataclasses import dataclass, field
from functools import reduce
from typing import Any, ClassVar

from django.db import models
from django.db.models import Q


@dataclass(frozen=True)
class SearchableEntity:
    model: type[models.Model]
    label: str                      # dot-notation app label, e.g. 'sales.saleorder'
    title_singular: str             # e.g. 'Nota de Venta'
    title_plural: str               # e.g. 'Notas de Venta'
    icon: str                       # lucide icon name, e.g. 'receipt-text'
    search_fields: tuple[str, ...]  # ORM field lookups, e.g. ('number', 'customer__name')
    short_display_template: str     # e.g. 'NV-{number}'
    display_template: str           # Python str.format_map template, e.g. 'NV-{number} · {customer.name}'
    list_url: str                   # frontend route, e.g. '/ventas/ordenes'
    detail_url_pattern: str         # frontend route with {id}, e.g. '/ventas/ordenes/{id}'
    subtitle_template: str = ""     # e.g. '{customer.email}'
    extra_info_template: str = ""   # e.g. '{status}'
    permission: str | None = None   # Django permission codename, e.g. 'sales.view_saleorder'
    extra_filters: dict[str, Any] = field(default_factory=dict)


class _DotAccessor:
    """Wraps a model instance so that display_template can access related attrs."""

    def __init__(self, instance: models.Model) -> None:
        self._instance = instance

    def __getitem__(self, key: str) -> str:
        obj = self._instance
        for part in key.split("."):
            obj = getattr(obj, part, "")
            if callable(obj):
                obj = obj()
            if obj is None:
                return ""
        return obj


class UniversalRegistry:
    _entities: ClassVar[dict[str, SearchableEntity]] = {}

    @classmethod
    def register(cls, entity: SearchableEntity) -> None:
        if entity.label in cls._entities:
            raise ValueError(f"Entity '{entity.label}' already registered in UniversalRegistry.")
        cls._entities[entity.label] = entity

    @classmethod
    def all_labels(cls) -> list[str]:
        return list(cls._entities.keys())

    @classmethod
    def get_for_model(cls, model: type[models.Model]) -> SearchableEntity | None:
        for entity in cls._entities.values():
            if entity.model == model:
                return entity
        return None

    @classmethod
    def search(
        cls,
        query: str,
        *,
        user: Any,
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        """
        Full-text search across all registered entities with prefix detection.
        """
        query = query.strip()
        if not query:
            return []

        results: list[dict[str, Any]] = []
        
        # 1. Identify if the query has a canonical prefix (e.g., "NV-", "OCS-")
        # We check all entities to see if the query starts with their template's constant prefix
        targeted_entities = []
        clean_query = query
        
        for label, entity in cls._entities.items():
            # Extract constant prefix from short_display_template (e.g., "NV-{number}" -> "NV-")
            prefix_match = re.match(r"^([^{]+)\{", entity.short_display_template)
            if prefix_match:
                prefix = prefix_match.group(1)
                if query.upper().startswith(prefix.upper()):
                    # Query has this prefix! 
                    # Strip it to search for the numeric part or the rest of the string
                    prefix_len = len(prefix)
                    clean_query = query[prefix_len:].strip()
                    targeted_entities.append(label)
                    break # Assuming one prefix match is enough

        # 2. Re-order entities: targeted first, then others
        labels_to_search = targeted_entities + [l for l in cls._entities.keys() if l not in targeted_entities]

        for label in labels_to_search:
            entity = cls._entities[label]
            if entity.permission and not user.has_perm(entity.permission):
                continue

            # If we are in a targeted entity, we search with the clean_query
            # If we are in a broad search, we use the original query
            current_search_term = clean_query if label in targeted_entities else query
            
            # If the targeted entity has no numeric part after prefix, skip targeted search
            if label in targeted_entities and not current_search_term:
                continue

            q_filter = cls._build_icontains_filter(current_search_term, entity.search_fields)
            if q_filter is None:
                continue

            try:
                # If targeted, we might want to boost exact matches on 'number' if it exists
                qs = entity.model.objects.filter(q_filter, **entity.extra_filters)[:limit]

                for instance in qs:
                    results.append(
                        {
                            "label": label,
                            "title": entity.title_singular,
                            "title_plural": entity.title_plural,
                            "icon": entity.icon,
                            "id": instance.pk,
                            "short_display": cls._render(entity.short_display_template, instance),
                            "display": cls._render(entity.display_template, instance),
                            "subtitle": cls._render(entity.subtitle_template, instance),
                            "extra_info": cls._render(entity.extra_info_template, instance),
                            "list_url": entity.list_url,
                            "detail_url": entity.detail_url_pattern.replace("{id}", str(instance.pk)),
                        }
                    )
                    if len(results) >= limit:
                        return results
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Error searching entity {label}: {e}")
                continue

        return results

    @staticmethod
    def _build_icontains_filter(query: str, search_fields: tuple[str, ...]) -> Q | None:
        if not search_fields:
            return None

        clauses = []
        # Normalization for RUTs (Chilean Tax IDs): strip dots and hyphens
        clean_query = re.sub(r"[.\-]", "", query)
        
        for field in search_fields:
            # Basic icontains for the raw query
            clauses.append(Q(**{f"{field}__icontains": query}))
            
            # If the field seems to be a RUT/TaxID, we add a normalized check
            if any(term in field.lower() for term in ["tax_id", "rut", "identification", "code"]):
                # If clean_query is different, search for it too
                if clean_query != query:
                    clauses.append(Q(**{f"{field}__icontains": clean_query}))
                
                # Advanced: if we are on PostgreSQL, we could use a Func to replace dots/hyphens in the field itself
                # For now, searching for the clean version in the field covers the case where the DB has clean RUTs.
                # To cover the case where DB has dots/hyphens but user types clean, we'd need:
                # .annotate(clean_f=Replace(Replace(field, Value('.'), Value('')), Value('-'), Value('')))
                # .filter(clean_f__icontains=clean_query)
                # But this requires knowing the model context inside this static method.

        return reduce(operator.or_, clauses)

    @staticmethod
    def _render(template: str, instance: models.Model) -> str:
        try:
            return template.format_map(_DotAccessor(instance))
        except Exception:
            return str(instance)
