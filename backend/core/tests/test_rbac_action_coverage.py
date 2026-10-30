"""
ADR-0104 — RBAC Phase 1: cobertura de action_permissions.

Ratchet que verifica que toda acción de escritura de un ViewSet declare
``action_permissions`` (o esté en el baseline temporal UNMAPPED_WRITE_ACTIONS).
El baseline sólo se reduce; nunca se agregan entradas sin justificación en el PR.
"""

from __future__ import annotations

from django.urls import get_resolver

from core.tests.rbac_action_baseline import AUTHENTICATED_ONLY_VIEWS, UNMAPPED_WRITE_ACTIONS
from core.tests.test_permission_references import permission_catalog


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _viewset_classes():
    """Yield each unique ViewSet class registered in the URL conf."""
    seen = set()

    def walk(patterns):
        for p in patterns:
            if hasattr(p, "url_patterns"):
                yield from walk(p.url_patterns)
                continue
            cls = getattr(p.callback, "cls", None)
            if cls is not None and cls not in seen:
                seen.add(cls)
                yield cls

    yield from walk(get_resolver().url_patterns)


def _write_actions():
    """
    Yield ``(key, cls, action_name)`` for every extra action whose HTTP methods
    include at least one write verb (POST, PUT, PATCH, DELETE).

    key format: ``"{cls.__module__}.{cls.__name__}.{action.__name__}"``
    """
    for cls in _viewset_classes():
        if not hasattr(cls, "get_extra_actions"):
            continue
        for action in cls.get_extra_actions():
            if set(action.mapping) & {"post", "put", "patch", "delete"}:
                key = f"{cls.__module__}.{cls.__name__}.{action.__name__}"
                yield (key, cls, action.__name__)


def _is_modelless(cls) -> bool:
    """Return True if the class has neither a queryset nor a get_queryset method."""
    return getattr(cls, "queryset", None) is None and not hasattr(cls, "get_queryset")


def _uses_require_perms(cls) -> bool:
    """Return True if the class statically declares a require_perms()-based class."""
    return any(
        hasattr(pc, "required_perms")
        for pc in getattr(cls, "permission_classes", [])
    )


def _overrides_get_permissions(cls) -> bool:
    """Return True if the class overrides get_permissions (dynamic permission dispatch)."""
    return "get_permissions" in cls.__dict__


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_every_write_action_declares_permission():
    """Every write extra-action must declare action_permissions, or be in the baseline."""
    missing = {
        key
        for (key, cls, name) in _write_actions()
        if name not in getattr(cls, "action_permissions", {})
        and key not in UNMAPPED_WRITE_ACTIONS
    }
    assert missing == set(), (
        f"Declara action_permissions para estas acciones (ADR-0104). "
        f"Si aún no lo puedes hacer, agrega la clave al baseline UNMAPPED_WRITE_ACTIONS "
        f"con justificación en el PR:\n  " + "\n  ".join(sorted(missing))
    )


def test_baseline_has_no_stale_entries():
    """
    Each entry in UNMAPPED_WRITE_ACTIONS must still correspond to an actual write
    action that is NOT yet covered by action_permissions.  Stale entries (removed
    actions or already-fixed actions) must be deleted from the baseline.
    """
    current_keys = {key for (key, _cls, _name) in _write_actions()}
    stale = set()
    for key in UNMAPPED_WRITE_ACTIONS:
        if key not in current_keys:
            # Action no longer exists.
            stale.add(key)
            continue
        # Action still exists — check if it has been fixed.
        module_cls, _, action_name = key.rpartition(".")
        module, _, cls_name = module_cls.rpartition(".")
        # Find the actual class from the URL conf.
        for _key, cls, name in _write_actions():
            if _key == key and name in getattr(cls, "action_permissions", {}):
                stale.add(key)
                break

    assert stale == set(), (
        "Quita estas entradas obsoletas del baseline UNMAPPED_WRITE_ACTIONS:\n  "
        + "\n  ".join(sorted(stale))
    )


def test_action_permissions_reference_existing_permissions():
    """
    Every permission string declared in action_permissions must exist in the
    permission catalog (i.e. be a valid 'app_label.codename' string).
    """
    catalog = permission_catalog()
    bad: list[str] = []
    for cls in _viewset_classes():
        ap = getattr(cls, "action_permissions", None)
        if not ap:
            continue
        qname = f"{cls.__module__}.{cls.__name__}"
        for action_name, value in ap.items():
            if value is None:
                continue
            perms = (value,) if isinstance(value, str) else tuple(value)
            for perm in perms:
                if perm not in catalog:
                    bad.append(f"{qname}.{action_name} → '{perm}'")
    assert not bad, (
        "action_permissions hace referencia a permisos inexistentes:\n  "
        + "\n  ".join(sorted(bad))
    )


def test_modelless_views_declare_permissions():
    """
    Every modelless ViewSet (no queryset / get_queryset) must satisfy at least
    one of:
      1. Its static permission_classes includes a require_perms()-based class.
      2. It overrides get_permissions() for dynamic permission dispatch.
      3. Its action_permissions covers all write extra-actions (no missing keys).
      4. Its qualified name is in AUTHENTICATED_ONLY_VIEWS (personal endpoints).
    """
    failing: list[str] = []
    for cls in _viewset_classes():
        if not _is_modelless(cls):
            continue
        qname = f"{cls.__module__}.{cls.__name__}"

        # Condition 4: explicitly listed as personal/public
        if qname in AUTHENTICATED_ONLY_VIEWS:
            continue

        # Condition 1: static require_perms
        if _uses_require_perms(cls):
            continue

        # Condition 2: overrides get_permissions dynamically
        if _overrides_get_permissions(cls):
            continue

        # Condition 3: action_permissions covers every write extra-action.
        # This condition applies only to ViewSet classes (with get_extra_actions).
        # Non-ViewSet classes (WrappedAPIView from @api_view) cannot satisfy this
        # condition; they must use require_perms (condition 1), override
        # get_permissions (condition 2), or be listed in AUTHENTICATED_ONLY_VIEWS
        # (condition 4).
        if hasattr(cls, "get_extra_actions"):
            ap = getattr(cls, "action_permissions", {})
            missing_keys = [
                a.__name__
                for a in cls.get_extra_actions()
                if set(a.mapping) & {"post", "put", "patch", "delete"}
                and a.__name__ not in ap
            ]
            if not missing_keys:
                # All write extra-actions are covered (or there are none)
                continue

        failing.append(qname)

    assert not failing, (
        "Estas vistas sin modelo no declaran permisos suficientes "
        "(usa require_perms, action_permissions, o agrégala a AUTHENTICATED_ONLY_VIEWS):\n  "
        + "\n  ".join(sorted(failing))
    )


def test_authenticated_only_views_still_exist():
    """
    Every entry in AUTHENTICATED_ONLY_VIEWS must correspond to a class registered
    in the URL conf.  Orphan entries must be removed.
    """
    registered = {
        f"{cls.__module__}.{cls.__name__}" for cls in _viewset_classes()
    }
    orphans = AUTHENTICATED_ONLY_VIEWS - registered
    assert not orphans, (
        "Estas entradas de AUTHENTICATED_ONLY_VIEWS ya no tienen una vista registrada. "
        "Quítalas del baseline:\n  " + "\n  ".join(sorted(orphans))
    )
