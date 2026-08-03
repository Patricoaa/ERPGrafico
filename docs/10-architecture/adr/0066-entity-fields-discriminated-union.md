---
id: 0066
title: Entity Fields — discriminated-union FieldDef and total type→cell registry
status: Accepted
date: 2026-08-03
author: core-team
---

# 0066 — Entity Fields: discriminated-union FieldDef and total type→cell registry

**Supersedes:** Part of ADR-0054 (Entity Fields Schema), part of ADR-0055 (computed / icon)
**Related:** ADR-0054 (Entity Fields Schema), ADR-0055 (computed/icon/chipIcon/null-safe status), ADR-0062 (dateTime weights), ADR-0065 (DataCell.Status), `component-contracts.md` (DataCell primitives)

---

## Context

`createEntityFields<T>()` (ADR-0054/0055) is the single source of truth for DataTable / EntityCard / Kanban fields, but its render engine drifted:

1. **`computed` is the de-facto primary type.** 44 of ~150 field definitions (~30%) use `type: 'computed'`, on par with `text` (39) and `currency` (35). Many are trivial — e.g. `productFields.name` is `computed` only to wrap `DataCell.Text` in a centered div, which `type: 'text'` already produces. The escape hatch became the default because the flat `FieldDef<T>` cannot express per-type options, so features fall back to `render`.

2. **Dead / ignored props and types.**
   - Fieldtypes `icon`, `progress`, `numericFlow` have **zero** uses; `icon`'s functionality is covered by the `icon` prefix prop on `text`/`code`/`secondary`.
   - `render` is **silently ignored** on non-`computed`/`complex` types — `productFields.availability` (`type: 'chip'` + multi-chip `render`) renders a single `String(value)`; the multi-chip is dead code.
   - `cellProps: Record<string, unknown>` (18 uses) bypasses the typed system.
   - The `type: 'icon'` renderer reads its icon from `extra.icon` (`cellProps`) while every other type uses the dedicated `icon` FieldDef prop — inconsistent.
   - The `default` branch of the `renderCell` switch is unreachable (exhaustive union).

3. **`complex` duplicates `computed`.** Both delegate to `def.render`; they differ only in placement routing (`complex` → always header). A semantic-only distinction at the type level.

4. **Inconsistent null policy.** `status` → dash (null-safe, ADR-0055), `text`/`code`/`secondary` → dash inline, `chip` → empty string, `date`/`number`/`currency`/flows → raw passthrough. Same "missing data" concept, four conventions.

5. **`chip-category` bypasses the `DataCell` namespace**, rendering `Chip.Category` in a manual `flex-wrap` container directly in `renderCell`.

6. **Three concerns in one switch** (`entity-fields.tsx:344-501`): value resolution, cell selection, and layout semantics (`fieldRole`/`placement` auto-detection) are interleaved; auto-title/auto-subtitle logic is duplicated between `toColumns()` and `toCardFields()`.

## Decision

Rebuild the field engine so that **"one fieldtype = one set of options = one renderer"** is guaranteed by the compiler.

### D-01: `FieldDef<T>` becomes a discriminated union keyed by `type`

The flat interface is split into per-type option groups. Each fieldtype carries **only** its valid options; `cellProps` is removed; a type-specific prop outside its type is a compile error.

```ts
type FieldDef<T> = SharedFieldDef<T> & (
  | { type: 'text' | 'secondary'; icon?: LucideIcon }
  | { type: 'code'; icon?: LucideIcon }
  | { type: 'date' }
  | { type: 'dateTime'; dateWeight?: DataCellWeight; timeWeight?: DataCellWeight }
  | { type: 'currency'; currency?: string; showZeroAsDash?: boolean; tooltip?: string }
  | { type: 'number'; suffix?: string; suffixGap?: boolean }
  | { type: 'status'; getLabel?: (e: T) => string }
  | { type: 'contact' }
  | { type: 'chip'; intent?: ChipIntent; chipIcon?: LucideIcon }
  | { type: 'chip-category'; domain?: CategoryDomain }
  | { type: 'currencyFlow'; direction?: FlowDirection; currency?: string }
  | { type: 'sourceDest' }
  | { type: 'computed'; render: (e: T) => ReactNode }
)
```

- `SharedFieldDef<T>` keeps the surface-agnostic props: `key`, `label`, `header?`, `get?`, `surfaces?`, `placement?`, `fieldRole?`, `className?`, `tableOptions?`, `kanbanOptions?`.
- `dateTime` stays a distinct token sharing `DateOptions` with `date` (preserves ADR-0062 and the `'datetime'` role: never subtitle).
- `render` exists **only** on `computed`; it cannot silently attach to other types anymore.

### D-02: Switch → total `CELL_RENDERER` registry

The `renderCell` switch is replaced by a declarative, exhaustive registry plus a shared value pipeline:

