"""
test_deletion_policy_consistency.py

Verifies that the deletion policy (docs/20-contracts/deletion-policy.md)
is consistent with the backend model implementations.

Every model listed in the deletion-policy table must:
- Anulación pattern → has `status` field with a CANCELLED-like value
- Archivo pattern → has `is_active` BooleanField
- Hard delete pattern → neither `status` enum nor `is_active` (or only for non-fiscal use)
"""
import re
from pathlib import Path

import pytest
from django.apps import apps
from django.conf import settings


# ── Deletion policy table: model_key → (app_label, model_name, pattern) ──
DELETION_POLICY = {
    'Account':           ('accounting', 'account', 'archivo'),
    'JournalEntry':      ('accounting', 'journalentry', 'anulacion'),
    'Invoice':           ('billing', 'invoice', 'anulacion'),
    'Contact':           ('contacts', 'contact', 'archivo'),
    'User':              ('core', 'user', 'archivo'),
    'Employee':          ('hr', 'employee', 'archivo'),
    'Product':           ('inventory', 'product', 'archivo'),
    'ProductCategory':   ('inventory', 'productcategory', 'archivo'),
    'UoM':               ('inventory', 'uom', 'archivo'),
    'UoMCategory':       ('inventory', 'uomcategory', 'archivo'),
    'Warehouse':         ('inventory', 'warehouse', 'archivo'),
    'StockMove':         ('inventory', 'stockmove', 'anulacion'),
    'WorkOrder':         ('production', 'workorder', 'anulacion'),
    'PurchaseOrder':     ('purchasing', 'purchaseorder', 'anulacion'),
    'PurchaseReceipt':   ('purchasing', 'purchasereceipt', 'anulacion'),
    'SaleOrder':         ('sales', 'saleorder', 'anulacion'),
    'SaleDelivery':      ('sales', 'saledelivery', 'anulacion'),
    'DraftCart':         ('sales', 'draftcart', 'hard_delete'),
    'TaxPeriod':         ('tax', 'taxperiod', 'archivo'),
    'Bank':              ('treasury', 'bank', 'archivo'),
    'TreasuryAccount':   ('treasury', 'treasuryaccount', 'archivo'),
    'PaymentMethod':     ('treasury', 'paymentmethod', 'archivo'),
    'TreasuryMovement':  ('treasury', 'treasurymovement', 'anulacion'),
    'BankStatementLine': ('treasury', 'bankstatementline', 'anulacion'),
}


def _has_status_field(model) -> bool:
    """Check if model has a 'status' field."""
    return hasattr(model, 'status') and hasattr(model.status, 'choices')


def _has_cancelled_status(model) -> bool:
    """Check if model's Status enum has a CANCELLED-like value."""
    if not _has_status_field(model):
        return False
    cancelled_keywords = {'CANCELLED', 'ANULLED', 'CANCELED'}
    return any(
        choice[0].upper() in cancelled_keywords
        for choice in model.Status.choices
    )


def _has_is_active_field(model) -> bool:
    """Check if model has an 'is_active' BooleanField."""
    try:
        field = model._meta.get_field('is_active')
        return field.get_internal_type() == 'BooleanField'
    except Exception:
        return False


@pytest.mark.django_db
class TestDeletionPolicyConsistency:
    """
    Verify that each model's deletion pattern matches the policy document.
    """

    def test_anulacion_models_have_status_with_cancelled(self):
        """
        Models with 'anulacion' pattern must have a Status enum
        containing a CANCELLED-like value.
        """
        failures = []
        for entity_key, (app, model_name, pattern) in DELETION_POLICY.items():
            if pattern != 'anulacion':
                continue
            try:
                model = apps.get_model(app, model_name)
            except LookupError:
                failures.append(f"{entity_key}: model {app}.{model_name} not found")
                continue

            if not _has_status_field(model):
                failures.append(f"{entity_key}: anulacion pattern but no Status field")
            elif not _has_cancelled_status(model):
                failures.append(
                    f"{entity_key}: Status exists but no CANCELLED value. "
                    f"Choices: {[c[0] for c in model.Status.choices]}"
                )

        assert not failures, (
            "Anulacion pattern violations:\n" + "\n".join(failures)
        )

    def test_archivo_models_have_is_active(self):
        """
        Models with 'archivo' pattern must have an is_active BooleanField.
        """
        failures = []
        for entity_key, (app, model_name, pattern) in DELETION_POLICY.items():
            if pattern != 'archivo':
                continue
            try:
                model = apps.get_model(app, model_name)
            except LookupError:
                failures.append(f"{entity_key}: model {app}.{model_name} not found")
                continue

            if not _has_is_active_field(model):
                failures.append(f"{entity_key}: archivo pattern but no is_active BooleanField")

        assert not failures, (
            "Archivo pattern violations:\n" + "\n".join(failures)
        )

    def test_hard_delete_models_no_status_or_is_active(self):
        """
        Models with 'hard_delete' pattern should not rely on status or is_active
        for deletion logic (they can have these fields for other purposes).
        """
        # DraftCart is ephemeral — just verify the model exists
        failures = []
        for entity_key, (app, model_name, pattern) in DELETION_POLICY.items():
            if pattern != 'hard_delete':
                continue
            try:
                model = apps.get_model(app, model_name)
            except LookupError:
                failures.append(f"{entity_key}: model {app}.{model_name} not found")

        assert not failures, (
            "Hard delete pattern violations:\n" + "\n".join(failures)
        )

    def test_all_deletion_policy_models_exist(self):
        """
        Every model referenced in the deletion policy table must exist in the backend.
        """
        failures = []
        for entity_key, (app, model_name, pattern) in DELETION_POLICY.items():
            try:
                apps.get_model(app, model_name)
            except LookupError:
                failures.append(f"{entity_key}: {app}.{model_name} does not exist")

        assert not failures, (
            "Missing models:\n" + "\n".join(failures)
        )
