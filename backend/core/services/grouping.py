"""
Server-side grouping of a list (ADR-0158 §7, collection-toolbar §7.1).

`list_groups` answers `GET <list>/groups/?group_by=<name>&<filters>` with one query over the
same filtered queryset as the list: `values(<field>[, <label>]).annotate(count, sums)`.
Each group carries the list params that select its rows, so the client never needs to know
the filter names.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from django.core.exceptions import FieldDoesNotExist
from django.db.models import Count, QuerySet, Sum
from rest_framework.exceptions import ValidationError


@dataclass(frozen=True)
class GroupField:
    """A field a list can be grouped by.

    - `field`: ORM path whose value is the group key (`"status"`, `"customer"`, `"date"`).
    - `label`: ORM path of the group's label, for relations (`"customer__name"`). Without it the
      label comes from the field's `choices`, or is `null` (the client formats the key).
    - `param`: list filter that selects one group's rows (`?<param>=<key>`); default the group name.
    - `null_param`: list filter that selects the rows without a value (`?<null_param>=true`). Without
      it, the "no value" group has no `params` and its rows cannot be listed.
    """

    field: str
    label: str | None = None
    param: str | None = None
    null_param: str | None = None


def _choices(model: type, path: str) -> dict[Any, str]:
    if "__" in path:
        return {}
    try:
        field = model._meta.get_field(path)
    except FieldDoesNotExist:
        return {}
    return {value: str(label) for value, label in (getattr(field, "flatchoices", None) or [])}


def _decimal_places(model: type, path: str) -> int | None:
    """Scale of the summed field, so sums read like the list (`"150.00"`), whatever the database returns."""
    target = model
    *relations, last = path.split("__")
    try:
        for name in relations:
            target = target._meta.get_field(name).related_model
        return getattr(target._meta.get_field(last), "decimal_places", None)
    except (FieldDoesNotExist, AttributeError):
        return None


def _amount(value: Any, places: int | None) -> str:
    amount = Decimal(value if value is not None else 0)
    return str(amount.quantize(Decimal(1).scaleb(-places)) if places is not None else amount)


def _key(value: Any) -> str | None:
    if value is None:
        return None
    return value.isoformat() if hasattr(value, "isoformat") else str(value)


def _direction(spec: GroupField, ordering: str | None) -> tuple[str, bool] | None:
    """`("field" | "label", descending)` when the list ordering names the grouped field."""
    for raw in (ordering or "").split(","):
        name = raw.strip()
        bare = name.lstrip("-")
        if bare == spec.field:
            return "field", name.startswith("-")
        if spec.label and bare == spec.label:
            return "label", name.startswith("-")
    return None


def list_groups(
    queryset: QuerySet,
    name: str | None,
    fields: dict[str, GroupField],
    aggregates: dict[str, str],
    ordering: str | None = None,
) -> list[dict[str, Any]]:
    """Groups of the filtered list, in display order. One query, whatever the row count."""
    if not name or name not in fields:
        raise ValidationError({"group_by": f"Valores posibles: {', '.join(sorted(fields)) or '(ninguno)'}."})
    spec = fields[name]
    model = queryset.model
    # Subquery on the pks: joins of the list filters (search across lines) cannot inflate the sums.
    base = model._default_manager.filter(pk__in=queryset.order_by().values("pk")).order_by()
    values = [spec.field] + ([spec.label] if spec.label else [])
    sums = {f"_agg_{key}": Sum(path) for key, path in aggregates.items()}
    rows = base.values(*values).annotate(_count=Count("pk"), **sums)

    places = {key: _decimal_places(model, path) for key, path in aggregates.items()}
    choices = _choices(model, spec.field)
    param = spec.param or name
    groups: list[dict[str, Any]] = []
    for row in rows:
        value = row[spec.field]
        key = _key(value)
        # Plain values (dates, numbers) have no label: the client formats the key with the field kind.
        label = row[spec.label] if spec.label else choices.get(value)
        if key is not None:
            params: dict[str, str] | None = {param: key}
        elif spec.null_param:
            params = {spec.null_param: "true"}
        else:
            params = None
        groups.append({
            "key": key,
            "label": None if label is None else str(label),
            "count": row["_count"],
            "aggregates": {k: _amount(row[f"_agg_{k}"], places[k]) for k in aggregates},
            "params": params,
            "_sort": value,
        })

    direction = _direction(spec, ordering)
    if direction and direction[0] == "field":
        present = sorted((g for g in groups if g["key"] is not None), key=lambda g: g["_sort"], reverse=direction[1])
    else:
        descending = bool(direction and direction[1])
        present = sorted((g for g in groups if g["key"] is not None), key=lambda g: (g["label"] or "").casefold(), reverse=descending)
    # The "no value" group always goes last.
    ordered = present + [g for g in groups if g["key"] is None]
    for group in ordered:
        del group["_sort"]
    return ordered
