---
id: 0072
title: Entity Fields — contact fieldtype reactivated with display override (getDisplay)
status: Accepted
date: 2026-08-13
author: core-team
---

# 0072 — Entity Fields: `contact` reactivated with `getDisplay`

**Amends:** ADR-0066 (fieldtype union), ADR-0067 (§TYPE_TO_ROLE)
**Related:** ADR-0066 (discriminated-union FieldDef), ADR-0067 (placement/fieldRole), `component-fields.md` (§3 fieldtype table, §3.2), `subscriptionFields.tsx`, `DataTableCells.tsx` (`DataCell.ContactLink`)

---

## Context

Post-ADR-0067 audit of the field engine surfaced a dead `contact` fieldtype:

1. **`contact` has zero producers.** No `*Fields.ts` file uses `type: 'contact'`. The only relation-to-a-registered-entity producer in the codebase is `subscriptionFields.supplierName`, which hand-rolls a `computed` field (`fieldRole: 'relation'`) rendering `DataCell.ContactLink` directly — exactly the shape of the `contact` fieldtype, mirroring the ADR-0067 D-04 `numericFlow` precedent (computed hand-roll → reintroduced declarative fieldtype).
2. **The current `contact` rendering contract is degenerate.** It renders `contactId={value}` with `toDisplayValue(value)` as the visible text — the value must be *both* the id and the label. A registered entity usually carries a separate display name (e.g. `supplier_id` + `supplier_name`), which the type cannot express. Migrating `supplierName` to `type: 'contact'` as-is would render the numeric id as the cell text, a UX regression.

## Decision

### D-01: `contact` gains an optional display override

- The `contact` member of the `FieldDef` discriminated union adds `getDisplay?: (entity: T) => string`.
- `renderCell` case `'contact'` resolves the visible text as `def.getDisplay ? def.getDisplay(entity) : toDisplayValue(value)`; `contactId` stays `value` (the contact id via `get` or direct access).
- Backward-compatible: `getDisplay` is optional; existing semantics (value = id = text) unchanged when absent.

### D-02: `supplierName` migrates from `computed` to `type: 'contact'`

- `subscriptionFields.supplierName` becomes `key: 'supplier_id'`, `get: (s) => s.supplier_id`, `getDisplay: (s) => s.supplier_name`, dropping the `computed` + inline `DataCell.ContactLink` (and the now-unused `DataCell` import).
- Placement is unchanged (`relation` → detail), so no layout delta.

## Consequences

### Positivas
- The `contact` fieldtype gains its first real producer; the hand-rolled `computed` pattern disappears (same move as ADR-0067 D-04 for `numericFlow`).
- Establishes the canonical pattern for any future registered-entity field: id as value + `getDisplay` for the label.
- Additive and non-breaking; no existing field changes behavior.

### Negativas
- One more option in the shared `FieldDef` union to document (§3/§3.2 of `component-fields.md` updated in the same change).
- Sort accessor for the supplier column changes from `supplier_name` to `supplier_id` (stable numeric sort).
