---
id: 0075
title: Motion compliance — single shell transition, FadeIn-only entry, global reduced-motion floor
status: Accepted
date: 2026-10-09
author: core-team
---

# 0075 — Motion compliance — single shell transition, FadeIn-only entry, global reduced-motion floor

**Related:** `component-animation.md` (existing contract), ADR-0074 (ModuleGrid — no local motion), `globals.css`, `FadeIn.tsx`, POS excluded per contract header

---

## Context

`component-animation.md` (stable, 2026-05-21) already defines the motion system: **only** the `DashboardShell` transition for pathname changes (rule 2: "cero duplicación de animación en páginas simples") and `<FadeIn>` for same-route sub-view changes (rule 1: no direct framer-motion; rule 3: reduced-motion mandatory). GPU-only properties (§3).

Fase 1 verified four violations / gaps:

1. **Dashboard module grid** — `DashboardPageClient.tsx:72-73`: each of 10 cards applies `animate-in fade-in slide-in-from-bottom-4` + inline `animationDelay: ${index*50}ms` + `animationFillMode: 'backwards'`. The shell *already* animates the page (correctly, with `motion-reduce:animate-none` at `DashboardShell.tsx:245`), so this is the exact duplication the contract forbids (§1.2/§4 — "Tablero: No Requerido. El Shell maneja la entrada"), and the inline stagger bypasses `FadeIn`'s reduced-motion support.
2. **Settings module grid** — `SettingsPageClient.tsx:85`: `animationDelay` stagger on `card-base`, same problem.
3. **Micro-feedback** — `StatementImportModal.tsx:525`: `animate-bounce` on a success `CheckCircle2`, without `motion-reduce` guard.
4. **No reduced-motion floor for entry utilities** — `globals.css` wires `prefers-reduced-motion` only for `.skeleton` and sheet transitions, case-by-case; `animate-in`/`animate-*` and inline `animationDelay` in page content are unguarded → WCAG 2.1 SC 2.3.3 (animation from interactions) gap.

`DashboardShell.tsx:245` is the model to copy: `motion-reduce:animate-none motion-reduce:opacity-100` + `--tw-enter-translate-y: 8px` + `animationDuration: 0.35s`.

## Decision

1. **Entry/transition animation in page *content* exists only via two mechanisms:** the `DashboardShell` global transition, or `<FadeIn>` (delay through its `delay` prop — GPU-only, reduced-motion aware). Ban, as PR-reject + lint rule:
   - `animate-in` / `animate-*` Tailwind utilities in page/module components.
   - Inline `animationDelay` / `animationFillMode` / `@keyframes` in page content.
   - Direct `framer-motion` imports (already banned, rule 1 — restate, no new behavior).

2. **Module grids render static cards** (per ADR-0074 §4); staggered entrance is delivered, when wanted, by wrapping the grid in a single `<FadeIn>` at the consumer (dashboard/settings), never per-card inline.

3. **Global reduced-motion floor in `globals.css`:** a single `@media (prefers-reduced-motion: reduce)` rule that clamps entry/attention animation to ≤1 frame for any element carrying the entry utilities (or applying `animationDelay` inline):
   ```css
   @media (prefers-reduced-motion: reduce) {
     [style*="animation-delay"],
     .animate-in, .animate-out {
       animation-duration: 0.01ms !important;
       animation-delay: 0s !important;
       animation-iteration-count: 1 !important;
       transform: none !important;
     }
   }
   ```
   Note: the selector matches the DOM-serialized inline style (`animation-delay`, not `animationDelay`).
   This makes WCAG 2.1 SC 2.3.3 hold site-wide regardless of author discipline; keep the existing case-specific rules (skeleton, sheets) and the stronger `motion-reduce:` pairs where present (DashboardShell).

4. **Micro-feedback** (bounce/scale pulses on success/attention icons): allowed as a short attention cue **only when** it pairs with `motion-reduce:animate-none` (or is covered by the global floor in decision 3). `StatementImportModal.tsx:525` `animate-bounce` is migrated accordingly (remove or guard).

5. **Amend `component-animation.md`:** add a §Module grids (static cards; stagger via consumer `FadeIn`, not per-card), a §Micro-feedback (attention pulses, guard mandatory), the explicit ban list with the lint rule name, and the SC 2.3.3 floor reference. POS remains excluded per the contract header (POS motion is governed by its own phase/workstream).

## Consequences

### Positivas
- Motion becomes single-sourced and WCAG-compliant without per-element discipline.
- Kills DSH-04/SET-04/X-02 (re-audited as *violations of an existing contract*, not missing system).
- Dashboard/Settings entrance visual stable (shell covers it); tiny perf win (10/6 fewer animations per page load).

### Negativas
- Grid cards lose their staggered entrance (intentional per §4; shell fade replaces it).
- `animate-bounce` removal on the import-modal success state is a small delight regression — compensated by a static success treatment + reduced-motion correctness.
- Global floor is `!important` — must be maintained narrowly (entry classes only) to avoid surprising other intentional animations (sheet transitions already have their own 100ms rule; keep both, floor as backstop).

### Archivos modificados (estimado)
- `frontend/app/globals.css` — reduced-motion floor
- `frontend/app/(dashboard)/DashboardPageClient.tsx`, `frontend/app/(dashboard)/settings/SettingsPageClient.tsx` — remove per-card animate/inline delay (with ADR-0074)
- `frontend/features/finance/bank-reconciliation/components/StatementImportModal.tsx:525` — guard/remove bounce
- `docs/20-contracts/component-animation.md` — §Module grids, §Micro-feedback, ban list, SC 2.3.3
- Optional ESLint rule (e.g. `no-restricted-syntax` on `animationDelay` string / `animate-in` class) in `eslint.config.*`

## Alternatives considered

- **Keep stagger, only add `motion-reduce:` per site.** Rejected: violates §1.2 duplication; 16 call sites to touch and re-audit; the shell already animates the view.
- **Adopt framer-motion for entrance.** Rejected: contract forbids; heavier; no UX win at this polish layer.
- **Rely on OS-level animation disarm (no CSS).** Rejected: OS settings don't propagate reliably in browser; WCAG requires the site to offer the reduction.

## References

- `frontend/components/layout/DashboardShell.tsx:243-246` — the correct pattern (`motion-reduce:animate-none` + 0.35s + 8px)
- `frontend/app/(dashboard)/DashboardPageClient.tsx:72-73` — violation (grid)
- `frontend/app/(dashboard)/settings/SettingsPageClient.tsx:85` — violation (grid)
- `frontend/features/finance/bank-reconciliation/components/StatementImportModal.tsx:525` — `animate-bounce`
- `frontend/app/globals.css:727,1294` — current case-specific reduced-motion rules
- `docs/20-contracts/component-animation.md` — existing motion contract
- Fase 1 backlog: DSH-04, SET-04, X-02