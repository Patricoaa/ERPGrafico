---
id: 0030
title: DataTable compact variant (CSS Grid for modals/drawers)
status: Proposed
date: 2026-05-30
author: core-team
---

# 0030 — DataTable compact variant (CSS Grid for modals/drawers)

## Context

The `DraftCartsList` component in the POS module uses a hand-built CSS Grid layout (`grid-cols-[2rem_1fr_auto_auto_auto]`) to render a compact, scrollable list of draft carts inside a modal. This pattern is superior to `<table>` HTML for compact modal/drawer contexts because:

- **Explicit column widths**: CSS Grid tracks (`2rem`, `1fr`, `auto`) give precise control over column sizing, unlike `<table>` which distributes width by content.
- **Multi-line cells**: Grid cells naturally support stacked content (name + badges + customer + timestamp) without fighting `whitespace-nowrap`.
- **Denser layout**: Tighter padding and gap control without CSS overrides on `<td>`/`<th>`.
- **Better scroll fit**: `ScrollArea` wrapping a grid avoids the horizontal overflow issues of `<table>` inside constrained modals.

The same pattern appears in `CostCalculatorDrawer` (`grid-cols-12`). However, every implementation hand-builds the header, rows, loading skeleton, and empty state — there is no reusable abstraction.

The existing `DataTable` component operates in three variants (`standalone`, `embedded`, `minimal`) — all rendering via `<table>` HTML elements. None of them produce the CSS Grid layout that modal/drawer contexts benefit from.

## Decision

Add `variant="compact"` to `DataTable` that renders rows as CSS Grid `<div>` elements instead of `<table>` HTML elements.

### API

```tsx
<DataTable
  variant="compact"
  gridTemplate="grid-cols-[2rem_1fr_auto_auto_auto]"
  columns={columns}
  data={data}
  renderRowActions={(row) => <Button>...</Button>}
  onRowClick={handleClick}
/>
```

### New props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `gridTemplate` | `string` | — (required for compact) | CSS Grid template class, e.g. `"grid-cols-[2rem_1fr_auto_auto_auto]"` |
| `gridGap` | `string` | `"gap-x-3"` | Gap between columns |
| `compactMaxHeight` | `string` | `"max-h-[65vh]"` | Max height for the ScrollArea wrapper |
| `renderRowActions` | `(row: TData) => React.ReactNode` | — | Render callback for the actions cell (last grid track) |

### Rendering approach

- Uses `flexRender` (which is HTML-element-agnostic) to render column headers and cells into `<div>` elements.
- All `DataTableCells` primitives already render `<div>` roots — fully grid-compatible.
- `DataTableColumnHeader` already renders `<div>` — works outside `<table>`.
- Wraps content in `ScrollArea` for scroll containment.
- Applies `role="table"`, `role="row"`, `role="columnheader"`, `role="cell"` for accessibility.
- Uses `divide-y divide-border/60` for row separators (matching DraftCartsList pattern).

### Constraints

- No toolbar, no pagination, no bulk actions (same as `minimal`).
- The `renderRowActions` slot occupies the last grid track; the consumer's `columns` array should NOT include an actions column when using `renderRowActions`.
- The `gridTemplate` must have exactly `columns.length + 1` tracks when `renderRowActions` is provided (the extra track is for actions), or `columns.length` tracks when it is not.

## Consequences

### Positive

- Standardized compact table pattern for modals and drawers — no more hand-built grids.
- Single API surface (`DataTable`) for all table contexts (standalone, embedded, minimal, compact).
- `DraftCartsList` and `CostCalculatorDrawer` can migrate to the shared variant, reducing duplication.
- Consumers get loading skeleton, empty state, and scroll containment for free.

### Negative

- `DataTable.tsx` grows by ~80 lines (already 793 lines). Mitigated by the block being self-contained.
- CSS Grid layout is less semantic than `<table>` for screen readers. Mitigated by ARIA `role` attributes.
- `gridTemplate` is a Tailwind class string, which means it must match the actual number of columns — mismatch causes visual bugs. This is a consumer responsibility.

### Neutral

- ADR-0030 required (contract change to `component-datatable-views.md`).
- `DraftCartsList` migration included in the same PR as proof of concept.

## Alternatives considered

### 1. Separate `CompactDataTable` component

A new shared component dedicated to CSS Grid tables.

**Rejected because:** Fragments the API surface — consumers must choose between `DataTable` and `CompactDataTable`. Duplicates TanStack Table wiring, loading/empty state logic, and scroll handling. Violates the principle of a single table component.

### 2. `renderCustomView` with existing DataTable

Consumers use `renderCustomView` to implement their own grid layout inside the current DataTable.

**Rejected because:** Does not standardize the pattern. Each consumer reimplements header, rows, loading, and empty state. No consistent ARIA roles or scroll containment.

## References

- `frontend/features/pos/components/DraftCartsList.tsx` — canonical CSS Grid list in modal
- `frontend/components/tools/CostCalculatorDrawer.tsx` — CSS Grid list in drawer
- `docs/20-contracts/component-datatable-views.md` — DataTable variant contract
- `docs/20-contracts/component-contracts.md` — DataTable component entry
- `frontend/components/shared/DataTable.tsx` — implementation target
