"""Tests for Task 7: catalog, role composition, no-escalation, SoD and audit.

9 required tests:
1. test_catalog_hides_noise_and_lists_bundles
2. test_put_composition_materializes_and_audits
3. test_cannot_edit_team_or_system_role_permissions
4. test_put_rejects_unknown_bundles_or_codes
5. test_user_cannot_grant_permissions_they_lack
6. test_user_cannot_change_own_roles
7. test_role_editor_cannot_add_bundles_they_lack
8. test_sod_conflict_warns_and_audits
9. test_composition_endpoint_query_count

Bug-fix regression tests:
C1. test_cannot_create_user_with_escalated_group
C2. test_empty_composition_clears_permissions
C3. test_cannot_demote_user_with_groups_actor_lacks
"""

import pytest
from django.contrib.auth.models import Group, Permission
from rest_framework.test import APIClient

from core.models import ActionLog, User


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_user(username, *perms, superuser=False):
    """Create a user with direct permissions."""
    if superuser:
        return User.objects.create_superuser(username=username, password="x")
    user = User.objects.create_user(username=username, password="x")
    for code in perms:
        app_label, codename = code.split(".", 1)
        found = Permission.objects.filter(content_type__app_label=app_label, codename=codename)
        if found.exists():
            user.user_permissions.add(*found)
    return user


