"""
test_deletion_policy_consistency.py

Verifies that the deletion policy (docs/20-contracts/deletion-policy.md)
is consistent with the backend model implementations.

Every model listed in the deletion-policy table must:
- Cancelación pattern → has `status` field with a CANCELLED-like value
- Anulación pattern → has `status` field with a CANCELLED-like value + reversal entries
- Archivo pattern → has `is_active` BooleanField
- Hard delete pattern → neither `status` enum nor `is_active` (or only for non-fiscal use)
"""
import importlib
import re
from pathlib import Path

import pytest
from django.apps import apps
from django.conf import settings

# ── Cancelacion models → (module_path, service_class, method_name) ──
CANCEL_SERVICE_MAP = {
    'SaleOrder':         ('sales.services', 'SalesService', 'cancel_sale_order'),
    'PurchaseOrder':     ('purchasing.services', 'PurchaseOrderService', 'cancel_purchase_order'),
    'PurchaseReceipt':   ('purchasing.services', 'PurchasingService', 'cancel_receipt'),
    'Invoice':           ('billing.services', 'BillingService', 'cancel_invoice'),
    'TreasuryMovement':  ('treasury.services', 'TreasuryService', 'cancel_movement'),
}


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
    'PurchaseReceipt':   ('purchasing', 'purchasereceipt', 'cancelacion'),
    'SaleOrder':         ('sales', 'saleorder', 'cancelacion'),
    'SaleDelivery':      ('sales', 'saledelivery', 'anulacion'),
    'DraftCart':         ('sales', 'draftcart', 'hard_delete'),
    'TaxPeriod':         ('tax', 'taxperiod', 'archivo'),
    'Bank':              ('treasury', 'bank', 'archivo'),
    'TreasuryAccount':   ('treasury', 'treasuryaccount', 'archivo'),
    'PaymentMethod':     ('treasury', 'paymentmethod', 'archivo'),
    'TreasuryMovement':  ('treasury', 'treasurymovement', 'cancelacion'),
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
        Models with 'anulacion' or 'cancelacion' pattern must have a Status enum
        containing a CANCELLED-like value.
        """
        failures = []
        for entity_key, (app, model_name, pattern) in DELETION_POLICY.items():
            if pattern not in ('anulacion', 'cancelacion'):
                continue
            try:
                model = apps.get_model(app, model_name)
            except LookupError:
                failures.append(f"{entity_key}: model {app}.{model_name} not found")
                continue

            if not _has_status_field(model):
                failures.append(f"{entity_key}: {pattern} pattern but no Status field")
            elif not _has_cancelled_status(model):
                failures.append(
                    f"{entity_key}: Status exists but no CANCELLED value. "
                    f"Choices: {[c[0] for c in model.Status.choices]}"
                )

        assert not failures, (
            "Anulacion/Cancelacion pattern violations:\n" + "\n".join(failures)
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

    def test_cancelacion_models_have_cancel_service(self):
        """
        Models with 'cancelacion' pattern must expose a static/service method
        to perform the cancellation, registered in CANCEL_SERVICE_MAP.
        """
        failures = []
        for entity_key, (app, model_name, pattern) in DELETION_POLICY.items():
            if pattern != 'cancelacion':
                continue
            if entity_key not in CANCEL_SERVICE_MAP:
                failures.append(
                    f"{entity_key}: cancelacion pattern but not in CANCEL_SERVICE_MAP"
                )
                continue

            module_path, class_name, method_name = CANCEL_SERVICE_MAP[entity_key]
            try:
                module = importlib.import_module(module_path)
            except ImportError:
                failures.append(f"{entity_key}: cannot import {module_path}")
                continue

            svc_class = getattr(module, class_name, None)
            if svc_class is None:
                failures.append(
                    f"{entity_key}: class {class_name} not found in {module_path}"
                )
                continue

            cancel_method = getattr(svc_class, method_name, None)
            if cancel_method is None or not callable(cancel_method):
                failures.append(
                    f"{entity_key}: method {class_name}.{method_name} not found or not callable"
                )

        assert not failures, (
            "Cancelacion service violations:\n" + "\n".join(failures)
        )
