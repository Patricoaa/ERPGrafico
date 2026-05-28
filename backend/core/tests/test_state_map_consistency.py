"""
test_state_map_consistency.py

Verifies that the entity state map (docs/20-contracts/state-map.md)
is consistent with the backend model Status.TextChoices enums.

Every model that defines a Status TextChoices class must have its values
documented in state-map.md, and vice versa.
"""
import re
from pathlib import Path

import pytest
from django.apps import apps
from django.conf import settings


# ── Mapping: state-map section header → (app_label, model_name) ────────────
# The header in state-map.md must match the key here.
STATE_MAP_ENTITIES = {
    'SaleOrder': ('sales', 'saleorder'),
    'PurchaseOrder': ('purchasing', 'purchaseorder'),
    'WorkOrder': ('production', 'workorder'),
    'Invoice': ('billing', 'invoice'),
    'JournalEntry': ('accounting', 'journalentry'),
    'SaleDelivery': ('sales', 'saledelivery'),
    'SaleReturn': ('sales', 'salereturn'),
    'PurchaseReceipt': ('purchasing', 'purchasereceipt'),
    'PurchaseReturn': ('purchasing', 'purchasereturn'),
    'Payroll': ('hr', 'payroll'),
    'BankStatement': ('treasury', 'bankstatement'),
    'POSSession': ('treasury', 'possession'),
    'TerminalBatch': ('treasury', 'terminalbatch'),
    'Subscription': ('inventory', 'subscription'),
    'Task': ('workflow', 'task'),
    'TaxPeriod': ('tax', 'taxperiod'),
    'AccountingPeriod': ('tax', 'accountingperiod'),
    'FiscalYear': ('accounting', 'fiscalyear'),
    'Employee': ('hr', 'employee'),
}


def _parse_state_map_states() -> dict[str, list[str]]:
    """
    Parse state-map.md and extract the status values listed in each entity table.
    Returns { 'SaleOrder': ['DRAFT', 'CONFIRMED', ...], ... }
    """
    state_map_path = Path(settings.BASE_DIR).parent / 'docs' / '20-contracts' / 'state-map.md'
    if not state_map_path.exists():
        return {}

    content = state_map_path.read_text()
    result = {}

    # Split by ## headers
    sections = re.split(r'^## (.+)$', content, flags=re.MULTILINE)
    # sections[0] is preamble, then alternating: header, body
    for i in range(1, len(sections), 2):
        header = sections[i].strip()
        body = sections[i + 1] if i + 1 < len(sections) else ''

        # Only process entities we care about
        if header not in STATE_MAP_ENTITIES:
            continue

        # Extract status values from table rows: | `STATUS` | ...
        statuses = re.findall(r'\| `([A-Z_]+)` \|', body)
        if statuses:
            result[header] = statuses

    return result


def _get_model_statuses(app_label: str, model_name: str) -> list[str] | None:
    """
    Get the Status.TextChoices values for a model, if it defines one.
    """
    try:
        model = apps.get_model(app_label, model_name)
    except LookupError:
        return None

    if hasattr(model, 'Status') and hasattr(model.Status, 'choices'):
        return [choice[0] for choice in model.Status.choices]
    return None


@pytest.mark.django_db
class TestStateMapConsistency:
    """
    Every entity in STATE_MAP_ENTITIES must:
    1. Have its status values documented in state-map.md
    2. The documented values must match the backend TextChoices
    """

    def test_all_documented_entities_have_backend_status(self):
        """Every entity in state-map.md must have a Status TextChoices in the backend."""
        documented = _parse_state_map_states()
        missing = []
        for entity_name, (app, model) in STATE_MAP_ENTITIES.items():
            if entity_name not in documented:
                missing.append(f"{entity_name}: not in state-map.md")
                continue
            statuses = _get_model_statuses(app, model)
            if statuses is None:
                missing.append(f"{entity_name}: no Status TextChoices in {app}.{model}")

        assert not missing, (
            "Entities missing backend status:\n" + "\n".join(missing)
        )

    def test_documented_states_match_backend(self):
        """The status values in state-map.md must match the backend TextChoices."""
        documented = _parse_state_map_states()
        mismatches = []
        for entity_name, (app, model) in STATE_MAP_ENTITIES.items():
            backend_statuses = _get_model_statuses(app, model)
            if backend_statuses is None:
                continue
            doc_statuses = documented.get(entity_name, [])
            if set(doc_statuses) != set(backend_statuses):
                missing_in_doc = set(backend_statuses) - set(doc_statuses)
                extra_in_doc = set(doc_statuses) - set(backend_statuses)
                if missing_in_doc:
                    mismatches.append(
                        f"{entity_name}: missing in state-map.md: {missing_in_doc}"
                    )
                if extra_in_doc:
                    mismatches.append(
                        f"{entity_name}: extra in state-map.md (not in backend): {extra_in_doc}"
                    )

        assert not mismatches, (
            "State map mismatches:\n" + "\n".join(mismatches)
        )

    def test_status_badge_map_covers_all_states(self):
        """
        Every Status.TextChoices value must have an entry in STATUS_MAP
        (frontend/lib/badge-resolvers.ts).
        This test reads the file and parses the STATUS_MAP keys.
        """
        badge_map_path = Path(settings.BASE_DIR).parent / 'frontend' / 'lib' / 'badge-resolvers.ts'
        if not badge_map_path.exists():
            pytest.skip("badge-resolvers.ts not found")

        content = badge_map_path.read_text()
        # Extract keys from STATUS_MAP: { label: '...', intent: '...' }
        map_keys = set(re.findall(r"(\w+):\s*\{\s*label:", content))

        missing = []
        for entity_name, (app, model) in STATE_MAP_ENTITIES.items():
            statuses = _get_model_statuses(app, model)
            if statuses is None:
                continue
            for status in statuses:
                if status not in map_keys:
                    missing.append(f"{entity_name}.{status}")

        assert not missing, (
            "States missing from STATUS_MAP in badge-resolvers.ts:\n"
            + "\n".join(missing)
        )