def _api(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _role_group(name, bundles=None, is_system=False):
    """Create a ROLE group with the given bundles."""
    g = Group.objects.create(name=name)
    g.profile.kind = "ROLE"
    g.profile.is_system = is_system
    if bundles:
        g.profile.bundles = bundles
    g.profile.save()
    return g


# ---------------------------------------------------------------------------
# 1. Catalog hides noise and lists bundles
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_catalog_hides_noise_and_lists_bundles():
    """GET /catalog/: no historical/contenttypes; billing.annul_invoice in billing.manage."""
    user = _make_user("cat_user", "auth.view_group")
    client = _api(user)

    resp = client.get("/api/core/permissions/catalog/")
    assert resp.status_code == 200

    data = resp.json()
    app_labels = [entry["app"] for entry in data]

    # Must not include hidden apps
    assert "contenttypes" not in app_labels
    assert "admin" not in app_labels

    # Must not include historical models
    for entry in data:
        for perm in entry["permissions"]:
            assert not (perm.get("model") or "").startswith("historical"), (
                f"historical model leaked: {perm['code']}"
            )

    # billing.annul_invoice must exist and its bundles must include billing.manage
    billing = next((e for e in data if e["app"] == "billing"), None)
    assert billing is not None, "billing app not found in catalog"

    annul = next(
        (p for p in billing["permissions"] if p["code"] == "billing.annul_invoice"),
        None,
    )
    assert annul is not None, "billing.annul_invoice not found"
    assert "billing.manage" in annul["bundles"], (
        f"billing.annul_invoice bundles: {annul['bundles']}"
    )


# ---------------------------------------------------------------------------
# 2. PUT composition materializes and audits
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_put_composition_materializes_and_audits():
    """PUT bundles=["sales.read"]: group gets expanded perms; ActionLog created."""
    from core.rbac.bundles import expand

    actor = _make_user("comp_actor", superuser=True)
    client = _api(actor)

    group = _role_group("CompTest")

    resp = client.put(
        f"/api/core/groups/{group.pk}/composition/",
        {"bundles": ["sales.read"], "extra_permissions": [], "excluded_permissions": []},
        format="json",
    )
    assert resp.status_code == 200, resp.json()
    assert resp.json()["status"] == "ok"

    # Permissions materialized correctly
    expected = expand(["sales.read"])
    actual = {
        f"{p.content_type.app_label}.{p.codename}"
        for p in group.permissions.select_related("content_type")
    }
    assert expected == actual, f"Missing: {expected - actual}, Extra: {actual - expected}"

    # ActionLog created
    assert ActionLog.objects.filter(
        user=actor,
        action_type=ActionLog.Type.SECURITY,
        metadata__group_name="CompTest",
    ).exists()


# ---------------------------------------------------------------------------
# 3. Cannot edit TEAM or is_system role composition
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_cannot_edit_team_or_system_role_permissions():
    """PUT on TEAM group → 400; PUT on sysadmin → 400."""
    actor = _make_user("team_sys_actor", superuser=True)
    client = _api(actor)
    payload = {"bundles": [], "extra_permissions": [], "excluded_permissions": []}

    # TEAM group (auto-created profile)
    team_group = Group.objects.create(name="TeamBlock")
    # profile.kind = TEAM by default from signal

    resp = client.put(f"/api/core/groups/{team_group.pk}/composition/", payload, format="json")
    assert resp.status_code == 400, resp.json()

    # is_system role
    sys_role = _role_group("SysRoleBlock", is_system=True)
    resp2 = client.put(f"/api/core/groups/{sys_role.pk}/composition/", payload, format="json")
    assert resp2.status_code == 400, resp2.json()


# ---------------------------------------------------------------------------
# 4. PUT rejects unknown bundles or codes
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_put_rejects_unknown_bundles_or_codes():
    """PUT with unknown bundle key returns 400 with invalid list."""
    actor = _make_user("reject_actor", superuser=True)
    client = _api(actor)
    group = _role_group("RejectGroup")

    resp = client.put(
        f"/api/core/groups/{group.pk}/composition/",
        {
            "bundles": ["nonexistent.bundle"],
            "extra_permissions": [],
            "excluded_permissions": [],
        },
        format="json",
    )
    assert resp.status_code == 400
    body = resp.json()
    # Error handler wraps DRF validation errors in {"error": {"details": ...}}
    details = body.get("error", {}).get("details", body)
    assert "invalid" in details
    assert "nonexistent.bundle" in details["invalid"]


# ---------------------------------------------------------------------------
# 5. User cannot grant permissions they lack
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_user_cannot_grant_permissions_they_lack():
    """Actor without hr.payroll perms cannot assign RRHH role (which grants those perms)."""
    from core.rbac.bundles import expand
    from core.rbac.services import RoleService

    # Create hr.payroll role (with some permissions materialized)
    hr_role = _role_group("RRHH_NoEsc", bundles=["hr.payroll"])
    RoleService.materialize(hr_role)

    # Actor has core.change_user but NOT hr.payroll permissions
    actor = _make_user("noesc_actor", "core.change_user", "core.view_user", "auth.change_group", "auth.view_group")
    client = _api(actor)

    # Target user to receive the RRHH role
    target = _make_user("noesc_target")

    # PATCH the target with the RRHH role (actor doesn't have hr.payroll perms)
    # groups field is a SlugRelatedField(slug_field="name")
    resp = client.patch(
        f"/api/core/users/{target.pk}/",
        {"groups": [hr_role.name]},
        format="json",
    )
    assert resp.status_code == 403, resp.json()


# ---------------------------------------------------------------------------
# 6. User cannot change own roles
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_user_cannot_change_own_roles():
    """PATCH /users/{self.id}/ with groups → 403."""
    some_group = Group.objects.create(name="SomeGroupSelf")

    actor = _make_user("self_role_actor", "core.change_user", "core.view_user", superuser=True)
    client = _api(actor)

    # groups field is a SlugRelatedField(slug_field="name")
    resp = client.patch(
        f"/api/core/users/{actor.pk}/",
        {"groups": [some_group.name]},
        format="json",
    )
    assert resp.status_code == 403, resp.json()


# ---------------------------------------------------------------------------
# 7. Role editor cannot add bundles they lack
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_role_editor_cannot_add_bundles_they_lack():
    """Actor with auth.change_group but NOT treasury.payments cannot add treasury.payments bundle."""
    actor = _make_user(
        "role_ed_actor",
        "auth.view_group",
        "auth.change_group",
        "auth.view_permission",
    )
    client = _api(actor)
    group = _role_group("RoleEdGroup")

    resp = client.put(
        f"/api/core/groups/{group.pk}/composition/",
        {
            "bundles": ["treasury.payments"],
            "extra_permissions": [],
            "excluded_permissions": [],
        },
        format="json",
    )
    assert resp.status_code == 403, resp.json()


# ---------------------------------------------------------------------------
# 8. SoD conflict warns and audits
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_sod_conflict_warns_and_audits():
    """Assigning user to both purchasing.manage and treasury.payments roles → 200 with sod_warnings."""
    from core.rbac.services import RoleService

    actor = _make_user("sod_actor", superuser=True)
    client = _api(actor)

    # Create two conflicting roles
    compras_role = _role_group("Compras_SoD", bundles=["purchasing.manage"])
    finanzas_role = _role_group("Finanzas_SoD", bundles=["treasury.payments"])
    RoleService.materialize(compras_role)
    RoleService.materialize(finanzas_role)

    # Assign one role to a target user, then update composition to include conflicting bundle
    target_group = _role_group("SoDTargetGroup")
    resp = client.put(
        f"/api/core/groups/{target_group.pk}/composition/",
        {
            "bundles": ["purchasing.manage", "treasury.payments"],
            "extra_permissions": [],
            "excluded_permissions": [],
        },
        format="json",
    )
    assert resp.status_code == 200, resp.json()
    body = resp.json()
    assert "sod_warnings" in body
    assert len(body["sod_warnings"]) >= 1

    # Rule key should be purchasing_treasury
    rule_keys = [w["rule"] for w in body["sod_warnings"]]
    assert "purchasing_treasury" in rule_keys

    # Audit log should mention sod conflict
    assert ActionLog.objects.filter(
        user=actor,
        action_type=ActionLog.Type.SECURITY,
        metadata__group_name="SoDTargetGroup",
    ).exists()


# ---------------------------------------------------------------------------
# 9. Composition endpoint query count
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_composition_endpoint_query_count(django_assert_num_queries):
    """GET /groups/{pk}/composition/ uses <= 4 queries."""
    actor = _make_user("qcount_actor", "auth.view_group")
    client = _api(actor)
    group = _role_group("QCountGroup", bundles=["sales.read"])

    with django_assert_num_queries(4):
        resp = client.get(f"/api/core/groups/{group.pk}/composition/")
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# C1 — Privilege escalation on user create
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_cannot_create_user_with_escalated_group():
    """POST /users/ with a group containing perms actor lacks → 403, user not created."""
    from contacts.models import Contact
    from core.rbac.services import RoleService

    # Create a high-privilege role that actor won't have
    hr_role = _role_group("HR_Esc_Create", bundles=["hr.payroll"])
    RoleService.materialize(hr_role)

    # A contact is required by UserSerializer
    victim_contact = Contact.objects.create(name="Victim Contact", tax_id="99.111.222-3")

    # Actor has only core.change_user/view_user/add_user — no hr.payroll perms
    actor = _make_user(
        "esc_create_actor",
        "core.add_user",
        "core.change_user",
        "core.view_user",
        "auth.view_group",
    )
    client = _api(actor)

    resp = client.post(
        "/api/core/users/",
        {
            "username": "esc_victim",
            "password": "strongpass123",
            "contact": victim_contact.pk,
            "groups": [hr_role.name],
        },
        format="json",
    )
    assert resp.status_code == 403, resp.json()

    # User must NOT exist in the DB (escalation prevented before save)
    from core.models import User
    assert not User.objects.filter(username="esc_victim").exists(), (
        "User was created in DB despite 403 — privilege escalation on create!"
    )


# ---------------------------------------------------------------------------
# C2 — Empty composition must clear all permissions
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_empty_composition_clears_permissions():
    """PUT with empty bundles after having some must set group.permissions to empty."""
    from core.rbac.services import RoleService

    actor = _make_user("clear_comp_actor", superuser=True)
    client = _api(actor)

    group = _role_group("ClearCompGroup", bundles=["sales.read"])
    RoleService.materialize(group)
    assert group.permissions.count() > 0, "Group should have permissions after materializing"

    # PUT with all-empty composition
    resp = client.put(
        f"/api/core/groups/{group.pk}/composition/",
        {"bundles": [], "extra_permissions": [], "excluded_permissions": []},
        format="json",
    )
    assert resp.status_code == 200, resp.json()

    group.refresh_from_db()
    assert group.permissions.count() == 0, (
        f"Group still has {group.permissions.count()} permissions after empty PUT"
    )


# ---------------------------------------------------------------------------
# C3 — Cannot demote user if actor lacks the group's perms
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_cannot_demote_user_with_groups_actor_lacks():
    """PATCH groups=[] for a user in a high-privilege group → 403 if actor lacks group perms."""
    from core.rbac.services import RoleService

    # High-privilege group with hr.payroll permissions
    hr_group = _role_group("HR_Demote_Test", bundles=["hr.payroll"])
    RoleService.materialize(hr_group)

    # Target user already in the high-privilege group
    target = _make_user("demote_target")
    target.groups.add(hr_group)

    # Actor has only core.change_user — no hr.payroll perms
    actor = _make_user("demote_actor", "core.change_user", "core.view_user")
    client = _api(actor)

    # Attempt to strip the high-privilege group (PATCH groups=[])
    resp = client.patch(
        f"/api/core/users/{target.pk}/",
        {"groups": []},
        format="json",
    )
    assert resp.status_code == 403, resp.json()

    # Target must still be in the hr group
    target.refresh_from_db()
    assert hr_group in target.groups.all(), (
        "hr_group was removed from target despite 403 — demotion not guarded!"
    )