```ts
const CELL_RENDERER: Record<FieldType, CellRenderer<T>> = { ... }

function renderCell(def, entity) {
  const value = resolveValue(def, entity)
  return CELL_RENDERER[def.type](def, value, entity)
}
```

`CELL_RENDERER` is keyed by the union of all `type` literals — adding a fieldtype without a renderer is a compile error. `FieldType` stays internal (features type through the factory), but the mapping type→cell becomes a total, inspectable table instead of a procedural `switch`.

### D-03: Unified null policy

A single `toDisplayValue(value)` centralizes the missing-data convention: text-like types (`text`, `code`, `secondary`, `status`, `chip`) render `-` for `null`/`undefined`/`""`. Numeric/flow/date cells keep their semantic nulls (zero-as-dash, neutral flow), which are data states, not missing-data states.

### D-04: Type surface = what is actually used

- **Remove** `icon`, `progress`, `numericFlow` fieldtypes (zero uses). Their renderers remain available as `DataCell.Icon` / `DataCell.Progress` / `DataCell.NumericFlow` components for `computed` renderers and direct columns; `FieldRole 'progress'` stays.
- **Merge** `complex` → `computed`. Migration rule: `type: 'complex'` becomes `type: 'computed'` with `fieldRole: 'complex'` (the role drives the always-header routing via `headerPriorityIndex` / `ROLE_TO_PLACEMENT`, unchanged).
- **Fix** `productFields.availability` dead `render`: multi-chip goes through `computed`, or the field uses `chip-category`.

### D-05: `chip-category` enters the `DataCell` namespace

New `DataCell.Category` primitive (multi-chip `flex-wrap`, `size="sm"`) in `DataTableCells.tsx`; `renderCell`'s `chip-category` branch delegates to it instead of rendering `Chip.Category` directly.

## Consequences

### Positivas
- Per-type prop safety: `intent` on a `date` or `render` on a `chip` is now a compile error, not silent dead code.
- One null convention across text-like cells; explicit semantic nulls elsewhere.
- `computed` reverts to a genuine escape hatch; trivial wrappers migrate to standard types.
- The type→cell mapping is a total, inspectable registry; new types require a renderer.
- `cellProps` untyped passthrough eliminated.

### Negativas
- **Contract change** to `FieldDef<T>` (layer 20) — this ADR provides the required authorization. `*Fields.ts` files with latent illegal props (e.g. `intent` on non-chip, `render` on non-computed) break at type level and must be fixed.
- Migration churn across ~50 `*Fields.ts` files; executed in phases with a commit per phase.
- Internal `FieldType` remains unexported (as today) — features cannot name the type directly; they type through the factory.

### Neutras
- Public API of `EntityFieldsReturn<T>` (`toColumns` / `toCardFields` / `toKanbanFields` / `render` / `meta` / `resolveTitle` / `resolveSubtitle`) unchanged.
- `FieldRole` / `Placement` / `headerPriorityIndex` unchanged.
- `DataCell` primitives unchanged except the additive `DataCell.Category`.

### Archivos modificados
- `frontend/components/shared/entity-fields.tsx` — discriminated union, `CELL_RENDERER`, null policy, type removals, `complex` merge
- `frontend/components/shared/DataTableCells.tsx` — add `DataCell.Category`
- `*Fields.ts` sites: 6 `complex` → `computed` + `fieldRole:'complex'`; trivial `computed` → standard types; `productFields.availability` dead-render fix
- `docs/10-architecture/adr/README.md` (index), `docs/10-architecture/adr/0054-entity-fields-schema.md` (mapping table), `docs/10-architecture/adr/0055-entity-fields-computed-and-icon.md` (computed as sole escape hatch), `docs/20-contracts/component-contracts.md` (DataCell.Category)

## Alternatives considered

- **Keep flat `FieldDef` + registry only:** rejected — does not enforce per-type option legality; `cellProps` and dead `render` props survive.
- **Keep `icon`/`progress`/`numericFlow` as future-proof types:** rejected — zero callers and the aggressive-surface goal; `DataCell.*` components remain for computed/direct use.
- **Model `dateTime` as `date: { showTime: true }`:** rejected — loses the automatic `'datetime'` role (never-subtitle) from ADR-0062.
- **Eliminate `computed` entirely:** rejected — compound cells (link+description, source→dest) are real; the escape hatch stays but is reduced.

## References

- `docs/10-architecture/adr/0054-entity-fields-schema.md` — original mapping table (updated)
- `docs/10-architecture/adr/0055-entity-fields-computed-and-icon.md` — computed/icon/null-safe status
- `docs/10-architecture/adr/0062-datacell-date-time-weights.md` — dateTime fieldtype
- `docs/10-architecture/adr/0065-datacell-status-ghost-pill-unification.md` — status canonicalization
- `docs/20-contracts/component-contracts.md` — DataCell primitives
- Implementación: `frontend/components/shared/entity-fields.tsx`
