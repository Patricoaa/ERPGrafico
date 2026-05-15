"""
stage_data_schema.py — Canonical shape for WorkOrder.stage_data (TASK-112)

All stage_data dicts written by WorkOrderService should conform to StageData.
Use `migrate_stage_data_to_v1()` to normalize legacy documents on read.

To introduce a v2 in the future:
  1. Add a new branch in `migrate_stage_data_to_v1` that detects `_version == 1` and upgrades.
  2. Update the `StageData` TypedDict.
  3. Write a Django data migration that calls `migrate_stage_data_to_v1` for every WorkOrder.
"""
from typing import Optional, List, Literal, TypedDict


class Phases(TypedDict, total=False):
    prepress: bool
    press: bool
    postpress: bool


class Specifications(TypedDict, total=False):
    prepress: str
    press: str
    postpress: str


class Comment(TypedDict):
    id: str
    user: str
    text: str
    timestamp: str


class StageData(TypedDict, total=False):
    _version: Literal[1]

    # Dimensionality
    quantity: float
    uom_id: int
    uom_name: str

    # Manufacturing phases
    phases: Phases
    specifications: Specifications
    # Legacy flat fields (still written by _map_manufacturing_data, kept for compat)
    prepress_specs: str
    press_specs: str
    postpress_specs: str

    design_needed: bool
    design_attachments: List[str]    # filenames
    design_approved: bool
    approval_attachment: Optional[str]
    folio_enabled: bool
    folio_start: str
    print_type: Optional[Literal['offset', 'digital', 'especial']]

    # Context
    internal_notes: str
    product_description: str
    contact_id: Optional[int]
    contact_name: Optional[str]
    contact_tax_id: Optional[str]

    # Comments (stored inline — TASK-307 will migrate these to polymorphic Comment model)
    comments: List[Comment]

    # Reserved for future per-stage overrides without breaking the flat layout
    overrides: dict


def migrate_stage_data_to_v1(data: dict) -> dict:
    """
    Normalize a legacy stage_data dict to version 1.

    Legacy documents may have:
      - A "prepress", "press", "postpress" key whose VALUE is a dict (copy of flat_data).
        This was the pattern in create_from_sale_line before TASK-113.

    The v1 canonical shape is FLAT — all fields at root level. Phase sub-dicts are removed
    and their contents merged into root (first non-empty wins).

    Idempotent: already-v1 documents are returned unchanged.
    """
    if not data:
        return {'_version': 1}

    if data.get('_version') == 1:
        return data

    flat = dict(data)

    # Lift any legacy phase-nested copies
    for phase_key in ('prepress', 'press', 'postpress'):
        phase_val = data.get(phase_key)
        if isinstance(phase_val, dict):
            for key, value in phase_val.items():
                # Only copy if root doesn't already have a non-falsy value
                if value and not flat.get(key):
                    flat[key] = value
            del flat[phase_key]  # remove the nested copy

    flat['_version'] = 1
    return flat
