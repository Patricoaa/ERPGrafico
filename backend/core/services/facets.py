"""
Facet counts of a list (ADR-0158 §8, collection-toolbar §7.2).

`GET <list>/facets/?fields=<param>,<param>&<filters>` answers, for each requested filter, how many
rows each of its options would leave with the other active filters applied: the filter's own value
is left out (standard facet semantics), so picking one option does not zero the rest.
"""

from __future__ import annotations

from collections.abc import Callable, Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Any

from django.db.models import Count, QuerySet
from rest_framework.exceptions import ValidationError


@dataclass(frozen=True)
class FacetField:
    """A list filter whose options get counts.

    - `field`: ORM path of a column the filter compares to: one grouped query
      (`values(field).annotate(count)`).
    - `values`: the options of a filter that is not a plain column (a `FilterSet` method): one count per
      option, applying the filter with that value. The query count follows the options, not the rows;
      never use it for a filter evaluated in Python over the whole list.
    - `params`: list params of the filter, all left out while counting (default: the facet name).
    """

    field: str | None = None
    values: tuple[str, ...] = ()
    params: tuple[str, ...] = ()


@contextmanager
def _without(request: Any, params: tuple[str, ...], extra: dict[str, str] | None = None) -> Iterator[None]:
    """Temporarily drops `params` from the request query (and sets `extra`): the list's own
    `filter_queryset` / selector then filter exactly like the list, minus that filter."""
    original = request._request.GET
    query = original.copy()
    for name in params:
        query.pop(name, None)
    for name, value in (extra or {}).items():
        query[name] = value
    request._request.GET = query
    try:
        yield
    finally:
        request._request.GET = original


def facet_counts(
    request: Any,
    names: list[str],
    fields: dict[str, FacetField],
    filtered: Callable[[], QuerySet],
) -> dict[str, list[dict[str, Any]]]:
    unknown = [n for n in names if n not in fields]
    if unknown:
        raise ValidationError({"fields": f"Valores posibles: {', '.join(sorted(fields)) or '(ninguno)'}."})
    result: dict[str, list[dict[str, Any]]] = {}
    for name in names:
        spec = fields[name]
        params = spec.params or (name,)
        if spec.field:
            with _without(request, params):
                queryset = filtered()
            model = queryset.model
            # Subquery on the pks: the joins of other filters cannot inflate the counts.
            rows = (
                model._default_manager.filter(pk__in=queryset.order_by().values("pk"))
                .order_by()
                .values(spec.field)
                .annotate(_count=Count("pk", distinct=True))
            )
            result[name] = [
                {"value": str(row[spec.field]), "count": row["_count"]}
                for row in rows
                if row[spec.field] is not None
            ]
        else:
            counts = []
            for value in spec.values:
                with _without(request, params, {params[0]: value}):
                    counts.append({"value": value, "count": filtered().order_by().count()})
            result[name] = counts
    return result
