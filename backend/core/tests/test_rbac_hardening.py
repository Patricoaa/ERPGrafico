import pytest
from django.contrib.auth.models import Group
from rest_framework.test import APIClient

from core.permissions import Roles
from core.tests.rbac_factories import make_user


@pytest.mark.django_db
@pytest.mark.parametrize("url", ["/api/auth/user/", "/api/core/auth/me/"])
def test_me_patch_cannot_change_groups(url):
    Group.objects.get_or_create(name=Roles.ADMIN)
    user = make_user("op", groups=(Roles.OPERATOR,))
    client = APIClient()
    client.force_authenticate(user)
    client.patch(url, {"groups": [Roles.ADMIN], "is_active": False}, format="json")
    user.refresh_from_db()
    assert list(user.groups.values_list("name", flat=True)) == [Roles.OPERATOR]
    assert user.is_active is True


@pytest.mark.django_db
def test_me_patch_mixed_payload_only_applies_theme():
    user = make_user("op", groups=(Roles.OPERATOR,))
    client = APIClient()
    client.force_authenticate(user)
    r = client.patch(
        "/api/core/auth/me/",
        {"theme": "dark", "username": "root", "groups": [Roles.ADMIN]},
        format="json",
    )
    user.refresh_from_db()
    assert r.status_code == 200
    assert (user.theme, user.username) == ("dark", "op")
    assert r.data["groups"] == [Roles.OPERATOR]


# --- Task 2: roles ---

ADMIN_GROUP_PERMS = ("auth.add_group", "auth.change_group", "auth.delete_group", "auth.view_group")


def _client(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


@pytest.mark.django_db
def test_operator_cannot_create_rename_or_delete_groups():
    admin_group = Group.objects.get_or_create(name=Roles.ADMIN)[0]
    team = Group.objects.create(name="Equipo")
    c = _client(make_user("op", groups=(Roles.OPERATOR,)))
    assert c.post("/api/core/groups/", {"name": "X"}, format="json").status_code == 403
    assert c.patch(f"/api/core/groups/{team.id}/", {"name": "Y"}, format="json").status_code == 403
    assert c.delete(f"/api/core/groups/{team.id}/").status_code == 403
    assert Group.objects.filter(pk=admin_group.pk).exists()


@pytest.mark.django_db
def test_admin_cannot_delete_system_role():
    admin_group = Group.objects.get_or_create(name=Roles.ADMIN)[0]
    c = _client(make_user("adm", *ADMIN_GROUP_PERMS))
    assert c.delete(f"/api/core/groups/{admin_group.id}/").status_code == 400
    assert Group.objects.filter(pk=admin_group.pk).exists()


@pytest.mark.django_db
def test_admin_cannot_rename_system_role():
    op = Group.objects.get_or_create(name=Roles.OPERATOR)[0]
    c = _client(make_user("adm", *ADMIN_GROUP_PERMS))
    assert c.patch(f"/api/core/groups/{op.id}/", {"name": "X"}, format="json").status_code == 400
    op.refresh_from_db()
    assert op.name == Roles.OPERATOR


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
    c = _client(make_user("op", groups=(Roles.OPERATOR,)))
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
    user = make_user("op", groups=(Roles.OPERATOR,))
    assert _client(user).post("/api/core/documents/1/1/confirm/").status_code == 404
