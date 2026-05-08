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
    icon: str                       # lucide icon name, e.g. 'receipt-text'
    search_fields: tuple[str, ...]  # ORM field lookups, e.g. ('number', 'customer__name')
    display_template: str           # Python str.format_map template, e.g. 'NV-{number}'
    list_url: str                   # frontend route, e.g. '/ventas/ordenes'
    detail_url_pattern: str         # frontend route with {id}, e.g. '/ventas/ordenes/{id}'
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
        return str(obj)


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
        Full-text search across all registered entities.

        Returns a list of result dicts, sorted by entity label then pk,
        trimmed to `limit` total results.
        """
        query = query.strip()
        if not query:
            return []

        results: list[dict[str, Any]] = []

        for label, entity in cls._entities.items():
            if entity.permission and not user.has_perm(entity.permission):
                continue

            q_filter = cls._build_icontains_filter(query, entity.search_fields)
            if q_filter is None:
                continue

            qs = entity.model.objects.filter(q_filter, **entity.extra_filters)[:limit]

            for instance in qs:
                results.append(
                    {
                        "label": label,
                        "icon": entity.icon,
                        "id": instance.pk,
                        "display": cls._render(entity.display_template, instance),
                        "list_url": entity.list_url,
                        "detail_url": entity.detail_url_pattern.replace("{id}", str(instance.pk)),
                    }
                )
                if len(results) >= limit:
                    return results

        return results

    @staticmethod
    def _build_icontains_filter(query: str, search_fields: tuple[str, ...]) -> Q | None:
        if not search_fields:
            return None
        clauses = [Q(**{f"{field}__icontains": query}) for field in search_fields]
        return reduce(operator.or_, clauses)

    @staticmethod
    def _render(template: str, instance: models.Model) -> str:
        try:
            return template.format_map(_DotAccessor(instance))
        except Exception:
            return str(instance)
