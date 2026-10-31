"""Permission bundle definitions and expansion for the RBAC system.

Bundles are named sets of permissions that can be granted as a unit.

Three categories:
  - Module-level bundles ({app}.read / {app}.operate / {app}.manage) – cumulative;
    read ⊂ operate ⊂ manage for non-sensitive perms.
  - Sensitive capability bundles (e.g. hr.payroll, core.security) – cross-cutting
    sets that require explicit, separate granting.

The ``sensitive`` flag on a module bundle is always False; on a sensitive bundle
it is always True.  The expansion rules guarantee that no sensitive permission
ever appears in an {app}.operate or {app}.manage module bundle.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Iterable

if TYPE_CHECKING:
    pass

# ---------------------------------------------------------------------------
# TypedDict
# ---------------------------------------------------------------------------
from typing import TypedDict


class Bundle(TypedDict):
    key: str
    label: str
    description: str
    sensitive: bool


# ---------------------------------------------------------------------------
# Apps that have module-level bundles (read / operate / manage)
# ---------------------------------------------------------------------------
_MODULE_APPS: list[str] = [
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

# ---------------------------------------------------------------------------
# Sensitive capability bundles: explicit permission sets
# These perms are EXCLUDED from every {app}.operate and {app}.manage bundle.
# NOTE: only include permissions that actually exist in the catalog; unknown
# strings are silently dropped by expand() via catalog filtering.
# ---------------------------------------------------------------------------
_SENSITIVE_PERM_SETS: dict[str, frozenset[str]] = {
    "hr.payroll": frozenset({
        "hr.view_payroll",
        "hr.add_payroll",
        "hr.change_payroll",
        "hr.delete_payroll",
        "hr.post_payroll",
        "hr.pay_payroll",
        "hr.annul_payrollpayment",
        # hr.pay_payrollpayment doesn't exist in current schema; omitted
    }),
    "hr.salary_advances": frozenset({
        "hr.view_salaryadvance",
        "hr.add_salaryadvance",
        "hr.change_salaryadvance",
        "hr.delete_salaryadvance",
        "hr.annul_salaryadvance",
    }),
    "treasury.payments": frozenset({
        "treasury.view_treasurymovement",
        "treasury.add_treasurymovement",
        "treasury.change_treasurymovement",
        "treasury.annul_treasurymovement",
        "treasury.cancel_treasurymovement",
        "treasury.confirm_bankstatement",
        "treasury.close_possession",
    }),
    "treasury.credit_cards": frozenset({
        # creditcardstatement model (add/change/delete/view)
        "treasury.view_creditcardstatement",
        "treasury.add_creditcardstatement",
        "treasury.change_creditcardstatement",
        "treasury.delete_creditcardstatement",
        # registered business verbs
        "treasury.pay_creditcardstatement",
        "treasury.cancel_creditcardstatement",
        "treasury.reverse_creditcardstatement",
    }),
    "treasury.bank_loans": frozenset({
        # bankloan model
        "treasury.view_bankloan",
        "treasury.add_bankloan",
        "treasury.change_bankloan",
        # registered business verbs
        "treasury.post_bankloan",
        "treasury.pay_loaninstallment",
    }),
    "contacts.profit_distribution": frozenset({
        # profitdistribution* models (resolution, line, linedestination, payment)
        "contacts.view_profitdistributionresolution",
        "contacts.view_profitdistributionline",
        "contacts.view_profitdistributionlinedestination",
        "contacts.view_profitdistributionpayment",
        "contacts.add_profitdistributionresolution",
        "contacts.add_profitdistributionline",
        "contacts.add_profitdistributionlinedestination",
        "contacts.add_profitdistributionpayment",
        "contacts.change_profitdistributionresolution",
        "contacts.change_profitdistributionline",
        "contacts.change_profitdistributionlinedestination",
        "contacts.change_profitdistributionpayment",
        # business verbs
        "contacts.approve_profitdistributionresolution",
        "contacts.pay_profitdistributionresolution",
    }),
    "core.security": frozenset({
        # user management
        "core.view_user",
        "core.add_user",
        "core.change_user",
        "core.delete_user",
        # group management (from auth app)
        "auth.view_group",
        "auth.add_group",
        "auth.change_group",
        "auth.delete_group",
        # permission management (from auth app)
        "auth.view_permission",
        "auth.add_permission",
        "auth.change_permission",
        "auth.delete_permission",
        # audit log
        "core.view_actionlog",
    }),
    "tax.declarations": frozenset({
        # f29declaration model
        "tax.view_f29declaration",
        "tax.add_f29declaration",
        "tax.change_f29declaration",
        "tax.delete_f29declaration",
        # f29payment model
        "tax.view_f29payment",
        "tax.add_f29payment",
        "tax.change_f29payment",
        "tax.delete_f29payment",
        # registered business verbs
        "tax.post_f29declaration",
        "tax.annul_f29payment",
    }),
    "accounting.fiscal_year": frozenset({
        "accounting.view_fiscalyear",
        "accounting.change_fiscalyear",
        "accounting.close_fiscalyear",
        "accounting.reopen_fiscalyear",
    }),
}

# Union of all sensitive permissions across all sensitive bundles
_ALL_SENSITIVE: frozenset[str] = frozenset().union(*_SENSITIVE_PERM_SETS.values())

# ---------------------------------------------------------------------------
# OVERRIDES: explicit bundle membership for specific permissions.
# bundles_of() checks here before falling back to computed membership.
# Use this when the systematic rules would produce the wrong result.
# ---------------------------------------------------------------------------
OVERRIDES: dict[str, list[str]] = {
    # view_actionlog is sensitive; we want it listed only under core.security,
    # not also under core.read (which the systematic view_* rule would include).
    "core.view_actionlog": ["core.security"],
}

# ---------------------------------------------------------------------------
# BUNDLES dict — static metadata only (no Django access at import time)
# ---------------------------------------------------------------------------

def _make_module_bundles() -> dict[str, Bundle]:
    result: dict[str, Bundle] = {}
    app_labels = {
        "billing": "Facturación",
        "sales": "Ventas",
        "purchasing": "Compras",
        "accounting": "Contabilidad",
        "treasury": "Tesorería",
        "hr": "RR.HH.",
        "production": "Producción",
        "inventory": "Inventario",
        "contacts": "Contactos",
        "tax": "Tributario",
        "workflow": "Workflow",
        "core": "Sistema",
        "finances": "Finanzas",
    }
    for app in _MODULE_APPS:
        label = app_labels.get(app, app.capitalize())
        result[f"{app}.read"] = Bundle(
            key=f"{app}.read",
            label=f"{label} — Lectura",
            description=f"Acceso de lectura completo al módulo {label}.",
            sensitive=False,
        )
        result[f"{app}.operate"] = Bundle(
            key=f"{app}.operate",
            label=f"{label} — Operador",
            description=(
                f"Crear y modificar registros en {label}. "
                "Incluye lectura. Excluye acciones destructivas y permisos sensibles."
            ),
            sensitive=False,
        )
        result[f"{app}.manage"] = Bundle(
            key=f"{app}.manage",
            label=f"{label} — Gestor",
            description=(
                f"Acceso completo al módulo {label} incluyendo eliminación y "
                "acciones destructivas. No incluye permisos sensibles de capacidades "
                "especiales."
            ),
            sensitive=False,
        )
    return result


_SENSITIVE_BUNDLE_METADATA: dict[str, Bundle] = {
    "hr.payroll": Bundle(
        key="hr.payroll",
        label="Nómina",
        description="Contabilizar, pagar y anular nóminas. Acceso completo al módulo de nómina.",
        sensitive=True,
    ),
    "hr.salary_advances": Bundle(
        key="hr.salary_advances",
        label="Anticipos de Sueldo",
        description="Gestión completa de anticipos de sueldo incluyendo anulación.",
        sensitive=True,
    ),
    "treasury.payments": Bundle(
        key="treasury.payments",
        label="Movimientos de Tesorería",
        description="Crear y anular movimientos de caja, confirmar cartolas, cerrar sesiones de caja.",
        sensitive=True,
    ),
    "treasury.credit_cards": Bundle(
        key="treasury.credit_cards",
        label="Tarjetas de Crédito",
        description="Gestión de tarjetas de crédito: pago, cancelación y reversión de cartolas.",
        sensitive=True,
    ),
    "treasury.bank_loans": Bundle(
        key="treasury.bank_loans",
        label="Créditos Bancarios",
        description="Gestión de créditos bancarios: desembolso y pago de cuotas.",
        sensitive=True,
    ),
    "contacts.profit_distribution": Bundle(
        key="contacts.profit_distribution",
        label="Distribución de Utilidades",
        description="Aprobar y pagar distribuciones de utilidades a socios.",
        sensitive=True,
    ),
    "core.security": Bundle(
        key="core.security",
        label="Seguridad del Sistema",
        description="Gestión de usuarios, grupos y permisos del sistema. Acceso a registros de auditoría.",
        sensitive=True,
    ),
    "tax.declarations": Bundle(
        key="tax.declarations",
        label="Declaraciones Tributarias",
        description="Registrar y anular declaraciones F29. Acceso completo a documentos tributarios.",
        sensitive=True,
    ),
    "accounting.fiscal_year": Bundle(
        key="accounting.fiscal_year",
        label="Ejercicio Fiscal",
        description="Ver, modificar, cerrar y reabrir ejercicios fiscales.",
        sensitive=True,
    ),
}

BUNDLES: dict[str, Bundle] = {
    **_make_module_bundles(),
    **_SENSITIVE_BUNDLE_METADATA,
}

# ---------------------------------------------------------------------------
# Destructive verb prefixes (never in operate)
# ---------------------------------------------------------------------------
_DESTRUCTIVE_PREFIXES: tuple[str, ...] = (
    "annul_",
    "cancel_",
    "delete_",
    "reverse_",
    "write_off_",
    "purge_",
)


def _codename(perm: str) -> str:
    """Return the codename part of 'app_label.codename'."""
    return perm.split(".", 1)[1]


def _app_label(perm: str) -> str:
    return perm.split(".", 1)[0]


def _is_destructive(codename: str) -> bool:
    return any(codename.startswith(d) for d in _DESTRUCTIVE_PREFIXES)


def _expand_one(bundle_key: str, catalog: set[str]) -> set[str]:
    """Expand a single bundle key against the given permission catalog."""
    # Sensitive capability bundle: return intersection with catalog
    if bundle_key in _SENSITIVE_PERM_SETS:
        return _SENSITIVE_PERM_SETS[bundle_key] & catalog

    # Module-level bundle
    parts = bundle_key.rsplit(".", 1)
    if len(parts) != 2:
        return set()
    app, level = parts
    if level not in ("read", "operate", "manage"):
        return set()

    # All permissions for this app
    app_perms = {p for p in catalog if _app_label(p) == app}

    if level == "read":
        # All view_* for the app, minus sensitive perms (those belong to their own bundle only).
        return {p for p in app_perms if _codename(p).startswith("view_") and p not in _ALL_SENSITIVE}

    if level == "operate":
        # All non-destructive, non-sensitive perms for the app
        result: set[str] = set()
        for p in app_perms:
            if p in _ALL_SENSITIVE:
                continue
            if not _is_destructive(_codename(p)):
                result.add(p)
        return result

    if level == "manage":
        # All perms for the app minus sensitive
        return app_perms - _ALL_SENSITIVE

    return set()


def expand(bundle_keys: Iterable[str]) -> set[str]:
    """Return the union of all permissions granted by the given bundle keys.

    Requires Django's app registry to be ready (call after django.setup()).
    """
    from core.rbac.catalog import permission_catalog

    catalog = permission_catalog()
    result: set[str] = set()
    for key in bundle_keys:
        result |= _expand_one(key, catalog)
    return result


def bundles_of(code: str) -> list[str]:
    """Return the list of bundle keys that grant the permission *code*.

    Checks OVERRIDES first, then falls back to computed membership via expand().
    Requires Django's app registry to be ready.
    """
    if code in OVERRIDES:
        return OVERRIDES[code]

    from core.rbac.catalog import permission_catalog

    catalog = permission_catalog()
    result: list[str] = []
    for key in BUNDLES:
        if code in _expand_one(key, catalog):
            result.append(key)
    return result
