"""
ADR-0091 — economic immutability.

Unit tests for EditPolicy plus the contract ratchet: every project model with a
FK to accounting.JournalEntry declares ``edit_policy`` or is listed in
UNPROTECTED_BASELINE, which may only shrink. ViewSets serving a model with a
policy must use EditPolicyMixin.
"""

import inspect
from types import SimpleNamespace

import pytest
from django.apps import apps
from django.urls import get_resolver

from core.edit_policy import DocumentLockedError, EditPolicy, changed_fields
from core.mixins import EditPolicyMixin

PROJECT_APPS = {
    "accounting", "billing", "contacts", "core", "finances", "hr", "inventory",
    "production", "purchasing", "sales", "tax", "treasury", "workflow",
}

# Models with journal-entry derivatives still lacking an edit_policy.
# Remove the entry in the same PR that adds the policy. Never add new ones.
UNPROTECTED_BASELINE = {
    "billing.Invoice": "validate_editable ad-hoc en BillingService; migrar a EditPolicy",
    "sales.SaleOrder": "validate_editable ad-hoc en SalesService; migrar a EditPolicy",
    "purchasing.PurchaseOrder": "validate_editable ad-hoc en PurchasingService; migrar a EditPolicy",
    "inventory.StockMove": "API de solo lectura; declarar política para servicios",
    "contacts.PartnerTransaction": "no revisado; agregar al informe",
    "contacts.ProfitDistributionResolution": "no revisado; agregar al informe",
    "accounting.FiscalYear": "período con asientos de apertura/cierre; clase B",
}

# Not documents: lines owned by a locked parent, or the ledger itself.
EXEMPT = {
    "accounting.JournalItem": "hijo de JournalEntry; lo protege JournalEntryService",
}


def _models_with_journal_entry():
    from accounting.models import JournalEntry

    for model in apps.get_models():
        if model._meta.app_label not in PROJECT_APPS or model is JournalEntry:
            continue
        if model.__name__.startswith("Historical"):
            continue
        if any(
            f.is_relation and f.related_model is JournalEntry
            for f in model._meta.concrete_fields
        ):
            yield model


def _viewset_classes():
    seen = set()

    def walk(patterns):
        for p in patterns:
            if hasattr(p, "url_patterns"):
                yield from walk(p.url_patterns)
                continue
            cls = getattr(p.callback, "cls", None)
            if cls is not None and cls not in seen:
                seen.add(cls)
                yield cls

    yield from walk(get_resolver().url_patterns)


def _viewset_model(cls):
    queryset = getattr(cls, "queryset", None)
    if queryset is not None:
        return queryset.model
    serializer = getattr(cls, "serializer_class", None)
    meta = getattr(serializer, "Meta", None)
    return getattr(meta, "model", None)


# ── Unit ───────────────────────────────────────────────────────────────────


def _rec(**kw):
    return SimpleNamespace(**{"pk": 1, "status": "DRAFT", "locked_flag": False, **kw})


POLICY = EditPolicy(
    editable_statuses=frozenset({"DRAFT"}),
    is_locked=lambda r: r.locked_flag,
    is_purgeable=lambda r: r.status == "CANCELLED",
)


def test_unsaved_record_is_never_locked():
    assert not POLICY.locked(SimpleNamespace(pk=None, status="POSTED", locked_flag=True))


def test_locked_by_status_or_predicate():
    assert not POLICY.locked(_rec())
    assert POLICY.locked(_rec(status="POSTED"))
    rec = _rec()
    rec.locked_flag = True
    assert POLICY.locked(rec)


def test_locked_record_accepts_only_mutable_fields():
    rec = _rec(status="POSTED")
    POLICY.assert_editable(rec, {"notes"})
    with pytest.raises(DocumentLockedError) as exc:
        POLICY.assert_editable(rec, {"notes", "amount"})
    assert exc.value.details["fields"] == ["amount"]
    with pytest.raises(DocumentLockedError):
        POLICY.assert_editable(rec)


def test_delete_requires_deletable_or_purgeable():
    with pytest.raises(DocumentLockedError):
        POLICY.assert_deletable(_rec())
    POLICY.assert_deletable(_rec(status="CANCELLED"))
    EditPolicy(deletable=True).assert_deletable(_rec())


def test_changed_fields_ignores_resent_values():
    rec = SimpleNamespace(amount=10, notes="a")
    assert changed_fields(rec, {"amount": 10, "notes": "b"}) == {"notes"}


# ── Contract ───────────────────────────────────────────────────────────────


def test_models_with_journal_entry_declare_edit_policy():
    missing = sorted(
        m._meta.label
        for m in _models_with_journal_entry()
        if getattr(m, "edit_policy", None) is None
        and m._meta.label not in UNPROTECTED_BASELINE
        and m._meta.label not in EXEMPT
    )
    assert not missing, (
        f"Modelos con asiento sin edit_policy (ADR-0091): {missing}. "
        "Declarar EditPolicy en el modelo."
    )


def test_baseline_has_no_stale_entries():
    labels = {m._meta.label: m for m in _models_with_journal_entry()}
    stale = sorted(
        label
        for label in UNPROTECTED_BASELINE
        if label not in labels or getattr(labels[label], "edit_policy", None) is not None
    )
    assert not stale, f"Quitar de UNPROTECTED_BASELINE: {stale}"


def test_viewsets_of_policy_models_use_mixin():
    offenders = sorted(
        cls.__name__
        for cls in _viewset_classes()
        if getattr(_viewset_model(cls), "edit_policy", None) is not None
        and (hasattr(cls, "update") or hasattr(cls, "destroy"))
        and not issubclass(cls, EditPolicyMixin)
    )
    assert not offenders, f"ViewSets sin EditPolicyMixin: {offenders}"


def test_policy_viewset_overrides_call_super():
    offenders = []
    for cls in _viewset_classes():
        if not issubclass(cls, EditPolicyMixin):
            continue
        for hook in ("perform_update", "perform_destroy"):
            own = cls.__dict__.get(hook)
            if own and f"super().{hook}(" not in inspect.getsource(own):
                offenders.append(f"{cls.__name__}.{hook}")
    assert not offenders, f"Overrides que no llaman a super(): {offenders}"
