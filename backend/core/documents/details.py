"""Textos de detalle de DocumentRef por tipo (ADR-0083): lo que distingue a un documento en una lista."""

from __future__ import annotations

from decimal import Decimal


def join(*parts: object) -> str | None:
    text = " · ".join(str(p) for p in parts if p not in (None, ""))
    return text or None


def display(obj, field: str) -> str | None:
    getter = getattr(obj, f"get_{field}_display", None)
    return getter() if callable(getter) and getattr(obj, field, None) else None


def quantity(value) -> str:
    value = Decimal(value or 0)
    return f"{value.normalize():f}" if value == value.to_integral() else f"{value:.2f}"


def lines_count(obj, related: str = "lines") -> str | None:
    manager = getattr(obj, related, None)
    if manager is None:
        return None
    n = manager.count()
    return f"{n} línea" if n == 1 else f"{n} líneas"
