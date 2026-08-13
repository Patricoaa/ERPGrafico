---
id: 0076
title: Tab underline & module rail — positional CMYK accent (Layer 1 inks for navigation)
status: Proposed
date: 2026-08-13
author: core-team
---

# 0076 — Tab underline & module rail: positional CMYK accent (Layer 1 inks for navigation)

**Related:** ADR-0064 (Badge Layer-1 categorical intents), `color-system.md` (§2.4, §8, §11), `TabBar.tsx` (underline variant), `DashboardShell.tsx` (module rail)

---

## Context

The underline tabs (`TabBar` `variant="underline"`) and the left module rail showed their active state with a single `bg-primary` (K100) indicator and a static hover. The design direction requests:

- A thin 1px baseline border always visible under every underline tab.
- A thick second border on hover/active.
- Lighter font weight at rest, bold on hover/active.
- A **positional CMYK cycle** for the hover/active accent: elements enumerated in order get cyan → magenta → yellow → black, repeating every 4.

`color-system.md §2.4/§8` reserves Layer 1 inks for `ColorBar`, charts and (since ADR-0064) categorical chips. Using them as a hover/focus **state** on navigation surfaces is a new consumer. Positional cycling (index-based, not identity-based) was explicitly the rejected alternative in ADR-0064 for chips — but it is exactly the intent here, because a tab position is a decorative sequence, not a domain identity.

## Decision

1. **Authorize Layer 1 process inks as a positional accent** for navigation decoration only: `TabBar` underline triggers and the left module rail in `DashboardShell`.
2. **Cycle by position:** 1º `cyan`, 2º `magenta`, 3º `yellow`, 4º `black`, repeating every 4 (`index % 4` over the visible/render order). Left→right for tabs, top→bottom for the rail.
3. **Hover/active uses the item's ink** for text/icon (`text-{ink}`) and the thick border bar (`bg-{ink}`). Rest stays neutral (`text-foreground/60` + `border-border/40` baseline).
4. **Shared constant:** `CMYK_ACCENT` exported from `components/shared/TabBar.tsx` (consumed via the shared barrel) so tabs and the rail use the same cycle.
5. **No new tokens.** Existing `--color-cyan` / `--color-magenta` / `--color-yellow` / `--color-black` are consumed via `text-{ink}` / `bg-{ink}` utilities. No `.dark` adaptation — inks stay fixed (Layer 1).
6. **Semantic intents remain the only option for workflow state** (`StatusBadge` / `STATUS_MAP`); this ADR does not touch them.

## Consequences

### Positivas

- Consistent graphic-industry vocabulary across the two main navigation surfaces.
- Explicit hover/active affordance (thick border) layered on the always-visible baseline.
- Dark-mode safe by construction: fixed inks need no `.dark` overrides.

### Negativas

- Layer 1 used for UI state requires this ADR as authorization (contract change).
- `text-yellow` on light backgrounds has low contrast during hover — accepted as a transient accent, consistent with ADR-0064 chips.
- Positional cycle means colors shift when tabs/modules are added, removed or reordered (decorative by design).

### Archivos modificados

- `frontend/components/shared/TabBar.tsx` — `CMYK_ACCENT` + underline trigger styles (baseline, weights, hover/active ink, thick bar)
- `frontend/components/layout/DashboardShell.tsx` — module rail ink hover/active + right thick bar (no thin baseline, by request)
- `frontend/app/globals.css` — removed dead `.tab-underline-primary` block
- `docs/20-contracts/color-system.md` — §8 exception + §11 note

## Alternatives considered

- **Dynamic class construction** (`text-${ink}`): rejected — Tailwind JIT cannot see interpolated classes; full literal strings are kept in `CMYK_ACCENT`.
- **`:nth-child` CSS rules in globals.css**: rejected — couples styling to DOM position and splits the color source of truth; the shared constant keeps tabs and rail in sync and is testable.
- **Semantic intents only (no CMYK)**: rejected — loses the requested brand accent and the industry identity; rest/hover would be hue-indistinguishable.

## References

- `docs/20-contracts/color-system.md` — §2.4 Layer 1 rules, §8 exceptions, §11 governance
- `docs/10-architecture/adr/0064-badge-layer1-categorical-intents.md` — precedent for authorizing Layer 1 consumers
- `frontend/components/shared/TabBar.tsx` — `CMYK_ACCENT`
- `frontend/components/layout/DashboardShell.tsx` — module rail
