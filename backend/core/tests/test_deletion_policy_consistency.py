"""
test_deletion_policy_consistency.py

Verifies that the deletion policy (docs/20-contracts/deletion-policy.md)
is consistent with the backend model implementations.

Mechanisms per the contract's authoritative table:
- Cancelación / Anulación con status → `status` field with a CANCELLED value
- Anulación vía contramovimiento (StockMove) → no own status; reversal moves
- Anulación vía conciliación (BankStatementLine) → `reconciliation_status`
- Archivo → `is_active` BooleanField (excepciones por enum `status` en
  ARCHIVO_EXEMPT; gaps pendientes fijados en ARCHIVO_KNOWN_GAPS)
- Hard delete → model exists; no structural requirement

If you add a model to the deletion-policy table, add it here in the same PR.
"""
import importlib

import pytest
from django.apps import apps

# ── Cancelacion models → (module_path, service_class, method_name) ──
CANCEL_SERVICE_MAP = {
    'SaleOrder':         ('sales.services', 'SalesService', 'cancel_sale_order'),
    'PurchaseOrder':     ('purchasing.services', 'PurchaseOrderService', 'cancel_purchase_order'),
    'PurchaseReceipt':   ('purchasing.services', 'PurchasingService', 'cancel_receipt'),
    'Invoice':           ('billing.services', 'BillingService', 'cancel_invoice'),
    'TreasuryMovement':  ('treasury.services', 'TreasuryService', 'cancel_movement'),
}


# ── Deletion policy table: model_key → (app_label, model_name, pattern) ──
# Mirror of the authoritative table in docs/20-contracts/deletion-policy.md.
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

# Anulación entities whose mechanism is NOT an own `status` field, per the
# contract's "Notas" column. Key → field that implements the mechanism
# (None = reversal documents only, nothing to assert structurally).
STATUS_EXEMPT = {
    # "Reverso vía contramovimiento": the annulment is a counter StockMove,
    # the original move is never mutated.
    'StockMove': None,
    # "No se borra; se marca unmatched o discarded" via reconciliation_status.
    'BankStatementLine': 'reconciliation_status',
}

# Archivo entities whose lifecycle is governed by an existing `status` enum
# instead of `is_active` — adding a parallel boolean would create two sources
# of truth. Key → field that implements the mechanism. Documented in
# deletion-policy.md.
ARCHIVO_EXEMPT = {
    'Employee': 'status',    # ACTIVE / INACTIVE
    'TaxPeriod': 'status',   # OPEN / UNDER_REVIEW / CLOSED — no es archivable
}

# Archivo entities that do NOT yet comply with the contract's
# "el campo se llama siempre is_active" rule. Pinned so the gap cannot grow
# silently; remove an entry here the day the model gains `is_active`.
ARCHIVO_KNOWN_GAPS = {}

CANCELLED_KEYWORDS = {'CANCELLED', 'CANCELED', 'ANNULLED', 'ANULLED'}


def _get_field(model, name):
    try:
        return model._meta.get_field(name)
    except Exception:
        return None


def _has_cancelled_status(model) -> bool:
    """Model has a `status` field whose choices include a CANCELLED value."""
    field = _get_field(model, 'status')
    if field is None or not field.choices:
        return False
    return any(str(value).upper() in CANCELLED_KEYWORDS for value, _ in field.choices)


def _has_is_active_field(model) -> bool:
    field = _get_field(model, 'is_active')
    return field is not None and field.get_internal_type() == 'BooleanField'


@pytest.mark.django_db
class TestDeletionPolicyConsistency:
    """
    Verify that each model's deletion pattern matches the policy document.
    """

    def test_anulacion_models_have_status_with_cancelled(self):
        """
        Models with 'anulacion' or 'cancelacion' pattern must have a status
        field containing a CANCELLED value — unless the contract assigns them
        another mechanism (STATUS_EXEMPT).
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

            if entity_key in STATUS_EXEMPT:
                mechanism_field = STATUS_EXEMPT[entity_key]
                if mechanism_field and _get_field(model, mechanism_field) is None:
                    failures.append(
                        f"{entity_key}: exempt from status but mechanism field "
                        f"'{mechanism_field}' is missing"
                    )
                continue

            if not _has_cancelled_status(model):
                field = _get_field(model, 'status')
                detail = (
                    f"status choices {[c[0] for c in field.choices]}"
                    if field is not None and field.choices
                    else "no status field"
                )
                failures.append(
                    f"{entity_key}: {pattern} pattern requires status with "
                    f"CANCELLED, found {detail}"
                )

        assert not failures, (
            "Anulacion/Cancelacion pattern violations:\n" + "\n".join(failures)
        )

    def test_archivo_models_have_is_active(self):
        """
        Models with 'archivo' pattern must have an is_active BooleanField.
        Known non-compliant models are pinned in ARCHIVO_KNOWN_GAPS: the gap
        may not grow, and entries must be removed once fixed.
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

            if entity_key in ARCHIVO_EXEMPT:
                mechanism_field = ARCHIVO_EXEMPT[entity_key]
                if _get_field(model, mechanism_field) is None:
                    failures.append(
                        f"{entity_key}: exempt from is_active but mechanism field "
                        f"'{mechanism_field}' is missing"
                    )
                continue

            has_flag = _has_is_active_field(model)
            if entity_key in ARCHIVO_KNOWN_GAPS:
                if has_flag:
                    failures.append(
                        f"{entity_key}: now has is_active — remove it from "
                        f"ARCHIVO_KNOWN_GAPS"
                    )
            elif not has_flag:
                failures.append(
                    f"{entity_key}: archivo pattern but no is_active BooleanField"
                )

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
                apps.get_model(app, model_name)
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
