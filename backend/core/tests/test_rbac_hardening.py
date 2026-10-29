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
