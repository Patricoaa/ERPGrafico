---
id: 0064
title: Badge Layer-1 categorical intents (cyan / magenta / yellow / black)
status: Proposed
date: 2026-08-03
author: core-team
---

# 0064 — Badge Layer-1 categorical intents (cyan / magenta / yellow / black)

**Related:** ADR-0029 (Color system), `color-system.md` (§2.4, §4.4, §8), `component-chip.md` (intent → token), `badge-resolvers.ts` (CATEGORY_MAP)

---

## Context

Categorical chips — like the payment methods shown in `sales/pos/cajas` ("Métodos") and treasury ("Métodos Soportados") — were rendered through `Chip.Category` → `resolveCategory` → `Badge`, which only accepts **semantic** intents (`primary`, `info`, `success`, `warning`, `destructive`, `neutral`). Payment methods were therefore forced into semantic colors (CASH→success, CARD→info, TRANSFER→primary, CHECK→warning) even though a payment method is a *categorical identifier*, not a workflow state.

`color-system.md §8` and ADR-0029 reserve Layer 1 process inks (`cyan`, `magenta`, `yellow`, `black`) for `ColorBar` and charts (`--chart-N`). The result: the graphic-industry vocabulary that grounds the rest of the brand — C-M-Y-K inks — was unavailable to chips, which are the very component used to identify money-flow categories.

## Decision

1. **Extend `BadgeIntent`** with four Layer 1 categorical intents: `'cyan' | 'magenta' | 'yellow' | 'black'`.
2. **Add the matching CVA variants** in `Badge.tsx` using the standard tint recipe (`bg-{ink}/10 text-{ink} border-{ink}/20`), plus entries in `Badge.Dot` / `Badge.Hub` color maps.
3. **Map the `payment_method` category** statically (identity, per type — not cycled by position):
   - `CASH` → `cyan`
   - `CARD` / `CARD_TERMINAL` / `DEBIT_CARD` / `CREDIT_CARD` → `magenta`
   - `TRANSFER` → `yellow`
   - `CHECK` → `black`
   - `OTHER` → `neutral` (unchanged fallback)
4. **Authorize categorical chips as a Layer 1 consumer** in `color-system.md §8` (alongside `ColorBar` and charts), and document the categorical chip palette in a new `§4.5`.
5. **Semantic intents remain the only option for workflow state** (`StatusBadge` / `STATUS_MAP`). The new intents are restricted to categorical chips.

## Consequences

### Positivas
- Payment-method chips now use the fixed process inks, consistent with the brand's C-M-Y-K identity (a graphic-industry ERP).
- Categorical identity no longer overloads semantic state colors — a chip that says "CASH" can never be confused with a "paid" status badge.
- Static per-type mapping keeps the same method color across all terminals and screens.
- Backward compatible: widening the `BadgeIntent` union is additive; consumers with `Record<string, string>` color maps are unaffected.

### Negativas
- The contract changes (color-system / component-chip) — an ADR is required per `stability: contract-changes-require-ADR`; this ADR provides it.
- `color-system.contract.test.ts` "STATUS_MAP only emits known BadgeIntent values" iterates every `intent:` in `badge-resolvers.ts` (including `CATEGORY_MAP`) and must learn the new intents.
- Visual change: payment-method chips switch from semantic to process colors — needs a quick light/dark pass in `sales/pos/cajas` and treasury devices.

### Archivos modificados
- `frontend/lib/badge-resolvers.ts` — `BadgeIntent` union + `CATEGORY_MAP.payment_method`
- `frontend/components/shared/Badge.tsx` — CVA intents + `Badge.Dot` / `Badge.Hub` maps
- `frontend/lib/__tests__/color-system.contract.test.ts` — known intents + Layer 1 chip guard
- `docs/20-contracts/color-system.md` — §2.4, §4.5, §8, §11
- `docs/20-contracts/component-chip.md` — intent prop + intent → token table
- `docs/10-architecture/design-system.md` — prohibited-patterns exception note

## Alternatives considered

- **Dynamic palette cycled by chip position** (cyan → magenta → yellow → … by index): rejected — the same method would change color between terminals and across rows, destroying categorical identity.
- **Scoped `tone` prop on `Chip.Category` only** (bypass `BadgeIntent`): rejected — duplicates the CVA machinery, forks the color resolution path, and leaves `Badge`/`Badge.Dot`/`Badge.Hub` unable to express process colors.
- **Keep semantic-only**: rejected — forced a categorical concept onto state colors and made the graphic-industry palette unusable for chips.

## References

- `docs/20-contracts/color-system.md` — §8 exceptions, §4.4 data-viz, §11 governance
- `docs/20-contracts/component-chip.md` — Chip contract, intent → token mapping
- `docs/10-architecture/adr/0029-color-system-robustening.md`
- `frontend/lib/badge-resolvers.ts` — `CATEGORY_MAP.payment_method`
