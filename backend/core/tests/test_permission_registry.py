"""Tests for PermissionRegistry reliability: no duplicates, correct app labels."""

from unittest.mock import MagicMock, patch

import pytest
from django.contrib.auth.models import Group, Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ImproperlyConfigured

from core.permissions import PermissionRegistry
from core.tests.rbac_factories import make_user


# ---------------------------------------------------------------------------
#  Duplicate prevention
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_registry_does_not_duplicate_model_permissions():
    """sync_to_db must skip a codename that already exists for the app_label,
    even when the existing Permission sits on a different content type within
    the same app (AccountingPeriod vs TaxPeriod)."""

    codename = "can_close_accounting_period"

    # This permission is defined in AccountingPeriod.Meta.permissions.
    # Django's post_migrate/syncdb creates it on the AccountingPeriod CT.
    ct_ap = ContentType.objects.get(app_label="tax", model="accountingperiod")
    Permission.objects.get_or_create(
        content_type=ct_ap,
        codename=codename,
        defaults={"name": "Can close accounting periods"},
    )
    before = Permission.objects.filter(
        content_type__app_label="tax", codename=codename,
    ).count()
    assert before == 1, "Pre-condition failed: permission should exist once"

    # PermissionRegistry would pick TaxPeriod's CT (first model in tax app).
    # The old code creates a duplicate; the fix must skip it.
    original = PermissionRegistry._registry.copy()
    try:
        PermissionRegistry._registry = {}
        PermissionRegistry.register("tax", [(codename, "Can close accounting periods")])
        PermissionRegistry.sync_to_db()
    finally:
        PermissionRegistry._registry = original

    assert (
        Permission.objects.filter(
            content_type__app_label="tax", codename=codename,
        ).count()
        == 1
    ), "sync_to_db created a duplicate Permission row"


# ---------------------------------------------------------------------------
#  Finances app label
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_finances_dashboard_permission_has_finances_label():
    """The view_dashboard_finances permission must live under app_label='finances'
    so that has_perm('finances.view_dashboard_finances') works."""

    ct = ContentType.objects.get(app_label="finances", model="financespermissions")
    perm, _ = Permission.objects.get_or_create(
        content_type=ct,
        codename="view_dashboard_finances",
        defaults={"name": "Can view finances dashboard"},
    )

    user = make_user("fin_viewer")
    user.user_permissions.add(perm)
    # Clear Django's per-request permission cache.
    user = type(user).objects.get(pk=user.pk)

    assert user.has_perm("finances.view_dashboard_finances")


# ---------------------------------------------------------------------------
#  App without models → ImproperlyConfigured
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_registry_rejects_app_without_models():
    """An app with registered permissions but zero models must raise
    ImproperlyConfigured instead of silently falling back to User's CT."""

    fake_config = MagicMock()
    fake_config.get_models.return_value = []

    real_get_app_config = __import__(
        "django.apps", fromlist=["apps"]
    ).apps.get_app_config

    def selective_get_app_config(app_name: str):
        if app_name == "ghost_app":
            return fake_config
        return real_get_app_config(app_name)

    original = PermissionRegistry._registry.copy()
    try:
        PermissionRegistry._registry = {}
        PermissionRegistry.register(
            "ghost_app", [("view_ghost", "Can view ghost")]
        )

        with patch(
            "core.permissions.apps.get_app_config",
            side_effect=selective_get_app_config,
        ):
            with pytest.raises(ImproperlyConfigured, match="ghost_app"):
                PermissionRegistry.sync_to_db()
    finally:
        PermissionRegistry._registry = original


# ---------------------------------------------------------------------------
#  Merge-duplicates migration function
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_merge_duplicates_keeps_group_assignments():
    """When duplicate Permission rows exist for the same (app_label, codename),
    the merge function must keep the one whose CT model declares the codename,
    transfer Group.permissions and User.user_permissions to it, and delete the
    duplicates."""
    from core.migrations.helpers.merge_duplicate_permissions import (
        merge_duplicate_permissions,
    )

    # The "real" permission on AccountingPeriod's CT (where the Meta.permission is).
    ct_ap = ContentType.objects.get(app_label="tax", model="accountingperiod")
    real_perm, _ = Permission.objects.get_or_create(
        content_type=ct_ap,
        codename="view_accountingperiod",
        defaults={"name": "Can view accounting period"},
    )

    # Duplicate on TaxPeriod's CT (simulates the old PermissionRegistry bug:
    # sync_to_db picked models[0] = TaxPeriod for all "tax" permissions).
    ct_tp = ContentType.objects.get(app_label="tax", model="taxperiod")
    dup_perm = Permission.objects.create(
        content_type=ct_tp,
        codename="view_accountingperiod",
        name="Can view accounting period (dup)",
    )

    # Wire the duplicate into a group and a user.
    group = Group.objects.create(name="TestMerge")
    group.permissions.add(dup_perm)

    user = make_user("merge_u")
    user.user_permissions.add(dup_perm)

    # Run the merge.
    merge_duplicate_permissions()

    # The duplicate should be gone.
    assert not Permission.objects.filter(pk=dup_perm.pk).exists()
    # The real permission survives.
    assert Permission.objects.filter(pk=real_perm.pk).exists()
    # Group and user now point to the real one.
    assert group.permissions.filter(pk=real_perm.pk).exists()
    user = type(user).objects.get(pk=user.pk)
    assert user.has_perm("tax.view_accountingperiod")


# ---------------------------------------------------------------------------
#  post_migrate: automatic, additive sync
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_post_migrate_creates_registered_permissions():
    from django.core.management import call_command

    original = PermissionRegistry._registry.copy()
    try:
        PermissionRegistry._registry = {}
        PermissionRegistry.register("core", [("pm_test_perm", "Can pm test")])
        assert not Permission.objects.filter(codename="pm_test_perm").exists()
        call_command("migrate", verbosity=0)
        assert Permission.objects.filter(
            content_type__app_label="core", codename="pm_test_perm"
        ).exists()
    finally:
        PermissionRegistry._registry = original


@pytest.mark.django_db
def test_post_migrate_sync_is_additive():
    from django.core.management import call_command

    from core.permissions import Roles

    admin, _ = Group.objects.get_or_create(name=Roles.ADMIN)
    operator, _ = Group.objects.get_or_create(name=Roles.OPERATOR)
    extra = Permission.objects.filter(codename="view_user").first()
    operator.permissions.add(extra)

    original = PermissionRegistry._registry.copy()
    try:
        PermissionRegistry._registry = {}
        PermissionRegistry.register("core", [("pm_test_perm2", "Can pm test 2")])
        call_command("migrate", verbosity=0)
    finally:
        PermissionRegistry._registry = original

    assert operator.permissions.filter(pk=extra.pk).exists()
    new = Permission.objects.get(codename="pm_test_perm2")
    assert admin.permissions.filter(pk=new.pk).exists()
    assert not operator.permissions.filter(pk=new.pk).exists()


@pytest.mark.django_db
def test_post_migrate_without_admin_group_does_not_fail():
    from django.core.management import call_command

    from core.permissions import Roles

    Group.objects.filter(name=Roles.ADMIN).delete()
    call_command("migrate", verbosity=0)
    assert not Group.objects.filter(name=Roles.ADMIN).exists()
