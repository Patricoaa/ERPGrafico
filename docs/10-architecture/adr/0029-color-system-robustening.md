---
id: 0029
title: Color System Robustening — info→blue, neutral accent, fixed Layer 1 / adaptive Layer 2, data-viz palette
status: Accepted
date: 2026-05-30
author: pato
---

# 0029 — Color System Robustening

## Context

The 3-layer color architecture (Process CMYK → Semantic → Domain, OKLCH) is sound, but its application was inconsistent and the contract had drifted from the implementation. Concrete problems, verified in code:

1. **Broken guardrail.** The `tw/no-raw-color` ESLint rule's regex required `{prefix}{color}` with no hyphen, so it matched *no* real Tailwind class (`bg-red-500` → no match). Invariant #2 ("no raw Tailwind colors") was effectively unenforced. It also never inspected `cn(cond && "…")` arguments, so hardcoded values inside conditional class composition slipped through.
2. **Contract ↔ implementation drift.** `color-system.md` documented per-intent "Dark OKLCH" values that did not exist in `globals.css` — in `.dark` only foregrounds and surfaces changed, not the intents. The "adaptive dark mode" was fiction.
3. **Semantic collisions.** `accent == warning == yellow` (identical OKLCH, papered over with a `SMART CONTRAST` hack); `info == magenta` (pink → tinted `asset` pink); `blue` defined but unused.
4. **Residue + leaks.** `--ring` was hue 301 (violet), left over from the pre-Cyan "Electric Violet" primary. Ghost vars `--success-rgb`/`--warning-rgb` (never defined → silent shadow failure). Hardcoded amber `rgba(245,158,11,…)` and pure-black `rgba(0,0,0,…)` shadows. Charts reused semantic intents (`success`/`warning`/`destructive`) as categorical series colors — with no data-viz palette in the contract.

## Decision

1. **`info` → `blue`.** `--info-raw` aliases `--blue-raw` (was `--magenta-raw`). Conventional informational blue; activates the previously-orphan `blue` ink; `asset` (→ `info`) is no longer pink. Magenta becomes a Layer-1-only ink (ColorBar / graphic-industry components), unmapped to any intent.
2. **`accent` → neutral interaction surface.** `--accent-raw` aliases `--secondary-raw` (was `--yellow-raw`). `accent` is the hover/focus/selected/active surface that shadcn primitives rely on; it must stay low-chroma. The "secondary emphasis" concept is dropped — **for emphasis use `primary`.** The `SMART CONTRAST` patch now targets only `warning`.
3. **`--ring` → `primary`.** Focus ring derives from Process Cyan, matching `--color-sidebar-ring`; the violet residue is removed.
4. **Layer 1 fixed, Layer 2 adaptive.** All Layer 1 inks and overprint mixes are fixed across modes. Each Layer 2 intent (`primary`, `info`, `success`, `warning`, `destructive`) gets an explicit lighter value in `.dark` for perceptual contrast (implemented, no longer documentation-only). `accent` follows `secondary`; `neutral` stays fixed.
5. **Data-viz palette `--chart-1…6`.** A dedicated categorical palette mapped to the CMYK/spot inks (cyan, magenta, green, pantone-orange, blue, yellow). Charts must use `var(--chart-N)` and never a semantic intent as a series color. Charts are an authorized Layer-1 consumer.
6. **ESLint guardrail repaired and hardened.** Regex now matches real raw palette classes (`{prefix}-{color}-{shade}`, shade required so theme tokens like `bg-cyan`/`bg-neutral` pass), flags literal hex/rgb in `className`/`cn`, and recurses through `cn(cond && …)`, ternaries, arrays and object keys. **Promoted from `warn` to `error`** once the violation count reached 0.
7. **Contract sync + consistency test.** `color-system.md`, `design-system.md`, `GOVERNANCE.md` updated to match the implementation. A `color-system.contract.test.ts` enforces invariants (intents have tokens, aliases resolve to existing raws, Layer 1 not overridden in `.dark` while Layer 2 is, `STATUS_MAP` ⊆ `BadgeIntent`).
8. **`--overlay` scrim token + white/black migration.** Added `--color-overlay` (fixed dark scrim, does not invert) for modal backdrops / image darkeners. Migrated all out-of-contract `white`/`black` utilities in `features`/`shared`/`layout`: `border-white/black`→`border-border`, `bg-{intent} text-white`→`text-{intent}-foreground`, interaction surfaces (`hover:bg-white/5`, `bg-black/10`)→`bg-accent`, forced `bg-white`→`bg-card`/`bg-background`, dividers→`bg-border`, progress/kbd→`bg-muted`, glass→`bg-card/50`, scrims `bg-black/N`→`bg-overlay/N`. Shadcn `components/ui/*` overlay primitives keep their stock `bg-black/N` (rule 22, documented exception).

## Consequences

- **Positive:** the guardrail is real and broader; the contract matches the CSS; semantic colors are legible per-view (info blue, no accent/warning collision); dark mode genuinely adapts; charts are on-brand and maximally distinct; a test prevents future drift.
- **Neutral:** `info`/`accent` are token aliases, so the ~290 `bg-info`/`bg-accent` usages update with no component edits. `magenta` and the two Pantone spot colors remain defined but carry no semantic role.
- **Negative / risk:** the `white`/`black` migration (item 8) touches glassmorphism / always-dark surfaces (UniversalSearch command palette, OrderHeaderDashboard glass cards) where `border-border`/`bg-card/50`/`bg-accent` now resolve theme-aware instead of a fixed light tint — these warrant a quick visual pass in light **and** dark mode. Bare `white`/`black` utilities are still not auto-caught by the lint rule (black is a Layer-1 token, white is bare), so prevention relies on the §8 contract rule + review, not enforcement.

## Alternatives considered

- **`accent` → pantone-violet (the original ask).** Rejected: `accent` is the neutral interaction surface across 95 shadcn/feature usages; a saturated hue would turn every menu/dropdown/calendar/selected hover violet.
- **Keep `info` = magenta.** Rejected: pink informational state is unconventional and tinted `asset` pink; `blue` was already defined and idle.
- **Ratify the fixed-only reality and delete the dark columns** (instead of implementing them). Rejected: the user chose full adaptive dark mode; the documented values were already designed.

## References

- Contract: [color-system.md](../../20-contracts/color-system.md) (§2 fixed Layer 1, §3.1 intents, §4.4 data-viz, §5 dark strategy, §6 sidebar, §8 forbidden + exceptions)
- [design-system.md](../design-system.md), [GOVERNANCE.md](../../90-governance/GOVERNANCE.md) rules 12–13
- Implementation: `frontend/app/globals.css`, `frontend/eslint-rules/no-raw-tailwind-colors.mjs`
- Test: `frontend/lib/__tests__/color-system.contract.test.ts`
- Supersedes the dark-mode strategy described (but not implemented) in the prior `color-system.md`; builds on [0003](0003-tailwind-v4-theme-inline.md).
