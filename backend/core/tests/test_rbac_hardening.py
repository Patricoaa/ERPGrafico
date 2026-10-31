import pytest
from django.contrib.auth.models import Group
from rest_framework.test import APIClient

from core.permissions import Roles
from core.tests.rbac_factories import make_user

# Stable group names used throughout these tests
_OPERATOR_GROUP = "Operadores Demo"
_ADMIN_LIKE_GROUP = Roles.SYSTEM_ADMIN


@pytest.mark.django_db
@pytest.mark.parametrize("url", ["/api/auth/user/", "/api/core/auth/me/"])
def test_me_patch_cannot_change_groups(url):
    admin_group, _ = Group.objects.get_or_create(name=_ADMIN_LIKE_GROUP)
    admin_group.profile.kind = "ROLE"
    admin_group.profile.is_system = True
    admin_group.profile.save()
    user = make_user("op", groups=(_OPERATOR_GROUP,))
    client = APIClient()
    client.force_authenticate(user)
    client.patch(url, {"groups": [_ADMIN_LIKE_GROUP], "is_active": False}, format="json")
    user.refresh_from_db()
    assert list(user.groups.values_list("name", flat=True)) == [_OPERATOR_GROUP]
    assert user.is_active is True


@pytest.mark.django_db
def test_me_patch_mixed_payload_only_applies_theme():
    user = make_user("op", groups=(_OPERATOR_GROUP,))
    client = APIClient()
    client.force_authenticate(user)
    r = client.patch(
        "/api/core/auth/me/",
        {"theme": "dark", "username": "root", "groups": [_ADMIN_LIKE_GROUP]},
        format="json",
    )
    user.refresh_from_db()
    assert r.status_code == 200
    assert (user.theme, user.username) == ("dark", "op")
    assert [g["name"] for g in r.data["groups"]] == [_OPERATOR_GROUP]


# --- Task 2: roles ---

ADMIN_GROUP_PERMS = ("auth.add_group", "auth.change_group", "auth.delete_group", "auth.view_group")


def _client(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


@pytest.mark.django_db
def test_operator_cannot_create_rename_or_delete_groups():
    admin_group = Group.objects.get_or_create(name=_ADMIN_LIKE_GROUP)[0]
    admin_group.profile.kind = "ROLE"
    admin_group.profile.is_system = True
    admin_group.profile.save()
    team = Group.objects.create(name="Equipo")
    c = _client(make_user("op", groups=(_OPERATOR_GROUP,)))
    assert c.post("/api/core/groups/", {"name": "X"}, format="json").status_code == 403
    assert c.patch(f"/api/core/groups/{team.id}/", {"name": "Y"}, format="json").status_code == 403
    assert c.delete(f"/api/core/groups/{team.id}/").status_code == 403
    assert Group.objects.filter(pk=admin_group.pk).exists()


@pytest.mark.django_db
def test_admin_cannot_delete_system_role():
    admin_group = Group.objects.get_or_create(name=_ADMIN_LIKE_GROUP)[0]
    admin_group.profile.kind = "ROLE"
    admin_group.profile.is_system = True
    admin_group.profile.save()
    c = _client(make_user("adm", *ADMIN_GROUP_PERMS))
    assert c.delete(f"/api/core/groups/{admin_group.id}/").status_code == 400
    assert Group.objects.filter(pk=admin_group.pk).exists()


@pytest.mark.django_db
def test_admin_cannot_rename_system_role():
    op = Group.objects.get_or_create(name=_OPERATOR_GROUP)[0]
    op.profile.kind = "ROLE"
    op.profile.is_system = True
    op.profile.save()
    c = _client(make_user("adm", *ADMIN_GROUP_PERMS))
    assert c.patch(f"/api/core/groups/{op.id}/", {"name": "X"}, format="json").status_code == 400
    op.refresh_from_db()
    assert op.name == _OPERATOR_GROUP


@pytest.mark.django_db
def test_admin_can_create_and_delete_team_group():
    c = _client(make_user("adm", *ADMIN_GROUP_PERMS))
    r = c.post("/api/core/groups/", {"name": "Imprenta"}, format="json")
    assert r.status_code == 201
    assert c.delete(f"/api/core/groups/{r.data['id']}/").status_code == 204


@pytest.mark.django_db
def test_operator_template_can_list_groups():
    from django.core.management import call_command

    call_command("sync_permissions")
    # After sync_permissions a user with auth.view_group can list groups.
    # auth.view_group is part of core.security (sysadmin bundle).
    c = _client(make_user("op", "auth.view_group"))
    assert c.get("/api/core/groups/").status_code == 200


@pytest.mark.django_db
def test_group_list_query_count(django_assert_max_num_queries):
    for i in range(10):
        Group.objects.create(name=f"G{i}")
    c = _client(make_user("adm", *ADMIN_GROUP_PERMS))
    with django_assert_max_num_queries(3):
        assert c.get("/api/core/groups/").status_code == 200


# --- Task 7: endpoint genérico de acciones documentales eliminado ---


@pytest.mark.django_db
def test_generic_document_action_endpoint_removed():
    from django.urls import NoReverseMatch, reverse

    with pytest.raises(NoReverseMatch):
        reverse("document-action", kwargs={"content_type_id": 1, "object_id": 1, "action": "confirm"})
    user = make_user("op", groups=(_OPERATOR_GROUP,))
    assert _client(user).post("/api/core/documents/1/1/confirm/").status_code == 404


# --- Task 9: sin sesión solo nombre y logo ---


@pytest.mark.django_db
def test_branding_is_public_and_minimal():
    """Anonymous GET /api/core/company/branding/ returns 200 with only branding fields."""
    from core.models import CompanySettings

    CompanySettings.objects.create(
        name="ACME Ltda",
        trade_name="ACME",
        tax_id="76.000.000-0",
        address="Calle 123",
        phone="+56912345678",
        email="info@acme.cl",
    )
    client = APIClient()  # anonymous
    r = client.get("/api/core/company/branding/")
    assert r.status_code == 200
    assert set(r.data.keys()) == {"name", "trade_name", "logo", "logo_url"}
    assert r.data["name"] == "ACME Ltda"
    assert r.data["trade_name"] == "ACME"


@pytest.mark.django_db
def test_company_current_requires_authentication():
    """Anonymous GET /api/core/company/current/ now returns 401; authenticated returns 200 with tax_id."""
    from core.models import CompanySettings

    CompanySettings.objects.create(
        name="ACME Ltda",
        trade_name="ACME",
        tax_id="76.000.000-0",
    )
    anon = APIClient()
    assert anon.get("/api/core/company/current/").status_code == 401

    user = make_user("viewer", "core.view_companysettings")
    auth = _client(user)
    r = auth.get("/api/core/company/current/")
    assert r.status_code == 200
    assert "tax_id" in r.data
