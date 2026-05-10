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

from django.db import connection as _db_connection
from django.db import models
from django.db.models import Q


def _is_postgres() -> bool:
    return _db_connection.vendor == 'postgresql'


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
    _TAX_INDICATORS: ClassVar[tuple[str, ...]] = ("tax_id", "rut", "identification")

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
            
            # If the targeted entity has no numeric part after prefix, we show recent items
            # Otherwise, we perform the normal search.
            try:
                if label in targeted_entities and not current_search_term:
                    qs = entity.model.objects.filter(**entity.extra_filters).order_by("-id")[:limit]
                else:
                    qs = cls._build_fts_query(entity, current_search_term)[:limit]

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

    @classmethod
    def _build_fts_query(cls, entity: SearchableEntity, query: str) -> models.QuerySet[Any]:
        has_tax_field = any(
            any(t in f.lower() for t in cls._TAX_INDICATORS)
            for f in entity.search_fields
        )

        if has_tax_field or not _is_postgres():
            q_filter = cls._build_icontains_filter(query, entity.search_fields)
            if q_filter is None:
                return entity.model.objects.none()
            return entity.model.objects.filter(q_filter, **entity.extra_filters)

        from django.contrib.postgres.search import SearchVector, SearchQuery

        # Exclude integer PK and FK traversal fields (SearchVector only accepts direct columns)
        fts_fields = [f for f in entity.search_fields if f != 'id' and '__' not in f]
        fk_fields = tuple(f for f in entity.search_fields if '__' in f)

        if not fts_fields:
            # All fields are FK traversal → icontains handles them via JOIN
            q_filter = cls._build_icontains_filter(query, entity.search_fields)
            if q_filter is None:
                return entity.model.objects.none()
            return entity.model.objects.filter(q_filter, **entity.extra_filters)

        sv = SearchVector(*fts_fields, config='spanish')
        # 'plain' search_type: each word required (AND semantics, matches current multi-word logic)
        sq = SearchQuery(query, config='spanish', search_type='plain')

        if fk_fields:
            # Combined: FTS on direct fields OR icontains on FK fields (single SQL query)
            q_fk = cls._build_icontains_filter(query, fk_fields)
            fts_q = Q(_fts=sq)
            combined = (fts_q | q_fk) if q_fk else fts_q
            return (
                entity.model.objects
                .annotate(_fts=sv)
                .filter(combined, **entity.extra_filters)
            )

        return entity.model.objects.annotate(_fts=sv).filter(_fts=sq, **entity.extra_filters)

    @staticmethod
    def _build_icontains_filter(query: str, search_fields: tuple[str, ...]) -> Q | None:
        if not search_fields:
            return None

        # 1. Split query into words to support multi-term search (AND logic between words)
        # Example: "Juan 1025" will find documents where "Juan" matches something AND "1025" matches something
        words = [w for w in query.split() if len(w) > 1]
        if not words:
            # Fallback for single characters or empty strings
            words = [query] if query else []
            if not words: return None

        word_clauses = []
        for word in words:
            # For each word, it must match at least ONE of the search fields (OR logic between fields)
            field_clauses = []
            
            # Normalization for RUTs/Codes for this specific word
            clean_word = re.sub(r"[.\-]", "", word)
            
            for field in search_fields:
                # 1. Standard search
                field_clauses.append(Q(**{f"{field}__icontains": word}))

                # 2. Enhanced Tax/RUT/Code matching
                is_tax_field = any(term in field.lower() for term in ["tax_id", "rut", "identification", "code"])
                if is_tax_field:
                    # Case A: User typed symbols (88.222), search also without them
                    if clean_word != word:
                        field_clauses.append(Q(**{f"{field}__icontains": clean_word}))
                    
                    # Case B: User typed clean (88222), match formatted (88.222.333-k)
                    # We use a regex to allow dots/dashes between characters
                    if word.isalnum() and len(word) >= 3 and _is_postgres():
                        # Pattern: 8[.-]?8[.-]?2...
                        regex_pattern = "[.-]?".join(list(word))
                        field_clauses.append(Q(**{f"{field}__iregex": regex_pattern}))

            # Combine field clauses with OR for this specific word
            word_clauses.append(reduce(operator.or_, field_clauses))

        # 2. Combine all word clauses with AND
        # This means all words typed by the user must be present in the record
        return reduce(operator.and_, word_clauses)

    @staticmethod
    def _render(template: str, instance: models.Model) -> str:
        try:
            return template.format_map(_DotAccessor(instance))
        except Exception:
            return str(instance)
