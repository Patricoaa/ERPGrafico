---
id: 0071
title: ProductSelector — filtering by context (productTypes + canBeSold/canBePurchased)
status: Proposed
date: 2026-08-06
author: core-team
---

# 0071 — ProductSelector: filtering by context

## Context

The legacy `ProductSelector` (`frontend/components/selectors/ProductSelector.tsx`) exposes **five overlapping filter mechanisms**, applied inconsistently across 12 consumers:

| Prop | Level | Behavior |
|---|---|---|
| `productType: string` | Server | `?product_type=` (single type) |
| `allowedTypes: string[]` | Client | Filters already-fetched results (200-cap) |
| `simpleOnly: boolean` | Client | STORABLE or simple MANUFACTURABLE |
| `customFilter: (p) => boolean` | Client | Arbitrary predicate |
| `context: 'sale'\|'purchase'` | Server | `can_be_sold` / `can_be_purchased` |

Problems:

- The same intent (e.g. "only storable products") is expressed differently across consumers (`allowedTypes`, `customFilter`, or `productType`), so behavior drifts silently.
- `allowedTypes`/`simpleOnly` filter *after* the 200-item server fetch, so an out-of-set product can be missed even though it exists.
- BOM raw materials/component rows accept `MANUFACTURABLE` subassemblies — business decision requires **STORABLE only**.
- BOM outsourced service rows accept any purchasable product via `customFilter`; `validate_bom_line` does not enforce the type rule server-side.

## Decision

Consolidate the type-filter surface into a single declarative prop and move it to the server.

### API

- **`productTypes?: ProductType[]`** replaces `productType` / `allowedTypes` / `simpleOnly`.
  - 1 element → `?product_type=X`
  - N elements → `?product_type__in=X,Y` (backend gains the `in` lookup on `ProductFilter.product_type`).
- **`canBePurchased?: boolean`** / **`canBeSold?: boolean`** replace `context` (mapped to `can_be_purchased` / `can_be_sold` query params).
- Remaining local filters kept: `customFilter`, `customDisabled`, `excludeIds`, `restrictStock`.
- `excludeVariantTemplates` becomes standalone (was previously only honored under `context="purchase"`).
- `fetchSingleId` (dead, never consumed) removed from `useProductSearch`.

### Business rules

- **BOM materials (raw materials/components): STORABLE only.** Enforced in the selector via `productTypes={['STORABLE']}` and server-side via `validate_bom_line` for **new lines**.
- **BOM outsourced services: SERVICE and `can_be_purchased`.** Enforced via `productTypes={['SERVICE']}` + `canBePurchased`, and server-side for new lines.
- **Legacy data (existing lines with `MANUFACTURABLE` components) is NOT broken**: the validator only blocks *new* lines (`is_new` flag derived from the serializer instance); `audit_bom_line_types` management command reports existing violations for business review.
- The `useSingleProduct` path keeps edit-mode rendering safe when the stored value falls outside the filtered set.

### Consumers

All 12 migrated in one atomic frontend change (type-check only passes once all move together). `BOMDrawer` extracts local solo-prop wrappers `MaterialSelector` (`productTypes={['STORABLE']}`) and `ServiceSelector` (`productTypes={['SERVICE']}` + `canBePurchased`) to keep the two line types self-documenting. Redundant filters removed (`PricingRuleDrawer` `!parent_template` — the hook already forces `parent_template__isnull=true`; BOM material `customFilter` subsumed by STORABLE-only). `ProviderDrawer` commission product gains the missing `SERVICE` filter (bug fix).

## Consequences

### Positive

- Single declarative type filter; server-side narrowing (no more 200-cap client filtering for types).
- Business rules (STORABLE-only materials, SERVICE+purchasable outsourcing) enforced at both UI and API layers for new data.
- Edit-mode of legacy BOMs preserved; audit tooling surfaces existing violations.
- Bug fixed in `ProviderDrawer` (unfiltered service selector).

### Negative

- Behavior change: BOM materials no longer accept `MANUFACTURABLE` subassemblies (requires data audit via `audit_bom_line_types`).
- Frontend migration is atomic (12 consumers in one change).
- `canBeSold` is currently consumed by no caller (kept for symmetry with `canBePurchased` — see OV-6 decision).

### Neutral

- Contract change → this ADR (required by invariant 12) + `component-selectors.md` updated.
- `URLSearchParams` encodes commas as `%2C`; harmless at runtime (django-filter decodes before the `in` split), but tests assert on the decoded param.

## Alternatives considered

### 1. Keep `allowedTypes`/`simpleOnly` and just add server flags

**Rejected:** does not remove the overlapping surfaces or the client-side 200-cap filtering; the refactor intent is one declarative path.

### 2. Enforce STORABLE-only strictly for existing BOM lines too

**Rejected:** breaks editing of legacy BOMs containing subassemblies. Block-only-new + audit is the chosen safe path.

### 3. Keep `context="sale"` for the `canBeSold` path

**Rejected (partially):** `context` was ambiguous with `UoMSelector.context`. The boolean props are self-describing. `canBeSold` is kept for API symmetry despite being unused today.

## References

- `docs/20-contracts/component-selectors.md` — ProductSelector contract (updated)
- `frontend/components/selectors/ProductSelector.tsx` — implementation
- `frontend/features/inventory/hooks/useProductSearch.ts` — hook
- `backend/inventory/filters.py` — `product_type__in` lookup
- `backend/production/validators.py` — `validate_bom_line` new-line rules
- `backend/production/management/commands/audit_bom_line_types.py` — audit tooling
- `frontend/components/selectors/__tests__/ProductSelector.test.tsx` — regression suite
