"""
test_frontend_action_alignment.py

Lightweight smoke-test: verifies that frontend action files reference the correct
business-verb permission strings (those registered in the backend apps.py / views.py)
rather than approximate CRUD permissions (change_*, delete_*, add_*).

Strategy: simple string-grep — no AST parsing, no import resolution.
A failing assertion means the frontend file still uses the old approximate permission.

Each tuple is: (relative_frontend_path, label, expected_permission_string)
"""
import os
from pathlib import Path

import pytest

# ---------------------------------------------------------------------------
# Root of the repository — two levels up from this test file (backend/core/tests/)
# ---------------------------------------------------------------------------
REPO_ROOT = Path(__file__).resolve().parents[3]
FRONTEND_ROOT = REPO_ROOT / "frontend"


def _read(rel_path: str) -> str:
    full = FRONTEND_ROOT / rel_path
    assert full.exists(), f"Frontend file not found: {full}"
    return full.read_text()


# ---------------------------------------------------------------------------
# Map: (frontend_file, human_label, expected_permission_string_in_that_file)
# ---------------------------------------------------------------------------
ENDPOINT_PERMISSION_MAP: list[tuple[str, str, str]] = [
    # ── Invoice ────────────────────────────────────────────────────────────
    (
        "features/accounting/journalEntryActions.ts",
        "post-entry uses accounting.post_journalentry",
        "accounting.post_journalentry",
    ),
    (
        "features/accounting/journalEntryActions.ts",
        "reverse-entry uses accounting.reverse_journalentry",
        "accounting.reverse_journalentry",
    ),
    # ── Invoice (billing) ──────────────────────────────────────────────────
    (
        "features/treasury/paymentActions.ts",
        "annul-payment uses treasury.annul_treasurymovement",
        "treasury.annul_treasurymovement",
    ),
    (
        "features/treasury/paymentActions.ts",
        "cancel-payment uses treasury.cancel_treasurymovement",
        "treasury.cancel_treasurymovement",
    ),
    # ── Invoice cancel (billing) ───────────────────────────────────────────
    (
        "features/orders/hooks/useOrderRelatedActions.tsx",
        "cancel-draft-invoice uses billing.cancel_invoice",
        "billing.cancel_invoice",
    ),
    # ── TreasuryMovement annul/cancel ──────────────────────────────────────
    (
        "features/orders/hooks/useOrderRelatedActions.tsx",
        "annul-payment uses treasury.annul_treasurymovement",
        "treasury.annul_treasurymovement",
    ),
    (
        "features/orders/hooks/useOrderRelatedActions.tsx",
        "cancel-payment uses treasury.cancel_treasurymovement",
        "treasury.cancel_treasurymovement",
    ),
    # ── Logistics annul ───────────────────────────────────────────────────
    (
        "features/orders/hooks/useOrderRelatedActions.tsx",
        "annul sale delivery uses sales.annul_saledelivery",
        "sales.annul_saledelivery",
    ),
    (
        "features/orders/hooks/useOrderRelatedActions.tsx",
        "annul purchase receipt uses purchasing.annul_purchasereceipt",
        "purchasing.annul_purchasereceipt",
    ),
    # ── WorkOrder annul ────────────────────────────────────────────────────
    (
        "features/orders/hooks/useOrderRelatedActions.tsx",
        "annul work order uses production.annul_workorder",
        "production.annul_workorder",
    ),
    # ── CashMovement annul/cancel ─────────────────────────────────────────
    (
        "features/treasury/hooks/useCashMovementActions.tsx",
        "annul uses treasury.annul_treasurymovement",
        "treasury.annul_treasurymovement",
    ),
    (
        "features/treasury/hooks/useCashMovementActions.tsx",
        "cancel uses treasury.cancel_treasurymovement",
        "treasury.cancel_treasurymovement",
    ),
    (
        "features/treasury/hooks/useCashMovementActions.tsx",
        "cancel-draft-invoice uses billing.cancel_invoice",
        "billing.cancel_invoice",
    ),
    # ── SaleOrder cancel/annul ─────────────────────────────────────────────
    (
        "features/orders/components/sheet/OrderSheet.tsx",
        "cancel sale order uses sales.cancel_saleorder",
        "sales.cancel_saleorder",
    ),
    (
        "features/orders/components/sheet/OrderSheet.tsx",
        "annul sale order uses sales.annul_saleorder",
        "sales.annul_saleorder",
    ),
    # ── PurchaseOrder cancel/annul ─────────────────────────────────────────
    (
        "features/orders/components/sheet/OrderSheet.tsx",
        "cancel purchase order uses purchasing.cancel_purchaseorder",
        "purchasing.cancel_purchaseorder",
    ),
    (
        "features/orders/components/sheet/OrderSheet.tsx",
        "annul purchase order uses purchasing.annul_purchaseorder",
        "purchasing.annul_purchaseorder",
    ),
    # ── Invoice confirm (sales) ────────────────────────────────────────────
    (
        "features/sales/actions.tsx",
        "complete-folio uses billing.confirm_invoice",
        "billing.confirm_invoice",
    ),
    # ── Invoice confirm (purchasing) ───────────────────────────────────────
    (
        "features/purchasing/actions.tsx",
        "complete-folio uses billing.confirm_invoice",
        "billing.confirm_invoice",
    ),
]


@pytest.mark.parametrize("rel_path,label,expected_perm", ENDPOINT_PERMISSION_MAP)
def test_frontend_actions_use_backend_permission(rel_path: str, label: str, expected_perm: str) -> None:
    """
    Each frontend action file must reference the exact business-verb permission
    that the Django backend registers in action_permissions / apps.py.

    This is a string-grep test — no AST parsing. If the string appears anywhere
    in the file the check passes; the tests are designed to catch the common case
    of using an approximate CRUD permission (change_*, delete_*, add_*) instead
    of the correct business verb.
    """
    content = _read(rel_path)
    assert expected_perm in content, (
        f"\n[{label}]\n"
        f"Expected to find '{expected_perm}' in {rel_path}\n"
        f"The file still uses an approximate CRUD permission instead of the backend business verb.\n"
        f"Fix: replace the approximate permission with '{expected_perm}' in that file."
    )
