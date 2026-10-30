"""Tests for core.rbac.bundles and core.rbac.catalog (Task 4)."""
import pytest

from core.rbac.bundles import BUNDLES, expand, bundles_of
from core.rbac.catalog import curated_catalog


# ---------------------------------------------------------------------------
# 1. BUNDLES dict is populated with expected keys
# ---------------------------------------------------------------------------
def test_bundles_keys_include_module_and_sensitive():
    """BUNDLES must contain module bundles for core apps and sensitive bundles."""
    expected_module = {
        "sales.read", "sales.operate", "sales.manage",
        "hr.read", "hr.operate", "hr.manage",
        "treasury.read", "treasury.operate", "treasury.manage",
        "accounting.read", "accounting.operate", "accounting.manage",
    }
    expected_sensitive = {
        "hr.payroll", "hr.salary_advances",
        "treasury.payments", "treasury.credit_cards", "treasury.bank_loans",
        "contacts.profit_distribution",
        "core.security",
        "tax.declarations",
        "accounting.fiscal_year",
    }
    missing_module = expected_module - set(BUNDLES.keys())
    missing_sensitive = expected_sensitive - set(BUNDLES.keys())
    assert not missing_module, f"Missing module bundles: {sorted(missing_module)}"
    assert not missing_sensitive, f"Missing sensitive bundles: {sorted(missing_sensitive)}"


# ---------------------------------------------------------------------------
# 2. sensitive flag is correct per bundle type
# ---------------------------------------------------------------------------
def test_bundle_sensitive_flag():
    """Module bundles are NOT sensitive; sensitive capability bundles ARE."""
    for key in ("sales.read", "sales.operate", "sales.manage",
                "hr.read", "hr.operate", "hr.manage"):
        assert BUNDLES[key]["sensitive"] is False, f"{key} should be sensitive=False"
    for key in ("hr.payroll", "hr.salary_advances", "treasury.payments",
                "core.security", "tax.declarations"):
        assert BUNDLES[key]["sensitive"] is True, f"{key} should be sensitive=True"


# ---------------------------------------------------------------------------
# 3. expand() for read bundle contains expected view_* perms
# ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_expand_read_includes_view_perms():
    """expand('sales.read') must contain known view_* perms for sales."""
    read_perms = expand(["sales.read"])
    assert "sales.view_saleorder" in read_perms
    assert "sales.view_saledelivery" in read_perms
    assert "sales.view_dashboard_sales" in read_perms
    # must NOT contain add/change/delete perms
    assert "sales.add_saleorder" not in read_perms
    assert "sales.confirm_saleorder" not in read_perms


# ---------------------------------------------------------------------------
# 4. expand() for operate excludes destructive verbs
# ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_operate_excludes_destructive():
    """Destructive verbs (annul_*, cancel_*, delete_*, etc.) must NOT be in operate."""
    operate = expand(["sales.operate"])
    destructive = [
        "sales.annul_saleorder",
        "sales.cancel_saleorder",
        "sales.delete_saleorder",
        "sales.write_off_saleorder",
        "sales.annul_saledelivery",
        "sales.annul_salereturn",
    ]
    for p in destructive:
        assert p not in operate, f"{p} must not be in sales.operate"
    # Non-destructive business verbs ARE in operate
    assert "sales.confirm_saleorder" in operate
    assert "sales.dispatch_saleorder" in operate


# ---------------------------------------------------------------------------
# 5. Sensitive permissions are excluded from operate and manage
# ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_sensitive_perm_not_in_module_bundles():
    """Sensitive perms must not appear in any operate or manage bundle for their app."""
    # hr.view_payroll is in hr.payroll (sensitive) → not in hr.operate or hr.manage
    hr_operate = expand(["hr.operate"])
    hr_manage = expand(["hr.manage"])
    sensitive_hr = ["hr.view_payroll", "hr.add_payroll", "hr.change_payroll",
                    "hr.post_payroll", "hr.pay_payroll"]
    for p in sensitive_hr:
        assert p not in hr_operate, f"{p} must not be in hr.operate"
        assert p not in hr_manage, f"{p} must not be in hr.manage"

    # treasury.view_treasurymovement is in treasury.payments (sensitive)
    t_operate = expand(["treasury.operate"])
    t_manage = expand(["treasury.manage"])
    assert "treasury.view_treasurymovement" not in t_operate
    assert "treasury.view_treasurymovement" not in t_manage


# ---------------------------------------------------------------------------
# 6. expand() for known sensitive bundle returns expected permissions
# ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_expand_sensitive_bundle_content():
    """expand('hr.payroll') must contain the specific payroll permissions."""
    payroll_perms = expand(["hr.payroll"])
    expected = {
        "hr.view_payroll", "hr.add_payroll", "hr.change_payroll", "hr.delete_payroll",
        "hr.post_payroll", "hr.pay_payroll", "hr.annul_payrollpayment",
    }
    missing = expected - payroll_perms
    assert not missing, f"hr.payroll bundle missing: {sorted(missing)}"


# ---------------------------------------------------------------------------
# Spec-required: test_levels_are_cumulative
# ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_levels_are_cumulative():
    """expand(read) ⊆ expand(operate) ⊆ expand(manage) for sales."""
    read = expand(["sales.read"])
    operate = expand(["sales.operate"])
    manage = expand(["sales.manage"])
    assert read <= operate, f"sales.read not ⊆ sales.operate; extras: {sorted(read - operate)}"
    assert operate <= manage, f"sales.operate not ⊆ sales.manage; extras: {sorted(operate - manage)}"


# ---------------------------------------------------------------------------
# Spec-required: test_manage_includes_annul_and_delete
# ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_manage_includes_annul_and_delete():
    """Destructive verbs must be present in sales.manage."""
    manage = expand(["sales.manage"])
    for code in ("sales.annul_saleorder", "sales.cancel_saleorder", "sales.delete_saleorder"):
        assert code in manage, f"{code} must be in sales.manage"


# ---------------------------------------------------------------------------
# Spec-required: test_security_bundle_contains_user_and_group_admin
# ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_security_bundle_contains_user_and_group_admin():
    """core.security must contain user + group admin + audit log perms."""
    security = expand(["core.security"])
    for code in (
        "core.view_user", "core.add_user", "core.change_user", "core.delete_user",
        "auth.view_group", "auth.add_group", "auth.change_group", "auth.delete_group",
        "core.view_actionlog",
    ):
        assert code in security, f"{code} must be in core.security"


# ---------------------------------------------------------------------------
# 7. Every curated permission belongs to at least one bundle
# ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_every_curated_permission_belongs_to_a_bundle():
    """No permission in curated_catalog() should be orphaned (bundles list empty)."""
    orphans = []
    for app_entry in curated_catalog():
        for perm in app_entry["permissions"]:
            if not perm["bundles"]:
                orphans.append(perm["code"])
    assert not orphans, (
        f"{len(orphans)} orphaned permissions (belong to no bundle): {sorted(orphans)}"
    )
