---
id: 0066
title: CurrencyFlow aesthetic as the default badge style
status: Proposed
date: 2026-08-03
author: core-team
---

# 0066 — CurrencyFlow aesthetic as the default badge style

**Related:** ADR-0029 (Color system), ADR-0060 (flow cells tinted badge), ADR-0064 (Layer-1 categorical intents), ADR-0065 (DataCell.Status ghost pill unification), `component-chip.md` (typography invariants), `typography-scale.md` (§N2), `color-system.md` (§3.3), GOVERNANCE §15

---

## Context

The badge system used two visual languages:

- **Legacy badge** (`Badge`, `StatusBadge`, `Chip`, `EntityBadge`): `font-mono font-black uppercase`, `rounded-full` pill, `border`, letter-spacing (`tracking-widest`/`tracking-tight`), size-driven font sizes (`text-[9px]`…`text-base`).
- **Flow cells** (`DataCell.CurrencyFlow` / `DataCell.NumericFlow`, ADR-0060): borderless `rounded-sm` tinted badge with `font-sans text-xs font-medium`.

The legacy badge language read as "monospace stencil" and clashed with the data-cell typography the app uses everywhere else. The user-facing direction: **the CurrencyFlow aesthetic becomes the default for all project badges** — same radius, text size, weight, font family, and borderless treatment — while keeping the legacy look reachable as an opt-in for legacy consumers.

## Decision

1. **The CurrencyFlow aesthetic is the default for every badge primitive:**
   - `font-sans font-medium text-xs`, normal tracking, **no border**, no uppercase.
   - `rounded-sm` (square) instead of `rounded-full` (pill).
   - Default `size="md"` renders `px-2 py-0.5 text-xs gap-1` (identical to the CurrencyFlow container).
   - Intent colors keep the tinted recipe `bg-{intent}/10 text-{intent}` (neutral: `bg-muted/60 text-muted-foreground`).

2. **Single visual system, changed in place.** No new `flow`/`classic` variant was added: the existing base + defaults of `badgeVariants` (`components/shared/Badge.tsx`) were modified directly. The legacy typography is reachable only via explicit `className` overrides in legacy consumers (e.g. `SimulationResults` renders `font-mono font-black`).

3. **Table cells render the solid tinted badge.** `DataCell.Status` and `DataCell.Chip` drop `appearance="ghost"` and render the standard tinted badge — the same look as the CurrencyFlow columns in the same tables. This supersedes ADR-0065 decisions 1 and 5.

4. **`ui/badge.tsx` (shadcn) is aligned.** Base loses `border` (it already was `rounded-sm text-xs font-medium px-2 py-0.5`). The `outline` variant adds an explicit `border` since it relied on the base one.

5. **Circular surfaces are preserved.** `Badge.Hub` (status ring) and status **dot** indicators remain circular (GOVERNANCE §15). `Badge.Dot` text aligns to `font-sans font-medium`.

## Consequences

### Positivas
- One unified badge look across the whole app, matching `DataCell.CurrencyFlow` exactly.
- Dense-table status/chip cells now read as the same token as flow columns (consistent with ADR-0060's design direction).
- Legacy `font-mono font-black uppercase`/pill/border language is gone from defaults — less "stencil" visual noise.

### Negativas
- Global visual change: every badge/chip/status in the app changes appearance at once (all consumers of the defaults).
- Legacy consumers that relied on the old default typography now read differently; those that need the old look must add explicit `className` overrides.
- Table status cells become tinted (more visual weight than the previous ghost pills) — this matches the flow-column look by design.
- `Badge.Hub` and dot presentations intentionally keep `rounded-full`; GOVERNANCE §15 wording was updated.

### Archivos modificados
- `frontend/components/shared/Badge.tsx` — base typography, `size.md`, `tracking.normal`, `shape` default, render simplification, `Badge.Dot`
- `frontend/components/shared/Chip.tsx` — drop forced `tracking`
- `frontend/components/shared/StatusBadge.tsx` — drop forced `tracking`, docs
- `frontend/components/shared/EntityBadge.tsx` — square + borderless default
- `frontend/components/shared/DataTableCells.tsx` — `DataCell.Status`/`DataCell.Chip` solid tinted
- `frontend/components/ui/badge.tsx` — borderless base, `outline` border
- `docs/20-contracts/component-chip.md`, `component-contracts.md`, `typography-scale.md`, `color-system.md`
- `docs/90-governance/GOVERNANCE.md` (§15)
- ADR-0060 / ADR-0065 amendments, `docs/10-architecture/adr/README.md`

## Alternatives considered

- **Add a `style` variant (`flow` vs `classic`) and keep the old look opt-in:** rejected — the user asked to change the default style in place, not introduce a parallel style system.
- **Keep table cells ghost:** rejected — the request explicitly targets the CurrencyFlow look (tinted badge) for all badges; ghost without a border is just plain text.
- **Keep pill `rounded-full`:** rejected — `rounded-sm` is part of the requested aesthetic.

## References

- `docs/10-architecture/adr/0060-flow-cells-tinted-badge.md` — flow recipe this ADR adopts as the badge default
- `docs/10-architecture/adr/0065-datacell-status-ghost-pill-unification.md` — superseded presentation decision
- `docs/20-contracts/component-chip.md`, `docs/20-contracts/typography-scale.md` — typography invariants
- `docs/20-contracts/color-system.md` — tinted recipe
- `docs/90-governance/GOVERNANCE.md` — §15 border radius
