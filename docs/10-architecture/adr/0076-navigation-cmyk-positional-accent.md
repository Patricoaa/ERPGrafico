---
id: 0076
title: Tab underline, module rail, page navbar & top navheader — positional CMYK accent (Layer 1 inks for navigation)
status: Proposed
date: 2026-08-13
author: core-team
---

# 0076 — Tab underline, module rail, page navbar & top navheader: positional CMYK accent (Layer 1 inks for navigation)

**Related:** ADR-0064 (Badge Layer-1 categorical intents), `color-system.md` (§2.4, §8, §11), `TabBar.tsx` (underline + toolbar variants), `ModuleNavigationMenu.tsx` (top navheader), `DashboardShell.tsx` (module rail)

---

## Context

The underline tabs (`TabBar` `variant="underline"`), the left module rail, the page navigation bars (`TabBar` `variant="toolbar"` — the "navbar" rendered by `PageSectionHeader`, `BankSubTabBar`, `AnalyticsPanel` and the `DataTableToolbar` view switcher) and the top module navigation header (`ModuleNavigationMenu` in the shell top bar) showed their active state with a single `bg-primary` (K100) indicator or a neutral `bg-accent`/`bg-muted` fill plus a static hover. The design direction requests:

- A thin 1px baseline border always visible under every underline tab.
- A thick second border on hover/active.
- Lighter font weight at rest, bold on hover/active (underline tabs only).
- A **positional CMYK cycle** for the hover/active accent: elements enumerated in order get cyan → magenta → yellow → black, repeating every 4.
- The page navbar (`toolbar` variant) and the top navheader (`ModuleNavigationMenu` tabs) to follow the module-rail behavior: neutral ink at rest, accent ink + bottom bar on hover/active, **dropping the `bg-accent` pill and the `bg-primary/5` / `bg-muted/50` fills** entirely.

`color-system.md §2.4/§8` reserves Layer 1 inks for `ColorBar`, charts and (since ADR-0064) categorical chips. Using them as a hover/focus **state** on navigation surfaces is a new consumer. Positional cycling (index-based, not identity-based) was explicitly the rejected alternative in ADR-0064 for chips — but it is exactly the intent here, because a tab position is a decorative sequence, not a domain identity.

## Decision

1. **Authorize Layer 1 process inks as a positional accent** for navigation decoration only: `TabBar` underline triggers, `TabBar` toolbar triggers (page navbar), the top navheader tabs in `ModuleNavigationMenu`, and the left module rail in `DashboardShell`.
2. **Cycle by position:** 1º `cyan`, 2º `magenta`, 3º `yellow`, 4º `black`, repeating every 4 (`index % 4` over the visible/render order). Left→right for tabs, the navbar and the navheader, top→bottom for the rail.
3. **Hover/active uses the item's ink** for text/icon (`text-{ink}`, plus `data-[state=active]:text-{ink}` on `TabBar` triggers to override the shadcn `TabsTrigger` base `data-[state=active]:text-foreground`, and `data-[state=open]:text-{ink}` on `ModuleNavigationMenu` triggers to override the shadcn `NavigationMenuTrigger` base `data-[state=open]:text-accent-foreground`) and the thick border bar (`bg-{ink}`). Rest stays neutral (`text-foreground/60` + `border-border/40` baseline for underline; `text-muted-foreground`, no fill, for the toolbar navbar and the navheader).
4. **Navbar and navheader drop their fills:** the `toolbar` variant no longer renders a `bg-accent`/`bg-background` segmented container, and the navheader tabs no longer use `bg-primary/5` (active) / `bg-muted/50` (hover/open); the accent ink + bottom bar (`h-[4px]`, opacity fade) is the only active/hover affordance, matching the module rail.
5. **Shared constant:** `CMYK_ACCENT` exported from `components/shared/TabBar.tsx` (consumed via the shared barrel) so tabs, the navbar, the navheader and the rail use the same cycle.
6. **No new tokens.** Existing `--color-cyan` / `--color-magenta` / `--color-yellow` / `--color-black` are consumed via `text-{ink}` / `bg-{ink}` utilities. No `.dark` adaptation — inks stay fixed (Layer 1).
7. **Semantic intents remain the only option for workflow state** (`StatusBadge` / `STATUS_MAP`); this ADR does not touch them.

## Consequences

### Positivas

- Consistent graphic-industry vocabulary across the navigation surfaces (tabs, navbar, navheader, module rail).
- Explicit hover/active affordance (thick border) layered on the always-visible baseline (underline) or on the neutral navbar/navheader row.
- Dark-mode safe by construction: fixed inks need no `.dark` overrides.
- Toolbar navbar and navheader gain a positional identity like the rail; the pill/fill backgrounds (segmented-control look, `bg-primary/5` active) are gone.

### Negativas

- Layer 1 used for UI state requires this ADR as authorization (contract change).
- `text-yellow` on light backgrounds has low contrast during hover — accepted as a transient accent, consistent with ADR-0064 chips.
- Positional cycle means colors shift when tabs/modules are added, removed or reordered (decorative by design).

### Archivos modificados

- `frontend/components/shared/TabBar.tsx` — `CMYK_ACCENT` (fields `text`, `activeText`, `openText`, `hoverText`, `bar`) + underline trigger styles (baseline, weights, hover/active ink, thick bar) + toolbar (navbar) triggers: pill removed, accent ink + bottom `h-[4px]` bar, neutral toolbar badge
- `frontend/components/shared/ModuleNavigationMenu.tsx` — top navheader tabs: `bg-primary/5` / `bg-muted/50` fills removed, items `h-full` with bottom `h-[4px]` accent bar aligned to the header baseline, rest muted + hover/open/active ink
- `frontend/components/layout/DashboardShell.tsx` — module rail ink hover/active + right thick bar (no thin baseline, by request)
- `frontend/components/shared/search-styles.ts` — `TAB_TOOLBAR_TRIGGER` geometry (`h-8 px-3`) for the navbar bar
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
- `frontend/components/shared/ModuleNavigationMenu.tsx` — top navheader
- `frontend/components/layout/DashboardShell.tsx` — module rail
