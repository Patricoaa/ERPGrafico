---
id: 0062
title: DateTime DataCell with independent date/time weights
status: Proposed
date: 2026-08-02
author: core-team
---

# 0062 — DateTime DataCell with independent date/time weights

**Related:** ADR-0061 (DataCell text primitives default to text-xs), `component-contracts.md` §DataCell primitives, `typography-scale.md` §N3

---

## Context

`DataCell.Date` renders an optional time suffix with `showTime`, but the time span was hardcoded to `text-xs text-muted-foreground/60` and ignored the cell's typography tokens. There was no way to give the date and time portions different font weights (e.g. date `font-medium`, time `font-normal` or lighter), and no dedicated field type to express "date + time" declaratively.

Separately, the card placement system assigned `date` fields the `temporal` role (a subtitle candidate, and otherwise center header). A date-time value is visually richer and deserves the center header slot explicitly, while a plain date stays a subtitle candidate.

## Decision

### 1. New weight token `light`

`DataCellWeight` gains `'light'` (→ `font-light`, 300) and is exported so field definitions can reference it. `WEIGHT_MAP` grows the entry; all other tokens are unchanged.

### 2. `DataCell.Date` accepts `dateWeight` / `timeWeight`

New optional props, typed as `DataCellWeight`:

- `dateWeight` — weight of the date portion (default `'medium'`, matching the base class). Falls back to the existing `weight` prop.
- `timeWeight` — weight of the time suffix (default `'normal'`). Applied via `WEIGHT_MAP[timeWeight]`, replacing the hardcoded suffix class. Size/color of the suffix stay `text-xs text-muted-foreground/60 ml-1.5`.

### 3. New field type `dateTime` + field role `datetime`

- `FieldType` gains `'dateTime'`, rendering `<DataCell.Date value showTime dateWeight timeWeight />` in `renderCell`.
- `FieldDef` gains typed `dateWeight?: DataCellWeight` and `timeWeight?: DataCellWeight`.
- New `FieldRole 'datetime'` maps `dateTime → ROLE_TO_PLACEMENT['detail']` (center header).
- `'datetime'` is deliberately **not** added to `buildSubtitleOrder` slot roles, so a date-time field is never a subtitle candidate.
- `date` (role `temporal`) is unchanged: still a subtitle candidate via auto-compose, otherwise center header.

## Consequences

### Positivas
- Date-time cells can express hierarchical emphasis (date `font-medium`, time `font-normal` or `light`) without per-consumer hardcode.
- `dateTime` is declarative: lists, cards, and kanban all route it to center header automatically.
- `date` vs `dateTime` placement is now semantically distinct without changing existing `temporal` behavior.

### Negativas
- `DataCell.Date` gains two more props; consumers using `showTime` without explicit weights get `font-normal` for the time instead of inheriting the cell weight — a subtle visual change for those call sites.
- New token `light` widens the accepted `DataCellWeight` union; `DataCellWeight` must remain exported for `entity-fields.tsx` to type `FieldDef`.

### Archivos modificados
- `frontend/components/shared/DataTableCells.tsx` — token `light`, export `DataCellWeight`, `DataCell.Date` `dateWeight`/`timeWeight`
- `frontend/components/shared/entity-fields.tsx` — `FieldType 'dateTime'`, `FieldRole 'datetime'`, maps, `FieldDef` props, `renderCell` case
- `docs/20-contracts/component-contracts.md` — §DataCell primitives, `dateTime` field type
- `docs/20-contracts/typography-scale.md` — §N3 fecha-hora row

## Alternatives considered

- **A separate `DataCell.DateTime` component**: rejected — duplicates date parsing/formatting; extending `DataCell.Date` reuses the single source of truth.
- **New role `light` without exporting `DataCellWeight`**: rejected — `FieldDef` needs the union type across modules.
- **Mapping `dateTime` to the existing `temporal` role**: rejected — it would become a subtitle candidate, contradicting the center-header intent.
