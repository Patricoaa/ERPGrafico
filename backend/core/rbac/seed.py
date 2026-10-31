"""Seeded roles (puestos de trabajo) for the RBAC system.

SEEDED_ROLES defines the 11 canonical roles of the system as specified in
spec §2.1.  Each entry maps a stable key to a SeededRole descriptor that
carries the role's display name, description, bundle list and is_system flag.

Rules:
  - Keys are stable, snake_case identifiers.  Never rename them.
  - The display name (``name``) may be translated but must match the seeded
    Group name so ``sync_permissions`` can locate the right Group.
  - ``bundles`` must reference valid keys from ``core.rbac.bundles.BUNDLES``.
  - ``is_system=True`` marks roles that may not be renamed or deleted by
    users with admin privileges.
"""

from __future__ import annotations

from typing import TypedDict


class SeededRole(TypedDict):
    name: str
    description: str
    bundles: list[str]
    is_system: bool


# ---------------------------------------------------------------------------
# Module apps — for building full read+operate+manage lists
# ---------------------------------------------------------------------------
_ALL_MODULE_APPS: list[str] = [
    "billing",
    "sales",
    "purchasing",
    "accounting",
    "treasury",
    "hr",
    "production",
    "inventory",
    "contacts",
    "tax",
    "workflow",
    "core",
    "finances",
]

_ALL_MODULE_BUNDLES: list[str] = [
    f"{app}.{level}"
    for app in _ALL_MODULE_APPS
    for level in ("read", "operate", "manage")
]

_ALL_SENSITIVE_BUNDLES: list[str] = [
    "core.security",
    "hr.payroll",
    "hr.salary_advances",
    "treasury.payments",
    "treasury.credit_cards",
    "treasury.bank_loans",
    "contacts.profit_distribution",
    "tax.declarations",
    "accounting.fiscal_year",
]

_ALL_READ_BUNDLES: list[str] = [f"{app}.read" for app in _ALL_MODULE_APPS]

# Sensitive bundles excluded from Gerencia
_GERENCIA_EXCLUDED_SENSITIVE: frozenset[str] = frozenset({
    "hr.payroll",
    "hr.salary_advances",
    "treasury.payments",
    "treasury.credit_cards",
    "treasury.bank_loans",
    "contacts.profit_distribution",
})

_GERENCIA_BUNDLES: list[str] = [
    b for b in _ALL_MODULE_BUNDLES if b not in _GERENCIA_EXCLUDED_SENSITIVE
]


# ---------------------------------------------------------------------------
# SEEDED_ROLES — stable, keyed dictionary of the 11 canonical roles
# ---------------------------------------------------------------------------

SEEDED_ROLES: dict[str, SeededRole] = {
    "sysadmin": SeededRole(
        name="Administrador del sistema",
        description=(
            "Acceso completo al sistema incluyendo gestión de usuarios, grupos, "
            "permisos y todas las capacidades sensibles. No puede ser eliminado ni "
            "renombrado."
        ),
        bundles=_ALL_MODULE_BUNDLES + _ALL_SENSITIVE_BUNDLES,
        is_system=True,
    ),
    "gerencia": SeededRole(
        name="Gerencia",
        description=(
            "Acceso de lectura, operación y gestión de todos los módulos excepto "
            "nómina, anticipos de sueldo, movimientos de tesorería, tarjetas de "
            "crédito, créditos bancarios y distribución de utilidades."
        ),
        bundles=_GERENCIA_BUNDLES,
        is_system=False,
    ),
    "ventas": SeededRole(
        name="Ventas",
        description=(
            "Operación completa del módulo de ventas y facturación. "
            "Lectura de inventario."
        ),
        bundles=[
            "sales.read",
            "sales.operate",
            "billing.read",
            "billing.operate",
            "inventory.read",
        ],
        is_system=False,
    ),
    "bodega": SeededRole(
        name="Bodega y Despacho",
        description=(
            "Operación de inventario, lectura de ventas y producción. "
            "Ideal para encargados de bodega y despacho."
        ),
        bundles=[
            "inventory.read",
            "inventory.operate",
            "sales.read",
            "production.read",
        ],
        is_system=False,
    ),
    "produccion": SeededRole(
        name="Producción",
        description=(
            "Operación del módulo de producción y lectura de inventario. "
            "Para operarios de planta."
        ),
        bundles=[
            "production.read",
            "production.operate",
            "inventory.read",
        ],
        is_system=False,
    ),
    "jefatura_produccion": SeededRole(
        name="Jefatura de Producción",
        description=(
            "Gestión completa del módulo de producción y operación de inventario. "
            "Para supervisores y jefes de producción."
        ),
        bundles=[
            "production.read",
            "production.operate",
            "production.manage",
            "inventory.read",
            "inventory.operate",
        ],
        is_system=False,
    ),
    "admin_finanzas": SeededRole(
        name="Administración y Finanzas",
        description=(
            "Gestión completa del módulo contable, movimientos de tesorería, "
            "créditos bancarios y lectura de recursos humanos."
        ),
        bundles=[
            "accounting.read",
            "accounting.operate",
            "accounting.manage",
            "treasury.payments",
            "treasury.bank_loans",
            "hr.read",
        ],
        is_system=False,
    ),
    "contabilidad": SeededRole(
        name="Contabilidad",
        description=(
            "Gestión completa del módulo contable incluyendo ejercicio fiscal. "
            "Para contadores."
        ),
        bundles=[
            "accounting.read",
            "accounting.operate",
            "accounting.manage",
            "accounting.fiscal_year",
        ],
        is_system=False,
    ),
    "rrhh": SeededRole(
        name="RRHH",
        description=(
            "Gestión completa del módulo de recursos humanos incluyendo "
            "nómina y anticipos de sueldo."
        ),
        bundles=[
            "hr.read",
            "hr.operate",
            "hr.manage",
            "hr.payroll",
            "hr.salary_advances",
        ],
        is_system=False,
    ),
    "tesorero": SeededRole(
        name="Tesorero",
        description=(
            "Gestión completa del módulo de tesorería incluyendo movimientos, "
            "tarjetas de crédito y créditos bancarios."
        ),
        bundles=[
            "treasury.read",
            "treasury.operate",
            "treasury.manage",
            "treasury.payments",
            "treasury.credit_cards",
            "treasury.bank_loans",
        ],
        is_system=False,
    ),
    "auditor": SeededRole(
        name="Auditor",
        description=(
            "Acceso de lectura a todos los módulos del sistema. "
            "Sin acceso a capacidades sensibles ni operaciones de modificación."
        ),
        bundles=_ALL_READ_BUNDLES,
        is_system=False,
    ),
}
