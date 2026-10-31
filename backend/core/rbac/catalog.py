"""Permission catalog for the RBAC system.

Exports:
  - permission_catalog() — all valid "app_label.codename" strings (no DB required)
  - HIDDEN_APPS          — apps excluded from the curated catalog
  - CatalogPermission    — TypedDict for a single permission entry
  - CatalogApp           — TypedDict for an app section in the catalog
  - curated_catalog()    — structured catalog for UI/API consumption (DB required)
"""

from __future__ import annotations

from typing import Literal, TypedDict

# ---------------------------------------------------------------------------
# Hidden apps — excluded from curated_catalog()
# ---------------------------------------------------------------------------
HIDDEN_APPS: frozenset[str] = frozenset(
    {
        "admin",
        "contenttypes",
        "sessions",
        "django_celery_beat",
        "socialaccount",
        "account",
    }
)

# ---------------------------------------------------------------------------
# TypedDicts
# ---------------------------------------------------------------------------

PermKind = Literal["module", "view", "add", "change", "delete", "business"]


class CatalogPermission(TypedDict):
    code: str              # "app_label.codename"
    name: str              # human-readable description
    model: str | None      # model name, or None for registry-only perms
    kind: PermKind
    bundles: list[str]     # bundle keys that grant this permission


class CatalogApp(TypedDict):
    app: str               # app_label
    label: str             # verbose app name
    permissions: list[CatalogPermission]


# ---------------------------------------------------------------------------
# permission_catalog() — re-exported here; no DB access needed
# ---------------------------------------------------------------------------

def permission_catalog() -> set[str]:
    """All valid permissions as 'app_label.codename', without querying the DB.

    Combines Django model default permissions, model Meta.permissions, and
    permissions registered via PermissionRegistry.
    """
    from django.apps import apps

    from core.permissions import PermissionRegistry

    catalog: set[str] = set()
    for model in apps.get_models():
        meta = model._meta
        for action in meta.default_permissions:
            catalog.add(f"{meta.app_label}.{action}_{meta.model_name}")
        for codename, _name in meta.permissions:
            catalog.add(f"{meta.app_label}.{codename}")
    for app_label, perms in PermissionRegistry.get_registered_permissions().items():
        for codename, _name in perms:
            catalog.add(f"{app_label}.{codename}")
    return catalog


# ---------------------------------------------------------------------------
# Verb → kind classification
# ---------------------------------------------------------------------------

# Permissions that override the automatic verb-based classification.
# Typically view_dashboard_* which are "module" kind, not plain "view".
_KIND_OVERRIDES: dict[str, PermKind] = {
    "sales.view_dashboard_sales": "module",
    "hr.view_dashboard_hr": "module",
    "inventory.view_dashboard_inventory": "module",
    "purchasing.view_dashboard_purchasing": "module",
    "production.view_dashboard_production": "module",
    "accounting.view_dashboard_accounting": "module",
    "treasury.view_dashboard_treasury": "module",
    "contacts.view_dashboard_contacts": "module",
    "workflow.view_dashboard_workflow": "module",
    "tax.view_dashboard_tax": "module",
    "billing.view_dashboard_billing": "module",
    "core.view_dashboard_core": "module",
    "finances.view_dashboard_finances": "module",
}


def _classify_kind(code: str) -> PermKind:
    if code in _KIND_OVERRIDES:
        return _KIND_OVERRIDES[code]
    codename = code.split(".", 1)[1]
    if codename.startswith("view_"):
        return "view"
    if codename.startswith("add_"):
        return "add"
    if codename.startswith("change_"):
        return "change"
    if codename.startswith("delete_"):
        return "delete"
    return "business"


# ---------------------------------------------------------------------------
# curated_catalog() — lazy; requires Django app registry + DB
# ---------------------------------------------------------------------------

def curated_catalog() -> list[CatalogApp]:
    """Return the curated permission catalog, grouped by app.

    Excludes HIDDEN_APPS and models whose name starts with 'historical'.
    Each permission entry includes the bundle keys that grant it.

    Requires Django's app registry to be ready (call after django.setup()).
    """
    from django.apps import apps
    from django.contrib.auth.models import Permission
    from django.contrib.contenttypes.models import ContentType

    from core.permissions import PermissionRegistry
    from core.rbac.bundles import bundles_of

    # Build a quick lookup: (app_label, codename) → Permission name
    perm_names: dict[tuple[str, str], str] = {}
    for p in Permission.objects.select_related("content_type").all():
        perm_names[(p.content_type.app_label, p.codename)] = p.name

    # Also include registry perms that may not yet be in DB
    for app_label, perms in PermissionRegistry.get_registered_permissions().items():
        for codename, name in perms:
            if (app_label, codename) not in perm_names:
                perm_names[(app_label, codename)] = name

    # Build per-app structure
    result: list[CatalogApp] = []

    for app_cfg in apps.get_app_configs():
        if app_cfg.label in HIDDEN_APPS:
            continue

        app_perms: list[CatalogPermission] = []

        # Model-derived permissions
        seen_codes: set[str] = set()
        for model in app_cfg.get_models():
            meta = model._meta
            if meta.model_name.startswith("historical"):
                continue
            model_name: str | None = meta.model_name

            for action in meta.default_permissions:
                code = f"{meta.app_label}.{action}_{meta.model_name}"
                if code in seen_codes:
                    continue
                seen_codes.add(code)
                name = perm_names.get(
                    (meta.app_label, f"{action}_{meta.model_name}"), code
                )
                app_perms.append(
                    CatalogPermission(
                        code=code,
                        name=name,
                        model=model_name,
                        kind=_classify_kind(code),
                        bundles=bundles_of(code),
                    )
                )

            for codename, perm_name in meta.permissions:
                code = f"{meta.app_label}.{codename}"
                if code in seen_codes:
                    continue
                seen_codes.add(code)
                name = perm_names.get((meta.app_label, codename), perm_name)
                app_perms.append(
                    CatalogPermission(
                        code=code,
                        name=name,
                        model=model_name,
                        kind=_classify_kind(code),
                        bundles=bundles_of(code),
                    )
                )

        # Registry-only permissions (not tied to a model)
        reg_perms = PermissionRegistry.get_registered_permissions().get(
            app_cfg.label, []
        )
        for codename, reg_name in reg_perms:
            code = f"{app_cfg.label}.{codename}"
            if code in seen_codes:
                continue
            seen_codes.add(code)
            name = perm_names.get((app_cfg.label, codename), reg_name)
            app_perms.append(
                CatalogPermission(
                    code=code,
                    name=name,
                    model=None,
                    kind=_classify_kind(code),
                    bundles=bundles_of(code),
                )
            )

        if not app_perms:
            continue

        result.append(
            CatalogApp(
                app=app_cfg.label,
                label=app_cfg.verbose_name,
                permissions=app_perms,
            )
        )

    return result
