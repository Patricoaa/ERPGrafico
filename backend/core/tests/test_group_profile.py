"""Tests for GroupProfile model and RoleService (Task 5)."""
import pytest
from django.contrib.auth.models import Group, Permission
from rest_framework.exceptions import ValidationError


# ---------------------------------------------------------------------------
# 1. GroupProfile created via GroupService.create sets kind and is_system
# ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_group_service_create_role():
    """GroupService.create(..., kind='ROLE') must create a group with a profile (kind=ROLE)."""
    from core.services import GroupService
    from core.models import GroupProfile

    g = GroupService.create(name="TestRole", kind="ROLE", description="A test role")
    assert g.pk is not None
    assert hasattr(g, "profile")
    assert g.profile.kind == "ROLE"
    assert g.profile.is_system is False
    assert g.profile.description == "A test role"


@pytest.mark.django_db
def test_group_service_create_team():
    """GroupService.create(..., kind='TEAM') must create a group with a profile (kind=TEAM)."""
    from core.services import GroupService
    from core.models import GroupProfile

    g = GroupService.create(name="TestTeam", kind="TEAM")
    assert g.pk is not None
    assert g.profile.kind == "TEAM"
    assert g.profile.is_system is False


# ---------------------------------------------------------------------------
# 2. validate_mutable uses profile.is_system when profile exists
# ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_validate_mutable_system_role_blocks_delete():
    """System groups (is_system=True) must not be deletable."""
    from core.services import GroupService
    from core.models import GroupProfile

    g = Group.objects.create(name="SysRole")
    GroupProfile.objects.create(group=g, kind="ROLE", is_system=True)

    with pytest.raises(ValidationError):
        GroupService.validate_mutable(g)


@pytest.mark.django_db
def test_validate_mutable_system_role_blocks_rename():
    """System groups (is_system=True) must not be renameable."""
    from core.services import GroupService
    from core.models import GroupProfile

    g = Group.objects.create(name="SysRole2")
    GroupProfile.objects.create(group=g, kind="ROLE", is_system=True)

    with pytest.raises(ValidationError):
        GroupService.validate_mutable(g, new_name="NewName")


@pytest.mark.django_db
def test_validate_mutable_non_system_role_allowed():
    """Groups with is_system=False must be mutable."""
    from core.services import GroupService
    from core.models import GroupProfile

    g = Group.objects.create(name="CustomRole")
    GroupProfile.objects.create(group=g, kind="ROLE", is_system=False)

    # Must not raise
    GroupService.validate_mutable(g)
    GroupService.validate_mutable(g, new_name="AnotherName")


# ---------------------------------------------------------------------------
# 3. RoleService.materialize computes permissions from bundles
# ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_role_service_materialize_from_bundles():
    """materialize() sets the correct Django perms from a bundle."""
    from core.rbac.services import RoleService
    from core.models import GroupProfile
    from core.rbac.bundles import expand

    g = Group.objects.create(name="SalesReader")
    GroupProfile.objects.create(group=g, kind="ROLE", bundles=["sales.read"])

    RoleService.materialize(g)

    g.refresh_from_db()
    group_perm_codes = {
        f"{p.content_type.app_label}.{p.codename}"
        for p in g.permissions.select_related("content_type")
    }

    expected = expand(["sales.read"])
    assert expected.issubset(group_perm_codes), (
        f"Missing: {expected - group_perm_codes}"
    )


# ---------------------------------------------------------------------------
# 4. RoleService.materialize_all returns correct count
# ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_role_service_materialize_all_count():
    """materialize_all() returns the count of ROLE groups processed."""
    from core.rbac.services import RoleService
    from core.models import GroupProfile

    # Create 3 ROLEs and 1 TEAM
    for i in range(3):
        g = Group.objects.create(name=f"Role{i}")
        GroupProfile.objects.create(group=g, kind="ROLE")
    t = Group.objects.create(name="ATeam")
    GroupProfile.objects.create(group=t, kind="TEAM")

    existing_roles = GroupProfile.objects.filter(kind="ROLE").count()
    count = RoleService.materialize_all()
    assert count == existing_roles


# ---------------------------------------------------------------------------
# 5. GroupSerializer includes kind, is_system, description
# ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_group_serializer_includes_profile_fields():
    """GroupSerializer must include kind, is_system and description."""
    from core.serializers import GroupSerializer
    from core.models import GroupProfile

    g = Group.objects.create(name="SerializerTest")
    GroupProfile.objects.create(group=g, kind="ROLE", is_system=False, description="Desc")

    # Annotate user_count (normally done in ViewSet queryset)
    from django.db.models import Count
    g_annotated = Group.objects.annotate(user_count=Count("user")).get(pk=g.pk)

    data = GroupSerializer(g_annotated).data
    assert data["kind"] == "ROLE"
    assert data["is_system"] is False
    assert data["description"] == "Desc"


# ---------------------------------------------------------------------------
# 6. GroupViewSet supports ?kind= filter
# ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_group_viewset_kind_filter(api_client):
    """GET /api/groups/?kind=ROLE must return only ROLE groups."""
    from core.models import GroupProfile

    role_group = Group.objects.create(name="FilterRole")
    GroupProfile.objects.create(group=role_group, kind="ROLE")
    team_group = Group.objects.create(name="FilterTeam")
    GroupProfile.objects.create(group=team_group, kind="TEAM")

    response = api_client.get("/api/core/groups/?kind=ROLE")
    assert response.status_code == 200
    names = [item["name"] for item in response.data]
    assert "FilterRole" in names
    assert "FilterTeam" not in names


# ---------------------------------------------------------------------------
# 7. GroupProfile.clean() rejects invalid bundle keys
# ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_group_profile_clean_rejects_invalid_bundle():
    """GroupProfile.clean() must raise ValidationError for unknown bundle keys."""
    from django.core.exceptions import ValidationError as DjangoValidationError
    from core.models import GroupProfile

    g = Group.objects.create(name="BadBundleGroup")
    profile = GroupProfile(group=g, kind="ROLE", bundles=["nonexistent.bundle"])
    with pytest.raises(DjangoValidationError):
        profile.clean()
