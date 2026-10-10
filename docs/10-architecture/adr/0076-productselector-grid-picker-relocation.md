---
id: 0076
title: Product grid family relocated out of the shared barrel and renamed ProductGridPicker
status: Accepted
date: 2026-10-09
author: frontend-team
---

# 0076 — Product grid family relocated out of the shared barrel and renamed ProductGridPicker

**Related:** ADR-0020 (modal-on-list edit UX), ADR-0071/0072 (shared-surface governance), `docs/50-audit/design-system-ui-audit.md` (§3.1, §7, §8.2, A2, T5)

---

## Context

The audit (§8 F2·6, A2) found the name `ProductSelector` was doing double duty on **incompatible surfaces**:

- `components/shared/ProductSelector/ProductSelector.tsx` — a grid **picker** (product grid + category filter + search + variant modal) fed from outside.
- `components/selectors/ProductSelector.tsx` — a single-value **combobox dropdown** consumed by 10+ drawers/forms.

Both were bundled under the same barrel name. The audit and eng review (2026-09-16) concluded they are not duplicates to merge but divergent surfaces that must not share a name. The grid's files also imported `@/features/inventory` (types + `useVariants`) from inside `components/shared`, violating layer direction (invariants 2/3): shared must not depend on features.

The shared barrel (`components/shared/index.ts`) publicly exports the grid family — `ProductSelector`, `ProductGrid`, `SearchBar`, `CategoryFilter`, `CategoryDropdown`, `VariantSelectorModal` + their prop types — documented in the barrel under "Product Selector family (PR-1, PR-2, PR-3)". Removing/renaming those exports is a **public-API change under invariant 12**; the audit's T5 row flags that an ADR is required exactly for this case. This ADR records that change.

## Decision

1. **Relocate** the whole grid folder with `git mv components/shared/ProductSelector → components/selectors/ProductGridPicker`; the folder keeps its own public barrel (`index.ts`) which now also lives in the `components/selectors` layer.
2. **Rename the surface**: facade `ProductSelector`/`ProductSelectorProps` → `ProductGridPicker`/`ProductGridPickerProps`, in the facade file and in the folder/`components/selectors` barrels. `ProductSelector` now means exactly one thing — the dropdown picker in `components/selectors/ProductSelector.tsx` (API untouched, per audit T5).
3. **Stop publishing the grid family from `@/components/shared`**: the shared barrel drops the folder export; the 2 audit call sites (`tools/CostCalculatorDrawer`, `production/.../ProductSelectionStep`) plus the additional consumers discovered during execution (`POSClientView`, `POSVariantSelectorModal` → `VariantSelectorModal`, `ContactCardGrid`/`AdvancedContactSelector` → `SearchBar`, `features/pos` shims) import from `@/components/selectors` instead.
4. **No deprecation window**: mirrors ADR-0072 — internal, unreleased surfaces; the shared→feature edge the folder caused is itself the reason to move it now rather than keep a forwarding shim.
5. **Guard**: `lib/__tests__/shared-imports.contract.test.ts` (audit T4, CI) now asserts the grid is gone from `components/shared` and keeps an allowlist ratchet for the two residual shared→feature edges outside this scope.

## Consequences

### Positivas
- One meaning per exported name; the dropdown picker is no longer shadowed by a grid surface at the barrel level.
- `components/shared` stops depending on `features/*` via this folder — the last large offender of the F2 invariant; the residual two-file ratchet is pinned by the guard.
- The grid family is now co-located with the other selectors it competes with, under one discoverable `components/selectors` layer.
- The shared barrel shrinks by 6 component exports + 6 type exports (mirrors the §8.0 "barrel publishes ≥3 consumers" rule).

### Negativas
- Any consumer importing the grid family from `@/components/shared` must update (in-repo migration complete: 8 files). External forks pinned to the old path/names break — none known.
- `ProductGridPicker` is longer to type than `ProductSelector`; this is deliberate to avoid collision with the dropdown picker.

### Archivos modificados
- Moved+renamed: `frontend/components/shared/ProductSelector/*` → `frontend/components/selectors/ProductGridPicker/*` (facade renamed to `ProductGridPicker.tsx`)
- Edited: `frontend/components/selectors/index.ts`, `frontend/components/shared/index.ts`, `frontend/features/production/components/steps/ProductSelectionStep.tsx`, `frontend/features/pos/components/POSClientView.tsx`, `frontend/features/pos/components/index.ts`, `frontend/features/pos/components/POSVariantSelectorModal.tsx`, `frontend/components/tools/CostCalculatorDrawer.tsx`, `frontend/components/shared/ContactSelector/ContactCardGrid.tsx`, `frontend/components/selectors/AdvancedContactSelector.tsx`, `frontend/features/inventory/types/index.ts` (comentario), `frontend/lib/__tests__/shared-imports.contract.test.ts`
- Docs: `docs/50-audit/design-system-ui-audit.md` (T5 done + A2 confirmado)

## Alternatives considered

- **Keep the grid in shared and drop only the facade rename**: rejected — the folder's `@/features/inventory` imports keep violating layer direction; the export-name collision at the barrel persists.
- **Move the grid to `features/inventory` (its "dueña")**, per the T5 option list: rejected — the grid is consumed by POS, production, tools and contacts-search; it is a cross-feature selector, so the `components/selectors` layer (not a single feature) is the right home, alongside the dropdown picker with which it nearly collided.
- **Keep a deprecated shared re-export shim to `@/components/selectors/ProductGridPicker`**: rejected — it would keep `@/components/shared` advertising a name that no longer means what it says, and the F2 guard specifically wants 0 grid imports from shared.

## References

- `docs/20-contracts/component-contracts.md` — shared barrel / public surface rules
- `docs/90-governance/GOVERNANCE.md` §12 (invariant 12 — public export changes)
- `docs/30-playbooks/deprecate-feature.md`
- `docs/50-audit/design-system-ui-audit.md` — §3.1, §7, §8.2, A2, T4/T5
- ADR-0072 (precedent: dead shared exports removal), ADR-0020