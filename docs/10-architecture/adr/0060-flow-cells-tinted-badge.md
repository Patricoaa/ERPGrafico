---
id: 0060
title: Flow DataCells as square tinted badges
status: Proposed
date: 2026-08-02
author: core-team
---

# 0060 — Flow DataCells as square tinted badges

**Related:** ADR-0029 (Color system), `component-contracts.md` §DataCell.NumericFlow, `color-system.md` §3.3

---

## Context

`DataCell.CurrencyFlow` and `DataCell.NumericFlow` (the `currencyFlow` / `numericFlow` field types) rendered flow values as **plain colored text** (`text-success` / `text-destructive` / `text-foreground`). In dense tables the direction color alone was hard to scan, and the cells did not read as status-like tokens the way chips and badges do.

The design direction: flow cells should be **square, rounded-sm badges tinted with the flow color**, matching the existing faded badge recipe (`bg-{intent}/10 text-{intent}`) used by Chip / StatusBadge.

## Decision

Both `DataCell.CurrencyFlow` and `DataCell.NumericFlow` wrap their content in a square, borderless, tinted badge:

- Container: `inline-flex items-center gap-1 rounded-sm px-2 py-0.5 leading-none`
- inflow → `bg-success/10 text-success`
- outflow → `bg-destructive/10 text-destructive`
- neutral → `bg-muted/60 text-muted-foreground`
- No border. Typography: `text-xs` (default `size sm`), `font-medium` (inherited from the wrapper so consumer `className` overrides like `font-bold` / `text-2xs` keep working).

Directional icon, sign (`+`/`−`), currency/quantity formatting and `showIcon` / `showSign` props are unchanged. The props API of both cells is unchanged.

## Consequences

### Positivas
- Flow direction is now visually tokenized — consistent with the badge/chip language elsewhere in the app.
- Faded tint (`/10`) keeps the cell subtle while still color-coding direction.
- No consumer changes required; the change is contained to the shared cell renderers.

### Negativas
- Flow cells are visually more prominent than before (background + padding); any consumer relying on the plain-text look is affected globally.
- `intent` / `color` overrides on flow cells now have reduced effect because the badge owns the text color.

### Archivos modificados
- `frontend/components/shared/DataTableCells.tsx` — `CurrencyFlow`, `NumericFlow`
- `docs/20-contracts/component-contracts.md` — NumericFlow appearance notes
- `docs/20-contracts/color-system.md` — NumericFlow recipe rows

## Alternatives considered

- **Reuse the `Badge` primitive** (`shape="square"`): rejected — forces `font-mono font-black uppercase` typography on monetary/quantity values and its fixed badge sizes; not requested.
- **Solid fill badge**: rejected — "más tenue" means a faded tint, not a solid block.
- **Border retained**: rejected — requested borderless.
