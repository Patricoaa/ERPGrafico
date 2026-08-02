---
id: 0061
title: DataCell text primitives default to text-xs
status: Proposed
date: 2026-08-02
author: core-team
---

# 0061 — DataCell text primitives default to text-xs

**Related:** ADR-0060 (Flow DataCells as square tinted badges), `component-contracts.md` §DataCell primitives, `typography-scale.md` §N3

---

## Context

The `DataCell.*` text primitives (`Text`, `Secondary`, `Code`, `Number`, `Currency`, `Variance`, `Date`, `Link`, `ContactLink`, `WorkflowSummary`) hardcoded `text-sm` in their base class. Only badge-based cells (`CurrencyFlow`, `NumericFlow`, `SourceDest`, chips) used `text-xs`, creating a two-tier look inside the same table where plain values sat one size larger than badge tokens.

The design direction: **all DataCell text defaults to `text-xs`**, keeping the badge cells already at `text-xs` and unifying the table cell typography.

## Decision

Every `DataCell` text primitive defaults to `text-xs` (font-medium, unchanged). The base class changes from `text-sm` to `text-xs`:

- `Text`, `Secondary`, `Code`, `Number`, `Currency`, `Variance`, `Date` (value + empty dash), `Link`, `ContactLink`, `WorkflowSummary` total.
- `NumericFlow` empty / NaN states also move to `text-xs`.

The `SIZE_MAP` token ladder is **unchanged**: `xs`/`sm` → `text-xs`, `md` → `text-sm`, `lg` → `text-base`. Consumers that explicitly pass `size="md"` still get `text-sm` as controlled escalation; `className` overrides still win via tailwind-merge.

## Consequences

### Positivas
- Single default text size across all table cells (`text-xs`), consistent with badge/chip tokens.
- Denser tables — more data per row without changing row structure.
- No consumer changes required; the change is contained to the shared cell renderers.

### Negativas
- Cells are visually smaller than before; consumers relying on the `text-sm` default must pass `size="md"` or `className="text-sm"` explicitly.
- Any consumer that stacked a sibling element assuming `text-sm` baselines may need minor alignment tweaks.

### Archivos modificados
- `frontend/components/shared/DataTableCells.tsx` — default `text-sm` → `text-xs` in text primitives
- `docs/20-contracts/component-contracts.md` — §DataCell primitives defaults
- `docs/20-contracts/typography-scale.md` — §N3 rows for DataCell.Text / DataCell.Date

## Alternatives considered

- **Shift `SIZE_MAP.md` to `text-xs` too**: rejected — removes the escalation token for consumers who want a larger value without a literal class override.
- **Per-consumer override at each call site**: rejected — too many call sites; the shared default is the single point of control.
