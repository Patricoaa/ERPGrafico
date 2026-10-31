"""Tests for Task 1: group kind in UserSerializer + kind on group create + sod_warnings in response."""
import pytest
from django.contrib.auth.models import Group, Permission
from rest_framework.test import APIClient

from core.models import User


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_user(username, *perms, superuser=False):
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
    g = Group.objects.create(name=name)
    g.profile.kind = "ROLE"
    g.profile.is_system = is_system
    if bundles:
        g.profile.bundles = bundles
    g.profile.save()
    return g


def _contact(name="Test Contact", tax_id="76.000.001-1"):
    from contacts.models import Contact
    return Contact.objects.create(name=name, tax_id=tax_id)


# ---------------------------------------------------------------------------
# 1. GET /users/{id}/ returns groups as [{id, name, kind}]
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_get_user_returns_groups_with_kind():
    """GET /users/{id}/ returns groups as [{id, name, kind}], not [name]."""
    role = _role_group("KindTestRole")
    contact = _contact()
    user = User.objects.create_user(username="kind_target", password="x")
    user.groups.add(role)

    actor = _make_user("kind_actor", superuser=True)
    client = _api(actor)

    res = client.get(f"/api/core/users/{user.pk}/")
    assert res.status_code == 200
    groups = res.data["groups"]
    assert len(groups) > 0
    assert isinstance(groups[0], dict)
    assert "kind" in groups[0]
    assert "id" in groups[0]
    assert "name" in groups[0]
    assert groups[0]["kind"] in ("ROLE", "TEAM", None)
    assert groups[0]["name"] == role.name


# ---------------------------------------------------------------------------
# 2. POST /users/ still accepts groups as [name] strings
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_create_user_accepts_group_names_as_before():
    """POST /users/ still accepts groups as [name] strings (backwards compat)."""
    role = _role_group("KindWriteRole")
    contact = _contact("Write Contact", "76.000.002-2")
    actor = _make_user("kind_write_actor", superuser=True)
    client = _api(actor)

    res = client.post(
        "/api/core/users/",
        {
            "username": "kind_new_user",
            "password": "strongpass123",
            "contact": contact.pk,
            "groups": [role.name],
        },
        format="json",
    )
    assert res.status_code == 201, res.data
    created = User.objects.get(username="kind_new_user")
    assert created.groups.filter(name=role.name).exists()


# ---------------------------------------------------------------------------
# 3. POST /groups/ {name, kind: ROLE} creates a ROLE GroupProfile
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_create_group_with_kind_role():
    """POST /groups/ {name, kind: ROLE} creates a ROLE GroupProfile."""
    from core.models.rbac import GroupProfile

    actor = _make_user("kind_group_actor", superuser=True)
    client = _api(actor)

    res = client.post(
        "/api/core/groups/",
        {"name": "Nuevo Puesto", "kind": "ROLE"},
        format="json",
    )
    assert res.status_code == 201, res.data
    profile = GroupProfile.objects.get(group__name="Nuevo Puesto")
    assert profile.kind == "ROLE"


# ---------------------------------------------------------------------------
# 4. POST /groups/ without kind defaults to TEAM
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_create_group_defaults_to_team():
    """POST /groups/ without kind defaults to TEAM."""
    from core.models.rbac import GroupProfile

    actor = _make_user("team_group_actor", superuser=True)
    client = _api(actor)

    res = client.post(
        "/api/core/groups/",
        {"name": "Equipo Test"},
        format="json",
    )
    assert res.status_code == 201, res.data
    profile = GroupProfile.objects.get(group__name="Equipo Test")
    assert profile.kind == "TEAM"


# ---------------------------------------------------------------------------
# 5. POST /users/ response includes sod_warnings
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_create_user_response_includes_sod_warnings():
    """POST /users/ response includes sod_warnings key."""
    role = _role_group("SodCreateRole")
    contact = _contact("SoD Contact", "76.000.003-3")
    actor = _make_user("sod_create_actor", superuser=True)
    client = _api(actor)

    res = client.post(
        "/api/core/users/",
        {
            "username": "sod_new_user",
            "password": "strongpass123",
            "contact": contact.pk,
            "groups": [role.name],
        },
        format="json",
    )
    assert res.status_code == 201, res.data
    assert "sod_warnings" in res.data


# ---------------------------------------------------------------------------
# 6. PATCH /users/{id}/ response includes sod_warnings (empty when no conflict)
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_update_user_response_includes_sod_warnings():
    """PATCH /users/{id}/ returns sod_warnings (empty list when no conflict)."""
    role = _role_group("SodUpdateRole")
    contact = _contact("SoD Update Contact", "76.000.004-4")
    target = User.objects.create_user(username="sod_update_target", password="x")
    target.groups.add(role)

    actor = _make_user("sod_update_actor", superuser=True)
    client = _api(actor)

    res = client.patch(
        f"/api/core/users/{target.pk}/",
        {"groups": [role.name]},
        format="json",
    )
    assert res.status_code == 200, res.data
    assert "sod_warnings" in res.data
    assert res.data["sod_warnings"] == []
