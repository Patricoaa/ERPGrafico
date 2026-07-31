---
id: 0055
title: Entity Fields — computed type, icon prefix, chipIcon, and null-safe status
status: Accepted
date: 2026-07-17
author: core-team
---

# 0055 — Entity Fields: computed type, icon prefix, chipIcon, null-safe status

**Supersedes:** Part of ADR-0054 (Entity Fields Schema)
**Related:** ADR-0054 (Entity Fields Schema), ADR-0023 (ROW_ACTIONS registry)

---

## Context

ADR-0054 introduced `createEntityFields<T>()` as the single source of truth for DataTable, EntityCard, and Kanban field definitions. However, 5 features (BOM, Tax Periods, Budgets, Stock Moves, Payment Methods) define fields in `*Fields.ts` but their table views ignore `toColumns()` and define all columns inline.

Root cause: the field factory only supports **one field = one column = one DataCell renderer**. Several features need:

| Pattern | Example | Features |
|---------|---------|----------|
| Compound multi-field columns | `product_name` + chips de código in one cell | BOM, Payment Methods |
| Icon prefixes | `<CreditCard>` before account name | Payment Methods, Budgets |
| Custom visual containers | Calendar badge (40x40 box with year/month) | Tax Periods |
| Chip with icon | `<Layers>` icon inside a count chip | BOM |
| Null-safe status | Render dash when value is null | Tax Periods |

## Decision

Extend `FieldDef<T>` with four additive capabilities:

### D-01: `computed` field type

New `FieldType = 'computed'` with a `render: (entity: T) => ReactNode` callback.

- `toColumns()`: produces a `ColumnDef` whose cell calls `render(row.original)`
- `toCardFields()`: produces a `CardField` whose value is `render(entity)`
- Role defaults to `'descriptive'`, placement to `'detail'` (overridable via `fieldRole`/`cardPlacement`)
- **Last resort**: prefer standard types (`text`, `currency`, `status`) when possible. `computed` is the escape hatch for compound/custom rendering.

### D-02: `icon` property on FieldDef

Optional `icon?: LucideIcon | ((entity: T) => LucideIcon)` on `FieldDef<T>`.

- Applies to: `text`, `code`, `secondary`, `chip` field types
- Renders an icon prefix before cell content: `<Icon className="h-4 w-4" />` + content
- In card rendering: ignored when field is placed in `header` zone (AutoEntityCard handles header icons separately)

### D-03: `chipIcon` property on FieldDef

Optional `chipIcon?: LucideIcon | ((entity: T) => LucideIcon)` on `FieldDef<T>`.

- Applies to: `chip` field type only
- Passed through to `DataCell.Chip` → `Chip` → `Badge` as the `icon` prop
- Enables chips like `<Layers>` icon inside a count chip

### D-04: Null-safe `status` type

When `status` field's `get()` returns `null`, `undefined`, or `""`, render a dash (`-`) instead of `DataCell.Status`.

- Previously: `DataCell.Status` was always rendered, causing issues when data was absent
- Now: null/empty value → `<DataCell.Text>-</DataCell.Text>`

## Consequences

### Positivas
- 5 HIGH-severity features can migrate to use `toColumns()` as single source of truth
- `computed` provides an escape hatch without breaking the factory pattern
- `icon` and `chipIcon` are additive (no existing fields affected)
- Null-safe status eliminates a common source of rendering bugs

### Negativas / Riesgos
- `computed` could be overused — must be documented as last resort in playbook
- `render` callback returns `ReactNode`, which cannot be introspected by AutoEntityCard for card zone classification (card placement must be set explicitly)

### Neutras
- Existing field definitions are unaffected (all new props are optional)
- No breaking changes to `EntityFieldsReturn<T>` API

## References

- Implementation: `frontend/components/shared/entity-fields.tsx`
- Prior ADR: `docs/10-architecture/adr/0054-entity-fields-schema.md`
- Contract: `docs/20-contracts/component-datatable-views.md`
