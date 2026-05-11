"""
UniversalRegistry — central catalog of searchable ERP entities.

Each app registers its entities in AppConfig.ready().
The search view calls UniversalRegistry.search() with the authenticated user
so permission filtering happens server-side.
"""

from __future__ import annotations

import logging
import operator
import re
from dataclasses import dataclass, field
from functools import reduce
from typing import Any, ClassVar

from django.db import connection as _db_connection
from django.db import models
from django.db.models import Q

logger = logging.getLogger(__name__)


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
        
        # Connect indexing signals
        cls._connect_signals_for_entity(entity)

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

        logger.debug(f"Search started: query='{query}', user='{user}'")
        
        results: list[dict[str, Any]] = []
        
        # 1. Identify if the query has a canonical prefix (e.g., "NV-", "OCS-")
        # We find the best matching prefix and strip it to search for the core identifier.
        targeted_entities = []
        clean_query = query
        best_prefix_len = 0
        
        for label, entity in cls._entities.items():
            # Extract constant prefix (e.g., "NV-{number}" -> "NV-")
            m = re.match(r"^([^{]+)\{", entity.short_display_template)
            if not m:
                continue
                
            raw_prefix = m.group(1)
            # Clean version for flexible matching (e.g., "NV-" -> "NV")
            clean_prefix = re.sub(r"[^a-zA-Z0-9]+$", "", raw_prefix).upper()
            if not clean_prefix:
                continue
                
            q_upper = query.upper()
            
            # Match if query starts with the prefix letters (e.g., "NV100" or "NV-100" matches "NV-")
            # We ensure it's a true prefix by checking if it's followed by a non-letter or if it's the whole query.
            if q_upper == clean_prefix or (
                q_upper.startswith(clean_prefix) and not q_upper[len(clean_prefix)].isalpha()
            ):
                # We skip the prefix letters and any common separators in the user's query
                match_len = len(clean_prefix)
                remaining = query[match_len:].lstrip(" -./_:")
                
                if len(clean_prefix) > best_prefix_len:
                    best_prefix_len = len(clean_prefix)
                    targeted_entities = [label]
                    clean_query = remaining
                elif len(clean_prefix) == best_prefix_len:
                    targeted_entities.append(label)

        # 2. Perform Unified Search using GlobalSearchIndex
        from core.models import GlobalSearchIndex
        from django.contrib.postgres.search import SearchRank, SearchQuery
        from django.db.models import F

        # Filter by allowed entities (Permission check at DB level for performance and correctness)
        allowed_labels = [
            label for label, entity in cls._entities.items()
            if not entity.permission or user.has_perm(entity.permission)
        ]
        
        if not cls._entities:
            logger.warning("UniversalRegistry search called but NO entities are registered.")
            return []

        # If user has no permissions for any searchable entity, return empty
        if not allowed_labels:
            logger.info(f"User '{user}' has no permissions for any searchable entity. Registered: {list(cls._entities.keys())}")
            return []

        # Prepare Query Term and SearchQuery
        q_term = clean_query if targeted_entities else query
        
        logger.debug(f"Search parameters: q_term='{q_term}', targeted={targeted_entities}, allowed={len(allowed_labels)}")
        
        # Use websearch for FTS as it handles most user inputs gracefully.
        # Prefix matching (e.g., "NV-1") is handled by the icontains filter on denormalized fields.
        if q_term:
            sq = SearchQuery(q_term, config='spanish', search_type='websearch')
        else:
            sq = None

        # Base QuerySet
        qs = GlobalSearchIndex.objects.filter(entity_label__in=allowed_labels)
        
        # Build Filter
        q_filter = Q()
        if sq:
            q_filter |= Q(search_vector=sq)
            # Fallback to icontains for exact substring matches (e.g. middle of a code)
            q_filter |= Q(title__icontains=q_term) | Q(subtitle__icontains=q_term)

        # Enhanced RUT logic for the unified index (Search across denormalized display fields)
        if q_term.isalnum() and len(q_term) >= 3:
             # If the query is clean alphanumeric, try to match formatted patterns in display fields
             regex_pattern = "[.-]?".join(list(q_term))
             q_filter |= Q(title__iregex=regex_pattern) | Q(subtitle__iregex=regex_pattern)

        # Filter by targeted entities if prefix detected
        if targeted_entities:
            # Intersect allowed with targeted
            final_targets = [t for t in targeted_entities if t in allowed_labels]
            qs = qs.filter(entity_label__in=final_targets)

        # Annotate rank only if we have a search query
        if sq:
            qs = qs.annotate(rank=SearchRank(F('search_vector'), sq))
            qs = qs.filter(q_filter).order_by("-rank", "-last_updated")
        else:
            qs = qs.order_by("-last_updated")

        # Collect results
        final_results = []
        full_qs = qs[:limit]
        
        logger.debug(f"Search Queryset: {full_qs.query}")
        
        for idx in full_qs:
            entity = cls._entities.get(idx.entity_label)
            if not entity:
                continue

            final_results.append({
                "label": idx.entity_label,
                "title": entity.title_singular,
                "title_plural": entity.title_plural,
                "icon": entity.icon,
                "id": idx.object_id,
                "short_display": idx.title, # Title in index is already rendered
                "display": idx.title,
                "subtitle": idx.subtitle,
                "extra_info": idx.extra_info,
                "list_url": entity.list_url,
                "detail_url": entity.detail_url_pattern.replace("{id}", str(idx.object_id)),
            })

            if len(final_results) >= limit:
                break

        # Fallback: if no results found and it was a targeted search for just a prefix, 
        # show recent items from the index for that entity.
        if not final_results and targeted_entities and not (clean_query if targeted_entities else query):
             for idx in GlobalSearchIndex.objects.filter(entity_label__in=targeted_entities).order_by("-last_updated")[:limit]:
                entity = cls._entities.get(idx.entity_label)
                if entity and (not entity.permission or user.has_perm(entity.permission)):
                    final_results.append({
                        "label": idx.entity_label,
                        "title": entity.title_singular,
                        "title_plural": entity.title_plural,
                        "icon": entity.icon,
                        "id": idx.object_id,
                        "short_display": idx.title,
                        "display": idx.title,
                        "subtitle": idx.subtitle,
                        "extra_info": idx.extra_info,
                        "list_url": entity.list_url,
                        "detail_url": entity.detail_url_pattern.replace("{id}", str(idx.object_id)),
                    })
                    if len(final_results) >= limit: break

        return final_results

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

    @classmethod
    def update_index(cls, instance: models.Model) -> None:
        """Updates the GlobalSearchIndex for the given instance."""
        entity = cls.get_for_model(instance.__class__)
        if not entity:
            return

        from django.contrib.contenttypes.models import ContentType
        from django.contrib.postgres.search import SearchVector
        from core.models import GlobalSearchIndex

        # 1. Get or create index entry
        ct = ContentType.objects.get_for_model(instance.__class__)
        idx, _ = GlobalSearchIndex.objects.get_or_create(
            content_type=ct,
            object_id=str(instance.pk),
            defaults={"entity_label": entity.label}
        )

        # 2. Update display fields
        idx.title = cls._render(entity.display_template, instance)
        idx.subtitle = cls._render(entity.subtitle_template, instance)
        idx.extra_info = cls._render(entity.extra_info_template, instance)
        idx.icon = entity.icon
        idx.entity_label = entity.label
        idx.save()

        # 3. Update search vector (calculated from original model fields)
        # We now include ALL search fields, including related ones (__)
        fts_fields = entity.search_fields
        if fts_fields:
            # We annotate the vector on the original instance to get its value
            # Django's SearchVector handles foreign key traversals correctly in annotate()
            try:
                instance_with_vector = instance.__class__.objects.annotate(
                    computed_vector=SearchVector(*fts_fields, config='spanish')
                ).get(pk=instance.pk)
                
                idx.search_vector = instance_with_vector.computed_vector
                idx.save()
            except Exception as e:
                # Log error but don't fail indexing if vector fails (e.g. non-string fields)
                # We still have title/subtitle for icontains search
                pass

    @classmethod
    def remove_from_index(cls, instance: models.Model) -> None:
        """Removes the instance from GlobalSearchIndex."""
        from django.contrib.contenttypes.models import ContentType
        from core.models import GlobalSearchIndex

        ct = ContentType.objects.get_for_model(instance.__class__)
        GlobalSearchIndex.objects.filter(content_type=ct, object_id=str(instance.pk)).delete()

    @classmethod
    def _connect_signals_for_entity(cls, entity: SearchableEntity) -> None:
        """Connects indexing signals to a specific entity model."""
        from django.db.models.signals import post_save, post_delete
        
        def _on_save(sender, instance, **kwargs):
            cls.update_index(instance)
            
        def _on_delete(sender, instance, **kwargs):
            cls.remove_from_index(instance)

        post_save.connect(_on_save, sender=entity.model, dispatch_uid=f"search_index_save_{entity.label}")
        post_delete.connect(_on_delete, sender=entity.model, dispatch_uid=f"search_index_delete_{entity.label}")

    @staticmethod
    def _render(template: str, instance: models.Model) -> str:
        try:
            return template.format_map(_DotAccessor(instance))
        except Exception:
            return str(instance)
