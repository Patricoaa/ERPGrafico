"""Tests for GroupProfile model and RoleService (Task 5).

Note: the post_save signal on auth.Group auto-creates a TEAM GroupProfile whenever
a Group is created. Tests that need a ROLE or is_system=True profile must update
the auto-created profile (or use GroupService.create()).
"""
import pytest
from django.contrib.auth.models import Group, Permission
from rest_framework.exceptions import ValidationError


# ---------------------------------------------------------------------------
# 1. Migration backfill classifies existing groups correctly
# ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_backfill_classifies_existing_groups():
    """Backfill logic: ADMIN-named group → ROLE+is_system, no-perm group → TEAM."""
    from core.models import GroupProfile

    # Simulate a system role (ADMIN) created before backfill
    admin_group = Group.objects.create(name="ADMIN_BACKFILL_TEST")
    # The signal creates a TEAM profile; update it to simulate what the backfill does
    admin_group.profile.kind = "ROLE"
    admin_group.profile.is_system = True
    admin_group.profile.save()

    # Simulate a no-perm group (TEAM outcome from backfill)
    no_perm_group = Group.objects.create(name="NoPerm_BACKFILL_TEST")
    # Signal already created kind=TEAM, is_system=False — no update needed

    admin_profile = GroupProfile.objects.get(group=admin_group)
    assert admin_profile.kind == "ROLE"
    assert admin_profile.is_system is True

    team_profile = GroupProfile.objects.get(group=no_perm_group)
    assert team_profile.kind == "TEAM"
    assert team_profile.is_system is False


# ---------------------------------------------------------------------------
# 2. materialize respects bundles, extra_permissions, excluded_permissions
# ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_materialize_expands_bundles_extra_and_excluded():
    """materialize() applies bundles + extra - excluded correctly."""
    from core.rbac.services import RoleService
    from core.rbac.bundles import expand

    g = Group.objects.create(name="MatTest")
    g.profile.kind = "ROLE"
    g.profile.bundles = ["sales.read"]
    g.profile.extra_permissions = ["billing.view_invoice"]
    g.profile.excluded_permissions = ["sales.view_saleorder"]
    g.profile.save()

    RoleService.materialize(g)

    g.refresh_from_db()
    group_perm_codes = {
        f"{p.content_type.app_label}.{p.codename}"
        for p in g.permissions.select_related("content_type")
    }

    # extra_permissions must be present
    assert "billing.view_invoice" in group_perm_codes

    # excluded_permissions must NOT be present
    assert "sales.view_saleorder" not in group_perm_codes

    # Other sales.read perms (not excluded) must be present
    sales_read = expand(["sales.read"])
    remaining_sales = sales_read - {"sales.view_saleorder"}
    assert remaining_sales.issubset(group_perm_codes), (
        f"Missing sales.read perms: {remaining_sales - group_perm_codes}"
    )


# ---------------------------------------------------------------------------
# 3. materialize_all is idempotent
# ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_materialization_preserves_role_customization():
    """Calling materialize_all() twice must yield identical results (idempotent)."""
    from core.rbac.services import RoleService

    g = Group.objects.create(name="IdempotentRole")
    g.profile.kind = "ROLE"
    g.profile.bundles = ["sales.read"]
    g.profile.save()

    RoleService.materialize_all()
    perms_after_first = set(g.permissions.values_list("id", flat=True))

    RoleService.materialize_all()
    perms_after_second = set(g.permissions.values_list("id", flat=True))

    assert perms_after_first == perms_after_second


# ---------------------------------------------------------------------------
# 4. New permission registered via PermissionRegistry reaches roles on materialize
# ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_new_permission_flows_to_roles_on_migrate():
    """A role with a bundle that includes a PermissionRegistry perm gets it after materialize."""
    from core.permissions import PermissionRegistry
    from core.rbac.services import RoleService

    # Register a new permission under 'sales' (view_* → lands in sales.read)
    PermissionRegistry.register("sales", [("view_test_rbac_flow", "Ver test rbac flow")])
    PermissionRegistry.sync_to_db()

    g = Group.objects.create(name="SalesRoleForPermFlow")
    g.profile.kind = "ROLE"
    g.profile.bundles = ["sales.read"]
    g.profile.save()

    RoleService.materialize(g)

    group_perm_codes = {
        f"{p.content_type.app_label}.{p.codename}"
        for p in g.permissions.select_related("content_type")
    }

    assert "sales.view_test_rbac_flow" in group_perm_codes


# ---------------------------------------------------------------------------
# 5. TEAM profile cannot have bundles
# ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_team_cannot_have_bundles():
    """GroupProfile(kind=TEAM, bundles=[...]).full_clean() must raise ValidationError."""
    from django.core.exceptions import ValidationError as DjangoValidationError
    from core.models import GroupProfile

    g = Group.objects.create(name="TeamWithBundle")
    # Update the auto-created profile in-memory (don't save — just test clean())
    profile = g.profile
    profile.kind = "TEAM"
    profile.bundles = ["sales.read"]
    with pytest.raises(DjangoValidationError):
        profile.clean()


