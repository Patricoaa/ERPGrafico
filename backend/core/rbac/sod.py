"""Segregation of Duties (SoD) rules for the RBAC system.

SOD_RULES defines pairs of bundles that create a conflict when held by the
same actor (user or group).  All rules currently use mode="warn": the system
logs the conflict and returns warnings but does not block the assignment.
"""

from __future__ import annotations

from typing import Literal, TypedDict


class SodRule(TypedDict):
    key: str
    label: str
    bundles: tuple[str, str]  # two bundle keys that conflict
    mode: Literal["warn", "block"]


class SodWarning(TypedDict):
    rule: str   # SodRule key
    label: str
    user: str   # username or "group-level check"


SOD_RULES: list[SodRule] = [
    {
        "key": "purchasing_treasury",
        "label": "Compras + Tesorería",
        "bundles": ("purchasing.manage", "treasury.payments"),
        "mode": "warn",
    },
    {
        "key": "sales_billing",
        "label": "Ventas + Facturación completa",
        "bundles": ("sales.manage", "billing.manage"),
        "mode": "warn",
    },
    {
        "key": "payroll_accounting",
        "label": "Nómina + Contabilidad",
        "bundles": ("hr.payroll", "accounting.manage"),
        "mode": "warn",
    },
    {
        "key": "hr_treasury",
        "label": "RRHH + Tesorería",
        "bundles": ("hr.payroll", "treasury.payments"),
        "mode": "warn",
    },
]
