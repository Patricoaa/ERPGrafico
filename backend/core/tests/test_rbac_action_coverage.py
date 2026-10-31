"""
ADR-0104 — RBAC Phase 1: cobertura de action_permissions.

Ratchet que verifica que toda acción de escritura de un ViewSet declare
``action_permissions``.  Task 3c eliminó la lista de excepciones UNMAPPED_WRITE_ACTIONS;
a partir de aquí todas las acciones deben declarar su permiso.
"""

from __future__ import annotations

from django.urls import get_resolver

from core.tests.test_permission_references import permission_catalog

# Lista PERMANENTE de vistas que son legítimamente IsAuthenticated-only.
# Solo cambia cuando una vista cambia fundamentalmente de categoría.
AUTHENTICATED_ONLY_VIEWS: frozenset[str] = frozenset({
    # --- ViewSet-based personal/read-only views ---
    "core.views.BackgroundJobViewSet",
    "core.views.ChangePasswordView",
    "core.views.ChangePinView",
    "core.views.CurrentUserView",
    "core.views.GlobalAuditLogView",
    "core.views.MyProfilePayrollPreviewView",
    "core.views.MyProfileView",
    "core.views.UserPreferenceView",
    "sales.pricing_views.PricingViewSet",
    # --- @api_view system/utility endpoints (read-only or personal) ---
    "core.api.documents.document_ref",
    "core.api.documents.document_relations",
    "core.api.search.universal_search",
    "core.views.entity_config",
    "core.views.entity_prefixes",
    "core.views.logout_view",
    "core.views.server_time",
    "core.views.system_status",
    # --- DRF built-in views ---
    "rest_framework.routers.APIRootView",
})


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
    """Every write extra-action must declare action_permissions (ADR-0104)."""
    missing = {
        key
        for (key, cls, name) in _write_actions()
        if name not in getattr(cls, "action_permissions", {})
    }
    assert missing == set(), (
        f"Declara action_permissions para estas acciones (ADR-0104):\n  "
        + "\n  ".join(sorted(missing))
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


def test_read_like_post_actions_only_need_view(db):
    """
    A user with only view_product (no change/add) can call check_availability and
    toggle_favorite on ProductViewSet — those are read-like POSTs mapped to view_*.
    """
    from django.contrib.auth import get_user_model
    from django.contrib.auth.models import Permission
    from django.contrib.contenttypes.models import ContentType
    from rest_framework.request import Request
    from rest_framework.test import APIRequestFactory

    from inventory.views import ProductViewSet

    User = get_user_model()
    user = User.objects.create_user(username="rbac_view_test", password="x")
    ct = ContentType.objects.get(app_label="inventory", model="product")
    perm = Permission.objects.get(content_type=ct, codename="view_product")
    user.user_permissions.add(perm)
    user = User.objects.get(pk=user.pk)  # fresh instance, clears _perm_cache

    factory = APIRequestFactory()

    for action_name in ("check_availability", "toggle_favorite"):
        raw = factory.post(f"/api/products/{action_name}/", content_type="application/json")
        # Force the user without going through authentication middleware.
        request = Request(raw)
        request._user = user  # bypass DRF auth; user is already chosen
        vs = ProductViewSet()
        vs.request = request
        vs.kwargs = {}
        vs.action = action_name
        vs.format_kwarg = None
        for perm_class in vs.get_permissions():
            assert perm_class.has_permission(request, vs), (
                f"Permission denied for action '{action_name}' with only view_product"
            )


def test_edit_post_actions_need_change_not_add(db):
    """
    A user with only production.add_workorder (no change_workorder) must be denied
    add_material and update_section; a user with change_workorder must be allowed.
    """
    from django.contrib.auth import get_user_model
    from django.contrib.auth.models import Permission
    from django.contrib.contenttypes.models import ContentType
    from rest_framework.request import Request
    from rest_framework.test import APIRequestFactory

    from production.views import WorkOrderViewSet

    User = get_user_model()
    factory = APIRequestFactory()
    ct = ContentType.objects.get(app_label="production", model="workorder")

    # User with only add_workorder
    user_add = User.objects.create_user(username="rbac_add_only", password="x")
    perm_add = Permission.objects.get(content_type=ct, codename="add_workorder")
    user_add.user_permissions.add(perm_add)
    user_add = User.objects.get(pk=user_add.pk)

    # User with change_workorder
    user_change = User.objects.create_user(username="rbac_change_only", password="x")
    perm_change = Permission.objects.get(content_type=ct, codename="change_workorder")
    user_change.user_permissions.add(perm_change)
    user_change = User.objects.get(pk=user_change.pk)

    for action_name in ("add_material", "update_section"):
        raw_add = factory.post(f"/api/work-orders/{action_name}/", content_type="application/json")
        req_add = Request(raw_add)
        req_add._user = user_add
        vs_add = WorkOrderViewSet()
        vs_add.request = req_add
        vs_add.kwargs = {}
        vs_add.action = action_name
        vs_add.format_kwarg = None

        for perm_class in vs_add.get_permissions():
            assert not perm_class.has_permission(req_add, vs_add), (
                f"add_workorder user must be denied '{action_name}'"
            )

        raw_chg = factory.post(f"/api/work-orders/{action_name}/", content_type="application/json")
        req_chg = Request(raw_chg)
        req_chg._user = user_change
        vs_chg = WorkOrderViewSet()
        vs_chg.request = req_chg
        vs_chg.kwargs = {}
        vs_chg.action = action_name
        vs_chg.format_kwarg = None

        for perm_class in vs_chg.get_permissions():
            assert perm_class.has_permission(req_chg, vs_chg), (
                f"change_workorder user must be allowed '{action_name}'"
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
