---
id: 0065
title: DataCell.Status ghost pill unification (dead variant + ghost typography invariant)
status: Proposed
date: 2026-08-03
author: core-team
---

# 0065 — DataCell.Status ghost pill unification

**Related:** ADR-0029 (Color system), `component-chip.md` (typography invariants), `component-contracts.md` (§StatusBadge), `typography-scale.md` (§N2 Badge/Chip), `badge-resolvers.ts` (`STATUS_MAP` / `resolveStatus`), ADR-0060 (flow cells tinted badge — intentional exception), ADR-0064 (Layer-1 categorical intents — orthogonal)

---

## Context

`DataCell.Status` and the tag cells in `DataTableCells.tsx` drifted from the badge system invariants:

1. **Dead `variant` prop.** `DataCell.Status` accepts `variant: 'default' | 'hub' | 'dot'` and `createStatusColumn` forwards it, but the implementation hardcodes `variant="badge" appearance="ghost"`. `variant="dot"` silently renders a pill. No caller passes the prop; the API is misleading dead code.

2. **Two visual languages for the same workflow status inside tables.** `DataCell.Status` renders a ghost pill (`font-mono uppercase`), while direct `<StatusBadge status size="sm">` uses the default dot + `font-sans font-medium` label. Both appear in table cells across the codebase (AccountSelector, AccountsClientView, AccountingClosuresClientView, InventoryCountClientView, ProfileView, taxPeriodFields).

3. **`appearance="ghost"` breaks the `font-black` typography invariant.** `Badge`'s ghost variant adds `font-semibold` (`Badge.tsx`), which overrides the base `font-black` via `tailwind-merge`. Every ghost pill (DataCell.Status, DataCell.Chip) renders `font-semibold`, contradicting `component-chip.md` ("invariant typography: font-mono font-black uppercase"). Ghost is only used inside `DataTableCells`.

4. **Two sources of truth for status labels.** `DataCell.Status` falls back to `translateStatus()` (`lib/utils.ts`), whose extra fallback map diverges from `resolveStatus()` / `STATUS_MAP` (e.g. `MATERIAL_ASSIGNMENT` → "Asignación de Materiales" vs "Asig. Materiales"). `StatusBadge` always resolves via `STATUS_MAP`.

Documentation also drifted: `component-contracts.md` §StatusBadge documents a nonexistent `variant` union (`'sale-order' | ... | 'generic'`), and `typography-scale.md` §N2 lists `tracking-widest` for StatusBadge while `component-chip.md` defines `tracking-tight` as load-bearing.

## Decision

1. **Ghost pill is the canonical presentation for workflow status in DataTable cells.** Table-cell statuses render as `StatusBadge variant="badge" appearance="ghost"`. Direct `<StatusBadge>` in table cells is migrated to `DataCell.Status` (or the `*Fields.ts` `status` type). Cards / kanban / timelines keep the compact dot presentation.

2. **Remove the dead `variant` prop** from `DataCell.Status` and `createStatusColumn`. Their signatures become `{ status, label?, size?, className? }`. The `badge`/`ghost` presentation is internal.

3. **Unify label resolution.** `DataCell.Status` no longer falls back to `translateStatus()`; labels resolve exclusively through `resolveStatus()` / `STATUS_MAP` (a `label` prop still overrides). `translateStatus()` remains only where it is the documented API for non-badge label reads.

4. **Ghost preserves the `font-black` invariant.** `Badge` appearance `ghost` becomes `bg-transparent` only (no `font-semibold`). Ghost removes the background, never typography.

5. **Ghost chips keep `tracking-tight` in dense tables as a documented exception.** `Chip`'s ghost path switches to `tracking-tight` (vs `tracking-widest`). This is intentional — wide tracking overflows small table chips — and is now documented in `component-chip.md` instead of being an undocumented behavior. StatusBadge keeps `tracking-tight` (already load-bearing).

6. **Documentation reconciled.** `component-contracts.md` §StatusBadge and `typography-scale.md` §N2 are aligned with the real API and the Chip/StatusBadge tracking distinction. `component-chip.md` documents the `appearance` prop and the ghost exception.

## Consequences

### Positivas
- One look per workflow status across every DataTable; `*Fields.ts` `status` type and manual `DataCell.Status` agree.
- Typography invariant (`font-black`) restored for all ghost pills (status + chips).
- Single label source (`STATUS_MAP`) for badge rendering; no more label drift between `DataCell.Status` and `StatusBadge`.
- Dead API removed; `createStatusColumn` matches what it renders.

### Negativas
- Visual change: ghost pills across all tables go from `font-semibold` to `font-black` (slightly heavier text).
- Contract change on a shared component (`Badge` appearance, `DataCell.Status`/`createStatusColumn` signatures) — this ADR provides the required authorization.
- Any consumer passing `variant="dot"` to `DataCell.Status`/`createStatusColumn` breaks at type level (none exist).

### Archivos modificados
- `frontend/components/shared/Badge.tsx` — ghost appearance loses `font-semibold`
- `frontend/components/shared/DataTableCells.tsx` — `DataCell.Status`, `createStatusColumn`, imports
- Migrations to `DataCell.Status`: `components/selectors/AccountSelector.tsx`, `features/accounting/components/AccountsClientView.tsx`, `features/accounting/components/closures/AccountingClosuresClientView.tsx`, `features/inventory/components/InventoryCountClientView.tsx`, `features/profile/components/ProfileView.tsx`, `features/tax/taxPeriodFields.tsx`
- `docs/20-contracts/component-chip.md`, `docs/20-contracts/component-contracts.md`, `docs/20-contracts/typography-scale.md`
- `docs/10-architecture/adr/README.md` (index)

## Alternatives considered

- **Canonical dot presentation in tables** (match the direct `<StatusBadge>` calls): rejected — the ghost pill is already the de-facto standard through `*Fields.ts` `status` type and DataCell.Status; migrating the few direct calls is cheaper than re-rendering every fields table.
- **Honor `variant` instead of removing it:** rejected — the prop is untyped to the real presentation (can't express `badge`/`ghost`), has zero callers, and keeping it preserves a footgun.
- **Solid pills in tables:** rejected — heavier visual weight in dense rows; the solid pill stays for drawers/detail views where it already is.
- **Normalize flow cells (CurrencyFlow/NumericFlow) to chips:** rejected — ADR-0060 already documents the square tinted badge as intentional.

## Amendment (ADR-0068)

[ADR-0068](./0068-badge-currencyflow-default.md) supersedes decisions **1** (ghost pill as canonical table presentation) and **5** (ghost `tracking-tight` dense-table exception): `DataCell.Status` / `DataCell.Chip` now render the standard **solid tinted badge** (same recipe as `DataCell.CurrencyFlow`), and the whole badge system defaults to `font-sans font-medium text-xs` borderless `rounded-sm`. The typography-invariant restoration and label-unification decisions of this ADR remain in force.

## References

- `docs/20-contracts/component-chip.md` — typography invariants, tracking rationale
- `docs/20-contracts/component-contracts.md` — §StatusBadge (corrected)
- `docs/20-contracts/typography-scale.md` — §N2 Badge/Chip
- `frontend/lib/badge-resolvers.ts` — `STATUS_MAP`, `resolveStatus`
- `docs/10-architecture/adr/0060-flow-cells-tinted-badge.md` — flow exception
- `docs/10-architecture/adr/0064-badge-layer1-categorical-intents.md` — orthogonal badge work