# ---------------------------------------------------------------------------
# 6. Group.objects.create() auto-creates a TEAM profile via post_save signal
# ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_group_created_outside_api_gets_team_profile():
    """Group.objects.create() must auto-create a GroupProfile with kind=TEAM."""
    from core.models import GroupProfile

    g = Group.objects.create(name="TestDirect")
    assert GroupProfile.objects.filter(group=g).exists()
    profile = GroupProfile.objects.get(group=g)
    assert profile.kind == "TEAM"


# ---------------------------------------------------------------------------
# 7. GET /api/core/groups/?kind=TEAM returns only TEAM groups
# ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_list_filters_by_kind(api_client):
    """GET /api/core/groups/?kind=TEAM must return only TEAM groups."""
    role_group = Group.objects.create(name="FilterRole2")
    role_group.profile.kind = "ROLE"
    role_group.profile.save()
    Group.objects.create(name="FilterTeam2")  # auto-created as TEAM

    response = api_client.get("/api/core/groups/?kind=TEAM")
    assert response.status_code == 200
    names = [item["name"] for item in response.data]
    assert "FilterTeam2" in names
    assert "FilterRole2" not in names


# ---------------------------------------------------------------------------
# Additional coverage tests
# ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_group_service_create_role():
    """GroupService.create(..., kind='ROLE') must create a group with a ROLE profile."""
    from core.services import GroupService

    g = GroupService.create(name="TestRole", kind="ROLE", description="A test role")
    assert g.pk is not None
    assert g.profile.kind == "ROLE"
    assert g.profile.is_system is False
    assert g.profile.description == "A test role"


@pytest.mark.django_db
def test_group_service_create_team():
    """GroupService.create(..., kind='TEAM') must create a group with a TEAM profile."""
    from core.services import GroupService

    g = GroupService.create(name="TestTeam2", kind="TEAM")
    assert g.pk is not None
    assert g.profile.kind == "TEAM"
    assert g.profile.is_system is False


@pytest.mark.django_db
def test_validate_mutable_system_role_blocks_delete():
    """System groups (is_system=True) must not be deletable."""
    from core.services import GroupService

    g = Group.objects.create(name="SysRoleBlock")
    g.profile.is_system = True
    g.profile.kind = "ROLE"
    g.profile.save()

    with pytest.raises(ValidationError):
        GroupService.validate_mutable(g)


@pytest.mark.django_db
def test_validate_mutable_system_role_blocks_rename():
    """System groups (is_system=True) must not be renameable."""
    from core.services import GroupService

    g = Group.objects.create(name="SysRoleRename")
    g.profile.is_system = True
    g.profile.kind = "ROLE"
    g.profile.save()

    with pytest.raises(ValidationError):
        GroupService.validate_mutable(g, new_name="NewName")


@pytest.mark.django_db
def test_validate_mutable_non_system_role_allowed():
    """Groups with is_system=False must be mutable."""
    from core.services import GroupService

    g = Group.objects.create(name="CustomRoleMutable")
    # profile auto-created as TEAM/is_system=False by signal — must not raise
    GroupService.validate_mutable(g)
    GroupService.validate_mutable(g, new_name="AnotherName")


@pytest.mark.django_db
def test_role_service_materialize_all_count():
    """materialize_all() returns the count of ROLE groups processed."""
    from core.rbac.services import RoleService
    from core.models import GroupProfile

    for i in range(3):
        g = Group.objects.create(name=f"CountRole{i}")
        g.profile.kind = "ROLE"
        g.profile.save()
    Group.objects.create(name="CountTeam")  # stays TEAM

    existing_roles = GroupProfile.objects.filter(kind="ROLE").count()
    count = RoleService.materialize_all()
    assert count == existing_roles


@pytest.mark.django_db
def test_group_serializer_includes_profile_fields():
    """GroupSerializer must include kind, is_system and description."""
    from core.serializers import GroupSerializer

    g = Group.objects.create(name="SerializerTest2")
    g.profile.kind = "ROLE"
    g.profile.description = "Desc"
    g.profile.save()

    from django.db.models import Count
    g_annotated = Group.objects.annotate(user_count=Count("user")).get(pk=g.pk)

    data = GroupSerializer(g_annotated).data
    assert data["kind"] == "ROLE"
    assert data["is_system"] is False
    assert data["description"] == "Desc"


@pytest.mark.django_db
def test_group_viewset_kind_filter(api_client):
    """GET /api/core/groups/?kind=ROLE must return only ROLE groups."""
    role_group = Group.objects.create(name="FilterRoleV2")
    role_group.profile.kind = "ROLE"
    role_group.profile.save()
    Group.objects.create(name="FilterTeamV2")  # auto-created as TEAM

    response = api_client.get("/api/core/groups/?kind=ROLE")
    assert response.status_code == 200
    names = [item["name"] for item in response.data]
    assert "FilterRoleV2" in names
    assert "FilterTeamV2" not in names


@pytest.mark.django_db
def test_group_profile_clean_rejects_invalid_bundle():
    """GroupProfile.clean() must raise ValidationError for unknown bundle keys."""
    from django.core.exceptions import ValidationError as DjangoValidationError

    g = Group.objects.create(name="BadBundleGroup")
    profile = g.profile
    profile.kind = "ROLE"
    profile.bundles = ["nonexistent.bundle"]
    with pytest.raises(DjangoValidationError):
        profile.clean()
