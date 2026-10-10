---
id: 0074
title: Shared ModuleGrid component with truthful runtime status
status: Accepted
date: 2026-10-09
author: core-team
---

# 0074 — Shared ModuleGrid component with truthful runtime status

**Related:** ADR-0070 (Primary = Process Black K100), `component-card.md`, `color-system.md` §intents, `DashboardPageClient.tsx`, `SettingsPageClient.tsx`

---

## Context

Two grids present "modules as cards with a status pill", implemented twice with divergent details (Fase 1 findings):

| | Dashboard (`DashboardPageClient.tsx:65-94`) | Settings (`SettingsPageClient.tsx:77-108`) |
|---|---|---|
| Card height | `h-28` | `h-32` |
| Surface | inline Tailwind (`border border-border/10 rounded-md shadow-card`) | `card-base` utility |
| Status text size | `text-2xs` | `text-3xs` |
| Status source | **hardcoded literals** ("Online"/"Pendiente"/"Offline" — `const modules` estático, no WS) | **hardcoded literals** ("Configurado", "Seguro", "Activo", "Ejecutando") |
| Status colors | hand-rolled dot + label | `text-success`/`text-info` mixed without semantics |
| Entrance | `animate-in slide-in-from-bottom-4` + `animationDelay×10` (see ADR-0075) | `animationDelay×6` on `card-base` (see ADR-0075) |

Two problems:

1. **Divergence (SET-02):** same visual language, two implementations, drifting tokens. No single component to fix for height/status/entrance.
2. **Fabricated status (SET-01 + DSH-03 — same defect):** Settings cards claim "Seguro", "Ejecutando", "Activo" from a static array (`SettingsPageClient.tsx:18-64`). The dashboard grid is identical: `const modules` at `DashboardPageClient.tsx:10-21` hardcodes "Online"/"Pendiente"/"Offline". This is false information in a financial-operations UI — a user reads "Seguro" and believes a guardrail exists; a module reads "Offline" and looks broken. **There is no per-module connectivity feed today** — `useSystemStatus` (settings) reports server-level state (db/redis), not per-module reachability — so no status pill in either grid reflects a real value.

`color-system.md` requires status colors to follow layer intents; the hand-mixed `text-success`/`text-info` pairs violate intent semantics.

## Decision

1. **Introduce `components/shared/ModuleGrid.tsx`** — the single component for "module/card grids" (dashboard modules, settings modules, any future launchers). API sketch:
   ```ts
   interface ModuleGridItem {
       id: string
       label: string
       description?: string
       url: string
       icon: LucideIcon
       status?: RuntimeStatus            // resolved, not literal
   }
   type RuntimeStatus =
     | { kind: "connected" }             // dot-success + "Conectado"
     | { kind: "pending" }               // dot-warning + "Pendiente"
     | { kind: "offline" }               // dot-destructive + "Offline"
     | { kind: "info"; label: string }   // neutral intent, system-derived
   ```
   Card token is shared (`card-base` internally) with a single documented height (`h-28`), typography (`text-2xs`), and hover.

2. **Status is forbidden as static metadata.** A status pill may only render when it reflects a real system value: WS/connection events or server state from `useSystemStatus` (e.g. db/redis), never a literal in the module array. Literal strings are **PR-rejected** (there is no legitimate static "Seguro"/"Configurado"/"Online" in either grid).

3. **Status colors follow `color-system.md` intents only** (success/destructive/info), assigned via the `RuntimeStatus` kind — never hand-picked per module. Settings "Estado del Sistema" block (SET-05) reuses the same intent map for its 3 environments.

4. **Entrance animation is out of `ModuleGrid`'s scope** — no local motion (ADR-0075 owns that). `ModuleGrid` renders static cards; any stagger is applied by the consumer via `FadeIn`/shell per `component-animation.md`.

5. **Migrate (v1 ships without pills):** dashboard grid → `ModuleGrid` and settings grid → `ModuleGrid`, **both without a status pill** — no truthful feed exists per module today. `RuntimeStatus` stays in the API as the mechanism for a future real feed (WS events, connection checks); it is never mapped from a fabricated source. A pill may only be reintroduced together with the feed that backs it.

## Consequences

### Positivas
- One component, one token set — kills SET-02/DSH-05 drift.
- Honest status: neither grid fabricates pills anymore. `RuntimeStatus` is ready for the first real per-module feed, but until one exists the grids are pill-free.
- Accessible: `ModuleGrid` owns `<ul>/<li>` + card link semantics for free.
- Color intents centralized; SET-05 colors fixed by the same map.

### Negativas
- Visual churn on both grids (height, typography normalization) — one-time pass.
- Removing Settings' color-coded module badges loses *some* glanceability for what were fake restates anyway; compensation is the truthful `RuntimeStatus`.
- `ModuleGrid` becomes a new shared component → cross-cutting pattern, hence this ADR.

### Archivos modificados (estimado)
- `frontend/components/shared/ModuleGrid.tsx` (nuevo)
- `frontend/app/(dashboard)/DashboardPageClient.tsx`, `frontend/app/(dashboard)/settings/SettingsPageClient.tsx` — migrar + borrar status literals
- `frontend/features/settings` `useSystemStatus` — exponer `RuntimeStatus` mapper
- `docs/20-contracts/component-card.md` — documentar `ModuleGrid` en la familia card-base

## Alternatives considered

- **Keep two grids, only build a status resolver.** Rejected: leaves token drift (height/typography) in place; the real cost is duplication.
- **Keep status pills via `useSystemStatus`.** Rejected: it is server-level state (db/redis), not per-module reachability — mapping it to "Conectado"/"Offline" per module would be a new fabrication. Honesty is the goal; the pill stays dormant until a real feed exists.
- **Settings keep badges but relabel them as static perms descriptors.** Rejected: a badge labeled "Seguro" is inherently a claim; descriptors belong in the description text, not a status pill.

## References

- `frontend/app/(dashboard)/DashboardPageClient.tsx:65-94` — dashboard grid
- `frontend/app/(dashboard)/settings/SettingsPageClient.tsx:18-64,77-108` — settings grid + status literals
- `docs/20-contracts/color-system.md` — layer intents
- `docs/20-contracts/component-card.md` — `card-base` family
- Fase 1 backlog: DSH-03, DSH-05, SET-01, SET-02, SET-05