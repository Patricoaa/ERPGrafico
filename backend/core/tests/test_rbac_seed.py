"""Tests for seeded roles and sync_permissions rewrite (Task 6).

Spec §2.1 — 11 puestos de trabajo (seeded roles).
"""
import pytest
from django.contrib.auth.models import Group


# ---------------------------------------------------------------------------
# 1. All 11 seeded roles are present in SEEDED_ROLES
# ---------------------------------------------------------------------------

def test_seeded_roles_count():
    """SEEDED_ROLES must define exactly 11 roles."""
    from core.rbac.seed import SEEDED_ROLES

    assert len(SEEDED_ROLES) == 11


def test_seeded_roles_have_required_fields():
    """Every SeededRole must have name, description, bundles (list), is_system (bool)."""
    from core.rbac.seed import SEEDED_ROLES
    from core.rbac.bundles import BUNDLES

    for key, role in SEEDED_ROLES.items():
        assert isinstance(role["name"], str) and role["name"], f"{key}: empty name"
        assert isinstance(role["description"], str), f"{key}: missing description"
        assert isinstance(role["bundles"], list), f"{key}: bundles must be a list"
        assert isinstance(role["is_system"], bool), f"{key}: is_system must be a bool"
        for bundle in role["bundles"]:
            assert bundle in BUNDLES, f"{key}: unknown bundle '{bundle}'"


def test_sysadmin_is_system_and_has_all_bundles():
    """sysadmin role must be is_system=True and include core.security + all module manage."""
    from core.rbac.seed import SEEDED_ROLES, _ALL_MODULE_BUNDLES, _ALL_SENSITIVE_BUNDLES

    role = SEEDED_ROLES["sysadmin"]
    assert role["is_system"] is True
    bundles = set(role["bundles"])
    # Must include core.security (sensitive)
    assert "core.security" in bundles
    # Must include all module manage bundles
    for b in _ALL_MODULE_BUNDLES:
        assert b in bundles, f"sysadmin missing bundle: {b}"
    # Must include all sensitive bundles
    for b in _ALL_SENSITIVE_BUNDLES:
        assert b in bundles, f"sysadmin missing sensitive bundle: {b}"


def test_auditor_has_only_read_bundles():
    """Auditor must have exactly all *.read bundles and nothing else."""
    from core.rbac.seed import SEEDED_ROLES, _ALL_READ_BUNDLES

    role = SEEDED_ROLES["auditor"]
    assert set(role["bundles"]) == set(_ALL_READ_BUNDLES), (
        f"Auditor bundles mismatch. Extra: {set(role['bundles']) - set(_ALL_READ_BUNDLES)}, "
        f"Missing: {set(_ALL_READ_BUNDLES) - set(role['bundles'])}"
    )


# ---------------------------------------------------------------------------
# 2. Parametric permission membership test per spec §2.1
# ---------------------------------------------------------------------------

@pytest.mark.django_db
@pytest.mark.parametrize(
    "role_key, perm_in, perms_out",
    [
        (
            "ventas",
            "sales.confirm_saleorder",    # sales.operate → should be IN
            ["billing.annul_invoice",      # destructive → out of operate
             "hr.view_payroll",            # sensitive → never in ventas
             "treasury.view_treasurymovement"],  # not in ventas bundles
        ),
        (
            "auditor",
            "sales.view_saleorder",       # read perm → IN for auditor
            ["sales.add_saleorder",        # operate perm → NOT in auditor
             "hr.view_payroll",            # sensitive → NOT in auditor
             "treasury.add_treasurymovement"],  # not in read bundles
        ),
        (
            "gerencia",
            "sales.view_saleorder",       # should be IN
            ["hr.view_payroll",            # sensitive, excluded from gerencia
             "treasury.add_treasurymovement"],  # treasury.payments is sensitive
        ),
        (
            "rrhh",
            "hr.view_payroll",            # hr.payroll sensitive bundle → IN
            ["accounting.view_account",    # not in rrhh bundles
             "sales.view_saleorder"],      # not in rrhh bundles
        ),
    ],
)
def test_seeded_roles_match_spec(role_key, perm_in, perms_out):
    """Verify specific permissions are in/out for key roles per spec §2.1."""
    from core.rbac.seed import SEEDED_ROLES
    from core.rbac.bundles import expand

    bundles = SEEDED_ROLES[role_key]["bundles"]
    expanded = expand(bundles)

    app, codename = perm_in.split(".", 1)
    assert perm_in in expanded, (
        f"Role '{role_key}' should include '{perm_in}' but does not. "
        f"Role bundles: {bundles}"
    )

    for perm_out in perms_out:
        assert perm_out not in expanded, (
            f"Role '{role_key}' should NOT include '{perm_out}' but does."
        )


# ---------------------------------------------------------------------------
# 3. sync_permissions creates all 11 seeded role groups
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_sync_permissions_creates_seeded_groups():
    """sync_permissions must create one Group per seeded role."""
    from django.core.management import call_command
    from core.rbac.seed import SEEDED_ROLES

    call_command("sync_permissions", verbosity=0)

    for key, role in SEEDED_ROLES.items():
        assert Group.objects.filter(name=role["name"]).exists(), (
            f"sync_permissions did not create group for seeded role '{key}': {role['name']}"
        )


@pytest.mark.django_db
def test_sync_permissions_sets_role_profiles():
    """After sync_permissions, each seeded role group has kind=ROLE, is_system and bundles."""
    from django.core.management import call_command
    from core.rbac.seed import SEEDED_ROLES

    call_command("sync_permissions", verbosity=0)

    for key, role_data in SEEDED_ROLES.items():
        group = Group.objects.get(name=role_data["name"])
        profile = group.profile
        assert profile.kind == "ROLE", (
            f"Seeded role '{key}' has kind={profile.kind}, expected ROLE"
        )
        assert profile.is_system == role_data["is_system"], (
            f"Seeded role '{key}' has is_system={profile.is_system}, "
            f"expected {role_data['is_system']}"
        )
        assert set(profile.bundles) == set(role_data["bundles"]), (
            f"Seeded role '{key}' bundles mismatch"
        )


@pytest.mark.django_db
def test_sync_permissions_does_not_overwrite_customized_profile():
    """sync_permissions must preserve manually customized GroupProfile bundles."""
    from django.core.management import call_command
    from core.rbac.seed import SEEDED_ROLES

    # Pre-create the 'ventas' group with a customized profile
    role_data = SEEDED_ROLES["ventas"]
    group, _ = Group.objects.get_or_create(name=role_data["name"])
    profile = group.profile
    profile.kind = "ROLE"
    profile.is_system = True
    profile.bundles = ["sales.read"]  # customized: only sales.read instead of full ventas bundles
    profile.save()

    call_command("sync_permissions", verbosity=0)

    profile.refresh_from_db()
    # The customization must be preserved (not overwritten)
    assert profile.bundles == ["sales.read"], (
        "sync_permissions overwrote a manually customized GroupProfile"
    )


@pytest.mark.django_db
def test_sync_permissions_materializes_permissions():
    """After sync_permissions, seeded role groups have actual DB permissions set."""
    from django.core.management import call_command

    call_command("sync_permissions", verbosity=0)

    ventas_group = Group.objects.get(name="Ventas")
    perm_codes = {
        f"{p.content_type.app_label}.{p.codename}"
        for p in ventas_group.permissions.select_related("content_type")
    }
    # Ventas has sales.operate → includes confirm_saleorder
    assert any("sales" in c for c in perm_codes), (
        "Ventas group has no sales permissions after sync_permissions"
    )
