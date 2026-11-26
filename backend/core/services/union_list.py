"""
One list over two document types (ADR-0158 §7, collection-toolbar §7.1): deliveries + returns,
receipts + returns. Each source is an existing list viewset; its filters, search, permissions,
queryset and serializer are reused as they are, so the combined list filters like each list.

- Rows: a SQL `UNION` of the source keys (kind, pk and the sortable columns), ordered and
  paginated in the database; the page is then loaded with each source's list queryset and serializer.
  Queries: count + page + one load per source present on the page.
- Groups: each source's `groups/` (`list_groups`) merged by key; `type` groups are the sources.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any

from django.db.models import CharField, Count, F, Sum, Value
from django.db.models.expressions import Combinable
from django.http import QueryDict
from rest_framework.exceptions import ValidationError

from core.services.grouping import list_groups

KIND_PARAM = "fulfillment_type"


@dataclass(frozen=True)
class UnionSource:
    """A list viewset in the combined list.

    - `kind`: value of `fulfillment_type` for its rows (and its `type` group key).
    - `columns`: union column → ORM path or expression on the source (`date`, `number`, …). Every
      source declares the same columns: they are what the combined list sorts by.
    """

    kind: str
    label: str
    viewset: type
    columns: dict[str, str | Combinable] = field(default_factory=dict)


def _source_view(source: UnionSource, request: Any) -> Any:
    """The source viewset bound to this request as its `list` action: permissions are checked."""
    instance = source.viewset(request=request, format_kwarg=None, args=(), kwargs={}, action="list")
    instance.headers = {}
    instance.check_permissions(request)
    return instance


def _filtered(source_view: Any, request: Any) -> Any:
    """Source queryset with the list filters but without `ordering` (the union orders)."""
    original = request._request.GET
    query: QueryDict = original.copy()
    query.pop("ordering", None)
    request._request.GET = query
    try:
        return source_view.filter_queryset(source_view.get_queryset())
    finally:
        request._request.GET = original


def _wanted(sources: list[UnionSource], request: Any) -> list[UnionSource]:
    raw = request.query_params.get(KIND_PARAM)
    if not raw:
        return sources
    kinds = set(raw.split(","))
    return [s for s in sources if s.kind in kinds]


def _ordering(raw: str | None, aliases: dict[str, str], default: list[str]) -> list[str]:
    """DRF `ordering` (entity `orderBy` keys) → union columns; unknown keys are dropped."""
    keys = [k for k in (raw or "").split(",") if k] or default
    out = []
    for key in keys:
        desc = key.startswith("-")
        column = aliases.get(key.lstrip("-"))
        if column:
            out.append(f"-{column}" if desc else column)
    return [*out, "-u_pk"] if out else ["-u_date", "-u_pk"]


def union_page(
    sources: list[UnionSource],
    request: Any,
    view: Any,
    aliases: dict[str, str],
    default_ordering: list[str],
) -> tuple[Any, list[dict[str, Any]]]:
    """(paginator, serialized rows) of the combined list; every row carries `fulfillment_type`."""
    wanted = _wanted(sources, request)
    views = {s.kind: _source_view(s, request) for s in wanted}
    keys = []
    for source in wanted:
        cols = {f"u_{name}": F(path) if isinstance(path, str) else path for name, path in source.columns.items()}
        keys.append(
            _filtered(views[source.kind], request)
            .order_by()
            .annotate(u_kind=Value(source.kind, output_field=CharField()), u_pk=F("pk"), **cols)
            .values("u_kind", "u_pk", *cols)
        )
    if not keys:
        return None, []
    combined = keys[0].union(*keys[1:], all=True) if len(keys) > 1 else keys[0]
    combined = combined.order_by(*_ordering(request.query_params.get("ordering"), aliases, default_ordering))

    paginator = view.paginator
    page = paginator.paginate_queryset(combined, request, view=view)
    by_kind: dict[str, list[int]] = {}
    for row in page:
        by_kind.setdefault(row["u_kind"], []).append(row["u_pk"])
    loaded: dict[tuple[str, int], dict[str, Any]] = {}
    for kind, pks in by_kind.items():
        source_view = views[kind]
        objects = source_view.get_queryset().filter(pk__in=pks)
        serializer = source_view.get_serializer(objects, many=True)
        for obj, data in zip(objects, serializer.data):
            loaded[(kind, obj.pk)] = {**data, KIND_PARAM: kind}
    rows = [loaded[(r["u_kind"], r["u_pk"])] for r in page if (r["u_kind"], r["u_pk"]) in loaded]
    return paginator, rows


def _sum(a: str | None, b: str | None) -> str | None:
    if a is None:
        return b
    if b is None:
        return a
    total = Decimal(a) + Decimal(b)
    places = max(-Decimal(a).as_tuple().exponent, -Decimal(b).as_tuple().exponent, 0)
    return str(total.quantize(Decimal(1).scaleb(-places)))


def union_groups(sources: list[UnionSource], request: Any, view: Any, aggregate: str | None) -> list[dict[str, Any]]:
    """`groups/` of the combined list: each source's groups merged by key, or one group per source
    for `group_by=type`. Dates are newest first; other groups follow their label."""
    group_by = request.query_params.get("group_by")
    wanted = _wanted(sources, request)
    if group_by == "type":
        groups = []
        for source in wanted:
            source_view = _source_view(source, request)
            agg_path = source_view.group_aggregates.get(aggregate) if aggregate else None
            totals = _filtered(source_view, request).order_by().aggregate(
                _count=Count("pk", distinct=True), **({"_sum": Sum(agg_path)} if agg_path else {})
            )
            if not totals["_count"]:
                continue
            aggregates = {aggregate: str(totals.get("_sum") or 0)} if agg_path else {}
            groups.append({"key": source.kind, "label": source.label, "count": totals["_count"], "aggregates": aggregates, "params": {KIND_PARAM: source.kind}})
        return groups

    merged: dict[str | None, dict[str, Any]] = {}
    for source in wanted:
        source_view = _source_view(source, request)
        if group_by not in source_view.group_fields:
            raise ValidationError({"group_by": f"Valores posibles: type, {', '.join(sorted(source_view.group_fields))}."})
        for group in list_groups(_filtered(source_view, request), group_by, source_view.group_fields, source_view.group_aggregates, None):
            current = merged.get(group["key"])
            if current is None:
                merged[group["key"]] = {**group, "aggregates": dict(group["aggregates"])}
                continue
            current["count"] += group["count"]
            current["label"] = current["label"] or group["label"]
            for name, value in group["aggregates"].items():
                current["aggregates"][name] = _sum(current["aggregates"].get(name), value)
    groups = list(merged.values())
    if group_by == "date":
        # Newest first, like the list; `ordering=date` (ascending) flips it. Undated groups go last.
        newest_first = not (request.query_params.get("ordering") or "").startswith("date")
        dated = sorted((g for g in groups if g["key"]), key=lambda g: g["key"], reverse=newest_first)
        groups = dated + [g for g in groups if not g["key"]]
    else:
        groups.sort(key=lambda g: (g["label"] is None, (g["label"] or "").casefold(), g["key"] or ""))
    return groups
